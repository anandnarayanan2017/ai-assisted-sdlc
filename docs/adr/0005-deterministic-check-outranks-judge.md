# ADR-0005: A deterministic check outranks the LLM judge

Status: accepted · Date: 2026-10-13

## Context

In the recorded run the evaluator scored 9/10 on code that double-booked rooms under load.

## Decision

A sprint passes only if the contract's check command exits 0 AND architecture rules pass AND evaluator scores meet thresholds. The evaluator can add failures, never remove one.

## Alternatives considered

LLM review as the gate (measured false approvals); check only, no evaluator (misses craft and probe findings).

## Consequences

Broken code cannot be approved by a lenient judge. Requires every contract to carry a runnable check.
