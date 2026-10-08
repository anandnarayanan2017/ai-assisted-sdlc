import { Router } from "express";
import type { Pool } from "pg";
import { z } from "zod";
import { currentUser, requireUser } from "../auth.js";
import { HttpError } from "../http.js";

const COLS = `id, room_id AS "roomId", user_id AS "userId", start_at AS "startAt", end_at AS "endAt", status`;
const iso = z.string().datetime({ offset: true });
const idParam = z.coerce.number().int().positive();
const createBody = z
  .object({ roomId: z.number().int().positive(), startAt: iso, endAt: iso })
  .refine((b) => Date.parse(b.endAt) > Date.parse(b.startAt), { message: "endAt must be after startAt", path: ["endAt"] });

export function bookingsRouter(pool: Pool) {
  const r = Router();
  r.use("/bookings", requireUser(pool));

  r.post("/bookings", async (req, res) => {
    const b = createBody.parse(req.body);
    const room = await pool.query("SELECT 1 FROM rooms WHERE id = $1", [b.roomId]);
    if (!room.rows[0]) throw new HttpError(404, "room not found");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const clash = await client.query(`SELECT 1 FROM bookings WHERE room_id = $1 AND status = 'confirmed' AND start_at < $3 AND end_at > $2 LIMIT 1`, [b.roomId, b.startAt, b.endAt]);
      if (clash.rowCount) {
        await client.query("ROLLBACK");
        throw new HttpError(409, "room already booked for that time");
      }
      const { rows } = await client.query(
        `INSERT INTO bookings(room_id, user_id, start_at, end_at) VALUES ($1, $2, $3, $4) RETURNING ${COLS}`,
        [b.roomId, currentUser(res).id, b.startAt, b.endAt],
      );
      await client.query("COMMIT");
      res.status(201).json(rows[0]);
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  });

  r.get("/bookings", async (_req, res) => {
    const { rows } = await pool.query(`SELECT ${COLS} FROM bookings WHERE user_id = $1 ORDER BY start_at, id`, [
      currentUser(res).id,
    ]);
    res.json(rows);
  });

  r.delete("/bookings/:id", async (req, res) => {
    const id = idParam.parse(req.params.id);
    const found = await pool.query("SELECT user_id FROM bookings WHERE id = $1", [id]);
    if (!found.rows[0]) throw new HttpError(404, "booking not found");
    const me = currentUser(res);
    if (me.role !== "admin" && found.rows[0].user_id !== me.id) throw new HttpError(403, "not your booking");
    const { rows } = await pool.query(`UPDATE bookings SET status = 'cancelled' WHERE id = $1 RETURNING ${COLS}`, [id]);
    res.json(rows[0]);
  });

  return r;
}
