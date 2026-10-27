import { Router } from "express";
import { Booking, Payment, Notification, Show } from "../models/index.js";
import {
  auth,
  validate,
  validId,
  pageArgs,
  ApiError,
} from "../middleware/security.js";
import { holdSchema, paySchema } from "../validation.js";
import {
  holdSeats,
  settleDemo,
  cancelBooking,
  emitSeats,
} from "../services/booking.js";
export default function bookingRoutes(config, io) {
  const r = Router();
  r.use(auth(config));
  r.post("/bookings", validate(holdSchema), async (req, res) => {
    const b = await holdSeats(req.user.id, req.validated, config);
    await emitSeats(io, b.show);
    res.status(201).json(b);
  });
  r.get("/bookings", async (req, res) => {
    const { page, limit, skip } = pageArgs(req.query),
      filter = { user: req.user.id };
    if (["upcoming", "past"].includes(req.query.period)) {
      const now = new Date(),
        shows = await Show.find({ startsAt: { $gt: now } }).distinct("_id");
      const upcoming = {
        show: { $in: shows },
        $or: [
          { status: "confirmed" },
          { status: "held", expiresAt: { $gt: now } },
        ],
      };
      if (req.query.period === "upcoming") Object.assign(filter, upcoming);
      else filter.$nor = [upcoming];
    }
    const [items, total] = await Promise.all([
      Booking.find(filter)
        .populate({ path: "show", populate: ["movie", "theatre"] })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Booking.countDocuments(filter),
    ]);
    res.json({ items, total, page, pages: Math.ceil(total / limit) });
  });
  r.get("/bookings/:id", async (req, res) => {
    const b = await Booking.findOne({
      _id: validId(req.params.id),
      user: req.user.id,
    }).populate({ path: "show", populate: ["movie", "theatre"] });
    if (!b) throw new ApiError(404, "Booking not found");
    res.json({ booking: b, payment: await Payment.findOne({ booking: b.id }) });
  });
  r.post("/bookings/:id/pay-demo", validate(paySchema), async (req, res) => {
    const b = await settleDemo(
      req.user.id,
      req.params.id,
      req.validated.outcome,
      config,
    );
    await emitSeats(io, b.show);
    res.json(b);
  });
  r.post("/bookings/:id/cancel", async (req, res) => {
    const b = await cancelBooking(req.user.id, req.params.id, config);
    await emitSeats(io, b.show);
    res.json(b);
  });
  // DELETE is a lifecycle cancellation, not destructive removal of financial history.
  r.delete("/bookings/:id", async (req, res) => {
    const b = await cancelBooking(req.user.id, req.params.id, config);
    await emitSeats(io, b.show);
    res.json(b);
  });
  r.get("/notifications", async (req, res) => {
    const { skip, limit } = pageArgs(req.query);
    res.json(
      await Notification.find({ user: req.user.id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
    );
  });
  r.patch("/notifications/:id/read", async (req, res) => {
    const n = await Notification.findOneAndUpdate(
      { _id: validId(req.params.id), user: req.user.id },
      { $set: { read: true } },
      { new: true },
    );
    if (!n) throw new ApiError(404, "Notification not found");
    res.json(n);
  });
  return r;
}
