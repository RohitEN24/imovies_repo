import jwt from "jsonwebtoken";
import { User } from "../models/index.js";
export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export function validate(schema, source = "body") {
  return (req, res, next) => {
    const parsed = schema.safeParse(req[source]);
    if (!parsed.success)
      return res
        .status(400)
        .json({ message: "Validation failed", errors: parsed.error.flatten() });
    req.validated = parsed.data;
    next();
  };
}
export function auth(config) {
  return async (req, res, next) => {
    try {
      const token = req.cookies?.session;
      if (!token) throw new Error();
      const data = jwt.verify(token, config.secret, {
        algorithms: ["HS256"],
        issuer: "imovies",
        audience: "imovies-web",
      });
      const user = await User.findById(data.sub).select("+tokenVersion");
      if (!user || user.tokenVersion !== data.v) throw new Error();
      req.user = user;
      next();
    } catch {
      next(new ApiError(401, "Please sign in again"));
    }
  };
}
export const admin = (req, res, next) =>
  req.user?.role === "admin"
    ? next()
    : next(new ApiError(403, "Administrator access required"));
export const safeUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
});
export function setSession(res, user, config) {
  const token = jwt.sign({ v: user.tokenVersion || 0 }, config.secret, {
    subject: user.id,
    expiresIn: "8h",
    algorithm: "HS256",
    issuer: "imovies",
    audience: "imovies-web",
  });
  res.cookie("session", token, {
    httpOnly: true,
    secure: config.production,
    sameSite: "lax",
    maxAge: 8 * 60 * 60 * 1000,
    path: "/",
  });
}
export function originGuard(config) {
  return (req, res, next) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const origin = req.get("origin");
      if (
        (origin && origin !== config.origin) ||
        req.get("sec-fetch-site") === "cross-site"
      )
        return next(new ApiError(403, "Untrusted request origin"));
    }
    next();
  };
}
export const objectId = /^[a-f\d]{24}$/i;
export function validId(value) {
  if (!objectId.test(value)) throw new ApiError(400, "Invalid identifier");
  return value;
}
export function pageArgs(query) {
  const page = Math.max(
      1,
      Math.min(10000, Number.parseInt(query.page, 10) || 1),
    ),
    limit = Math.max(1, Math.min(50, Number.parseInt(query.limit, 10) || 12));
  return { page, limit, skip: (page - 1) * limit };
}
