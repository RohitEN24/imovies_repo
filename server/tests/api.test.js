import { before, after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import request from "supertest";
import { createApp } from "../src/app.js";
import {
  User,
  Movie,
  Theatre,
  Show,
  Seat,
  Booking,
  Payment,
  Notification,
  initializeModels,
} from "../src/models/index.js";
import { saveShow } from "../src/services/catalog.js";
import { expireHolds } from "../src/services/booking.js";
const config = {
  secret: "test-only-random-secret-at-least-32-characters",
  origin: "http://localhost:5173",
  production: false,
  demo: true,
  holdMinutes: 5,
  cancelMinutes: 60,
};
let db, app, user, other, admin, movie, theatre, show;
const movieData = {
  title: "Test Orbit",
  synopsis: "A very interesting space adventure.",
  genres: ["Sci-Fi"],
  language: "English",
  durationMinutes: 120,
  certificate: "U/A",
  releaseDate: "2026-01-01T00:00:00.000Z",
  poster: "",
  color: "#583b82",
  active: true,
};
before(async () => {
  db = await MongoMemoryReplSet.create({
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
  await mongoose.connect(db.getUri());
  await initializeModels();
  app = createApp(config);
});
after(async () => {
  await mongoose.disconnect();
  await db?.stop();
});
async function register(agent, email) {
  return agent
    .post("/api/auth/register")
    .send({ name: "Test User", email, password: "Password123!" })
    .expect(201);
}
beforeEach(async () => {
  app = createApp(config);
  await Promise.all(
    [User, Movie, Theatre, Show, Seat, Booking, Payment, Notification].map(
      (m) => m.deleteMany({}),
    ),
  );
  user = request.agent(app);
  other = request.agent(app);
  admin = request.agent(app);
  await register(user, "user@example.com");
  await register(other, "other@example.com");
  await register(admin, "admin@example.com");
  await User.updateOne(
    { email: "admin@example.com" },
    { $set: { role: "admin" } },
  );
  movie = await Movie.create(movieData);
  theatre = await Theatre.create({
    name: "Central",
    location: "Bengaluru",
    address: "Test street",
    screen: "Screen 1",
    rows: 4,
    columns: 8,
  });
  show = await saveShow(null, {
    movie: movie.id,
    theatre: theatre.id,
    startsAt: new Date(Date.now() + 86400000).toISOString(),
    price: 25000,
  });
});
const hold = (agent, seats = ["A1"]) =>
  agent.post("/api/bookings").send({ show: show.id, seats });
test("registration, login, cookie protection and logout invalidation", async () => {
  await request(app).get("/api/auth/me").expect(401);
  await user.get("/api/auth/me").expect(200);
  await request(app)
    .post("/api/auth/login")
    .send({ email: "user@example.com", password: "Incorrect123!" })
    .expect(401);
  const login = await request(app)
    .post("/api/auth/login")
    .send({ email: "user@example.com", password: "Password123!" })
    .expect(200);
  const cookie = login.headers["set-cookie"][0];
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  await user.post("/api/auth/logout").expect(200);
  await request(app).get("/api/auth/me").set("Cookie", cookie).expect(401);
});
test("duplicate accounts and unauthorized role assignment rejected", async () => {
  await user
    .post("/api/auth/register")
    .send({
      name: "Duplicate",
      email: "user@example.com",
      password: "Password123!",
    })
    .expect(409);
  await request(app)
    .post("/api/auth/register")
    .send({
      name: "X",
      email: "evil@example.com",
      password: "Password123!",
      role: "admin",
    })
    .expect(400);
});
test("admin authorization and CSRF origin checks", async () => {
  await user.get("/api/admin/stats").expect(403);
  await admin.get("/api/admin/stats").expect(200);
  await user
    .post("/api/bookings")
    .set("Origin", "https://evil.example")
    .send({ show: show.id, seats: ["A1"] })
    .expect(403);
});
test("movie CRUD preserves historical references", async () => {
  const created = await admin
    .post("/api/admin/movies")
    .send({ ...movieData, title: "Another Film", language: "Hindi" })
    .expect(201);
  const id = created.body._id;
  await admin
    .put(`/api/admin/movies/${id}`)
    .send({ ...movieData, title: "Changed Film" })
    .expect(200);
  const read = await user.get(`/api/movies/${id}`).expect(200);
  assert.equal(read.body.title, "Changed Film");
  await admin.delete(`/api/admin/movies/${id}`).expect(200);
  await user.get(`/api/movies/${id}`).expect(404);
  assert.ok(await Movie.findById(id));
});
test("search combines genre, language, location, theatre and date", async () => {
  const result = await request(app)
    .get("/api/movies")
    .query({
      q: "Orbit",
      genre: "Sci-Fi",
      language: "English",
      location: "Bengaluru",
      theatre: theatre.id,
    })
    .expect(200);
  assert.equal(result.body.total, 1);
  const mismatch = await request(app)
    .get("/api/movies")
    .query({ location: "Pune", theatre: theatre.id })
    .expect(200);
  assert.equal(mismatch.body.total, 0);
  const empty = await request(app)
    .get("/api/movies")
    .query({ language: "Hindi" })
    .expect(200);
  assert.equal(empty.body.total, 0);
  await request(app).get("/api/movies").query({ date: "bad" }).expect(400);
});
test("concurrent holds cannot allocate a seat twice", async () => {
  const results = await Promise.all([
    hold(user, ["A1", "A2"]),
    hold(other, ["A1", "A2"]),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  assert.equal(await Booking.countDocuments(), 1);
  assert.equal(await Seat.countDocuments({ status: "held" }), 2);
});
test("partial conflicts roll back every seat and booking", async () => {
  await hold(user, ["A1"]).expect(201);
  await hold(other, ["A1", "A2"]).expect(409);
  assert.equal(
    (await Seat.findOne({ show: show.id, label: "A2" })).status,
    "available",
  );
  assert.equal(await Booking.countDocuments(), 1);
});
test("seat validation rejects non-existent, duplicate and over-limit requests", async () => {
  await hold(user, ["T20"]).expect(409);
  await hold(user, ["A1", "A1"]).expect(400);
  await hold(
    user,
    Array.from({ length: 9 }, (_, i) => `B${i + 1}`),
  ).expect(400);
});
test("payment uses server prices, confirms once, and hides booking from other users", async () => {
  const held = await hold(user, ["A1", "A2"]).expect(201);
  const id = held.body._id;
  assert.equal(held.body.amount, 50000);
  await other.get(`/api/bookings/${id}`).expect(404);
  await other
    .post(`/api/bookings/${id}/pay-demo`)
    .send({ outcome: "success" })
    .expect(404);
  await user
    .post(`/api/bookings/${id}/pay-demo`)
    .send({ outcome: "success", amount: 1 })
    .expect(400);
  await user
    .post(`/api/bookings/${id}/pay-demo`)
    .send({ outcome: "success" })
    .expect(200);
  await user
    .post(`/api/bookings/${id}/pay-demo`)
    .send({ outcome: "success" })
    .expect(200);
  assert.equal(await Payment.countDocuments(), 1);
  assert.equal(await Seat.countDocuments({ status: "booked" }), 2);
});
test("payment failure releases seats and creates a failed payment", async () => {
  const b = (await hold(user).expect(201)).body;
  const result = await user
    .post(`/api/bookings/${b._id}/pay-demo`)
    .send({ outcome: "failure" })
    .expect(200);
  assert.equal(result.body.status, "failed");
  assert.equal((await Seat.findOne({ label: "A1" })).status, "available");
  assert.equal((await Payment.findOne()).status, "failed");
});
test("expired hold cannot pay; cleanup never frees seats reclaimed by another booking", async () => {
  const a = (await hold(user).expect(201)).body;
  await Booking.updateOne(
    { _id: a._id },
    { $set: { expiresAt: new Date(Date.now() - 1000) } },
  );
  await Seat.updateMany(
    { booking: a._id },
    { $set: { expiresAt: new Date(Date.now() - 1000) } },
  );
  await user
    .post(`/api/bookings/${a._id}/pay-demo`)
    .send({ outcome: "success" })
    .expect(409);
  const b = (await hold(other).expect(201)).body;
  await expireHolds();
  assert.equal((await Booking.findById(a._id)).status, "expired");
  assert.equal(String((await Seat.findOne({ label: "A1" })).booking), b._id);
});
test("cancellation is idempotent, releases seats and marks demo refund", async () => {
  const b = (await hold(user).expect(201)).body;
  await user
    .post(`/api/bookings/${b._id}/pay-demo`)
    .send({ outcome: "success" })
    .expect(200);
  await user.post(`/api/bookings/${b._id}/cancel`).expect(200);
  await user.delete(`/api/bookings/${b._id}`).expect(200);
  assert.equal((await Payment.findOne()).status, "refunded");
  assert.equal((await Seat.findOne({ label: "A1" })).status, "available");
});
test("late cancellation is rejected", async () => {
  const b = (await hold(user).expect(201)).body;
  await user
    .post(`/api/bookings/${b._id}/pay-demo`)
    .send({ outcome: "success" })
    .expect(200);
  await Show.updateOne(
    { _id: show.id },
    { $set: { startsAt: new Date(Date.now() + 30 * 60000) } },
  );
  await user.post(`/api/bookings/${b._id}/cancel`).expect(409);
});
test("shows block overlaps and edits with active bookings", async () => {
  const body = {
    movie: movie.id,
    theatre: theatre.id,
    startsAt: show.startsAt.toISOString(),
    price: 25000,
  };
  await admin.post("/api/admin/shows").send(body).expect(409);
  await hold(user).expect(201);
  await admin.put(`/api/admin/shows/${show.id}`).send(body).expect(409);
  await admin.delete(`/api/admin/shows/${show.id}`).expect(409);
  await admin.delete(`/api/admin/movies/${movie.id}`).expect(409);
});
test("theatre and show CRUD, inventory rebuild and archival", async () => {
  const t = (
    await admin
      .post("/api/admin/theatres")
      .send({
        name: "West",
        location: "Pune",
        address: "West road",
        screen: "One",
        rows: 2,
        columns: 4,
        active: true,
      })
      .expect(201)
  ).body;
  await admin
    .put(`/api/admin/theatres/${t._id}`)
    .send({
      name: "West Updated",
      location: "Pune",
      address: "West road",
      screen: "One",
      rows: 3,
      columns: 4,
      active: true,
    })
    .expect(200);
  const input = {
    movie: movie.id,
    theatre: t._id,
    startsAt: new Date(Date.now() + 2 * 86400000).toISOString(),
    price: 18000,
  };
  const s = (await admin.post("/api/admin/shows").send(input).expect(201)).body;
  assert.equal(await Seat.countDocuments({ show: s._id }), 12);
  await admin
    .put(`/api/admin/shows/${s._id}`)
    .send({ ...input, price: 20000 })
    .expect(200);
  await admin.delete(`/api/admin/shows/${s._id}`).expect(200);
  await admin.delete(`/api/admin/theatres/${t._id}`).expect(200);
});
test("booking history paginates and notifications are user scoped", async () => {
  const b = (await hold(user).expect(201)).body;
  await user.post(`/api/bookings/${b._id}/cancel`).expect(200);
  const history = await user.get("/api/bookings?limit=1").expect(200);
  assert.equal(history.body.total, 1);
  assert.equal((await other.get("/api/bookings").expect(200)).body.total, 0);
  const n = (await user.get("/api/notifications").expect(200)).body[0];
  await other.patch(`/api/notifications/${n._id}/read`).expect(404);
  await user.patch(`/api/notifications/${n._id}/read`).expect(200);
});
test("upcoming and past booking filters apply before pagination", async () => {
  const b = (await hold(user).expect(201)).body;
  assert.equal(
    (await user.get("/api/bookings?period=upcoming").expect(200)).body.total,
    1,
  );
  await user.post(`/api/bookings/${b._id}/cancel`).expect(200);
  assert.equal(
    (await user.get("/api/bookings?period=upcoming").expect(200)).body.total,
    0,
  );
  assert.equal(
    (await user.get("/api/bookings?period=past").expect(200)).body.total,
    1,
  );
});
test("rate limiting rejects repeated auth requests", async () => {
  for (let i = 0; i < 27; i++)
    await request(app).post("/api/auth/login").send({}).expect(400);
  await request(app).post("/api/auth/login").send({}).expect(429);
});
test("seat snapshot events omit customer and booking identity", async () => {
  const { emitSeats } = await import("../src/services/booking.js");
  await hold(user).expect(201);
  let captured;
  await emitSeats(
    {
      to(room) {
        assert.equal(room, `show:${show.id}`);
        return {
          emit(event, payload) {
            captured = { event, payload };
          },
        };
      },
    },
    show.id,
  );
  assert.equal(captured.event, "seats:updated");
  const seat = captured.payload.seats.find((s) => s.label === "A1");
  assert.equal(seat.status, "held");
  assert.deepEqual(Object.keys(seat).sort(), ["expiresAt", "label", "status"]);
});
test("show date filtering uses IST and rejects mismatched location/theatre", async () => {
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(show.startsAt);
  const result = await request(app)
    .get("/api/shows")
    .query({ date, movie: movie.id })
    .expect(200);
  assert.equal(result.body.total, 1);
  const mismatch = await request(app)
    .get("/api/shows")
    .query({ location: "Pune", theatre: theatre.id })
    .expect(200);
  assert.equal(mismatch.body.total, 0);
});
test("filter options include admin-defined genres and languages", async () => {
  await Movie.create({
    ...movieData,
    title: "Fantasy Tale",
    genres: ["Fantasy"],
    language: "Marathi",
  });
  const result = await request(app).get("/api/filters").expect(200);
  assert.ok(result.body.genres.includes("Fantasy"));
  assert.ok(result.body.languages.includes("Marathi"));
});
