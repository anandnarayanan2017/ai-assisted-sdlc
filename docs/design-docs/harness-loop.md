# The harness loop

Status: accepted · Owner: maintainers · Last verified: 2026-10-13

Diagrams: [docs/architecture.md](../architecture.md). Code: `harness/src/harness.ts`.

## Decision

Run delivery as a loop of stateless agents that hand off through files:

| Stage | Input | Output | Assumption it encodes |
|---|---|---|---|
| Planner | 1-4 sentence request | `spec.json` feature list | Models under-scope from short prompts |
| Contract | feature, spec, workspace | `done`, `check` argv, acceptance tests | Models drift from the spec mid-build |
| Generator | contract, workspace, QA bugs | full file contents | — (the worker) |
| Check | workspace | exit code + output | LLMs cannot verify their own work reliably |
| Architecture rules | import graph | violations | Models erode layering unless it is enforced |
| Prober | running app | Playwright tests | Reading code misses runtime bugs |
| Evaluator | changed files, check + probe output | scores, bugs | Self-grading is lenient |
| Human gate | finished build | release | Accountability stays with people |

## Consequences

- Every call is a fresh context. Cost: each agent re-reads the workspace snapshot. Benefit: no context drift, any
  process can crash and `--resume` continues from `.harness/progress.json`.
- The loop is model-agnostic: any role can be served by any vendor (`--llm <id> --live-roles ...`), which is what
  makes the SDLC benchmark possible.
- Up to 3 attempts per sprint; failing test names and check output go back to the generator.

## Alternatives rejected

- **One long session with compaction**: fewer calls, but stale assumptions survive compaction and a crash loses state.
- **LLM-only review**: measured false approvals (sprint 5: judge 9/10 on code that double-books) rule it out.
