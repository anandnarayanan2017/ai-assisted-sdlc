import type { RequestHandler, Response } from "express";
import type { Pool } from "pg";
import { HttpError } from "./http.js";

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: "user" | "admin";
}

/** Dev-grade identity: trusts the x-user-id header (swap for real tokens in production). */
export const requireUser =
  (pool: Pool): RequestHandler =>
  async (req, res, next) => {
    const raw = req.header("x-user-id");
    const id = Number(raw);
    if (!raw || !Number.isInteger(id) || id <= 0) throw new HttpError(401, "authentication required");
    const { rows } = await pool.query("SELECT id, email, name, role FROM users WHERE id = $1", [id]);
    if (!rows[0]) throw new HttpError(401, "unknown user");
    res.locals.user = rows[0] as AuthUser;
    next();
  };

export const requireAdmin: RequestHandler = (_req, res, next) => {
  if (currentUser(res).role !== "admin") throw new HttpError(403, "admin only");
  next();
};

export const currentUser = (res: Response): AuthUser => res.locals.user as AuthUser;
