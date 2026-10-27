import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { getConfig } from "./config.js";
import { User, Movie, Theatre, initializeModels } from "./models/index.js";
import { saveShow } from "./services/catalog.js";
const config = getConfig();
await mongoose.connect(config.mongoUri);
await initializeModels();
try {
  if ((await Movie.countDocuments()) || (await User.countDocuments()))
    throw new Error(
      "Seed requires an empty database. No existing data was changed.",
    );
  const adminPassword = process.env.SEED_ADMIN_PASSWORD,
    userPassword = process.env.SEED_USER_PASSWORD;
  if (
    !adminPassword ||
    !userPassword ||
    Math.min(adminPassword.length, userPassword.length) < 10
  )
    throw new Error(
      "Set both SEED_ADMIN_PASSWORD and SEED_USER_PASSWORD (10+ characters)",
    );
  await User.create([
    {
      name: "Cinema Admin",
      email: process.env.SEED_ADMIN_EMAIL || "admin@imovies.local",
      password: await bcrypt.hash(adminPassword, 12),
      role: "admin",
    },
    {
      name: "Movie Lover",
      email: "user@imovies.local",
      password: await bcrypt.hash(userPassword, 12),
    },
  ]);
  const movies = await Movie.insertMany([
    {
      title: "The Last Orbit",
      synopsis:
        "A flight engineer receives a signal from a spacecraft that vanished twenty years ago. One final journey will change everything she knows about home.",
      genres: ["Sci-Fi", "Adventure"],
      language: "English",
      durationMinutes: 138,
      certificate: "U/A",
      releaseDate: new Date(),
      color: "#734cba",
    },
    {
      title: "Monsoon Letters",
      synopsis:
        "Two strangers exchange letters through an old bookshop in Bengaluru, discovering a shared past as the city welcomes its first rains.",
      genres: ["Romance", "Drama"],
      language: "Hindi",
      durationMinutes: 124,
      certificate: "U",
      releaseDate: new Date(),
      color: "#216e75",
    },
    {
      title: "Midnight Express",
      synopsis:
        "On the last train out of the city, a detective has ninety minutes to find a missing witness before the next station.",
      genres: ["Thriller", "Mystery"],
      language: "English",
      durationMinutes: 112,
      certificate: "U/A",
      releaseDate: new Date(),
      color: "#9e453f",
    },
    {
      title: "Namma Sundays",
      synopsis:
        "An unlikely neighbourhood cricket team comes together for one unforgettable season of friendship, second chances and Sunday sunshine.",
      genres: ["Comedy", "Drama"],
      language: "Kannada",
      durationMinutes: 130,
      certificate: "U",
      releaseDate: new Date(),
      color: "#af8033",
    },
  ]);
  const theatres = await Theatre.insertMany([
    {
      name: "iMovies Central",
      location: "Bengaluru",
      address: "Central Avenue, Bellandur",
      screen: "Screen 1 · Atmos",
      rows: 6,
      columns: 10,
    },
    {
      name: "iMovies Lakeside",
      location: "Bengaluru",
      address: "Lakeside Road, Whitefield",
      screen: "Screen 2 · 4K",
      rows: 5,
      columns: 8,
    },
  ]);
  for (let d = 1; d <= 4; d++)
    for (let t = 0; t < theatres.length; t++)
      for (let i = 0; i < movies.length; i++) {
        const day = new Date();
        day.setUTCDate(day.getUTCDate() + d);
        day.setUTCHours(4 + i * 4, 30, 0, 0);
        await saveShow(null, {
          movie: movies[i].id,
          theatre: theatres[t].id,
          startsAt: day.toISOString(),
          price: (220 + t * 80) * 100,
        });
      }
  console.log(
    "Seed complete. Demo movies and 32 future shows created. Use the credentials in server/.env.",
  );
} finally {
  await mongoose.disconnect();
}
