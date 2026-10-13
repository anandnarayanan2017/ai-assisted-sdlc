# Model benchmark

Status: shipped (v1) · Last verified: 2026-10-13 · Design: [benchmark-methodology.md](../design-docs/benchmark-methodology.md)

## Problem

Teams pick LLMs by marketing benchmarks that do not match their work, and cannot tell whether a new model version is
better *for them*. They need a cheap, repeatable comparison across vendors on the work this harness does.

## Users and questions they ask

| User | Question |
|---|---|
| Solution architect | Which vendor/model should power the generator role? At what cost per resolved task? |
| Platform team | Did the new model version regress on our tasks? (run in CI on a schedule) |
| Researcher | Which harness components still pay off with a stronger model? (sdlc suite + ablation flags) |

## Requirements

1. Any vendor with an Anthropic or OpenAI-compatible API, plus local open-weights servers, configured in one JSON file.
2. Two suites: `codegen` (fast, HumanEval-style) and `sdlc` (agentic, fixed contracts, hidden tests).
3. Scoring by execution only. Mandatory `reference` and `empty` baselines.
4. Report: ranked table with pass@k, 95% CI, latency, tokens, cost; per-task / per-sprint matrix; raw JSONL.
5. Missing keys skip a model; API errors count as failures; one model's crash does not stop the run.
6. Runs offline in CI with baselines only; `--publish` writes the report to `docs/generated/`.

## Usage

```bash
npm run bench -- --suite codegen --models reference,empty,claude-sonnet-5-5,openai-gpt,google-gemini
npm run bench -- --suite codegen --models all --samples 5 --k 1,5          # pass@1 and pass@5
npm run bench -- --suite sdlc --models reference,claude-sonnet-5-5 --live-roles generator
npm run bench -- --suite sdlc --models claude-opus-5-5 --live-roles planner,contract,generator,prober,evaluator
```

## Example output (offline baselines; real numbers appear once keys are set)

```
| Rank | Model     | Vendor   | pass@1 | 95% CI (pass@1) | Solved | API errors | p50 / p95 latency | Tokens in / out | Cost    |
| 1    | reference | baseline | 100.0% | 75.7% - 100.0%  | 12/12  | 0          | 0.0s / 0.0s       | 0 / 0           | $0.0000 |
| 2    | empty     | baseline | 0.0%   | 0.0% - 24.3%    | 0/12   | 0          | 0.0s / 0.0s       | 0 / 0           | $0.0000 |
```

## Success metrics

- A three-vendor codegen comparison costs under $1 and finishes under 5 minutes.
- Two runs of the same model at temperature 0 differ by no more than their confidence intervals.
