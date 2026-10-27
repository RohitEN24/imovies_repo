import { test } from "node:test";
import assert from "node:assert/strict";
import { holdSchema, movieSchema, registerSchema } from "../src/validation.js";
import { labelsFor } from "../src/services/booking.js";
import { getConfig } from "../src/config.js";
const show = "012345678901234567890123";
test("seat requests reject duplicates, invalid labels and more than eight seats", () => {
  assert.equal(
    holdSchema.safeParse({ show, seats: ["A1", "A1"] }).success,
    false,
  );
  assert.equal(holdSchema.safeParse({ show, seats: ["Z1"] }).success, false);
  assert.equal(
    holdSchema.safeParse({
      show,
      seats: Array.from({ length: 9 }, (_, i) => `A${i + 1}`),
    }).success,
    false,
  );
  assert.equal(
    holdSchema.safeParse({ show, seats: ["A1", "B2"] }).success,
    true,
  );
});
test("clients cannot assign themselves an admin role", () => {
  assert.equal(
    registerSchema.safeParse({
      name: "Admin",
      email: "admin@example.com",
      password: "password1234",
      role: "admin",
    }).success,
    false,
  );
});
test("inventory labels cover theatre dimensions with no duplicates", () => {
  const labels = labelsFor(20, 20);
  assert.equal(labels.length, 400);
  assert.equal(new Set(labels).size, 400);
  assert.equal(labels.at(-1), "T20");
});
test("configuration rejects weak secrets and production demo payments", () => {
  assert.throws(() => getConfig({ JWT_SECRET: "short" }));
  assert.throws(() =>
    getConfig({
      JWT_SECRET: "x".repeat(40),
      MONGODB_URI: "mongodb://localhost",
      NODE_ENV: "production",
      PAYMENT_MODE: "demo",
    }),
  );
});
test("passwords cannot silently exceed bcrypt UTF-8 byte limits", () => {
  assert.equal(
    registerSchema.safeParse({
      name: "Tester",
      email: "x@example.com",
      password: "🎬".repeat(20),
    }).success,
    false,
  );
});
