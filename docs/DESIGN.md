# Design (code taste)

The conventions that keep agent-written code consistent. Where a rule can be checked, it is; the rest is taste
that reviewers (human or agent) apply. Architecture-level rules are in [ARCHITECTURE.md](../ARCHITECTURE.md).

## Language and tooling

- TypeScript, ESM (`"type": "module"`, NodeNext), `strict` + `noUncheckedIndexedAccess`. No `any` without a comment.
- Run with `tsx`; no build step. Node >= 22 (Docker uses Node 26).
- Tests: vitest. One behaviour per `it`, named as the behaviour ("retries until the check passes").

## Code shape

- **Small modules with one job**; a module's top comment says what it owns in one or two lines.
- **Functions over classes** unless there is real state (`Harness` holds config and paths; that is the bar).
- **Parse at the boundary**: model replies go through `parseJSON`, files through `JSON.parse` with a typed shape,
  and nothing downstream re-validates. Unknown shapes fail loudly with the first 200 characters of the input.
- **Errors are instructions.** A thrown or printed error names what to do next
  (`docs/generated/db-schema.md is stale: run npm run docs:gen`). Agents follow error text literally.
- **No hidden I/O in core modules.** Only composition roots (`cli.ts`, `bench/cli.ts`, ...) read argv, env or the
  registry file; core functions take what they need as parameters.
- **Zero runtime dependencies in the harness.** `fetch`, `node:*` built-ins. A new dependency needs an exec plan line.
- Comments explain *why*; the code says *what*. Match the existing comment density.

## Naming

- Files: lower-case, one concept (`codegen.ts`, `stats.ts`). Tests mirror the area (`bench.test.ts`).
- Benchmark task ids: `HarnessEval/<n>`; model ids in the registry: `vendor-family` or the vendor's model id.
- Exec plans: `NNN-short-name.md`.

## Prompts are code

Role prompts live in `PROMPTS` in `harness/src/harness.ts` and the codegen `SYSTEM` prompt in `bench/codegen.ts`.
Changing one changes behaviour of every model: re-run the benchmark (and `npm run calibrate` for the evaluator)
and note the before/after in the PR.
