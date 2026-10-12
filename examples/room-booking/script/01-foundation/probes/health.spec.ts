import { expect, test } from "@playwright/test";

test("health reports a live database as JSON", async ({ request }) => {
  const r = await request.get("/health");
  expect(r.status()).toBe(200);
  expect(r.headers()["content-type"]).toContain("application/json");
  expect(await r.json()).toMatchObject({ status: "ok", db: true });
});

test("unknown routes are 404, not a crash", async ({ request }) => {
  expect((await request.get("/no-such-route")).status()).toBe(404);
});
