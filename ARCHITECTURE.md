# ARCHITECTURE.md

Top-level map of the code: domains, layers, and the rules between them. Diagrams (system, sequence, state machine,
Docker topology) are in [docs/architecture.md](docs/architecture.md); the reasons behind the shape are in
[docs/adr/](docs/adr/index.md) (decision records) and [docs/design-docs/](docs/design-docs/index.md).

## Domains

| Domain | Code | Owns | Depends on |
|---|---|---|---|
| **Provider adapters** | `harness/src/llm.ts` | One `LLM` function type; Anthropic Messages and OpenAI-compatible Chat Completions clients; usage reporting; retry/backoff | `fetch` only |
| **Delivery loop** | `harness/src/harness.ts` | Planner, contract, generator, check, evaluator, retries, resume, human gate | adapters (type only), verification |
| **Verification** | `architecture.ts`, `probe.ts`, `calibration.ts` | Import-graph rules, live Playwright probes, judge calibration | node built-ins |
| **Benchmark** | `harness/src/bench/` | Model registry, codegen suite, statistics, leaderboard reports | adapters, (sdlc suite: the pipeline CLI as a child process) |
| **Knowledge base tooling** | `harness/src/docs.ts`, `docs-cli.ts` | Generated docs, docs lint | node built-ins |
| **Composition roots** | `harness/src/cli.ts`, `bench/cli.ts`, `calibrate.ts`, `docs-cli.ts` | Wiring flags, env and files into the domains | everything above |
| **Example project** | `examples/room-booking/` | Request, recorded script, seed, architect rules, calibration set | the `Example` interface |

## Layers and allowed dependencies

```
 composition roots (cli.ts, bench/cli.ts, calibrate.ts, docs-cli.ts)
        |                       |
        v                       v
   benchmark (bench/*)  --->  delivery loop (harness.ts) ---> verification
        |                       |
        +-----------> provider adapters (llm.ts) <------------+
```

- Dependencies point **down** only. The core (`harness.ts`, `llm.ts`, verification) never imports `bench/`;
  `harness/test/docs.test.ts` fails the build if it does.
- The benchmark reaches the delivery loop **through the CLI as a separate process** (one per model), so a model that
  hangs or crashes a run cannot take down the comparison, and each run's `.harness/` is archived next to its score.
- Composition roots are the only place that reads `process.argv`, `.env`-style variables or `benchmarks/models.json`.

## Data and state

| Where | What | Written by |
|---|---|---|
| `examples/<name>/workspace/.harness/` | spec, contracts, progress, every model call, `metrics.json` | delivery loop, pipeline CLI |
| `examples/<name>/workspace/` git | one commit per generator attempt | delivery loop |
| `benchmarks/results/<suite>-<ts>/` | `results.jsonl` (raw), `summary.json`, `report.md`, per-model `.harness/` copies | benchmark CLI |
| `docs/generated/` | db schema, published leaderboards | `npm run docs:gen`, `npm run bench -- --publish` |

## Generated application (room-booking) architecture

Enforced by `examples/room-booking/architecture.json` on every sprint: routes are independent of each other; `http`,
`auth` and `db` never import upward; only `src/server.ts` creates the `pg` Pool; `src/db/` is framework-free;
packages limited to `express`, `pg`, `zod`. Schema: [docs/generated/db-schema.md](docs/generated/db-schema.md).

## Cross-cutting concerns

- **Observability**: every model call is a JSON transcript (`.harness/calls/NNN-role.json`: prompt, reply, latency);
  every run writes `metrics.json` (sprints, attempts, tokens, cost, wall time). See [docs/RELIABILITY.md](docs/RELIABILITY.md).
- **Security**: secrets via env only; model code executed in a sandboxed child process. See [docs/SECURITY.md](docs/SECURITY.md).
- **Determinism**: the scripted LLM and the `reference` / `empty` baselines make every path testable offline.
