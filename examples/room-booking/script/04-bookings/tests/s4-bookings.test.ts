import { beforeEach, describe, expect, it } from "vitest";
import { api, as, makeUser, useDb } from "./helpers.js";

useDb();

const at = (h: number, m = 0) => new Date(Date.UTC(2031, 0, 15, h, m)).toISOString();
let admin: number, ann: number, bob: number, room: number, other: number;

beforeEach(async () => {
  [admin, ann, bob] = [await makeUser("admin"), await makeUser(), await makeUser()];
  room = (await api().post("/rooms").set(as(admin)).send({ name: "Hopper", capacity: 8 })).body.id;
  other = (await api().post("/rooms").set(as(admin)).send({ name: "Lovelace", capacity: 4 })).body.id;
});

const book = (user: number, roomId: number, s: string, e: string) =>
  api().post("/bookings").set(as(user)).send({ roomId, startAt: s, endAt: e });

describe("bookings", () => {
  it("creates a confirmed booking", async () => {
    const r = await book(ann, room, at(9), at(10));
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ roomId: room, userId: ann, status: "confirmed" });
    expect(new Date(r.body.startAt).toISOString()).toBe(at(9));
  });

  it("requires authentication", async () => {
    const r = await api().post("/bookings").send({ roomId: room, startAt: at(9), endAt: at(10) });
    expect(r.status).toBe(401);
  });

  it("404 for an unknown room, 400 for bad or inverted times", async () => {
    expect((await book(ann, 9999, at(9), at(10))).status).toBe(404);
    expect((await book(ann, room, at(10), at(9))).status).toBe(400);
    expect((await book(ann, room, at(9), at(9))).status).toBe(400);
    expect((await book(ann, room, "tomorrow", "later")).status).toBe(400);
  });

  it.each([
    ["identical", at(9), at(10)],
    ["partial start", at(8, 30), at(9, 30)],
    ["partial end", at(9, 30), at(10, 30)],
    ["contained", at(9, 15), at(9, 45)],
    ["containing", at(8), at(11)],
  ])("rejects an overlapping booking (%s) with 409", async (_n, s, e) => {
    await book(ann, room, at(9), at(10));
    expect((await book(bob, room, s, e)).status).toBe(409);
  });

  it("allows back-to-back bookings and the same slot in another room", async () => {
    await book(ann, room, at(9), at(10));
    expect((await book(bob, room, at(10), at(11))).status).toBe(201);
    expect((await book(bob, room, at(8), at(9))).status).toBe(201);
    expect((await book(bob, other, at(9), at(10))).status).toBe(201);
  });

  it("lists only the caller's bookings", async () => {
    await book(ann, room, at(9), at(10));
    await book(bob, room, at(11), at(12));
    const r = await api().get("/bookings").set(as(ann));
    expect(r.status).toBe(200);
    expect(r.body).toHaveLength(1);
    expect(r.body[0].userId).toBe(ann);
  });

  it("owner cancels and the slot becomes free again", async () => {
    const id = (await book(ann, room, at(9), at(10))).body.id;
    const c = await api().delete(`/bookings/${id}`).set(as(ann));
    expect(c.status).toBe(200);
    expect(c.body.status).toBe("cancelled");
    expect((await book(bob, room, at(9), at(10))).status).toBe(201);
  });

  it("only the owner or an admin may cancel", async () => {
    const id = (await book(ann, room, at(9), at(10))).body.id;
    expect((await api().delete(`/bookings/${id}`).set(as(bob))).status).toBe(403);
    expect((await api().delete(`/bookings/${id}`).set(as(admin))).status).toBe(200);
    expect((await api().delete("/bookings/9999").set(as(ann))).status).toBe(404);
  });
});
