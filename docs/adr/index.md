# Architecture Decision Records

Format: MADR-lite (context, decision, alternatives, consequences). Accepted ADRs are immutable; supersede with a new one.
`npm run docs:check` fails if a file here is missing from this table.

| ADR | Decision | Status |
|---|---|---|
| [ADR-0001](0001-record-architecture-decisions.md) | Record architecture decisions | accepted |
| [ADR-0002](0002-typescript-on-node.md) | TypeScript on Node.js, ESM, no build step | accepted |
| [ADR-0003](0003-zero-runtime-dependencies.md) | Zero runtime dependencies; plain fetch instead of vendor SDKs | accepted |
| [ADR-0004](0004-stateless-agents-file-handoff.md) | Stateless agents; state in files and git | accepted |
| [ADR-0005](0005-deterministic-check-outranks-judge.md) | A deterministic check outranks the LLM judge | accepted |
| [ADR-0006](0006-enforced-architecture-rules.md) | Architecture rules are enforced mechanically | accepted |
| [ADR-0007](0007-contract-owns-tests.md) | The contract owns the acceptance tests | accepted |
| [ADR-0008](0008-human-release-gate.md) | Human approval gate before release | accepted |
| [ADR-0009](0009-calibrated-evaluator.md) | Calibrate the evaluator against human grades | accepted |
| [ADR-0010](0010-example-stack-express-pg-zod.md) | Example app: Express 5 + PostgreSQL + zod | accepted |
| [ADR-0011](0011-vitest-and-playwright.md) | Vitest for tests, Playwright for live probes | accepted |
| [ADR-0012](0012-docker-compose-runtime.md) | Docker Compose as the only required runtime; pinned images | accepted |
| [ADR-0013](0013-two-llm-wire-formats.md) | Two LLM wire formats cover all vendors | accepted |
| [ADR-0014](0014-execution-based-benchmarking.md) | Benchmarks score by execution only | accepted |
| [ADR-0015](0015-fixed-contracts-sdlc-benchmark.md) | SDLC benchmark replays plan and contracts | accepted |
| [ADR-0016](0016-baselines-and-statistics.md) | Mandatory baselines; pass@k and Wilson intervals | accepted |
| [ADR-0017](0017-sandbox-model-code.md) | Sandbox model-generated code | accepted |
| [ADR-0018](0018-agents-md-knowledge-base.md) | AGENTS.md is a map; docs/ is the system of record | accepted |
| [ADR-0019](0019-exec-plans.md) | Execution plans are versioned artifacts | accepted |

New ADR: next number, copy an existing file's headings, add a row here, link it from the PR.
