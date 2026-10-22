# Design docs

Decisions and the reasoning behind them. Each doc has a status and is verified against the code when touched.
`npm run docs:check` fails if a file in this folder is missing from this table.

| Doc | Status | Summary |
|---|---|---|
| [core-beliefs.md](core-beliefs.md) | accepted | The operating principles every agent and human follows here |
| [harness-loop.md](harness-loop.md) | accepted | Why planner / contract / generator / check / evaluator are separate, and what each one assumes |
| [provider-adapters.md](provider-adapters.md) | accepted | One `LLM` function type, two wire formats, every vendor |
| [benchmark-methodology.md](benchmark-methodology.md) | accepted | How models are compared: execution-based scoring, pass@k, confidence intervals, fairness rules |

New design doc: copy the header of an existing one (title, `Status:`, `Owner:`, `Last verified:`), add a row here.
