import { z } from "zod";
const text = z.string().trim().min(1).max(200);
export const id = z.string().regex(/^[a-f\d]{24}$/i, "Invalid identifier");
export const registerSchema = z
  .object({
    name: text.max(80),
    email: z
      .string()
      .email()
      .max(200)
      .transform((s) => s.toLowerCase()),
    password: z
      .string()
      .min(10)
      .max(72)
      .refine(
        (value) => Buffer.byteLength(value, "utf8") <= 72,
        "Password must be at most 72 UTF-8 bytes",
      ),
  })
  .strict();
export const loginSchema = registerSchema.pick({ email: true, password: true });
export const movieSchema = z
  .object({
    title: text,
    synopsis: z.string().trim().min(10).max(5000),
    genres: z.array(text.max(40)).min(1).max(8),
    language: text.max(40),
    durationMinutes: z.number().int().min(1).max(600),
    certificate: text.max(10),
    releaseDate: z.string().datetime(),
    poster: z
      .union([
        z.literal(""),
        z
          .string()
          .url()
          .regex(/^https:\/\//),
      ])
      .default(""),
    color: z
      .string()
      .regex(/^#[a-f\d]{6}$/i)
      .default("#583b82"),
    active: z.boolean().default(true),
  })
  .strict();
export const theatreSchema = z
  .object({
    name: text,
    location: text,
    address: text.max(500),
    screen: text,
    rows: z.number().int().min(1).max(20),
    columns: z.number().int().min(1).max(20),
    active: z.boolean().default(true),
  })
  .strict();
export const showSchema = z
  .object({
    movie: id,
    theatre: id,
    startsAt: z.string().datetime(),
    price: z.number().int().min(100).max(1000000),
  })
  .strict();
export const holdSchema = z
  .object({
    show: id,
    seats: z
      .array(z.string().regex(/^[A-T](?:[1-9]|1\d|20)$/))
      .min(1)
      .max(8)
      .refine(
        (a) => new Set(a).size === a.length,
        "Duplicate seats are not allowed",
      ),
  })
  .strict();
export const paySchema = z
  .object({ outcome: z.enum(["success", "failure"]) })
  .strict();
