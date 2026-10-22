# ADR-0008: Human approval gate before release

Status: accepted · Date: 2026-10-13

## Context

Accountability for shipping must stay with people; agents optimise for passing checks, not for intent.

## Decision

A run ends at `AWAITING_APPROVAL`; only an explicit `--approve` (a human decision) releases. A sprint that exhausts retries blocks the run and escalates.

## Alternatives considered

Fully autonomous release; approval per sprint (too much human load).

## Consequences

Humans steer at the two points that matter: what to build, whether to ship.
