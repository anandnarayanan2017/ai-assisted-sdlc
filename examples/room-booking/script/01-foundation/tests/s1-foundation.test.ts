import { describe, expect, it } from "vitest";
import { migrate } from "../src/db/migrate.js";
import { api, pool, useDb } from "./helpers.js";

useDb();

describe("foundation", () => {
  it("GET /health reports ok with database connectivity", async () => {
    const r = await api().get("/health");
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ status: "ok", db: true });
  });

  it("migrations are idempotent", async () => {
    expect(await migrate(pool)).toEqual([]);
  });

  it("migrations are safe to run concurrently", async () => {
    const results = await Promise.all([migrate(pool), migrate(pool), migrate(pool)]);
    expect(results.every((r) => r.length === 0)).toBe(true);
  });

  it("creates the users and rooms tables", async () => {
    const { rows } = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    const names = rows.map((r) => r.table_name);
    expect(names).toEqual(expect.arrayContaining(["users", "rooms", "schema_migrations"]));
  });

  it("rejects an invalid user role at the database level", async () => {
    await expect(
      pool.query("INSERT INTO users(email, name, role) VALUES ('a@example.com', 'A', 'root')"),
    ).rejects.toMatchObject({ code: "23514" });
  });
});
