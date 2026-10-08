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

    subgraph Orchestrator["Orchestrator (harness.py) - owns the loop, holds no model context"]
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
        CON[("contract.json")]
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
        C->>S: write contract.json (done + check argv)
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
        Contracting --> Generating: contract.json
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
LLM does not pass failing code (`test_gate_overrides_a_lenient_evaluator`).

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
| `spec.json` | Planner | Contract, Orchestrator | Ambitious scope, no implementation detail |
| `contract.json` | Contract negotiator | Generator, Check, Evaluator | Definition of done + runnable `check` argv |
| source tree + git | Generator | Check, Evaluator | Work product and rollback points |
| `progress.json` | Orchestrator | Orchestrator (next process) | Resume after crash or context reset |

## 8. Design assumptions to re-test as models improve

Each component encodes a belief that the model can't do something alone. Ablate one at a time.

| Component | Assumption | Test by |
|---|---|---|
| Planner | Model under-scopes from a short prompt | Skip it, compare feature count |
| Sprint contract | Model drifts from spec mid-build | Merge contract into generator prompt |
| Separate evaluator | Self-grading is lenient | Let generator self-score, compare escaped bugs |
| Per-sprint evaluation | Long builds need frequent QA | Evaluate once at the end |
| Context resets | Model gets anxious near the limit | Use compaction, compare completion |
