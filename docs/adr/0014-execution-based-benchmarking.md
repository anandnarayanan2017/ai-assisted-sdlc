# ADR-0014: Benchmarks score by execution only

Status: accepted · Date: 2026-10-13

## Context

LLM-as-judge scores are themselves model-dependent and lenient (ADR-0005, ADR-0009).

## Decision

Two suites, both scored by hidden tests: `codegen` (HumanEval-schema tasks, pass@k) and `sdlc` (room-booking sprints, resolved rate).

## Alternatives considered

LLM-judged quality scores; public leaderboards (do not match our work, contamination).

## Consequences

Results are reproducible within sampling noise and auditable from raw JSONL.
