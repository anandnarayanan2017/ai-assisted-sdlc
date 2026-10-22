# Quality score

A graded view of each domain, updated when a domain changes. Grades drive what gets cleaned up next: agents pick
the lowest grade with an open tech-debt row. Last reviewed: 2026-10-13.

Scale: **A** well-tested, documented, enforced · **B** solid, minor gaps · **C** works, notable gaps · **D** fragile.

| Domain | Grade | Tests | Docs | Enforcement | Gaps |
|---|---|---|---|---|---|
| Delivery loop (`harness.ts`) | A | retry, block, approve, resume, tamper-restore, path-escape | architecture.md, harness-loop.md | check-beats-judge test | Whole-workspace context per role (TD-4) |
| Provider adapters (`llm.ts`) | B | OpenAI-compatible request/usage test | provider-adapters.md | — | No live contract test per vendor; Anthropic adapter tested only live |
| Verification (arch rules, probes, calibration) | A | violations, type-only imports, calibration agreement | architecture.md §4 | runs on every sprint | Browser probes untested (no UI yet) |
| Benchmark: codegen | B | pass@k, Wilson, sandbox fs/timeout, dataset validity, API-error handling | benchmark-methodology.md | baselines asserted in CI | 12 tasks; CI ignores task correlation (TD-1) |
| Benchmark: sdlc | B | via pipeline tests + offline baseline run | benchmark-methodology.md | CI baseline run | Sequential, shared DB (TD-2) |
| Knowledge base | A | docs lint, layering structural test | AGENTS.md, PLANS.md | `npm test` | Duplicated commands across files (TD-5) |
| Example: room-booking | A | 47 contract tests, probes, 5 calibration cases | room-booking-api.md, db-schema.md | architecture.json | — |

## How to raise a grade

Add the missing test or check, update the doc, re-grade in the same PR, and remove the tech-debt row it closes.
