# ADR-0007: The contract owns the acceptance tests

Status: accepted · Date: 2026-10-13

## Context

A generator under pressure to pass will weaken or delete tests.

## Decision

The contract agent writes the acceptance tests; the harness restores them before every check, so generator edits to them have no effect.

## Alternatives considered

Trusting the generator; read-only file permissions (bypassable by rewriting paths).

## Consequences

Tests stay an independent spec. Tested by the tamper-restore unit test.
