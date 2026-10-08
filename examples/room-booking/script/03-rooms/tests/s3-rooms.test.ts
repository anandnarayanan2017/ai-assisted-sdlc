import { beforeEach, describe, expect, it } from "vitest";
import { api, as, makeUser, useDb } from "./helpers.js";

useDb();

let admin: number;
let user: number;
beforeEach(async () => {
  admin = await makeUser("admin");
  user = await makeUser("user");
});

const create = (name = "Hopper", capacity = 8) =>
  api().post("/rooms").set(as(admin)).send({ name, capacity });

describe("rooms", () => {
  it("admin creates a room", async () => {
    const r = await create();
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ name: "Hopper", capacity: 8 });
  });

  it("non-admin cannot create (403) and anonymous gets 401", async () => {
    expect((await api().post("/rooms").set(as(user)).send({ name: "X", capacity: 2 })).status).toBe(403);
    expect((await api().post("/rooms").send({ name: "X", capacity: 2 })).status).toBe(401);
  });

  it.each([
    ["zero capacity", { name: "A", capacity: 0 }],
    ["missing name", { capacity: 4 }],
    ["fractional capacity", { name: "A", capacity: 2.5 }],
  ])("rejects %s with 400", async (_n, body) => {
    expect((await api().post("/rooms").set(as(admin)).send(body)).status).toBe(400);
  });

  it("rejects a duplicate room name with 409", async () => {
    await create("Dup");
    expect((await create("Dup")).status).toBe(409);
  });

  it("any authenticated user lists rooms in id order", async () => {
    await create("A", 2);
    await create("B", 4);
    const r = await api().get("/rooms").set(as(user));
    expect(r.status).toBe(200);
    expect(r.body.map((x: { name: string }) => x.name)).toEqual(["A", "B"]);
    expect((await api().get("/rooms")).status).toBe(401);
  });

  it("fetches one room; 404 when missing; 400 for a non-numeric id", async () => {
    const id = (await create()).body.id;
    expect((await api().get(`/rooms/${id}`).set(as(user))).body).toMatchObject({ id, name: "Hopper" });
    expect((await api().get("/rooms/9999").set(as(user))).status).toBe(404);
    expect((await api().get("/rooms/abc").set(as(user))).status).toBe(400);
  });

  it("admin updates a room; user cannot", async () => {
    const id = (await create()).body.id;
    const ok = await api().put(`/rooms/${id}`).set(as(admin)).send({ name: "Hopper II", capacity: 10 });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ name: "Hopper II", capacity: 10 });
    expect((await api().put(`/rooms/${id}`).set(as(user)).send({ name: "Z", capacity: 1 })).status).toBe(403);
    expect((await api().put("/rooms/9999").set(as(admin)).send({ name: "Z", capacity: 1 })).status).toBe(404);
  });

  it("admin deletes a room; user cannot", async () => {
    const id = (await create()).body.id;
    expect((await api().delete(`/rooms/${id}`).set(as(user))).status).toBe(403);
    expect((await api().delete(`/rooms/${id}`).set(as(admin))).status).toBe(204);
    expect((await api().get(`/rooms/${id}`).set(as(user))).status).toBe(404);
  });
});
