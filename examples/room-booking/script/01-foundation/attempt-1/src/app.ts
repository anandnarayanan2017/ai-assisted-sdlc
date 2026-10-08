import express from "express";
import type { Pool } from "pg";

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

  return app;
}
