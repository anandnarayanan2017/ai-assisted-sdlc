# Architecture

Design basis: Anthropic's [Harness design for long-running application development](https://www.anthropic.com/engineering/harness-design-long-running-apps).
Core idea: **the agent that builds is never the agent that judges**, agents share no context window,
and all state moves through files and git.

## 1. System architecture

```mermaid
flowchart TB
    subgraph Human["Human control plane"]
        REQ["Request / backlog item"]
        GATE["Approval gate<br/>(merge / release)"]
        ESC["Escalation<br/>(blocked sprint)"]
    end

    subgraph Orchestrator["Orchestrator (harness.ts) - owns the loop, holds no model context"]
        ORCH["Sprint scheduler<br/>retry budget, thresholds,<br/>resume from progress.json"]
    end

    subgraph Agents["Stateless agents - fresh context per call"]
        PLAN["Planner<br/>request -> spec"]
        CTR["Contract negotiator<br/>defines 'done' + runnable check"]
        GEN["Generator<br/>implements one feature"]
        EVAL["Skeptical Evaluator<br/>scores + files bugs"]
    end

    subgraph Verify["Deterministic verification"]
        CHK["Check command<br/>tests, lint, typecheck,<br/>Playwright, API/DB probes"]
    end

    subgraph State["Shared state (the only handoff channel)"]
        SPEC[("spec.json")]
        CON[("contracts/NN.json<br/>done + check + acceptance tests")]
        PROG[("progress.json")]
        GIT[("git history<br/>+ source tree")]
    end

    LLM[["LLM API"]]

    REQ --> ORCH
    ORCH --> PLAN --> SPEC
    ORCH --> CTR
    SPEC --> CTR --> CON
    ORCH --> GEN
    CON --> GEN --> GIT
    GIT --> CHK
    CON --> CHK
    CHK -- "exit code + output" --> EVAL
    CON --> EVAL
    EVAL -- "scores + bugs" --> ORCH
    ORCH <--> PROG
    ORCH -- "all sprints pass" --> GATE
    ORCH -- "retries exhausted" --> ESC
    PLAN & CTR & GEN & EVAL -.-> LLM
```

## 2. End-to-end flow (sequence)

```mermaid
sequenceDiagram
    autonumber
    actor H as Human
    participant O as Orchestrator
    participant P as Planner
    participant C as Contract
    participant G as Generator
    participant K as Check (deterministic)
    participant E as Evaluator
    participant S as Files + git

    H->>O: request (1-4 sentences)
    O->>P: expand
    P->>S: write spec.json
    O->>S: progress = building

    loop each feature (sprint)
        O->>C: negotiate contract
        C->>S: write contracts/NN.json (done, check argv, acceptance tests)
        loop attempt 1..N
            O->>G: feature + contract + prior QA bugs
            G->>S: write files, git commit
            O->>K: run contract.check
            K-->>O: exit code + output
            O->>E: contract + gate output
            E-->>O: scores + bugs
            alt gate OK and every score >= threshold
                O->>S: done[feature] = pass
            else retry budget left
                Note over O,G: bugs fed into next attempt
            else budget exhausted
                O->>S: status = blocked
                O-->>H: escalate, stop building
            end
        end
    end

    O->>H: awaiting_approval
    H-->>O: approve
    O->>S: status = released
```

## 3. Sprint state machine

```mermaid
stateDiagram-v2
    [*] --> Planning
    Planning --> Building: spec.json written
    state Building {
        [*] --> Contracting
        Contracting --> Generating: contracts/NN.json
        Generating --> Verifying: commit
        Verifying --> Evaluating: gate result
        Evaluating --> Passed: gate OK and scores >= thresholds
        Evaluating --> Generating: fail and attempts < max (bugs fed back)
        Evaluating --> Failed: fail and attempts == max
        Passed --> [*]
    }
    Building --> Blocked: any sprint Failed
    Building --> AwaitingApproval: all sprints Passed
    AwaitingApproval --> Released: human approves
    AwaitingApproval --> Building: human requests changes
    Blocked --> Building: human fixes spec/contract, resumes
    Released --> [*]
```

## 4. Pass/fail decision

```mermaid
flowchart LR
    A[Generator output] --> B{Check command<br/>exit 0?}
    B -- no --> F[FAIL<br/>bugs = gate output]
    B -- yes --> C{LLM scores<br/>all >= thresholds?}
    C -- no --> G[FAIL<br/>bugs = evaluator findings]
    C -- yes --> D[PASS]
    F --> R{attempts left?}
    G --> R
    R -- yes --> A
    R -- no --> X[BLOCK + escalate]
```

The deterministic gate comes first and **cannot be overridden by the evaluator**: a 10/10 from the
LLM does not pass failing code (unit test: *a deterministic check overrides a lenient evaluator*; live demo: sprint 5, attempt 1).

## 5. Where this sits in the SDLC

```mermaid
flowchart LR
    subgraph Classic["Classic SDLC"]
        direction LR
        R1[Requirements] --> D1[Design] --> I1[Implement] --> T1[Test] --> RV1[Review] --> REL1[Release]
    end
    subgraph Harness["Harness stage that owns it"]
        direction LR
        R2[Planner] --> D2[Contract] --> I2[Generator] --> T2[Check + Evaluator] --> RV2[Human gate] --> REL2[Released]
    end
    R1 -.- R2
    D1 -.- D2
    I1 -.- I2
    T1 -.- T2
    RV1 -.- RV2
    REL1 -.- REL2
```

## 6. Context strategy

