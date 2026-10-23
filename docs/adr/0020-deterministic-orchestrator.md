# ADR-0020: The orchestrator is deterministic code; agents are pluggable roles

Status: accepted · Date: 2026-10-23

## Context

The target intent ([ai-software-factory.md](../product-specs/ai-software-factory.md)) describes eight specialist
agents (Analyst, Architect, Coder, Tester, Reviewer, DevOps, Documentation, Monitoring) coordinated by an
"Orchestrator Agent". Today the five roles are hard-coded in the `PROMPTS` constant and the stage order in
`Harness.run`, so adding an agent means editing core code.

## Decision

1. The **orchestrator stays deterministic TypeScript**: it owns stage order, retries, budgets, resume and the human
   gate. "Orchestrator Agent" in the intent is read as the workflow-coordination *function*, not an LLM.
2. **Agents become pluggable roles**: each role is a module (prompt, input selector, output schema, deterministic
   validator) registered in a role registry; each example declares its pipeline as an ordered list of role ids.
3. A role's output is accepted only when its deterministic validator passes (ADR-0005). Roles that act on external
   systems (integration, deploy) run only after a recorded human approval (ADR-0008).

## Alternatives considered

- **LLM orchestrator** choosing the next agent: flexible, but control flow becomes non-reproducible, hard to audit,
  cannot be benchmarked with fixed contracts (ADR-0015), and can skip verification. Rejected for core belief 9
  (fail closed) and governance.
- **Keep hard-coded roles and add stages inline**: smallest change, but `harness.ts` grows with every agent and
  roles cannot be swapped per project, which defeats the Modularity capability.

## Consequences

Runs stay reproducible, resumable (ADR-0004) and comparable across models. New agents are added without touching the
loop. An LLM may still *propose* plan changes (e.g. the Analyst re-ordering the backlog), but the orchestrator
validates and applies them. Cost: one more abstraction (the registry) and a migration of the existing five roles.
