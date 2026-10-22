# ADR-0019: Execution plans are versioned artifacts

Status: accepted · Date: 2026-10-13

## Context

Multi-session work loses its reasoning between sessions and agents.

## Decision

Work spanning sessions gets `docs/exec-plans/active/NNN-*.md` with Status, plan, decision log and progress log; moved to `completed/` when done; unscheduled debt goes to the tech-debt tracker.

## Alternatives considered

Issue tracker only (not visible to agents offline); no plans.

## Consequences

Any agent can resume work from the repo alone.
