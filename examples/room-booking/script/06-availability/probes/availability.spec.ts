import { expect, test } from "@playwright/test";

async function user(request: import("@playwright/test").APIRequestContext) {
  const r = await request.post("/users", { data: { email: `probe-${Date.now()}-${Math.random()}@example.com`, name: "P" } });
  return { "x-user-id": String((await r.json()).id) };
}

test("availability rejects an empty window", async ({ request }) => {
  const h = await user(request);
  const t = "2030-01-01T10:00:00Z";
  expect((await request.get(`/rooms/available?startAt=${t}&endAt=${t}`, { headers: h })).status()).toBe(400);
});

test("availability rejects a non-numeric capacity", async ({ request }) => {
  const h = await user(request);
  const q = "startAt=2030-01-01T10:00:00Z&endAt=2030-01-01T11:00:00Z&minCapacity=lots";
  expect((await request.get(`/rooms/available?${q}`, { headers: h })).status()).toBe(400);
});

test("availability requires authentication", async ({ request }) => {
  const q = "startAt=2030-01-01T10:00:00Z&endAt=2030-01-01T11:00:00Z";
  expect((await request.get(`/rooms/available?${q}`)).status()).toBe(401);
});
