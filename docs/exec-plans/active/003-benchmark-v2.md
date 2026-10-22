# 003: Benchmark v2

Status: proposed · Owner: maintainers · Driver: unassigned · Started: —

## Goal

Make rankings statistically defensible and the benchmark usable as a scheduled regression gate.

## Non-goals

Replacing public leaderboards; benchmarking non-coding tasks.

## Plan

1. Per-task bootstrap 95% CI and a paired comparison (model A vs B on the same tasks) with a p-value. Verify: unit test against known distributions. (TD-1)
2. Grow `codegen` to 40+ tasks across difficulty tiers; keep reference 100% / empty 0% asserted. Optional import of MultiPL-E HumanEval-JS via `--tasks`.
3. Parallel sdlc runs: one workspace and Postgres schema per model. (TD-2)
4. Per-role usage and latency in `metrics.json`; cost per resolved task column. (TD-6)
5. Scheduled CI workflow (weekly) running the codegen suite on configured vendors, publishing to `docs/generated/`, failing when a pinned model drops outside its previous CI.
6. Judge benchmark: run `calibrate` per model to rank evaluator quality (false-approval rate) alongside generator quality.

## Decisions

(none yet)

## Progress

(not started)

## Risks / open questions

- Secrets for scheduled runs: repository secrets per vendor; who owns the budget?
- Contamination: once tasks are public they can leak into training data; keep a private held-out set?
