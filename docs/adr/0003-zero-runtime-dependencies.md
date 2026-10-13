# ADR-0003: Zero runtime dependencies; plain fetch instead of vendor SDKs

Status: accepted · Date: 2026-10-13

## Context

The harness talks to several LLM vendors and runs untrusted model output; every dependency is supply-chain surface and an upgrade treadmill.

## Decision

The harness has no runtime dependencies: `fetch` and `node:*` built-ins only. Dev dependencies: typescript, tsx, vitest, @types/node. A new dependency needs a line in an exec plan saying why.

## Alternatives considered

Vendor SDKs (one per vendor, divergent APIs, frequent breaking changes); LangChain/LiteLLM (large surface, hides request shapes).

## Consequences

Request shapes are visible and unit-testable; small Docker image. We maintain retries/backoff and parsing ourselves (~60 lines).