```mermaid
flowchart TB
    Q{Model shows context<br/>anxiety or drift?}
    Q -- yes --> RESET["Context reset (this repo's default)<br/>every call is a fresh window;<br/>progress.json + git carry state"]
    Q -- no --> COMPACT["Single long session with<br/>automatic compaction<br/>(fewer calls, lower cost)"]
    RESET --> NOTE["Cost: orchestration overhead,<br/>handoff must be complete"]
    COMPACT --> NOTE2["Risk: shortened history<br/>keeps stale assumptions"]
```

## 7. Handoff artifacts

| File | Writer | Reader | Purpose |
|---|---|---|---|
| `.harness/spec.json` | Planner | Contract, Orchestrator | Ambitious scope, no implementation detail |
| `.harness/contracts/NN.json` | Contract negotiator | Generator, Check, Evaluator | Definition of done, runnable `check` argv, and the **acceptance tests**, which the harness restores before every check so the generator cannot weaken them |
| source tree + git | Generator | Check, Evaluator | Work product and rollback points |
| `.harness/progress.json` | Orchestrator | Orchestrator (next process) | Resume after crash or context reset |

## 8. Design assumptions to re-test as models improve

Each component encodes a belief that the model can't do something alone. Ablate one at a time.

| Component | Assumption | Test by |
|---|---|---|
| Planner | Model under-scopes from a short prompt | Skip it, compare feature count |
| Sprint contract | Model drifts from spec mid-build | Merge contract into generator prompt |
| Separate evaluator | Self-grading is lenient | Let generator self-score, compare escaped bugs |
| Per-sprint evaluation | Long builds need frequent QA | Evaluate once at the end |
| Context resets | Model gets anxious near the limit | Use compaction, compare completion |

## 9. Docker topology

Everything runs in containers; nothing needs to be installed on the host except Docker.

```mermaid
flowchart LR
    DEV([developer]) -- "docker compose up" --> C

    subgraph C["docker compose"]
        direction LR
        subgraph DEMO["demo (node:22, built from ./Dockerfile)"]
            CLI["cli.ts"] --> H["Harness"]
            H --> LLMX{{"LLM"}}
            H -- "writes files, git commit" --> WS[("examples/room-booking/<br/>workspace")]
            H -- "spawns check:<br/>npm run verify" --> V["tsc + vitest + supertest<br/>(runs the generated app)"]
            V --> WS
        end
        subgraph DB["db (postgres:16-alpine, tmpfs)"]
            PG[("rooms database")]
        end
        V -- "DATABASE_URL" --> PG
    end

    LLMX -. "default: scripted replay" .-> SCRIPT["script/NN-*/<br/>planner, contract, attempts"]
    LLMX -. "--llm anthropic<br/>ANTHROPIC_API_KEY" .-> API["Anthropic Messages API"]
```

`db` has a healthcheck, `demo` waits for it, and the exit code of `demo` is the exit code of the run
(non-zero when a sprint is blocked).

## 10. The room-booking run, sprint by sprint

Six sprints, 47 acceptance tests, two deliberate failures that the harness must catch and repair.

```mermaid
flowchart TB
    S1["1 Foundation<br/>migrations, schema, /health"] --> S2["2 Users + auth<br/>POST /users, GET /me"]
    S2 --> S3["3 Rooms CRUD<br/>admin-only writes"]
    S3 --> S4["4 Bookings<br/>create, list, cancel<br/>(check-then-insert)"]
    S4 --> S5["5 Concurrency<br/>20 parallel requests, 1 winner"]
    S5 --> S6["6 Availability<br/>GET /rooms/available"]
    S6 --> REL(["human approval, released"])

    S5 -. "attempt 1: transaction without a lock.<br/>Evaluator says 9/10, check FAILS (10 winners).<br/>Attempt 2: EXCLUDE USING gist constraint" .-> S5
    S6 -. "attempt 1: /rooms/:id registered before /rooms/available.<br/>Evaluator reports 400s. Attempt 2: reorder routes" .-> S6
```

```mermaid
sequenceDiagram
    autonumber
    participant O as Orchestrator
    participant G as Generator
    participant K as Check (npm run verify)
    participant PG as Postgres
    participant E as Evaluator

    Note over O,E: Sprint 5, attempt 1
    O->>G: feature + contract
    G-->>O: bookings.ts using BEGIN / SELECT overlap / INSERT / COMMIT
    O->>K: run all accumulated tests
    K->>PG: 20 parallel POST /bookings
    PG-->>K: 9-10 inserts succeed (each saw an empty slot)
    K-->>O: FAIL, expected 1 winner, got 10
    O->>E: contract + failing output
    E-->>O: functionality 9, no bugs (rubber stamp)
    Note over O: check failed, so the sprint fails regardless of the score
    Note over O,E: Sprint 5, attempt 2
    O->>G: qa_bugs = failing assertions
    G-->>O: migration 003 exclusion constraint + per-room advisory lock, 23P01 mapped to 409
    O->>K: run all accumulated tests
    K->>PG: 20 parallel POST /bookings
    PG-->>K: 1 insert wins, 19 exclusion violations
    K-->>O: PASS (all sprints 1-5 re-verified)
    O->>E: contract + passing output
    E-->>O: 9 / 8
    O->>O: sprint passed, persist progress.json
```

Why this example works for the demo:

- **Real Postgres is the verifier.** The invariant (no overlapping confirmed bookings) is enforced by a
  GiST exclusion constraint (plus a per-room advisory lock that queues writers), and the check proves it with real concurrent transactions. A mock cannot.
- **Regression safety is automatic.** The check is cumulative, so sprint 6 re-runs the tests of sprints 1 to 5.
- **The generator cannot cheat.** Acceptance tests are owned by the contract and restored before each check.
