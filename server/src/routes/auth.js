import { Router } from "express";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import { User } from "../models/index.js";
import { registerSchema, loginSchema } from "../validation.js";
import {
  validate,
  auth,
  safeUser,
  setSession,
  ApiError,
} from "../middleware/security.js";
export default function authRoutes(config) {
  const r = Router();
  const limiter = rateLimit({
    windowMs: 15 * 60000,
    limit: 30,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  });
  r.post("/register", limiter, validate(registerSchema), async (req, res) => {
    const { name, email, password } = req.validated;
    const user = await User.create({
      name,
      email,
      password: await bcrypt.hash(password, 12),
    });
    setSession(res, user, config);
    res.status(201).json({ user: safeUser(user) });
  });
  r.post("/login", limiter, validate(loginSchema), async (req, res) => {
    const { email, password } = req.validated;
    const user = await User.findOne({ email }).select(
      "+password +tokenVersion",
    );
    const valid = await bcrypt.compare(
      password,
      user?.password ||
        "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6Ttx.wrB7DtZ4xErpDYweQBhEQMOC",
    );
    if (!user || !valid) throw new ApiError(401, "Incorrect email or password");
    setSession(res, user, config);
    res.json({ user: safeUser(user) });
  });
  r.get("/me", auth(config), (req, res) =>
    res.json({ user: safeUser(req.user) }),
  );
  r.post("/logout", auth(config), async (req, res) => {
    await User.updateOne({ _id: req.user.id }, { $inc: { tokenVersion: 1 } });
    res.clearCookie("session", {
      path: "/",
      httpOnly: true,
      secure: config.production,
      sameSite: "lax",
    });
    res.json({ message: "Signed out" });
  });
  return r;
}
