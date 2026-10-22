# ADR-0016: Mandatory baselines; pass@k and Wilson intervals

Status: accepted · Date: 2026-10-13

## Context

A benchmark with a vacuous test or a broken sandbox produces confident nonsense.

## Decision

Every run may include `reference` (must score 100%) and `empty` (must score 0%); violations exit 1 and CI asserts them. Metrics: unbiased pass@k (Chen et al. 2021), 95% Wilson interval, latency p50/p95, tokens, cost. Overlapping intervals = no ranking claim.

## Alternatives considered

Point estimates only; mean +/- 2 SE (wrong at small n).

## Consequences

Honest uncertainty. Known gap: per-task correlation (TD-1, exec plan 003).
