# Core beliefs

Status: accepted · Owner: maintainers · Last verified: 2026-10-13

These are the beliefs the harness is built on. They are written for agents first: short, checkable, and each tied to
the mechanism that enforces it. Sources: Anthropic's
[Harness design for long-running application development](https://www.anthropic.com/engineering/harness-design-long-running-apps)
(beliefs 5-7, 9, 11) and OpenAI's [Harness engineering](https://openai.com/index/harness-engineering/) (beliefs 1-4, 10).

1. **Humans steer, agents execute.** People decide what to build and whether to release; agents do the typing.
   *Mechanism*: the human gate (`--approve`), exec plans written for humans to review.
2. **The repository is the system of record.** If knowledge is not in the repo, an agent cannot see it.
   Slack threads, meeting notes and chat decisions must land in `docs/`. *Mechanism*: AGENTS.md map, docs lint.
3. **Give a map, not a manual.** Context is scarce; a giant instruction file crowds out the task. AGENTS.md points,
   docs explain, references hold API detail. Agents load what the task needs (progressive disclosure).
4. **Enforce invariants mechanically, not by review.** Architecture rules, layering, contract-test ownership and docs
   freshness are checked by code whose error messages tell the agent how to fix the problem.
5. **A deterministic check outranks an LLM judge.** The judge can add failures, never overrule a red check.
   Benchmarks score by executing hidden tests.
6. **The builder is never the judge.** Separate contexts, separate prompts, and the judge is calibrated against human
   grades (`npm run calibrate`) before it is trusted near a release.
7. **Make the app legible to the agent.** The agent can boot the app, hit it with Playwright, read transcripts and
   metrics. What the agent cannot observe, it cannot fix.
8. **Prefer boring technology.** Stable, well-documented, well-represented-in-training libraries; few of them.
   The harness has no runtime dependencies at all.
9. **Fail closed and escalate.** A sprint that exhausts its retries blocks the run; nobody builds on a broken base.
10. **Pay down entropy continuously.** Agents copy whatever patterns exist, good or bad. Record drift in the
    tech-debt tracker, fix it in small PRs, often ("garbage collection"), instead of in rare big cleanups.
11. **Every component encodes an assumption about model weakness.** Re-test them as models improve (ablation table
    in [docs/architecture.md](../architecture.md)) and delete what is no longer needed. The benchmark exists partly to
    measure exactly this.
12. **Measure before you trust.** A model, prompt or harness change is "better" only when a benchmark run with
    confidence intervals says so.
