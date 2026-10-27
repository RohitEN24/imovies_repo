import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { Booking, Show, Seat, Payment, Notification } from "../models/index.js";
import { ApiError, validId } from "../middleware/security.js";
export async function transaction(fn) {
  return mongoose.connection.transaction(fn, {
    readConcern: { level: "snapshot" },
    writeConcern: { w: "majority" },
  });
}
export const labelsFor = (rows, columns) =>
  Array.from({ length: rows }, (_, r) =>
    Array.from(
      { length: columns },
      (_, c) => `${String.fromCharCode(65 + r)}${c + 1}`,
    ),
  ).flat();
export async function publicSeats(showId) {
  return (
    await Seat.find({ show: showId }).select("label status expiresAt").lean()
  ).map((s) => ({
    label: s.label,
    status:
      s.status === "held" && s.expiresAt <= new Date() ? "available" : s.status,
    expiresAt: s.status === "held" ? s.expiresAt : null,
  }));
}
export async function emitSeats(io, showId) {
  io?.to(`show:${showId}`).emit("seats:updated", {
    show: String(showId),
    seats: await publicSeats(showId),
  });
}
export async function holdSeats(userId, input, config) {
  return transaction(async (session) => {
    const now = new Date(),
      expiresAt = new Date(now.getTime() + config.holdMinutes * 60000);
    const show = await Show.findOneAndUpdate(
      { _id: input.show, active: true, startsAt: { $gt: now } },
      { $inc: { inventoryVersion: 1 } },
      { new: true, session },
    );
    if (!show)
      throw new ApiError(409, "Show is unavailable or has already started");
    const bookingId = new mongoose.Types.ObjectId();
    const result = await Seat.updateMany(
      {
        show: show.id,
        label: { $in: input.seats },
        $or: [
          { status: "available" },
          { status: "held", expiresAt: { $lte: now } },
        ],
      },
      { $set: { booking: bookingId, status: "held", expiresAt } },
      { session },
    );
    if (result.modifiedCount !== input.seats.length)
      throw new ApiError(
        409,
        "Some seats were just taken. Choose available seats again.",
      );
    const [booking] = await Booking.create(
      [
        {
          _id: bookingId,
          user: userId,
          show: show.id,
          seats: input.seats,
          amount: show.price * input.seats.length,
          expiresAt,
          reference: `IM-${randomUUID().slice(0, 12).toUpperCase()}`,
        },
      ],
      { session },
    );
    return booking;
  });
}
export async function settleDemo(userId, bookingId, outcome, config) {
  if (!config.demo) throw new ApiError(503, "No payment provider configured");
  validId(bookingId);
  return transaction(async (session) => {
    const b = await Booking.findOne({ _id: bookingId, user: userId }).session(
      session,
    );
    if (!b) throw new ApiError(404, "Booking not found");
    if (b.status === "confirmed") return b; // Retrying never charges or creates a second payment.
    if (b.status !== "held") throw new ApiError(409, `Booking is ${b.status}`);
    const now = new Date();
    if (b.expiresAt <= now)
      throw new ApiError(409, "Seat hold expired. Please book again.");
    const show = await Show.findOneAndUpdate(
      { _id: b.show, active: true, startsAt: { $gt: now } },
      { $inc: { inventoryVersion: 1 } },
      { session, new: true },
    );
    if (!show) throw new ApiError(409, "Show is no longer available");
    const seats = await Seat.countDocuments({
      show: b.show,
      booking: b.id,
      status: "held",
      expiresAt: { $gt: now },
    }).session(session);
    if (seats !== b.seats.length)
      throw new ApiError(409, "Seat hold is no longer valid");
    b.status = outcome === "success" ? "confirmed" : "failed";
    await b.save({ session });
    await Seat.updateMany(
      { booking: b.id },
      outcome === "success"
        ? { $set: { status: "booked" }, $unset: { expiresAt: 1 } }
        : {
            $set: { status: "available" },
            $unset: { booking: 1, expiresAt: 1 },
          },
      { session },
    );
    await Payment.create(
      [
        {
          booking: b.id,
          user: userId,
          amount: b.amount,
          status: outcome === "success" ? "succeeded" : "failed",
          reference: `DEMO-${randomUUID()}`,
        },
      ],
      { session },
    );
    await Notification.create(
      [
        {
          user: userId,
          booking: b.id,
          message:
            outcome === "success"
              ? `Booking ${b.reference} confirmed.`
              : `Demo payment failed for ${b.reference}. Seats released.`,
        },
      ],
      { session },
    );
    return b;
  });
}
export async function cancelBooking(userId, bookingId, config) {
  validId(bookingId);
  return transaction(async (session) => {
    const b = await Booking.findOne({ _id: bookingId, user: userId }).session(
      session,
    );
    if (!b) throw new ApiError(404, "Booking not found");
    if (b.status === "cancelled") return b;
    if (!["confirmed", "held"].includes(b.status))
      throw new ApiError(409, `Cannot cancel a ${b.status} booking`);
    const show = await Show.findByIdAndUpdate(
      b.show,
      { $inc: { inventoryVersion: 1 } },
      { session, new: true },
    );
    if (!show) throw new ApiError(404, "Show not found");
    if (
      b.status === "confirmed" &&
      show.startsAt.getTime() - Date.now() < config.cancelMinutes * 60000
    )
      throw new ApiError(
        409,
        `Cancel at least ${config.cancelMinutes} minutes before showtime`,
      );
    b.status = "cancelled";
    await b.save({ session });
    await Seat.updateMany(
      { booking: b.id },
      { $set: { status: "available" }, $unset: { booking: 1, expiresAt: 1 } },
      { session },
    );
    await Payment.updateOne(
      { booking: b.id, status: "succeeded" },
      { $set: { status: "refunded" } },
      { session },
    );
    await Notification.create(
      [
        {
          user: userId,
          booking: b.id,
          message: `Booking ${b.reference} cancelled. Any demo payment is marked refunded.`,
        },
      ],
      { session },
    );
    return b;
  });
}
export async function expireHolds(io) {
  const pending = await Booking.find({
    status: "held",
    expiresAt: { $lte: new Date() },
  })
    .limit(100)
    .select("_id show");
  for (const item of pending) {
    await transaction(async (session) => {
      const b = await Booking.findOneAndUpdate(
        { _id: item.id, status: "held", expiresAt: { $lte: new Date() } },
        { $set: { status: "expired" } },
        { session, new: true },
      );
      if (!b) return;
      await Show.updateOne(
        { _id: b.show },
        { $inc: { inventoryVersion: 1 } },
        { session },
      );
      // A reclaimed seat may already belong to a newer hold: never release it by label.
      await Seat.updateMany(
        { booking: b.id, status: "held" },
        { $set: { status: "available" }, $unset: { booking: 1, expiresAt: 1 } },
        { session },
      );
    });
    await emitSeats(io, item.show);
  }
}
