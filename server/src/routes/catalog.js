import { Router } from "express";
import { Movie, Show, Theatre } from "../models/index.js";
import { validId, pageArgs, ApiError } from "../middleware/security.js";
import { publicSeats } from "../services/booking.js";
const escaped = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export default function catalogRoutes() {
  const r = Router();
  r.get("/filters", async (req, res) => {
    const [genres, languages] = await Promise.all([
      Movie.distinct("genres", { active: true }),
      Movie.distinct("language", { active: true }),
    ]);
    res.json({ genres: genres.sort(), languages: languages.sort() });
  });
  r.get("/movies", async (req, res) => {
    const { page, limit, skip } = pageArgs(req.query),
      q = req.query;
    const filter = { active: true };
    if (q.q) {
      if (typeof q.q !== "string" || q.q.length > 100)
        throw new ApiError(400, "Invalid search");
      filter.title = { $regex: escaped(q.q), $options: "i" };
    }
    for (const key of ["genre", "language"])
      if (q[key]) {
        if (typeof q[key] !== "string" || q[key].length > 80)
          throw new ApiError(400, "Invalid filter");
        filter[key === "genre" ? "genres" : key] = q[key];
      }
    if (q.location || q.theatre || q.date) {
      const sf = { active: true, startsAt: { $gt: new Date() } };
      if (q.location) {
        if (typeof q.location !== "string" || q.location.length > 100)
          throw new ApiError(400, "Invalid location");
        sf.theatre = {
          $in: await Theatre.find({
            active: true,
            location: { $regex: escaped(q.location), $options: "i" },
          }).distinct("_id"),
        };
      }
      if (q.theatre) {
        const theatreId = validId(q.theatre);
        if (
          sf.theatre &&
          !sf.theatre.$in.some((id) => String(id) === theatreId)
        )
          sf.theatre = { $in: [] };
        else sf.theatre = theatreId;
      }
      if (q.date) {
        if (
          typeof q.date !== "string" ||
          !/^\d{4}-\d{2}-\d{2}$/.test(q.date) ||
          Number.isNaN(Date.parse(q.date))
        )
          throw new ApiError(400, "Date must be YYYY-MM-DD");
        const start = new Date(`${q.date}T00:00:00+05:30`),
          end = new Date(start.getTime() + 86400000);
        sf.startsAt = {
          $gte: new Date(Math.max(start.getTime(), Date.now())),
          $lt: end,
        };
      }
      filter._id = { $in: await Show.find(sf).distinct("movie") };
    }
    const [items, total] = await Promise.all([
      Movie.find(filter)
        .sort({ releaseDate: -1, _id: 1 })
        .skip(skip)
        .limit(limit),
      Movie.countDocuments(filter),
    ]);
    res.json({ items, total, page, pages: Math.ceil(total / limit) });
  });
  r.get("/movies/:id", async (req, res) => {
    const movie = await Movie.findOne({
      _id: validId(req.params.id),
      active: true,
    });
    if (!movie) throw new ApiError(404, "Movie not found");
    res.json(movie);
  });
  r.get("/theatres", async (req, res) =>
    res.json(
      await Theatre.find({ active: true })
        .sort({ location: 1, name: 1 })
        .limit(200),
    ),
  );
  r.get("/shows", async (req, res) => {
    const filter = { active: true, startsAt: { $gt: new Date() } };
    if (req.query.movie) filter.movie = validId(req.query.movie);
    if (req.query.location) {
      if (
        typeof req.query.location !== "string" ||
        req.query.location.length > 100
      )
        throw new ApiError(400, "Invalid location");
      filter.theatre = {
        $in: await Theatre.find({
          active: true,
          location: { $regex: escaped(req.query.location), $options: "i" },
        }).distinct("_id"),
      };
    }
    if (req.query.theatre) {
      const theatreId = validId(req.query.theatre);
      if (
        filter.theatre &&
        !filter.theatre.$in.some((id) => String(id) === theatreId)
      )
        filter.theatre = { $in: [] };
      else filter.theatre = theatreId;
    }
    if (req.query.date) {
      const date = req.query.date;
      if (
        typeof date !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        Number.isNaN(Date.parse(date))
      )
        throw new ApiError(400, "Date must be YYYY-MM-DD");
      const start = new Date(`${date}T00:00:00+05:30`);
      filter.startsAt = {
        $gte: new Date(Math.max(start.getTime(), Date.now())),
        $lt: new Date(start.getTime() + 86400000),
      };
    }
    const { page, limit, skip } = pageArgs(req.query);
    const [items, total] = await Promise.all([
      Show.find(filter)
        .populate("movie theatre")
        .sort({ startsAt: 1 })
        .skip(skip)
        .limit(limit),
      Show.countDocuments(filter),
    ]);
    res.json({ items, total, page, pages: Math.ceil(total / limit) });
  });
  r.get("/shows/:id", async (req, res) => {
    const show = await Show.findOne({
      _id: validId(req.params.id),
      active: true,
    }).populate("movie theatre");
    if (!show) throw new ApiError(404, "Show not found");
    res.json({ show, seats: await publicSeats(show.id) });
  });
  return r;
}
