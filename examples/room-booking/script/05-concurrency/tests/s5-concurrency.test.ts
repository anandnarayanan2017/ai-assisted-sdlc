import { beforeEach, describe, expect, it } from "vitest";
import { api, as, makeUser, pool, useDb } from "./helpers.js";

useDb();

const S = "2031-02-01T09:00:00.000Z";
const E = "2031-02-01T10:00:00.000Z";
let admin: number, room: number;

beforeEach(async () => {
  admin = await makeUser("admin");
  room = (await api().post("/rooms").set(as(admin)).send({ name: "Hopper", capacity: 8 })).body.id;
});

describe("concurrency safety", () => {
  it("exactly one of 20 simultaneous requests for the same slot wins", async () => {
    const users = await Promise.all(Array.from({ length: 20 }, () => makeUser()));
    const results = await Promise.all(
      users.map((u) => api().post("/bookings").set(as(u)).send({ roomId: room, startAt: S, endAt: E })),
    );
    const codes = results.map((r) => r.status);
    expect(codes.filter((c) => c === 201)).toHaveLength(1);
    expect(codes.filter((c) => c === 409)).toHaveLength(19);
    const { rows } = await pool.query(
      "SELECT count(*)::int AS n FROM bookings WHERE room_id = $1 AND status = 'confirmed'",
      [room],
    );
    expect(rows[0].n).toBe(1);
  });

  it("the database itself rejects overlapping confirmed bookings (SQLSTATE 23P01)", async () => {
    const u = await makeUser();
    const ins = (s: string, e: string) =>
      pool.query("INSERT INTO bookings(room_id, user_id, start_at, end_at) VALUES ($1, $2, $3, $4)", [room, u, s, e]);
    await ins(S, E);
    await expect(ins("2031-02-01T09:30:00Z", "2031-02-01T10:30:00Z")).rejects.toMatchObject({ code: "23P01" });
    await ins(E, "2031-02-01T11:00:00Z"); // back-to-back is fine
  });

  it("cancelled bookings do not block the slot, even at the database level", async () => {
    const u = await makeUser();
    const id = (await api().post("/bookings").set(as(u)).send({ roomId: room, startAt: S, endAt: E })).body.id;
    await api().delete(`/bookings/${id}`).set(as(u));
    await pool.query("INSERT INTO bookings(room_id, user_id, start_at, end_at) VALUES ($1, $2, $3, $4)", [room, u, S, E]);
  });

  it("the same slot in different rooms is not a conflict", async () => {
    const r2 = (await api().post("/rooms").set(as(admin)).send({ name: "Lovelace", capacity: 4 })).body.id;
    const u = await makeUser();
    const codes = await Promise.all(
      [room, r2].map(async (id) => (await api().post("/bookings").set(as(u)).send({ roomId: id, startAt: S, endAt: E })).status),
    );
    expect(codes).toEqual([201, 201]);
  });
});
