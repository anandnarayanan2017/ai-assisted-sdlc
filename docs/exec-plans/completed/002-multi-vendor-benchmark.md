# 002: Multi-vendor model benchmark and knowledge base

Status: completed · Owner: maintainers · Driver: agent · Started: 2026-10-13 · Completed: 2026-10-13

## Goal

Compare LLMs across vendors on this repo's work with industry-standard, execution-based metrics, and reorganise the
docs as an agent-first knowledge base (AGENTS.md map + `docs/` system of record + mechanical checks).

## Non-goals

Hosted leaderboard; LLM-as-judge scoring; languages other than JavaScript/TypeScript.

## Plan (all done)

1. OpenAI-compatible adapter next to the Anthropic one, both reporting token usage. Verify: adapter test with a local HTTP server.
2. Model registry `benchmarks/models.json` (Anthropic, OpenAI, Google, Mistral, DeepSeek, OpenRouter, Ollama, baselines).
3. `codegen` suite: 12 original HumanEval-schema tasks, sandboxed execution, pass@k, Wilson CI. Verify: reference 100%, empty 0%.
4. `sdlc` suite: pipeline CLI accepts any registry model and `--live-roles`; writes `metrics.json`. Verify: reference 6/6 released, empty blocked.
5. Reports (`report.md`, `summary.json`, `results.jsonl`), `--publish` to `docs/generated/`.
6. Knowledge base: AGENTS.md, ARCHITECTURE.md, docs tree, references; `docs:check` / `docs:gen`; layering structural test.
7. Docker `bench` service, CI job running the offline baselines.

## Decisions

- 2026-10-13: Score by execution only; baselines mandatory. Alternative (LLM judge) rejected: our own calibration shows false approvals.
- 2026-10-13: sdlc suite replays plan and contracts, varies only `--live-roles`: comparable runs, like SWE-bench fixing the tests.
- 2026-10-13: One OpenAI-compatible adapter instead of per-vendor SDKs: zero dependencies, one code path.

## Progress

- 2026-10-13: All steps implemented; `npm test`, `npm run typecheck`, `npm run docs:check` pass; offline baselines
  verified for both suites (codegen 100% / 0%, sdlc 6/6 released / blocked at sprint 1).

## Follow-ups

[003-benchmark-v2](../active/003-benchmark-v2.md); TD-1, TD-2, TD-3, TD-7.
