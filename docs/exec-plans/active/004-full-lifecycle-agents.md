# 004: Full-lifecycle agents (AI-assisted Software Factory)

Status: proposed · Owner: maintainers · Driver: unassigned · Started: —

## Goal

The harness covers all eight SDLC stages in [ai-software-factory.md](../../product-specs/ai-software-factory.md):
every stage has a pluggable role, every role's output passes a deterministic check, the scripted `room-booking` run
goes requirements -> deploy -> monitoring offline, and a monitoring finding from one run feeds the next.

## Non-goals

An LLM that decides control flow ([ADR-0020](../../adr/0020-deterministic-orchestrator.md)); real cloud deployment
(compose is the reference target); replacing the human release decision; new runtime dependencies for the harness
(ADR-0003).

## Context

- Gap analysis: [ai-software-factory.md](../../product-specs/ai-software-factory.md) (Today vs Target columns).
- Loop design: [harness-loop.md](../../design-docs/harness-loop.md); beliefs: [core-beliefs.md](../../design-docs/core-beliefs.md).
- Related debt: TD-4 (whole-workspace context), TD-6 (per-role metrics).
- Prior plans: [001](../completed/001-harness-foundation.md), [002](../completed/002-multi-vendor-benchmark.md),
  [003](003-benchmark-v2.md) (step 4 overlaps with step 7 here).

## Plan

Each step is one PR. Every step keeps `npm run typecheck && npm test && npm run docs:check && npm run demo` green, and
the scripted LLM gains replies for any new role so the demo and CI stay offline.

1. **Role registry (Modularity).** Move `PROMPTS` into `harness/src/roles/<id>.ts`, each exporting
   `{ id, prompt, selectContext, parse, validate }`; add `pipeline` to the `Example` interface (default = today's
   five roles). No behaviour change. Verify: existing tests and demo unchanged; new test that an unknown role id fails
   with an instruction-style error.
2. **Governance baseline.** Approval becomes a record `{ by, at, commit, note }` in `.harness/approvals.jsonl`
   (`--approve --by <name>`); per-run token/cost budget and per-role model allow-list in config, failing closed.
   Verify: tests for budget exhaustion -> `blocked`, disallowed model -> refused, approval record written.
3. **Analyst (requirements + backlog).** Planner output becomes `requirements.json`: features with user stories,
   acceptance criteria, NFRs and dependencies. Contract stage must cite the acceptance criteria it tests. Validator:
   schema, dependency graph acyclic, every story has >=1 criterion. Verify: unit tests + demo.
4. **Architect.** New stage after the Analyst: proposes ADR drafts and a diff to `architecture.json` limited to an
   envelope the human sets (allowed packages, layers). Validator: proposal stays inside the envelope and
   `checkArchitecture` still runs on every sprint. Verify: test that an out-of-envelope proposal is rejected.
5. **Integration/DevOps.** After the human gate: create a branch, commit, run the example's CI command, then
   `docker compose up` the example and run a health check. External actions only with an approval record (step 2).
   Verify: scripted run reaches `deployed`; test that deploy without approval is refused.
6. **Documentation.** Per sprint, generate/refresh the example's README and API reference; validator checks every
   route in the code appears in the docs and links resolve (reuse `docs.ts` lint). Verify: unit test with a missing
   route -> failure.
7. **Monitoring + feedback loop (Memory).** Probe the deployed app (health, error rate from logs, latency), record
   per-role usage/latency in `metrics.json` (TD-6), and write findings to `.harness/lessons.jsonl` and new backlog
   items; Analyst and Generator read lessons on the next run. Verify: a seeded failing health check produces a backlog
   item consumed by the following scripted run.
8. **Role-specific context (TD-4).** Each role's `selectContext` returns only what it needs (contract + touched
   files for the Generator, etc.). Verify: token count in `metrics.json` drops on the demo; tests unchanged.
9. **Docs and benchmark.** Update ARCHITECTURE.md, `docs/architecture.md`, harness-loop.md, the ablation table, and
   let the sdlc benchmark select roles by registry id. Move this plan to `completed/`.

## Decisions

- 2026-10-23: Orchestrator stays deterministic; agents become registry roles ([ADR-0020](../../adr/0020-deterministic-orchestrator.md)).
  Alternative (LLM orchestrator) rejected: non-reproducible, unauditable, breaks fixed-contract benchmarking.
- 2026-10-23: Deployment target is the example's docker-compose stack; cloud targets are a later plug-in role.

## Progress

(not started)

## Risks / open questions

- Step 5 needs credentials for any real remote (GitHub, registry); keep the reference path local and offline.
- More roles = more model calls per run; budget (step 2) and context trimming (step 8) must land before live runs.
- Architect autonomy: how wide may the envelope be before a human must review each ADR? Owner decides at step 4.
- Monitoring signals for a demo app are thin; risk of a feedback loop that only ever sees synthetic faults.
