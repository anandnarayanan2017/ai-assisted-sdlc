# Recorded run

Output of `npm run demo` (scripted model, real Postgres 16), unedited apart from this header.
Sprints 5 and 6 each fail once and are repaired; the generated project is in
`examples/room-booking/workspace` (one git commit per attempt).

```text
PLANNER  6 features
  1. Foundation: migrations, schema and health check
  2. Users and header-based authentication
  3. Rooms CRUD with admin-only writes
  4. Create, list and cancel bookings
  5. Concurrency-safe booking (no double-booking under load)
  6. Availability search by time window and capacity

CONTRACT [Foundation: migrations, schema and health check]
  tests: tests/helpers.ts, tests/s1-foundation.test.ts
  GENERATOR attempt 1: wrote 4 file(s)
  CHECK PASS | EVALUATOR functionality=9 craft=8 => PASS

CONTRACT [Users and header-based authentication]
  tests: tests/s2-users.test.ts
  GENERATOR attempt 1: wrote 4 file(s)
  CHECK PASS | EVALUATOR functionality=9 craft=8 => PASS

CONTRACT [Rooms CRUD with admin-only writes]
  tests: tests/s3-rooms.test.ts
  GENERATOR attempt 1: wrote 2 file(s)
  CHECK PASS | EVALUATOR functionality=9 craft=8 => PASS

CONTRACT [Create, list and cancel bookings]
  tests: tests/s4-bookings.test.ts
  GENERATOR attempt 1: wrote 3 file(s)
  CHECK PASS | EVALUATOR functionality=9 craft=8 => PASS

CONTRACT [Concurrency-safe booking (no double-booking under load)]
  tests: tests/s5-concurrency.test.ts
  GENERATOR attempt 1: wrote 1 file(s)
  CHECK FAIL | EVALUATOR functionality=9 craft=8 => FAIL
    !! evaluator approved, but the deterministic check failed: the check wins
    FAIL  tests/s5-concurrency.test.ts > concurrency safety > exactly one of 20 simultaneous requests for the same slot wins
    AssertionError: expected [ 201, 201, 201, 201, 201, 201, …(4) ] to have a length of 1 but got 10
    FAIL  tests/s5-concurrency.test.ts > concurrency safety > the database itself rejects overlapping confirmed bookings (SQLSTATE 23P01)
    AssertionError: promise resolved "Result{ command: 'INSERT', …(9) }" instead of rejecting
  -> failures fed back to the generator
  GENERATOR attempt 2: wrote 2 file(s)
  CHECK PASS | EVALUATOR functionality=9 craft=8 => PASS

CONTRACT [Availability search by time window and capacity]
  tests: tests/s6-availability.test.ts
  GENERATOR attempt 1: wrote 1 file(s)
  CHECK FAIL | EVALUATOR functionality=3 craft=6 => FAIL
    FAIL  tests/s6-availability.test.ts > availability > lists every room when nothing is booked, ordered by capacity
    AssertionError: expected 400 to be 200 // Object.is equality
    FAIL  tests/s6-availability.test.ts > availability > excludes rooms with an overlapping confirmed booking
    TypeError: r.body.map is not a function
    FAIL  tests/s6-availability.test.ts > availability > ignores cancelled and back-to-back bookings
    FAIL  tests/s6-availability.test.ts > availability > filters by minimum capacity
  -> failures fed back to the generator
  GENERATOR attempt 2: wrote 1 file(s)
  CHECK PASS | EVALUATOR functionality=9 craft=8 => PASS

RELEASED

=== Summary ===
PASS  Foundation: migrations, schema and health check  (attempts: 1)
PASS  Users and header-based authentication  (attempts: 1)
PASS  Rooms CRUD with admin-only writes  (attempts: 1)
PASS  Create, list and cancel bookings  (attempts: 1)
PASS  Concurrency-safe booking (no double-booking under load)  (attempts: 2)
PASS  Availability search by time window and capacity  (attempts: 2)
status: released
```
