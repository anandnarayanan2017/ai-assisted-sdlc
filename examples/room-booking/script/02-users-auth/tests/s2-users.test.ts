import { describe, expect, it } from "vitest";
import { api, as, makeUser, useDb } from "./helpers.js";

useDb();

describe("users and auth", () => {
  it("registers a user with role 'user'", async () => {
    const r = await api().post("/users").send({ email: "ann@example.com", name: "Ann" });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ email: "ann@example.com", name: "Ann", role: "user" });
    expect(typeof r.body.id).toBe("number");
  });

  it("does not let callers self-assign a role", async () => {
    const r = await api().post("/users").send({ email: "eve@example.com", name: "Eve", role: "admin" });
    expect(r.status).toBe(201);
    expect(r.body.role).toBe("user");
  });

  it("rejects an invalid email with 400", async () => {
    const r = await api().post("/users").send({ email: "not-an-email", name: "X" });
    expect(r.status).toBe(400);
  });

  it("rejects a duplicate email with 409", async () => {
    await api().post("/users").send({ email: "dup@example.com", name: "One" });
    const r = await api().post("/users").send({ email: "dup@example.com", name: "Two" });
    expect(r.status).toBe(409);
  });

  it("GET /me returns the caller", async () => {
    const id = await makeUser("user", "me@example.com");
    const r = await api().get("/me").set(as(id));
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ id, email: "me@example.com", role: "user" });
  });

  it.each([
    ["missing header", {}],
    ["garbage id", { "x-user-id": "abc" }],
    ["unknown id", { "x-user-id": "99999" }],
  ])("GET /me returns 401 for %s", async (_name, headers) => {
    const r = await api().get("/me").set(headers);
    expect(r.status).toBe(401);
  });

  it("returns 400 JSON for malformed request bodies", async () => {
    const r = await api().post("/users").set("content-type", "application/json").send("{oops");
    expect(r.status).toBe(400);
  });
});
