# ADR-0006: Architecture rules are enforced mechanically

Status: accepted · Date: 2026-10-13

## Context

Agents copy whatever patterns exist; review alone does not stop layering erosion at agent throughput.

## Decision

Architect-owned `examples/<name>/architecture.json` (import directions, approved packages) is checked against the import graph after every generator attempt; violations fail the sprint and are fed back as instructions. The harness's own layering (core never imports `bench/`) is a structural test.

## Alternatives considered

Lint rules inside the workspace (the generator could edit them); human review only.

## Consequences

Rules cannot be relaxed by an agent; error text tells the agent how to fix the violation.
