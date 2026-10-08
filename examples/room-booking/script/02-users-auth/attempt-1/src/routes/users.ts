import { Router } from "express";
import type { Pool } from "pg";
import { z } from "zod";
import { currentUser, requireUser } from "../auth.js";
import { HttpError, pgCode } from "../http.js";

const body = z.object({ email: z.string().email(), name: z.string().min(1).max(100) });

export function usersRouter(pool: Pool) {
  const r = Router();

  r.post("/users", async (req, res) => {
    const b = body.parse(req.body);
    try {
      const { rows } = await pool.query(
        "INSERT INTO users(email, name) VALUES ($1, $2) RETURNING id, email, name, role",
        [b.email, b.name],
      );
      res.status(201).json(rows[0]);
    } catch (err) {
      if (pgCode(err) === "23505") throw new HttpError(409, "email already registered");
      throw err;
    }
  });

  r.get("/me", requireUser(pool), (_req, res) => {
    res.json(currentUser(res));
  });

  return r;
}
