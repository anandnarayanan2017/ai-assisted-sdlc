# ADR-0010: Example app: Express 5 + PostgreSQL + zod

Status: accepted · Date: 2026-10-13

## Context

The example must be a realistic service whose hardest requirement (no double-booking under concurrency) can only be proven by a real database.

## Decision

Express 5, `pg`, `zod`, PostgreSQL (GiST exclusion constraint enforces the invariant). Allowed packages are pinned in `architecture.json`.

## Alternatives considered

SQLite (no real concurrent transactions/exclusion constraints); NestJS/Prisma (more magic, more surface for agents to misuse); in-memory mocks (cannot prove concurrency).

## Consequences

Boring, well-known stack agents use correctly; the verifier is the database itself.
