import http from "node:http";
import mongoose from "mongoose";
import { Server } from "socket.io";
import { getConfig } from "./config.js";
import { initializeModels, Show } from "./models/index.js";
import { createApp, logger } from "./app.js";
import { expireHolds, publicSeats } from "./services/booking.js";
import { objectId } from "./middleware/security.js";
const config = getConfig();
await mongoose.connect(config.mongoUri);
await initializeModels();
let io;
const server = http.createServer(
  createApp(config, { to: (room) => io.to(room) }),
);
io = new Server(server, {
  cors: { origin: config.origin, credentials: true },
  allowRequest: (req, done) =>
    done(null, !req.headers.origin || req.headers.origin === config.origin),
});

io.on("connection", (socket) => {
  let lastJoin = 0;
  socket.on("show:join", async (id) => {
    if (
      typeof id !== "string" ||
      !objectId.test(id) ||
      Date.now() - lastJoin < 500
    )
      return;
    lastJoin = Date.now();
    try {
      if (!(await Show.exists({ _id: id, active: true }))) return;
      for (const room of socket.rooms)
        if (room.startsWith("show:")) socket.leave(room);
      await socket.join(`show:${id}`);
      socket.emit("seats:updated", { show: id, seats: await publicSeats(id) });
    } catch (err) {
      logger.error({ err }, "Socket join failed");
    }
  });
  socket.on("show:leave", (id) => {
    if (typeof id === "string" && objectId.test(id)) socket.leave(`show:${id}`);
  });
});
let running = false;
const timer = setInterval(async () => {
  if (running) return;
  running = true;
  try {
    await expireHolds(io);
  } catch (err) {
    logger.error({ err }, "Hold cleanup failed");
  } finally {
    running = false;
  }
}, 10000);
server.listen(config.port, () =>
  logger.info({ port: config.port }, "iMovies API ready"),
);
async function shutdown() {
  clearInterval(timer);
  io.close();
  server.close(async () => {
    await mongoose.disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
