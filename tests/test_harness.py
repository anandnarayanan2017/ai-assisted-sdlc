import json

from sdlc import Config, Harness, ScriptedLLM


def make(tmp_path, gen_attempts, eval_score=8, approve=None, check_ok=True):
    """gen_attempts: file content the generator emits per attempt (last repeats)."""
    state = {"n": 0}

    def generator(user):
        n = json.loads(user)["attempt"]
        state["n"] = n
        body = gen_attempts[min(n, len(gen_attempts)) - 1]
        return json.dumps({"files": {"app.py": body}})

    llm = ScriptedLLM({
        "planner": lambda u: json.dumps({"features": ["add", "list"]}),
        "contract": lambda u: json.dumps({"done": "prints ok", "check": ["python3", "app.py"]}),
        "generator": generator,
        "evaluator": lambda u: json.dumps({"functionality": eval_score, "craft": 7, "bugs": ["x"]}),
    })
    return llm, Harness(llm, Config(workdir=tmp_path / "w", max_attempts=3), approve)


GOOD, BAD = "print('ok')", "raise SystemExit(1)"


def test_retries_until_gate_passes(tmp_path):
    llm, h = make(tmp_path, [BAD, GOOD])
    p = h.run("todo")
    assert p.done == {"add": "pass", "list": "pass"}
    assert p.status == "awaiting_approval"  # human gate denies by default


def test_gate_overrides_a_lenient_evaluator(tmp_path):
    _, h = make(tmp_path, [BAD], eval_score=10)  # LLM says 10/10, code still fails
    p = h.run("todo")
    assert p.status == "blocked" and p.done["add"] == "failed"


def test_low_scores_fail_even_if_gate_passes(tmp_path):
    _, h = make(tmp_path, [GOOD], eval_score=3)
    assert h.run("todo").status == "blocked"


def test_blocked_stops_before_later_features(tmp_path):
    _, h = make(tmp_path, [BAD])
    p = h.run("todo")
    assert "list" not in p.done


def test_human_approval_releases(tmp_path):
    _, h = make(tmp_path, [GOOD], approve=lambda p: True)
    assert h.run("todo").status == "released"


def test_resume_skips_finished_features_and_replanning(tmp_path):
    llm, h = make(tmp_path, [GOOD])
    h.run("todo")
    llm.calls.clear()
    h2 = Harness(llm, h.cfg)  # new process, same workspace
    h2.run("todo")
    assert llm.calls == []  # nothing replanned or rebuilt
