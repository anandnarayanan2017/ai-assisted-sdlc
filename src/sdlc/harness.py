"""AI-assisted SDLC harness: planner -> (contract -> generate -> gates -> evaluate)* -> human gate.

Agents never share a context window. They hand off through files in the workspace
(spec.json, contract.json, progress.json) and git history.
"""
from __future__ import annotations

import json
import subprocess
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Callable

from .llm import LLM

PLANNER = ("You are the PLANNER. Expand the request into an ambitious product spec as JSON "
           '{"features": ["..."]}. No implementation detail: spec errors cascade downstream.')
CONTRACT = ("You negotiate a SPRINT CONTRACT for one feature. Reply JSON "
            '{"done": "acceptance criteria", "check": ["argv", "of", "runnable", "check"]}.')
GENERATOR = ("You are the GENERATOR. Implement ONLY the given feature to satisfy the contract. "
             'Reply JSON {"files": {"relative/path": "content"}}. Fix every QA bug listed.')
EVALUATOR = ("You are a skeptical EVALUATOR. Do not approve work with unresolved defects. "
             'Reply JSON {"functionality": 0-10, "craft": 0-10, "bugs": ["..."]}.')


@dataclass
class Config:
    workdir: Path = Path("workspace")
    thresholds: dict[str, int] = field(default_factory=lambda: {"functionality": 7, "craft": 6})
    max_attempts: int = 3
    check_timeout: int = 120


@dataclass
class Progress:
    """Durable handoff state; lets a fresh process (context reset) resume mid-project."""
    features: list[str] = field(default_factory=list)
    done: dict[str, str] = field(default_factory=dict)  # feature -> pass | failed
    status: str = "planning"  # planning | building | awaiting_approval | released | blocked


class Harness:
    def __init__(self, llm: LLM, cfg: Config | None = None,
                 approve: Callable[[Progress], bool] | None = None):
        self.llm, self.cfg = llm, cfg or Config()
        self.approve = approve or (lambda p: False)  # human gate: deny by default
        self.w = self.cfg.workdir
        self.w.mkdir(parents=True, exist_ok=True)

    # -- file handoff ------------------------------------------------------
    def _read(self, name: str) -> str:
        p = self.w / name
        return p.read_text() if p.exists() else ""

    def _write(self, name: str, s: str) -> None:
        p = self.w / name
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(s)

    def _git(self, *args: str) -> None:
        subprocess.run(["git", *args], cwd=self.w, capture_output=True)

    def _save(self, p: Progress) -> None:
        self._write("progress.json", json.dumps(asdict(p), indent=2))

    def _load(self) -> Progress:
        raw = self._read("progress.json")
        return Progress(**json.loads(raw)) if raw else Progress()

    # -- stages ------------------------------------------------------------
    def plan(self, request: str) -> list[str]:
        spec = self.llm("planner", PLANNER, request)
        self._write("spec.json", spec)
        return json.loads(spec)["features"]

    def contract(self, feature: str) -> dict:
        raw = self.llm("contract", CONTRACT, f"FEATURE={feature}\nSPEC={self._read('spec.json')}")
        self._write("contract.json", raw)
        return json.loads(raw)

    def generate(self, feature: str, contract: dict, attempt: int, bugs: list[str]) -> None:
        raw = self.llm("generator", GENERATOR, json.dumps(
            {"feature": feature, "contract": contract, "attempt": attempt, "qa_bugs": bugs}))
        for path, content in json.loads(raw)["files"].items():
            self._write(path, content)
        self._git("add", "-A")
        self._git("commit", "-qm", f"{feature}: attempt {attempt}")

    def gate(self, contract: dict) -> tuple[bool, str]:
        """Deterministic verification. Cannot be argued with, unlike the LLM evaluator."""
        try:
            r = subprocess.run(contract["check"], cwd=self.w, capture_output=True,
                               text=True, timeout=self.cfg.check_timeout)
        except (OSError, subprocess.TimeoutExpired) as e:
            return False, f"gate error: {e}"
        return r.returncode == 0, f"exit={r.returncode}\n{r.stdout}\n{r.stderr}"

    def evaluate(self, contract: dict, gate_out: str) -> dict:
        return json.loads(self.llm("evaluator", EVALUATOR,
                                   f"CONTRACT={json.dumps(contract)}\nGATE={gate_out}"))

    def _passes(self, gate_ok: bool, s: dict) -> bool:
        return gate_ok and all(s.get(k, 0) >= t for k, t in self.cfg.thresholds.items())

    # -- orchestration -----------------------------------------------------
    def run(self, request: str) -> Progress:
        self._git("init", "-q")
        p = self._load()
        if not p.features:
            p.features, p.status = self.plan(request), "building"
            self._save(p)
        for feature in p.features:
            if p.done.get(feature) == "pass":  # resume: skip finished sprints
                continue
            c = self.contract(feature)
            bugs: list[str] = []
            p.done[feature] = "failed"
            for attempt in range(1, self.cfg.max_attempts + 1):
                self.generate(feature, c, attempt, bugs)
                ok, out = self.gate(c)
                scores = self.evaluate(c, out)
                if self._passes(ok, scores):
                    p.done[feature] = "pass"
                    break
                bugs = scores.get("bugs", []) + ([] if ok else [f"gate failed: {out[-500:]}"])
            self._save(p)
            if p.done[feature] != "pass":
                p.status = "blocked"  # escalate to a human instead of building on a broken base
                self._save(p)
                return p
        p.status = "released" if self.approve(p) else "awaiting_approval"
        self._save(p)
        return p
