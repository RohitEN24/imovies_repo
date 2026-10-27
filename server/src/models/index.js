import mongoose from "mongoose";
const { Schema, model } = mongoose;
const ref = (name, required = true) => ({
  type: Schema.Types.ObjectId,
  ref: name,
  required,
});
const opts = { timestamps: true, strict: "throw" };
const user = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    tokenVersion: { type: Number, default: 0, select: false },
  },
  opts,
);
const movie = new Schema(
  {
    title: { type: String, required: true },
    synopsis: { type: String, required: true },
    genres: [String],
    language: { type: String, required: true },
    durationMinutes: { type: Number, required: true, min: 1 },
    certificate: { type: String, default: "U/A" },
    releaseDate: { type: Date, required: true },
    poster: { type: String, default: "" },
    color: { type: String, default: "#583b82" },
    catalogVersion: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  opts,
);
movie.index(
  { title: "text", synopsis: "text" },
  { default_language: "none", language_override: "textIndexLanguage" },
);
movie.index({ active: 1, language: 1, genres: 1 });
const theatre = new Schema(
  {
    name: { type: String, required: true },
    location: { type: String, required: true },
    address: { type: String, required: true },
    screen: { type: String, default: "Screen 1" },
    rows: { type: Number, required: true, min: 1, max: 20 },
    columns: { type: Number, required: true, min: 1, max: 20 },
    active: { type: Boolean, default: true },
    scheduleVersion: { type: Number, default: 0 },
  },
  opts,
);
theatre.index({ location: 1, active: 1 });
const show = new Schema(
  {
    movie: ref("Movie"),
    theatre: ref("Theatre"),
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    price: { type: Number, required: true, min: 1 },
    active: { type: Boolean, default: true },
    inventoryVersion: { type: Number, default: 0 },
  },
  opts,
);
show.index({ movie: 1, active: 1, startsAt: 1 });
show.index({ theatre: 1, startsAt: 1 });
const seat = new Schema(
  {
    show: ref("Show"),
    label: { type: String, required: true },
    booking: ref("Booking", false),
    expiresAt: Date,
    status: {
      type: String,
      enum: ["available", "held", "booked"],
      default: "available",
    },
  },
  opts,
);
seat.index({ show: 1, label: 1 }, { unique: true });
seat.index({ show: 1, status: 1, expiresAt: 1 });
const booking = new Schema(
  {
    user: ref("User"),
    show: ref("Show"),
    seats: [String],
    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    status: {
      type: String,
      enum: ["held", "confirmed", "cancelled", "expired", "failed"],
      default: "held",
    },
    expiresAt: { type: Date, required: true },
    reference: { type: String, required: true, unique: true },
  },
  opts,
);
booking.index({ user: 1, createdAt: -1 });
booking.index({ status: 1, expiresAt: 1 });
booking.index({ show: 1, status: 1 });
const payment = new Schema(
  {
    booking: { ...ref("Booking"), unique: true },
    user: ref("User"),
    amount: Number,
    currency: { type: String, default: "INR" },
    provider: { type: String, default: "demo" },
    status: {
      type: String,
      enum: ["succeeded", "failed", "refunded"],
      required: true,
    },
    reference: { type: String, required: true, unique: true },
  },
  opts,
);
const notification = new Schema(
  {
    user: ref("User"),
    message: { type: String, required: true },
    booking: ref("Booking", false),
    read: { type: Boolean, default: false },
  },
  opts,
);
notification.index({ user: 1, createdAt: -1 });
export const User = model("User", user),
  Movie = model("Movie", movie),
  Theatre = model("Theatre", theatre),
  Show = model("Show", show),
  Seat = model("Seat", seat),
  Booking = model("Booking", booking),
  Payment = model("Payment", payment),
  Notification = model("Notification", notification);
export async function initializeModels() {
  await Promise.all(
    [User, Movie, Theatre, Show, Seat, Booking, Payment, Notification].map(
      (m) => m.init(),
    ),
  );
}
