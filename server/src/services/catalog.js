import { Movie, Theatre, Show, Seat, Booking } from "../models/index.js";
import { transaction, labelsFor } from "./booking.js";
import { ApiError } from "../middleware/security.js";
export async function saveShow(id, input) {
  return transaction(async (session) => {
    const movie = await Movie.findOneAndUpdate(
      { _id: input.movie, active: true },
      { $inc: { catalogVersion: 1 } },
      { session, new: true },
    );
    if (!movie) throw new ApiError(400, "Choose an active movie");
    const theatre = await Theatre.findOneAndUpdate(
      { _id: input.theatre, active: true },
      { $inc: { scheduleVersion: 1 } },
      { session, new: true },
    );
    if (!theatre) throw new ApiError(400, "Choose an active theatre");
    const startsAt = new Date(input.startsAt),
      endsAt = new Date(
        startsAt.getTime() + (movie.durationMinutes + 20) * 60000,
      );
    if (startsAt <= new Date())
      throw new ApiError(400, "Showtime must be in the future");
    let existing;
    if (id) {
      existing = await Show.findByIdAndUpdate(
        id,
        { $inc: { inventoryVersion: 1 } },
        { session, new: true },
      );
      if (!existing) throw new ApiError(404, "Show not found");
      if (
        await Booking.exists({
          show: id,
          status: { $in: ["held", "confirmed"] },
        }).session(session)
      )
        throw new ApiError(409, "Cannot edit a show with active bookings");
      if (existing.theatre.toString() !== input.theatre)
        await Theatre.updateOne(
          { _id: existing.theatre },
          { $inc: { scheduleVersion: 1 } },
          { session },
        );
    }
    const clash = await Show.exists({
      theatre: theatre.id,
      active: true,
      startsAt: { $lt: endsAt },
      endsAt: { $gt: startsAt },
      ...(id ? { _id: { $ne: id } } : {}),
    }).session(session);
    if (clash)
      throw new ApiError(
        409,
        "This screen already has an overlapping show (includes 20 minutes turnaround)",
      );
    let show;
    if (id) {
      show = await Show.findByIdAndUpdate(
        id,
        { $set: { ...input, startsAt, endsAt } },
        { session, new: true },
      );
      await Seat.deleteMany({ show: id }).session(session);
    } else
      [show] = await Show.create([{ ...input, startsAt, endsAt }], { session });
    await Seat.insertMany(
      labelsFor(theatre.rows, theatre.columns).map((label) => ({
        show: show.id,
        label,
      })),
      { session },
    );
    return show;
  });
}
export async function retireShow(id) {
  return transaction(async (session) => {
    const show = await Show.findByIdAndUpdate(
      id,
      { $inc: { inventoryVersion: 1 } },
      { session, new: true },
    );
    if (!show) throw new ApiError(404, "Show not found");
    if (
      await Booking.exists({
        show: id,
        status: { $in: ["held", "confirmed"] },
      }).session(session)
    )
      throw new ApiError(
        409,
        "Cancel or finish existing bookings before removing this show",
      );
    show.active = false;
    await show.save({ session });
    return show;
  });
}
