# ADR-0009: Calibrate the evaluator against human grades

Status: accepted · Date: 2026-10-13

## Context

An LLM judge's leniency is unknown until measured.

## Decision

`calibration.json` holds real evaluator inputs with human grades; they are few-shot examples in every evaluator prompt and `npm run calibrate` reports agreement and false approvals (exit 1 on any).

## Alternatives considered

Prompt-only rubric (no measurement); fine-tuning a judge (cost, data volume).

## Consequences

Judge quality is a number that can regress in CI.
