# ADR-0002: TypeScript on Node.js, ESM, no build step

Status: accepted · Date: 2026-10-13

## Context

The harness orchestrates processes, files, git and HTTP. The example app and its tests are JS/TS. Agents (and models under test) write TypeScript well because it is heavily represented in training data.

## Decision

TypeScript `strict` + `noUncheckedIndexedAccess`, ESM/NodeNext, Node >= 22 (Docker: Node 26), executed with `tsx` (no compile step). One language for harness, example app, tests and benchmark tasks.

## Alternatives considered

Python (strong ML ecosystem, but a second language next to the TS example app and its tooling); Go (great CLIs, weaker for the generated web app and its tests).

## Consequences

One toolchain, one `tsc` for typechecking everything, fast iteration. Benchmark results speak for JS/TS work only (see ADR-0013).
