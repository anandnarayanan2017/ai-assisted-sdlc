# AI-assisted Software Factory (target intent)

Status: proposed · Last verified: 2026-10-23 · Plan: [004-full-lifecycle-agents.md](../exec-plans/active/004-full-lifecycle-agents.md)

## Vision

Move from isolated AI-assisted coding to an AI-enabled Software Factory: AI agents take part in the whole SDLC while
staying governed, observable and accountable. AI alone is not the solution; a harness supplies the controls, context
and governance that make it useful in production.

## Six harness capabilities

| Capability | Purpose | Outcome | Today | Target (plan 004 step) |
|---|---|---|---|---|
| Tools | Connect AI to real actions and enterprise systems | Authority | LLM adapters, git, shell checks, Playwright | Branch/PR, CI trigger, deploy (5) |
| Memory | Preserve history, decisions and learning | Continuity | `.harness/`, git, ADRs, exec plans (per run) | Cross-run lessons store (7) |
| Context | Relevant business and technical information | Intent alignment | AGENTS.md map, `docs/`, references | Role-specific context (8, TD-4) |
| Planning | Sequenced tasks and workflows | Visibility | Planner feature list, exec plans | Requirements + backlog with dependencies (3) |
| Verification | Validate outputs against rules and standards | Accountability | Checks, architecture rules, probes, calibrated evaluator, human gate | Unchanged; extended to new stages |
| Modularity | Reusable, replaceable components | Adaptability | Model per role, `Example` interface | Role registry and pipeline definition (1) |

## Lifecycle coverage

| # | Stage | Agent | Today | Target |
|---|---|---|---|---|
| 1 | Requirements analysis | Analyst | Planner expands the request | Structured FR / NFR / user stories with acceptance criteria |
| 2 | Planning and backlog | Analyst / Planner | Ordered feature list | Backlog with dependencies; contract derives from acceptance criteria |
| 3 | Architecture and design | Architect | Human-written `architecture.json`, ADRs | Agent proposes ADRs and rule changes inside a human-approved envelope |
| 4 | Code generation | Coder | Generator | Unchanged |
| 5 | Testing and validation | Tester, Reviewer | Contract, prober, evaluator, architecture check | Unchanged |
| 6 | Integration | DevOps | Commit per attempt in the workspace | Branch, PR, CI run |
| 7 | Deployment | DevOps | Status flips to `released` | Deploy after the human gate (compose target) |
| 8 | Monitoring and improvement | Monitoring, Documentation | Build-time `metrics.json`, transcripts | Runtime health -> new backlog items and lessons; generated-app docs |

Coordination is done by the deterministic orchestrator in `harness/src/harness.ts`, not by an LLM agent
([ADR-0020](../adr/0020-deterministic-orchestrator.md)).

## Acceptance criteria

1. Every stage above has a role in the role registry, and a scripted run of `room-booking` passes through all of them
   offline (`npm run demo`).
2. Each new role's output is checked by a deterministic check; LLM judgment can only add failures (ADR-0005).
3. Nothing is integrated or deployed without a recorded human approval (who, when, which commit).
4. A monitoring finding from one run appears as a backlog item or lesson read by the next run.
5. Every run enforces a token/cost budget and a per-role model allow-list, failing closed when exceeded.

## Non-goals

Replacing human product ownership or release decisions; production-grade deployment platforms (compose is the
reference target); an LLM that decides control flow.
