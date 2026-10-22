# References

Condensed, version-pinned API notes in the `llms.txt` style: what an agent needs to use a dependency correctly
without browsing. One file per dependency the harness or the example project relies on. Update the file in the
same PR that bumps the dependency's major version.

| File | Covers |
|---|---|
| [express-5-llms.txt](express-5-llms.txt) | Express 5 (example project HTTP layer) |
| [node-postgres-llms.txt](node-postgres-llms.txt) | `pg` 8 (pool, transactions, error codes) |
| [zod-3-llms.txt](zod-3-llms.txt) | zod 3 (request validation) |
| [vitest-llms.txt](vitest-llms.txt) | vitest 3 (harness and contract tests) |
| [playwright-test-llms.txt](playwright-test-llms.txt) | @playwright/test (evaluator probes) |
| [llm-provider-apis-llms.txt](llm-provider-apis-llms.txt) | Anthropic Messages and OpenAI Chat Completions wire formats |
