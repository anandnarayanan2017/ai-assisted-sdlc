# ADR-0013: Two LLM wire formats cover all vendors

Status: accepted · Date: 2026-10-13

## Context

We compare many vendors without per-vendor code paths.

## Decision

All roles use one type `LLM = (role, system, user) => Promise<string>`, implemented by an Anthropic Messages adapter and an OpenAI Chat Completions adapter (OpenAI, Gemini, Mistral, DeepSeek, OpenRouter, Ollama, vLLM). Vendors are JSON entries in `benchmarks/models.json`; keys by env var name.

## Alternatives considered

One adapter per vendor; a gateway library as a dependency (still usable as an `openai-compatible` base URL).

## Consequences

Adding a vendor is configuration. Vendor quirks become flags (`maxTokensParam`, default temperature).
