# Room-booking API (example project)

Status: shipped · Last verified: 2026-10-13

The project the harness builds from one request, and the workload of the `sdlc` benchmark suite.
Request text: `examples/room-booking/example.ts`. Schema: [db-schema.md](../generated/db-schema.md).

| # | Sprint | Done when |
|---|---|---|
| 1 | Foundation | Idempotent, concurrency-safe migration runner; `users`, `rooms` tables; `GET /health` reports DB connectivity |
| 2 | Users + auth | `POST /users` (400 invalid email, 409 duplicate); `GET /me` via the `x-user-id` header; 401 when missing or unknown |
| 3 | Rooms | CRUD; writes admin-only (403), 400 invalid body/id, 404 missing, 409 duplicate name |
| 4 | Bookings | `POST /bookings` (409 on overlap, back-to-back allowed), `GET /bookings` (own), `DELETE /bookings/:id` (owner or admin) |
| 5 | Concurrency | 20 simultaneous requests for one slot: exactly one 201, nineteen 409; enforced by the database (SQLSTATE 23P01) |
| 6 | Availability | `GET /rooms/available?startAt&endAt&minCapacity`: free rooms ordered by capacity then id; `/rooms/:id` keeps working |

Constraints: Express 5, `pg`, `zod`; no other runtime packages; layering in `examples/room-booking/architecture.json`.
Sprints 5 and 6 are deliberately hard: they separate models in the benchmark.
