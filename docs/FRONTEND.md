# Frontend

There is **no UI** in this repository today. The harness is a CLI, the example is a JSON API, and the benchmark's
interface is the terminal plus Markdown reports. This file holds the rules for when that changes, so the first UI
does not invent its own conventions.

## Current "frontends"

| Surface | Rules |
|---|---|
| Terminal output (`cli.ts`, `bench/cli.ts`) | One line per event, a fixed prefix (`PLANNER`, `CHECK PASS`, `SKIP`), progress dots `. F E` for samples, a summary block at the end. Never print secrets. |
| Markdown reports (`report.md`, `docs/generated/benchmark-*.md`) | GitHub-flavoured tables, ranked best-first, CI and sample count always shown, a caveat line under the table. |

## If an example gains a UI

- Stack: the most boring choice that fits (server-rendered HTML or a small React/Vite app); add it to the example's
  `architecture.json` `allowedPackages` and an exec plan.
- Legibility for agents: every interactive element has an accessible name or `data-testid`; the app starts with one
  command and exposes a readiness URL (`Example.app.ready`) so the prober can drive it with Playwright `page`.
- The evaluator's probes switch from the `request` fixture to `page`; screenshots of failures are saved under
  `.harness/probes/` for the evaluator and humans.
- Accessibility: WCAG 2.2 AA contrast, keyboard reachable, visible focus. Checked with Playwright + axe in the contract.

## If the benchmark gains a dashboard

Read `summary.json` files; never recompute metrics in the UI. Show intervals, not just point estimates.
