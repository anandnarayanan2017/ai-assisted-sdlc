# Provider adapters

Status: accepted · Owner: maintainers · Last verified: 2026-10-13

Code: `harness/src/llm.ts`, registry `benchmarks/models.json`, wiring `harness/src/bench/models.ts`.

## Decision

Everything in the harness talks to one type: `LLM = (role, system, user) => Promise<string>`. Two adapters implement it:

| Adapter | Wire format | Covers |
|---|---|---|
| `anthropicLLM` | Anthropic Messages API | Claude models |
| `openAICompatibleLLM` | OpenAI Chat Completions | OpenAI, Google Gemini (OpenAI-compatible endpoint), Mistral, DeepSeek, Groq, Together, OpenRouter, Azure OpenAI, vLLM, Ollama, LM Studio |

Both: plain `fetch`, no SDK; retry with exponential backoff on 429/5xx (4 retries); throw on truncation
(`max_tokens` / `finish_reason: length`) instead of returning half an answer; report token usage through `onUsage`.

Adding a vendor = adding a JSON entry (`provider`, `model`, `baseUrl`, `apiKeyEnv`, `price`). A new adapter is only
needed for a vendor with no OpenAI-compatible endpoint; it must satisfy the same contract and get a test with a local
HTTP server (see `harness/test/bench.test.ts`).

## Why not SDKs or a gateway library

- Zero runtime dependencies keeps the supply-chain surface and the Docker image small.
- Request shapes stay visible and testable; vendor quirks are one flag each (`maxTokensParam`, temperature omitted).
- A gateway (LiteLLM, OpenRouter) still works: point an `openai-compatible` entry at it.

## Known quirks

- OpenAI reasoning models: `max_completion_tokens`, default temperature only (`--temperature default`).
- Gemini via the OpenAI-compatible endpoint: base URL `https://generativelanguage.googleapis.com/v1beta/openai`.
- Local servers often have small context windows: set `maxTokens` and keep the SDLC suite to `--max-features 2`.
