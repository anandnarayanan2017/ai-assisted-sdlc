# Benchmark methodology

Status: accepted · Owner: maintainers · Last verified: 2026-10-13

How this repo compares LLMs and vendors. Code: `harness/src/bench/`. Product requirements:
[model-benchmark.md](../product-specs/model-benchmark.md).

## Two suites, one principle

**Score by execution, never by an LLM judge.** Every number on the leaderboard comes from running hidden tests.

| Suite | Industry analogue | Measures | Unit of scoring | Cost per model |
|---|---|---|---|---|
| `codegen` | HumanEval / MBPP (Chen et al. 2021) | Function-level coding ability | task passes its hidden unit tests | 12 calls x samples, cents |
| `sdlc` | SWE-bench style (fixed issue, hidden tests) | Agentic, multi-file, multi-turn delivery with feedback | sprint passes typecheck + vitest on Postgres + architecture rules within 3 attempts | ~10-25 calls, dollars |

### codegen

- 12 original JavaScript tasks (`benchmarks/codegen/tasks.jsonl`), HumanEval schema
  (`task_id, prompt, entry_point, canonical_solution, test`). Original tasks reduce training-data contamination; the
  schema lets you drop in a translated public set (for example MultiPL-E HumanEval-JS) with `--tasks`.
- Tasks are edge-case heavy (semver precedence, strict parsing, O(n log n) requirement, truncating division) so strong
  models separate from weak ones; trivial tasks only measure noise.
- The model gets the signature + docstring, replies with a fenced code block; the harness extracts the last block
  and runs it in a fresh Node process with the permission model (no fs writes, no child processes), 10 s timeout.
- **Metrics**: pass@k with the unbiased estimator `1 - C(n-c, k) / C(n, k)` averaged over tasks; 95% Wilson
  interval over all samples; tasks solved at least once; API errors; p50/p95 latency; tokens; cost.
- **Sampling convention**: `--samples 1` uses temperature 0 (pass@1, near-greedy). `--samples n --k 1,5` uses
  temperature 0.8 (the HumanEval paper's setting for pass@k). Models that reject temperature: `--temperature default`.

### sdlc

- Same project (room-booking, 6 sprints), same plan, same contract tests, same probes, same evaluator: they are
  replayed from the recorded run. Only the roles in `--live-roles` (default `generator`) go to the model under test.
  This isolates **implementation ability** and makes runs comparable, like SWE-bench fixing the issue and the tests.
- `--live-roles planner,contract,generator,prober,evaluator` benchmarks the full autonomous loop instead. Scores are
  then less comparable (each model writes its own tests); report them separately.
- **Metrics**: resolved sprints (headline), first-try passes, attempts used, final status, calls, tokens, cost,
  wall time. Per-sprint matrix shows *where* a model breaks (sprint 5 concurrency is the usual separator).

## Baselines are mandatory

Every run includes `reference` (canonical answers / recorded turns, must be 100%) and `empty` (stub, must be 0%).
If `reference` drops below 100% the tests or the sandbox are broken; if `empty` scores above 0% a test is vacuous.
Both are asserted in CI.

## Fairness rules

1. Same prompt, same tasks, same max tokens, same attempt budget for every model. No per-model prompt tuning in a
   comparison run (tune separately, then re-run everyone).
2. Report the temperature and sample count with the numbers (the report header does).
3. API errors count as failures: availability is part of what a vendor sells. Retries with backoff are applied
   equally to all.
4. Quote the confidence interval. **Overlapping intervals = no established ranking.** With 12 tasks a single run
   cannot separate models a few points apart; raise `--samples`, add tasks, or repeat runs.
5. Keep raw data: `results.jsonl` and, for sdlc, every transcript. A leaderboard row must be auditable.
6. Fill `price` in `benchmarks/models.json` from vendor pricing pages on the run date; cost per resolved task is
   often the deciding number, not raw accuracy.

## Limitations

- 12 tasks is a smoke-scale benchmark: good for regressions and coarse ranking, not for fine-grained claims.
- The Wilson interval treats samples as independent; samples of the same task are correlated, so the true
  uncertainty is somewhat wider. A per-task bootstrap is on the roadmap ([exec plan](../exec-plans/active/003-benchmark-v2.md)).
- One language (JavaScript/TypeScript). Results do not transfer automatically to other stacks.
- The recorded evaluator in the sdlc suite approves whenever the check and probes pass; it measures the generator,
  not judging ability. Judge quality is measured separately by `npm run calibrate`.
