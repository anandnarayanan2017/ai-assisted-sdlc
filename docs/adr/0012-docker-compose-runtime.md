# ADR-0012: Docker Compose as the only required runtime; pinned images

Status: accepted · Date: 2026-10-13

## Context

Contributors and CI must get identical environments, including Postgres, without local installs.

## Decision

`docker compose` services: `db`, `demo`, `unit`, `live`, `bench`. Images pinned by digest, Actions by SHA, Dependabot proposes updates. Local non-Docker path kept for development.

## Alternatives considered

Devcontainers only; Nix (reproducible, but steep for most teams).

## Consequences

One command per mode; CI runs exactly the README commands.
