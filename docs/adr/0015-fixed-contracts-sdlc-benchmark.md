# ADR-0015: SDLC benchmark replays plan and contracts

Status: accepted · Date: 2026-10-13

## Context

If each model writes its own tests, models are graded on different exams.

## Decision

The sdlc suite replays the recorded plan, contract tests, probes and evaluator; only `--live-roles` (default `generator`) go to the model under test. Full-autonomy runs are allowed but reported separately.

## Alternatives considered

Full autonomous loop as the headline metric (not comparable across models).

## Consequences

Comparable, SWE-bench-like 'resolved' metric; judge quality measured separately.
