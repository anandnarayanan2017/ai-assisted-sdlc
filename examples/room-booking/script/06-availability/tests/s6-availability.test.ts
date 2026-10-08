import { beforeEach, describe, expect, it } from "vitest";
import { api, as, makeUser, useDb } from "./helpers.js";

useDb();

const at = (h: number) => new Date(Date.UTC(2031, 2, 3, h)).toISOString();
let admin: number, ann: number;
const rooms: Record<string, number> = {};

beforeEach(async () => {
  admin = await makeUser("admin");
  ann = await makeUser();
  for (const [name, capacity] of [["Small", 2], ["Medium", 6], ["Large", 12]] as const) {
    rooms[name] = (await api().post("/rooms").set(as(admin)).send({ name, capacity })).body.id;
  }
});

const search = (q: Record<string, string | number>) => api().get("/rooms/available").set(as(ann)).query(q);
const names = (r: { body: { name: string }[] }) => r.body.map((x) => x.name);
const book = (room: number, s: string, e: string) =>
  api().post("/bookings").set(as(ann)).send({ roomId: room, startAt: s, endAt: e });

describe("availability", () => {
  it("lists every room when nothing is booked, ordered by capacity", async () => {
    const r = await search({ startAt: at(9), endAt: at(10) });
    expect(r.status).toBe(200);
    expect(names(r)).toEqual(["Small", "Medium", "Large"]);
  });

  it("excludes rooms with an overlapping confirmed booking", async () => {
    await book(rooms.Medium!, at(9), at(10));
    expect(names(await search({ startAt: at(9), endAt: at(10) }))).toEqual(["Small", "Large"]);
    expect(names(await search({ startAt: at(9), endAt: at(11) }))).toEqual(["Small", "Large"]);
  });

  it("ignores cancelled and back-to-back bookings", async () => {
    const id = (await book(rooms.Small!, at(9), at(10))).body.id;
    await api().delete(`/bookings/${id}`).set(as(ann));
    await book(rooms.Large!, at(8), at(9));
    expect(names(await search({ startAt: at(9), endAt: at(10) }))).toEqual(["Small", "Medium", "Large"]);
  });

  it("filters by minimum capacity", async () => {
    expect(names(await search({ startAt: at(9), endAt: at(10), minCapacity: 6 }))).toEqual(["Medium", "Large"]);
    expect(names(await search({ startAt: at(9), endAt: at(10), minCapacity: 50 }))).toEqual([]);
  });

  it("returns 400 for a missing or inverted window", async () => {
    expect((await search({})).status).toBe(400);
    expect((await search({ startAt: at(10), endAt: at(9) })).status).toBe(400);
  });

  it("requires authentication", async () => {
    expect((await api().get("/rooms/available").query({ startAt: at(9), endAt: at(10) })).status).toBe(401);
  });

  it("still serves rooms by numeric id", async () => {
    expect((await api().get(`/rooms/${rooms.Small}`).set(as(ann))).body.name).toBe("Small");
  });
});
