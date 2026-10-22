# Product sense

How to make trade-offs when the spec is silent. Read before adding a flag, a metric or a feature.

## Who we serve

1. **Solution architects and tech leads** deciding which model and harness design to adopt. They want a defensible
   answer, with cost, in an afternoon.
2. **Platform teams** running AI-assisted delivery. They want regressions caught before a model swap reaches users.
3. **Agents working in this repo.** They need everything legible: one map, clear errors, runnable checks.

## What good looks like

- **Trust over features.** One number people believe beats ten they argue about. Every metric is execution-based,
  shows its uncertainty, and links to raw data.
- **Cheap by default.** Defaults run offline or for cents (`reference,empty`, `--samples 1`, `--max-features`).
  Expensive runs are explicit.
- **Zero to result fast.** If onboarding takes more than 15 minutes, that is a bug ([new-user-onboarding.md](product-specs/new-user-onboarding.md)).
- **Vendor-neutral.** No vendor gets special prompts, defaults or wording. Adding one is a JSON entry.
- **Honest failure.** A blocked sprint, a skipped model or an API error is reported plainly, never hidden or retried
  until it looks good.

## Trade-off rules of thumb

| Tension | Default |
|---|---|
| Accuracy vs cost | Show both; rank by accuracy, let the reader sort by cost per resolved task |
| More tasks vs faster runs | More tasks, but keep the default run under 5 minutes |
| Flexibility vs comparability | Comparability: fixed prompts and budgets in a comparison run |
| New capability vs simplicity | Simplicity, unless a user question in a product spec needs it |
