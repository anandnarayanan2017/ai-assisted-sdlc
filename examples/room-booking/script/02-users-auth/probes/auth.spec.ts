import { expect, test } from "@playwright/test";

const email = () => `probe-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;

test("a client cannot register itself as admin", async ({ request }) => {
  const r = await request.post("/users", { data: { email: email(), name: "Mallory", role: "admin" } });
  expect(r.status()).toBe(201);
  expect((await r.json()).role).toBe("user");
});

test("identity header must be a known numeric id", async ({ request }) => {
  for (const h of ["abc", "-1", "1.5", "999999"]) {
    expect((await request.get("/me", { headers: { "x-user-id": h } })).status(), `x-user-id: ${h}`).toBe(401);
  }
});

test("malformed JSON is a 400 with a JSON error body", async ({ request }) => {
  const r = await request.post("/users", { headers: { "content-type": "application/json" }, data: "{not json" });
  expect(r.status()).toBe(400);
  expect(r.headers()["content-type"]).toContain("application/json");
});
