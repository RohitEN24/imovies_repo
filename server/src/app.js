import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import pino from "pino";
import pinoHttp from "pino-http";
import { ZodError } from "zod";
import { originGuard } from "./middleware/security.js";
import authRoutes from "./routes/auth.js";
import catalogRoutes from "./routes/catalog.js";
import bookingRoutes from "./routes/bookings.js";
import adminRoutes from "./routes/admin.js";
export const logger = pino({
  level:
    process.env.NODE_ENV === "test" || process.env.NODE_TEST_CONTEXT
      ? "silent"
      : "info",
  redact: [
    "req.headers.cookie",
    "req.headers.authorization",
    'res.headers["set-cookie"]',
  ],
});
export function createApp(config, io) {
  const app = express();
  app.disable("x-powered-by");
  app.use(
    helmet(),
    cors({ origin: config.origin, credentials: true }),
    express.json({ limit: "32kb" }),
    cookieParser(),
    pinoHttp({ logger }),
    originGuard(config),
  );
  app.use(
    "/api",
    rateLimit({
      windowMs: 60000,
      limit: 300,
      standardHeaders: "draft-7",
      legacyHeaders: false,
    }),
  );
  app.get("/api/health", (req, res) =>
    res.json({
      status: "ok",
      paymentMode: config.demo ? "demo" : "unconfigured",
    }),
  );
  app.use("/api/auth", authRoutes(config));
  app.use("/api", catalogRoutes(), bookingRoutes(config, io));
  app.use("/api/admin", adminRoutes(config, io));
  app.use((req, res) => res.status(404).json({ message: "Route not found" }));
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    let status = err.status || 500,
      message = err.message;
    if (err.code === 11000) {
      status = 409;
      message = "A record with those details already exists";
    }
    if (
      err.name === "CastError" ||
      err.name === "ValidationError" ||
      err instanceof ZodError
    ) {
      status = 400;
      message = "Invalid request data";
    }
    if (status >= 500) {
      logger.error({ err }, "Request failed");
      message = "Something went wrong. Please try again.";
    }
    res.status(status).json({ message });
  });
  return app;
}
