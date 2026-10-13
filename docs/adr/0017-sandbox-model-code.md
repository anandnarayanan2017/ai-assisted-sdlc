# ADR-0017: Sandbox model-generated code

Status: accepted · Date: 2026-10-13

## Context

Benchmark and pipeline execute untrusted model output.

## Decision

Codegen samples run in a fresh `node --permission` process (read-only own temp dir, no child processes/workers/addons, network blocked on Node >= 25) with a 10 s timeout, inside the Docker container. Pipeline writes are confined to the workspace; DB is throwaway tmpfs.

## Alternatives considered

vm module (not a security boundary); per-sample containers (strong but slow); no sandbox.

## Consequences

Cheap, layered isolation. Gap on host Node 22 network (TD-7).
