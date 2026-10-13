# AGENTS.md

This file is a **map, not a manual**. It tells you where knowledge lives; the knowledge itself lives in `docs/`,
which is the system of record. If something you needed was not findable from here, fixing that is part of your task.

## What this repo is

A TypeScript harness that runs AI-assisted delivery as a multi-agent loop
(**Planner -> Contract -> Generator -> Check -> Evaluator -> Human gate**), an example project it builds
(`examples/room-booking`: Express + PostgreSQL API), and a **multi-vendor model benchmark** that runs the same work
through different LLMs and ranks them on deterministic results.

## Start here

| You want to... | Read |
|---|---|
| Understand the system and its layers | [ARCHITECTURE.md](ARCHITECTURE.md), diagrams in [docs/architecture.md](docs/architecture.md) |
| Know the non-negotiable beliefs | [docs/design-docs/core-beliefs.md](docs/design-docs/core-beliefs.md) |
| Find a design decision | [docs/design-docs/index.md](docs/design-docs/index.md) |
| Know what the product must do | [docs/product-specs/index.md](docs/product-specs/index.md) |
| Plan non-trivial work | [docs/PLANS.md](docs/PLANS.md), then `docs/exec-plans/active/` |
| Compare models or vendors | [docs/product-specs/model-benchmark.md](docs/product-specs/model-benchmark.md), [docs/design-docs/benchmark-methodology.md](docs/design-docs/benchmark-methodology.md) |
| Check quality, reliability, security bars | [docs/QUALITY_SCORE.md](docs/QUALITY_SCORE.md), [docs/RELIABILITY.md](docs/RELIABILITY.md), [docs/SECURITY.md](docs/SECURITY.md) |
| Write code that fits | [docs/DESIGN.md](docs/DESIGN.md) (and [docs/FRONTEND.md](docs/FRONTEND.md) if a UI appears) |
| Make product trade-offs | [docs/PRODUCT_SENSE.md](docs/PRODUCT_SENSE.md) |
| See the database | [docs/generated/db-schema.md](docs/generated/db-schema.md) (generated, never hand-edit) |
| Use a library correctly | `docs/references/*-llms.txt` (condensed, version-pinned API notes) |
| Log debt you noticed but did not fix | [docs/exec-plans/tech-debt-tracker.md](docs/exec-plans/tech-debt-tracker.md) |

## Commands (all must pass before you hand work back)

```bash
npm ci && npm ci --prefix examples/room-booking   # once
npm run typecheck                                 # tsc --noEmit, strict
npm test                                          # vitest: harness, benchmark, docs and layering checks
npm run docs:check                                # knowledge-base lint (links, indexes, plan status, generated docs)
npm run docs:gen                                  # regenerate docs/generated/* after changing migrations
npm run demo                                      # scripted 6-sprint run (needs Postgres at DATABASE_URL)
npm run bench -- --suite codegen --models reference,empty    # offline benchmark sanity run, ~2 s
```

No Docker locally? `export DATABASE_URL=$(.claude/skills/sdlc/scripts/local-postgres.sh)` starts a Postgres.
With Docker: `docker compose --profile test run --rm unit` and `docker compose --profile bench run --rm bench`.

## Repository map

```
harness/src/            core: harness.ts (loop), llm.ts (provider adapters), architecture.ts, probe.ts, calibration.ts
harness/src/bench/      benchmark: models.ts (registry), codegen.ts (suite), stats.ts, report.ts, cli.ts
harness/src/docs*.ts    knowledge-base generator and linter
harness/test/           vitest suites (unit + structural + docs)
benchmarks/             models.json (vendors/models), codegen/tasks.jsonl (+ build-tasks.mjs), results/ (git-ignored)
examples/room-booking/  request, recorded script, architecture.json (enforced rules), calibration.json
docs/                   the knowledge base (see table above)
```

## Golden rules (enforced mechanically where possible)

1. **A deterministic check outranks any LLM judgment.** Tests, typecheck and architecture rules decide; an LLM
   score can only add a failure, never remove one. Benchmarks score by execution, never by an LLM judge.
2. **Layering is enforced, not reviewed.** Core modules never import `harness/src/bench/`
   (structural test in `harness/test/docs.test.ts`); generated apps obey `examples/*/architecture.json`.
3. **Contract tests are owned by the contract.** Never edit them to make code pass; the harness restores them anyway.
4. **State lives in files and git**, never in a context window: `.harness/` in the workspace, `docs/exec-plans/` here.
5. **No new dependencies** without a line in an exec plan saying why. Prefer boring, well-known, stable libraries.
   The harness itself has zero runtime dependencies (fetch, no SDKs).
6. **Never commit secrets.** Keys come from env vars named in `benchmarks/models.json`; never print them.
7. **Model-generated code runs only in a sandbox** (separate process, Node permission model, timeout).
8. **Knowledge goes in the repo.** A decision made in chat that is not in `docs/` does not exist for the next agent.

## How to work

- Small change: just do it, with a test. Anything spanning several files or sessions: write an exec plan first
  ([docs/PLANS.md](docs/PLANS.md)), keep its progress log current, move it to `completed/` when done.
- Error messages from linters and checks are written as instructions; follow them.
- When a check fails because the docs are wrong, fix the docs in the same change.
- Leave the codebase cleaner: if you see drift from the rules above, fix it or add a row to the tech-debt tracker.
- Keep PRs small and short-lived. A green, mergeable head waits on review; a red one is your work.

## Doc maintenance

`npm run docs:check` fails CI on: broken relative links, a design doc or product spec missing from its index, an
exec plan whose `Status:` disagrees with its folder, a stale generated file, or this file growing past 150 lines.
