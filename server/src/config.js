import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
dotenv.config({ path: fileURLToPath(new URL("../.env", import.meta.url)) });
export function getConfig(env = process.env) {
  if (
    !env.JWT_SECRET ||
    env.JWT_SECRET.length < 32 ||
    env.JWT_SECRET.startsWith("replace-")
  )
    throw new Error(
      "Set JWT_SECRET to a random secret of at least 32 characters",
    );
  if (!env.MONGODB_URI)
    throw new Error("MONGODB_URI is required (replica set or Atlas)");
  if (env.NODE_ENV === "production" && env.PAYMENT_MODE === "demo")
    throw new Error(
      "Demo payments are disabled in production; integrate a verified payment provider first",
    );
  const holdMinutes = Number(env.HOLD_MINUTES || 5),
    cancelMinutes = Number(env.CANCEL_BEFORE_MINUTES || 60);
  if (
    !Number.isFinite(holdMinutes) ||
    holdMinutes < 1 ||
    holdMinutes > 15 ||
    !Number.isFinite(cancelMinutes) ||
    cancelMinutes < 0
  )
    throw new Error("Invalid booking time configuration");
  return {
    port: Number(env.PORT || 5000),
    mongoUri: env.MONGODB_URI,
    secret: env.JWT_SECRET,
    origin: env.CLIENT_ORIGIN || "http://localhost:5173",
    production: env.NODE_ENV === "production",
    demo: env.PAYMENT_MODE === "demo",
    holdMinutes,
    cancelMinutes,
  };
}
