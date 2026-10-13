# Tech-debt tracker

Known drift and shortcuts, ranked. Agents add rows when they notice debt they are not fixing now; small items are
paid down continuously ("garbage collection") rather than in big cleanups. Remove a row in the PR that fixes it.

| ID | Area | Debt | Impact | Fix | Size |
|---|---|---|---|---|---|
| TD-1 | benchmark | Wilson CI treats samples of the same task as independent | CI too narrow with `--samples` > 1 | Per-task bootstrap ([003](active/003-benchmark-v2.md)) | S |
| TD-2 | benchmark | sdlc suite runs models sequentially on one workspace and DB | Slow; no parallel runs | Workspace and schema per model | M |
| TD-3 | benchmark | `price` entries in `benchmarks/models.json` are null | Cost column shows n/a | Fill from vendor pricing pages, record the date | S |
| TD-4 | harness | `harness.ts` sends the whole workspace snapshot to every role | Token cost grows with the project | Role-specific context (contract + touched files) | M |
| TD-5 | docs | README, AGENTS.md and onboarding spec repeat commands | Drift risk | Docs lint check that the commands match | S |
| TD-6 | harness | No per-phase timing / cost in `metrics.json` | Hard to see where a model spends | Record per-role usage and latency | S |
| TD-7 | security | Codegen sandbox relies on the Node permission model; network is only blocked on Node >= 25 | Model code could reach the network on Node 22 locally | Run benchmarks in Docker (Node 26) or add `--network none` container | S |
