import express from "express";
import type { Pool } from "pg";
import { errorHandler } from "./http.js";
import { roomsRouter } from "./routes/rooms.js";
import { usersRouter } from "./routes/users.js";

export function createApp(pool: Pool) {
  const app = express();
  app.use(express.json());

  app.get("/health", async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({ status: "ok", db: true });
    } catch {
      res.status(503).json({ status: "degraded", db: false });
    }
  });

  app.use(usersRouter(pool));
  app.use(roomsRouter(pool));
  app.use(errorHandler);
  return app;
}
