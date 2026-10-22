# Reliability

What the harness and benchmark guarantee when things go wrong, and how to observe them.

## Failure handling

| Failure | Behaviour | Where |
|---|---|---|
| API 429 / 5xx | Exponential backoff, 4 retries (2, 4, 8, 16 s), then error | `llm.ts` `post()` |
| Truncated reply | Error (never act on half an answer) | both adapters |
| Unparseable model reply | Error with the first 200 chars; the run stops, the CLI records it as `blocked` in `metrics.json`; `--resume` retries from the last finished sprint | `parseJSON`, `cli.ts` |
| Check hangs | Killed after `checkTimeoutMs` (180 s) | `harness.ts` `gate()` |
| Model code hangs (codegen) | Killed after 10 s, counted as a failed sample | `codegen.ts` `execute()` |
| Sprint fails 3 attempts | Run `blocked`, exit 1, later sprints not attempted | `harness.ts` |
| Process crash mid-run | `--resume` continues from `.harness/progress.json` | `harness.ts` |
| Model crashes a benchmark run | Child process per model; run recorded as blocked with metrics; next model continues | `bench/cli.ts`, `cli.ts` |
| Missing API key | Model skipped with a reason; run continues | `bench/models.ts` `unavailable()` |

## Observability

- **Transcripts**: `.harness/calls/NNN-role.json` (system prompt, input, reply, latency) for every call.
- **Run metrics**: `.harness/metrics.json` (status, sprints, attempts, first-try passes, calls, tokens, cost, wall time).
- **Benchmark data**: `benchmarks/results/<suite>-<ts>/results.jsonl` (every sample: pass, latency, tokens, error).
- **Git**: one commit per generator attempt in the workspace; `git log -p` replays the build.

## Reproducibility

- Scripted runs and baselines are deterministic and run in CI.
- Live runs are not reproducible. Use temperature 0 for pass@1, record model ids and the date, compare within
  confidence intervals, and archive `results.jsonl`.
- Docker images and GitHub Actions are pinned by digest/SHA; Dependabot proposes updates.

## Targets

- Scripted pipeline: green on every PR, < 2 min. Offline benchmark baselines: green on every PR, < 1 min.
- Live codegen run, 3 vendors x 12 tasks: < 5 min.
