# ADR-0011: Vitest for tests, Playwright for live probes

Status: accepted · Date: 2026-10-13

## Context

We need fast unit/contract tests and black-box tests against the running app.

## Decision

Vitest for harness and contract tests (supertest for in-process HTTP). Playwright `@playwright/test` with the `request` fixture for the evaluator's probes against the started app; `page` once an example has a UI.

## Alternatives considered

Jest (slower ESM story); hand-rolled HTTP probes (no standard reporter, less known to models).

## Consequences

Two well-documented tools, both ESM/TS-native.
