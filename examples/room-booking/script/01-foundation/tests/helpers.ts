import pg from "pg";
import request from "supertest";
import { afterAll, beforeEach } from "vitest";
import { createApp } from "../src/app.js";
import { migrate } from "../src/db/migrate.js";

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/rooms",
  max: 10,
});

export async function resetDb() {
  await migrate(pool);
  const { rows } = await pool.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'schema_migrations'",
  );
  if (rows.length) {
    const names = rows.map((r) => `"${r.tablename}"`).join(", ");
    await pool.query(`TRUNCATE ${names} RESTART IDENTITY CASCADE`);
  }
}

/** Call once at the top of a test file: clean database per test, pool closed at the end. */
export function useDb() {
  beforeEach(resetDb);
  afterAll(() => pool.end());
}

export const api = () => request(createApp(pool));
export const as = (userId: number) => ({ "x-user-id": String(userId) });

export async function makeUser(role: "user" | "admin" = "user", email?: string): Promise<number> {
  const e = email ?? `u${Math.random().toString(36).slice(2)}@example.com`;
  const { rows } = await pool.query("INSERT INTO users(email, name, role) VALUES ($1, $1, $2) RETURNING id", [e, role]);
  return rows[0].id as number;
}
