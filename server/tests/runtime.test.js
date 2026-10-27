import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import net from "node:net";
import { fileURLToPath } from "node:url";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { io } from "socket.io-client";
const exec = promisify(execFile);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function nextEvent(socket, event, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const handler = (payload) => {
      if (predicate(payload)) {
        clearTimeout(timer);
        socket.off(event, handler);
        resolve(payload);
      }
    };
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timed out waiting for ${event}`));
    }, 8000);
    socket.on(event, handler);
  });
}
test("seed, actual API startup, live seat events, payment and cancellation work together", async () => {
  const db = await MongoMemoryReplSet.create({
    replSet: {
      count: 1,
      args: [
        "--nounixsocket",
        "--setParameter",
        "diagnosticDataCollectionEnabled=false",
      ],
    },
    binary: { version: "7.0.24" },
  });
  let child, socket;
  let logs = "";
  try {
    const allocator = net.createServer();
    await new Promise((resolve) => allocator.listen(0, "127.0.0.1", resolve));
    const port = allocator.address().port;
    await new Promise((resolve) => allocator.close(resolve));
    const env = {
      ...process.env,
      NODE_ENV: "test",
      MONGODB_URI: db.getUri(),
      PORT: String(port),
      JWT_SECRET: "runtime-test-only-secret-over-thirty-two-characters",
      CLIENT_ORIGIN: "http://localhost:5173",
      PAYMENT_MODE: "demo",
      SEED_ADMIN_EMAIL: "admin@imovies.local",
      SEED_ADMIN_PASSWORD: "TestAdminPassword123!",
      SEED_USER_PASSWORD: "TestUserPassword123!",
    };
    const cwd = fileURLToPath(new URL("..", import.meta.url));
    await exec(process.execPath, ["src/seed.js"], { cwd, env });
    child = spawn(process.execPath, ["src/index.js"], {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", (d) => (logs += d));
    child.stderr.on("data", (d) => (logs += d));
    const base = `http://127.0.0.1:${port}`;
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try {
        const result = await fetch(`${base}/api/health`);
        if (result.ok) {
          ready = true;
          break;
        }
      } catch {}
      await delay(100);
    }
    assert.ok(ready, logs);
    const login = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "user@imovies.local",
        password: env.SEED_USER_PASSWORD,
      }),
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie").split(";")[0];
    const shows = await (await fetch(`${base}/api/shows`)).json();
    assert.equal(shows.total, 32);
    const show = shows.items[0];
    socket = io(base, { autoConnect: false, transports: ["websocket"] });
    const connected = nextEvent(socket, "connect");
    socket.connect();
    await connected;
    let event = nextEvent(socket, "seats:updated");
    socket.emit("show:join", show._id);
    const snapshot = await event;
    assert.ok(snapshot.seats.every((s) => s.status === "available"));
    const post = async (path, body) => {
      const res = await fetch(`${base}/api${path}`, {
        method: "POST",
        headers: { Cookie: cookie, "Content-Type": "application/json" },
        body: JSON.stringify(body || {}),
      });
      return { status: res.status, body: await res.json() };
    };
    event = nextEvent(socket, "seats:updated", (p) =>
      p.seats.some((s) => s.label === "A1" && s.status === "held"),
    );
    const held = await post("/bookings", { show: show._id, seats: ["A1"] });
    assert.equal(held.status, 201, JSON.stringify(held.body));
    await event;
    event = nextEvent(socket, "seats:updated", (p) =>
      p.seats.some((s) => s.label === "A1" && s.status === "booked"),
    );
    const paid = await post(`/bookings/${held.body._id}/pay-demo`, {
      outcome: "success",
    });
    assert.equal(paid.status, 200);
    await event;
    event = nextEvent(socket, "seats:updated", (p) =>
      p.seats.some((s) => s.label === "A1" && s.status === "available"),
    );
    const cancelled = await post(`/bookings/${held.body._id}/cancel`);
    assert.equal(cancelled.status, 200);
    await event;
    assert.doesNotMatch(logs, /ERR_HTTP_HEADERS_SENT/);
  } finally {
    socket?.disconnect();
    if (child) {
      const exited = new Promise((resolve) => child.once("exit", resolve));
      child.kill("SIGTERM");
      await Promise.race([exited, delay(3000)]);
      if (child.exitCode === null) child.kill("SIGKILL");
    }
    await db.stop();
  }
});
