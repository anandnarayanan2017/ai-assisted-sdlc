# New user onboarding

Status: shipped · Last verified: 2026-10-13

## Goal

A new engineer goes from `git clone` to (1) a passing scripted pipeline run and (2) their first model comparison
in **under 15 minutes**, with at most one API key.

## Journey

| Step | Command | Expected result | Time |
|---|---|---|---|
| 1. See it work, free | `docker compose up --build --abort-on-container-exit --exit-code-from demo` | 6 sprints, two repaired, `RELEASED` | ~2 min |
| 2. Prove the benchmark is sound, free | `docker compose --profile bench run --rm bench` | `reference` 100%, `empty` 0% | ~1 min |
| 3. Add a key | `cp .env.example .env`, set e.g. `ANTHROPIC_API_KEY` and/or `OPENAI_API_KEY` | — | 1 min |
| 4. First comparison | `docker compose --profile bench run --rm bench npm run bench -- --suite codegen --models reference,claude-sonnet-5-5,openai-gpt` | leaderboard in terminal and `benchmarks/results/` | ~2 min |
| 5. Agentic comparison | `... npm run bench -- --suite sdlc --models reference,claude-sonnet-5-5 --max-features 2` | resolved sprints per model | ~5 min |

## Acceptance criteria

- Steps 1-2 need no key and no network beyond image pulls.
- A missing key never fails a run: that model is listed as `SKIP <id>: <ENV> is not set`.
- Every failure message names the fix (missing key, unknown model id, stale docs).
- README, AGENTS.md and this spec give the same commands (checked by hand at each release; see tech-debt tracker).

## Non-goals

Hosted dashboard, account system, GUI. The terminal and Markdown reports are the interface.
