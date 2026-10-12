---
name: sdlc
description: Run this repo's AI-assisted SDLC pipeline (Planner -> Contract -> Generator -> Check -> Evaluator -> Human gate) and report the outcome. Use when asked to run the pipeline, the demo, a live/real-model run, a smoke run, resume or approve a run, run the harness tests, run evaluator calibration, or explain what a run did. Args - test | demo (default) | live [--max-features n] [--model id] | resume [--approve] | calibrate | inspect.
---

# /sdlc: run the delivery pipeline

The harness lives in `harness/src/` and its CLI is `tsx harness/src/cli.ts <example> [flags]`. The only example is
`room-booking`, which builds a Node/Express/Postgres API one sprint at a time. Each sprint has a contract with
tests, a generator attempt, a deterministic check (tsc and vitest against Postgres) and an LLM evaluator. A sprint
gets up to 3 attempts. The check result outranks the evaluator's opinion.

## 1. Pick the mode from the arguments

| Arg | What runs | Cost |
|---|---|---|
| `test` | `npm run typecheck && npm test` (harness unit tests, no DB) | free, ~5s |
| `demo` (default) | `npm run demo`: replays recorded model turns for 6 sprints and ends `RELEASED` | free, ~1 min |
| `live` | `npm run demo:live` with the real Anthropic API. Pass `--max-features 2` for a smoke run | **spends API credits** |
| `resume [--approve]` | `npm run demo:live -- --resume [--approve]`: continues from `.harness/progress.json` | API credits only if sprints remain |
| `calibrate [--llm anthropic]` | `npm run calibrate`: grades the human-labelled evaluator cases and reports agreement and false approvals. Exit 1 means the judge approved something a human failed | free scripted; a few API calls live |
| `inspect` | Runs nothing. Summarises the last run from `examples/room-booking/workspace/` | free |

Before a `live` run, confirm with the user unless they already asked for a live run explicitly, because it costs
money. A full live run makes dozens of calls, so suggest `--max-features 2` first. A live run needs
`ANTHROPIC_API_KEY` (from the environment or `.env`). Check it with `npm run check-key` before starting. If the key
is missing, stop and ask for it. Never print the key or write it to a file.

`--approve` releases the build. It stands in for the human gate, so pass it only when the user asked to approve or
release. Without it, a full run ends at `AWAITING_APPROVAL`, and that is a correct result.

## 2. Choose a runtime

Prefer Docker when the daemon is reachable (`docker info` succeeds):

- test: `docker compose --profile test run --rm unit`
- demo: `docker compose up --build --abort-on-container-exit --exit-code-from demo`
- live / resume: `docker compose --profile live run --rm live npm run demo:live -- <flags>`

Otherwise run it locally. This needs Node 22 and Postgres 16 binaries.

```bash
npm ci && npm ci --prefix examples/room-booking        # skip if node_modules are already present
export DATABASE_URL=$(.claude/skills/sdlc/scripts/local-postgres.sh)   # starts or reuses a throwaway Postgres on :5432
npm run demo                                           # or: npm run demo:live -- --max-features 2
```

`local-postgres.sh stop` shuts the local database down. A fresh run (anything without `--resume`) wipes the workspace
and resets the database schema, so warn the user before a fresh run if a previous live run's workspace is worth
keeping.

Run the pipeline in the foreground with a generous timeout (10 min). For a full live run, start it in the
background and wait for it to finish.

## 3. Report the result

Exit code 0 means `released` or `awaiting_approval`. Exit code 1 means `blocked`. Then read:

- the `=== Summary ===` block of the output: one PASS/---- line per sprint, with attempt counts
- `examples/room-booking/workspace/.harness/progress.json`: status, plus `done` and `attempts` per sprint
- `examples/room-booking/workspace/.harness/contracts/*.json` and `spec.json`: what was planned and promised
- `examples/room-booking/workspace/.harness/calls/NNN-<role>.json`: every model call (system, user, reply, secs)
- `git -C examples/room-booking/workspace log --oneline`: one commit per generator attempt, failed ones included

Reply with:

1. the status (`RELEASED` / `AWAITING_APPROVAL` / `BLOCKED`) and a sprint table (sprint, attempts, outcome)
2. each retry: what attempt 1 got wrong (the failing test names from the CHECK FAIL lines) and what the retry
   changed (`git -C examples/room-booking/workspace show <sha> --stat`)
3. any `ARCH <rule>` lines (architecture-rule violations from `examples/room-booking/architecture.json`) and
   whether the retry fixed them. Never edit `architecture.json` to make a run pass; it is the architect's file.
4. any sprint where the evaluator scored the work as passing but the check failed. That disagreement is the
   pattern the harness is designed to catch.
   Also report `PROBE FAIL` lines: the evaluator's live Playwright probes (`.harness/probes/NN-aK/`) found a
   runtime defect the contract tests missed.
5. for live runs, the number of model calls and the next command to run (`resume --approve` once the user has reviewed
   the result, or `--model <id>` to retry a `BLOCKED` run with a different model)

If the run is `BLOCKED`, read the last generator and evaluator transcripts for that sprint and say why it failed.
Do not edit the contract tests to make it pass. The harness restores them before every check anyway.

Do not commit `examples/room-booking/workspace/`. It is git-ignored and has its own git history.
