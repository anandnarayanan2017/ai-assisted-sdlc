# ADR-0001: Record architecture decisions

Status: accepted · Date: 2026-10-13

## Context

Decisions were scattered across PR descriptions and chat; agents cannot see either.

## Decision

Keep one short ADR per significant decision in `docs/adr/` (MADR-lite: context, decision, alternatives, consequences). ADRs are immutable once accepted; a change of mind is a new ADR that supersedes the old one. `npm run docs:check` fails if an ADR is missing from the index.

## Alternatives considered

Wiki pages (invisible to agents, drift from code); long design docs only (no quick lookup of *what* was decided).

## Consequences

Every agent can answer "why is it like this?" from the repo. Small writing cost per decision.
