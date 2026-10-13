# Plans

How work bigger than one small change is planned, tracked and closed. Plans are first-class, versioned artifacts:
an agent picking up the work tomorrow reads the plan, not a chat log.

## When to write one

| Change | Plan |
|---|---|
| One file, obvious fix, has a test | none: the PR description is enough |
| Several files, one session | lightweight: a checklist in the PR description |
| Several sessions, a new dependency, a schema or API change, or anything a human must approve | **exec plan** in `docs/exec-plans/active/` |

## Exec plan format

File: `docs/exec-plans/active/NNN-short-name.md` (next free number). Required header line: `Status:` one of
`proposed`, `in-progress`, `blocked` (active) or `completed` (completed). `npm run docs:check` enforces it.

```markdown
# NNN: Title
Status: proposed · Owner: <human> · Driver: <agent or human> · Started: YYYY-MM-DD

## Goal            what is true when this is done (measurable)
## Non-goals
## Context         links to specs, design docs, prior plans
## Plan            numbered steps, each small enough for one PR, each with its verification command
## Decisions       dated log: decision, alternatives, why
## Progress        dated log, newest last: what changed, what was verified, what is next
## Risks / open questions
```

## Lifecycle

1. `proposed` -> a human approves the goal and non-goals (comment or PR review).
2. `in-progress` -> the driver updates **Progress** at the end of every session, so a fresh agent can resume.
3. `blocked` -> say what unblocks it and who decides.
4. Done -> set `Status: completed`, add the outcome and follow-ups, `git mv` it to `docs/exec-plans/completed/`.
   Follow-ups that are not scheduled go to the [tech-debt tracker](exec-plans/tech-debt-tracker.md).

Plans are never deleted: completed plans are the project's memory of *why*.
