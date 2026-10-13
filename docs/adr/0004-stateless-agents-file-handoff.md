# ADR-0004: Stateless agents; state in files and git

Status: accepted · Date: 2026-10-13

## Context

Long-running agent sessions drift, lose context on compaction, and lose everything on a crash.

## Decision

Every model call is a fresh context. Agents hand off only through `.harness/` files (spec, contracts, progress, transcripts) and git (one commit per attempt). `--resume` continues from `progress.json`.

## Alternatives considered

One long session with automatic compaction (fewer calls, but stale assumptions survive and crashes lose state).

## Consequences

Crash-safe, auditable, model-agnostic per role. Cost: each call re-reads the workspace snapshot (TD-4).
