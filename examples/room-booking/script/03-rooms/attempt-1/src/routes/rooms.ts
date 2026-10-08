import { Router } from "express";
import type { Pool } from "pg";
import { z } from "zod";
import { requireAdmin, requireUser } from "../auth.js";
import { HttpError, pgCode } from "../http.js";

const idParam = z.coerce.number().int().positive();
const body = z.object({ name: z.string().min(1).max(100), capacity: z.number().int().positive().max(1000) });

export function roomsRouter(pool: Pool) {
  const r = Router();
  r.use("/rooms", requireUser(pool));

  r.get("/rooms", async (_req, res) => {
    const { rows } = await pool.query("SELECT id, name, capacity FROM rooms ORDER BY id");
    res.json(rows);
  });

  r.get("/rooms/:id", async (req, res) => {
    const id = idParam.parse(req.params.id);
    const { rows } = await pool.query("SELECT id, name, capacity FROM rooms WHERE id = $1", [id]);
    if (!rows[0]) throw new HttpError(404, "room not found");
    res.json(rows[0]);
  });

  r.post("/rooms", requireAdmin, async (req, res) => {
    const b = body.parse(req.body);
    try {
      const { rows } = await pool.query(
        "INSERT INTO rooms(name, capacity) VALUES ($1, $2) RETURNING id, name, capacity",
        [b.name, b.capacity],
      );
      res.status(201).json(rows[0]);
    } catch (err) {
      if (pgCode(err) === "23505") throw new HttpError(409, "room name already exists");
      throw err;
    }
  });

  r.put("/rooms/:id", requireAdmin, async (req, res) => {
    const id = idParam.parse(req.params.id);
    const b = body.parse(req.body);
    try {
      const { rows } = await pool.query(
        "UPDATE rooms SET name = $2, capacity = $3 WHERE id = $1 RETURNING id, name, capacity",
        [id, b.name, b.capacity],
      );
      if (!rows[0]) throw new HttpError(404, "room not found");
      res.json(rows[0]);
    } catch (err) {
      if (pgCode(err) === "23505") throw new HttpError(409, "room name already exists");
      throw err;
    }
  });

  r.delete("/rooms/:id", requireAdmin, async (req, res) => {
    const id = idParam.parse(req.params.id);
    const { rowCount } = await pool.query("DELETE FROM rooms WHERE id = $1", [id]);
    if (!rowCount) throw new HttpError(404, "room not found");
    res.status(204).end();
  });

  return r;
}
