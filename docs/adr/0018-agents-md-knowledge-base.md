# ADR-0018: AGENTS.md is a map; docs/ is the system of record

Status: accepted · Date: 2026-10-13

## Context

A giant instruction file crowds out the task and rots; knowledge outside the repo is invisible to agents.

## Decision

`AGENTS.md` (<= 150 lines) points into `docs/`: design docs, product specs, exec plans, generated docs, condensed `*-llms.txt` references, quality/reliability/security bars. `CLAUDE.md` imports it. `npm run docs:check` (in `npm test`) enforces links, indexes, plan status and generated-doc freshness.

## Alternatives considered

Single large AGENTS.md; external wiki.

## Consequences

Progressive disclosure for agents; docs drift fails CI.
