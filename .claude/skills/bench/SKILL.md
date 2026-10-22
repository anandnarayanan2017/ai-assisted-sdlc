---
name: bench
description: Benchmark and compare LLMs across vendors (Anthropic, OpenAI, Google, Mistral, DeepSeek, OpenRouter, local Ollama/vLLM) on this repo's codegen suite (HumanEval-style pass@k) or sdlc suite (agentic room-booking build), and report a leaderboard. Use when asked to compare models, benchmark a vendor, check a model for regressions, or explain benchmark results. Args - baselines (default) | codegen <ids> [--samples n --k 1,5] | sdlc <ids> [--max-features n] | inspect.
---

# /bench: compare models

Code: `harness/src/bench/`. Registry: `benchmarks/models.json`. Methodology: `docs/design-docs/benchmark-methodology.md`.

## 1. Mode

| Arg | Command | Cost |
|---|---|---|
| `baselines` (default) | `npm run bench:baselines` | free, ~2 s |
| `codegen <ids>` | `npm run bench -- --suite codegen --models reference,empty,<ids> [--samples n --k 1,n]` | cents per model |
| `sdlc <ids>` | `npm run bench -- --suite sdlc --models reference,<ids> [--max-features 2]` (needs `DATABASE_URL`) | ~dollars per model |
| `inspect` | Runs nothing: read the newest `benchmarks/results/*/report.md` and `summary.json` | free |

Always include `reference` (and `empty` for codegen): a run whose baselines are wrong exits 1 and its numbers are void.
Confirm with the user before any run that calls a paid API unless they asked for it explicitly; suggest
`--max-features 2` for a first sdlc run. List ids with `jq -r '.models[].id' benchmarks/models.json`.
Models whose key env var is unset are skipped; tell the user which variable to set. Never print keys.

## 2. Runtime

Docker when available: `docker compose --profile bench run --rm bench npm run bench -- <flags>`.
Otherwise locally (`npm ci && npm ci --prefix examples/room-booking`; for sdlc
`export DATABASE_URL=$(.claude/skills/sdlc/scripts/local-postgres.sh)`). Prefer Docker for untrusted models:
on Node < 25 the codegen sandbox does not block network access.

## 3. Report

Give the ranked table, then interpret: overlapping 95% intervals mean no established ranking; name the tasks or
sprints that separated models (per-task / per-sprint matrix); cost per resolved task when prices are filled in;
API errors separately from wrong answers. Point to the results directory for raw data.
