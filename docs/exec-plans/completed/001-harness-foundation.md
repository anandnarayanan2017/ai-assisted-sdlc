# 001: Harness foundation (v0.1 - v0.3)

Status: completed · Owner: maintainers · Completed: 2026-10-01

## Goal

A tested harness that builds the room-booking API end to end, catches a judge that approves broken code, and runs
entirely in Docker.

## Outcome

- Planner / contract / generator / check / evaluator loop with resume and a human gate.
- Architecture rules as part of the deterministic gate; contract tests restored before every check.
- Live Playwright probes and evaluator calibration against human grades (`npm run calibrate`).
- Pinned images, Docker CI, `/sdlc` skill. Record of a real run: [run-log.md](../../run-log.md).

## Decisions

- Deterministic check outranks the evaluator (sprint 5: judge 9/10, check fails; the check wins).
- No SDK dependency for the model client.

## Follow-ups

Per-phase cost and time tracking (TD-6), ablation switches, browser probes once an example has a UI.
