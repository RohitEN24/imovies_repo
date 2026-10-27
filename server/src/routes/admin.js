import { Router } from "express";
import { Movie, Theatre, Show, Booking, Payment } from "../models/index.js";
import {
  auth,
  admin,
  validate,
  validId,
  pageArgs,
  ApiError,
} from "../middleware/security.js";
import { movieSchema, theatreSchema, showSchema } from "../validation.js";
import { transaction, emitSeats } from "../services/booking.js";
import { saveShow, retireShow } from "../services/catalog.js";
export default function adminRoutes(config, io) {
  const r = Router();
  r.use(auth(config), admin);
  r.get("/stats", async (req, res) => {
    const [movies, theatres, shows, bookings, revenue] = await Promise.all([
      Movie.countDocuments({ active: true }),
      Theatre.countDocuments({ active: true }),
      Show.countDocuments({ active: true, startsAt: { $gt: new Date() } }),
      Booking.countDocuments({ status: "confirmed" }),
      Payment.aggregate([
        { $match: { status: "succeeded" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
    ]);
    res.json({
      movies,
      theatres,
      shows,
      bookings,
      revenue: revenue[0]?.total || 0,
    });
  });
  for (const [path, Model, schema, version] of [
    ["movies", Movie, movieSchema, "catalogVersion"],
    ["theatres", Theatre, theatreSchema, "scheduleVersion"],
  ]) {
    r.get(`/${path}`, async (req, res) => {
      const { page, limit, skip } = pageArgs(req.query);
      res.json({
        items: await Model.find()
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        total: await Model.countDocuments(),
        page,
      });
    });
    r.post(`/${path}`, validate(schema), async (req, res) =>
      res.status(201).json(await Model.create(req.validated)),
    );
    r.put(`/${path}/:id`, validate(schema), async (req, res) => {
      const id = validId(req.params.id);
      const item = await transaction(async (session) => {
        const current = await Model.findByIdAndUpdate(
          id,
          { $inc: { [version]: 1 } },
          { session, new: true },
        );
        if (!current) throw new ApiError(404, "Record not found");
        const relevant = await Show.find({
          [path === "movies" ? "movie" : "theatre"]: id,
          active: true,
          endsAt: { $gt: new Date() },
        }).session(session);
        if (relevant.length)
          throw new ApiError(
            409,
            "Remove future shows before editing this record",
          );
        Object.assign(current, req.validated);
        return current.save({ session });
      });
      res.json(item);
    });
    r.delete(`/${path}/:id`, async (req, res) => {
      const id = validId(req.params.id);
      await transaction(async (session) => {
        const current = await Model.findByIdAndUpdate(
          id,
          { $inc: { [version]: 1 } },
          { session, new: true },
        );
        if (!current) throw new ApiError(404, "Record not found");
        if (
          await Show.exists({
            [path === "movies" ? "movie" : "theatre"]: id,
            active: true,
            endsAt: { $gt: new Date() },
          }).session(session)
        )
          throw new ApiError(409, "Remove future shows first");
        current.active = false;
        await current.save({ session });
      });
      res.json({ message: "Archived; historical references preserved" });
    });
  }
  r.get("/shows", async (req, res) => {
    const { page, limit, skip } = pageArgs(req.query);
    res.json({
      items: await Show.find()
        .populate("movie theatre")
        .sort({ startsAt: -1 })
        .skip(skip)
        .limit(limit),
      total: await Show.countDocuments(),
      page,
    });
  });
  r.post("/shows", validate(showSchema), async (req, res) =>
    res.status(201).json(await saveShow(null, req.validated)),
  );
  r.put("/shows/:id", validate(showSchema), async (req, res) => {
    const s = await saveShow(validId(req.params.id), req.validated);
    await emitSeats(io, s.id);
    res.json(s);
  });
  r.delete("/shows/:id", async (req, res) => {
    const s = await retireShow(validId(req.params.id));
    await emitSeats(io, s.id);
    res.json({ message: "Show archived" });
  });
  r.get("/bookings", async (req, res) => {
    const { page, limit, skip } = pageArgs(req.query);
    res.json({
      items: await Booking.find()
        .populate("user", "name email")
        .populate({ path: "show", populate: ["movie", "theatre"] })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      total: await Booking.countDocuments(),
      page,
    });
  });
  return r;
}
