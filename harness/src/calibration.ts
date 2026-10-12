/**
 * Evaluator calibration. An LLM judge left alone is lenient: it finds real bugs, then talks itself into approving.
 * Humans grade a set of real evaluator inputs; those grades become few-shot examples in the evaluator's prompt
 * and a test set that measures how often the judge agrees with them.
 */
import type { LLM } from "./llm.js";

export interface HumanGrade { pass: boolean; scores: Record<string, number>; why: string }

export interface CalibrationCase {
  id: string;
  /** The evaluator's user message exactly as the harness sent it (from .harness/calls/NNN-evaluator.json). */
  input: string;
  human: HumanGrade;
}

/** Compact few-shot block: what the judge saw (summarised) and what the human decided and why. */
export function fewShot(cases: CalibrationCase[]): string {
  if (cases.length === 0) return "";
  const lines = cases.map((c) => {
    let seen = "";
    try {
      const i = JSON.parse(c.input) as { feature?: string; gate?: { ok: boolean; output: string }; probes?: { ok: boolean } };
      const failing = (i.gate?.output ?? "").split("\n").filter((l) => /^\s*(FAIL|AssertionError|ARCH )/.test(l)).slice(0, 3);
      seen = `feature "${i.feature}", check ${i.gate?.ok ? "passed" : "failed"}` +
        (i.probes ? `, probes ${i.probes.ok ? "passed" : "failed"}` : "") +
        (failing.length ? `: ${failing.map((l) => l.trim()).join(" | ")}` : "");
    } catch { seen = "(unparseable input)"; }
    const sc = Object.entries(c.human.scores).map(([k, v]) => `${k}=${v}`).join(" ");
    return `- ${seen}\n  human grade: ${c.human.pass ? "PASS" : "FAIL"} ${sc}. Why: ${c.human.why}`;
  });
  return "\n\nCalibration: work graded by a human reviewer. Grade the same way.\n" + lines.join("\n");
}

export interface CalibrationRow { id: string; human: HumanGrade; model: { pass: boolean; scores: Record<string, number> }; agree: boolean }
export interface CalibrationReport {
  rows: CalibrationRow[];
  agreement: number;
  /** The dangerous error: the judge passes work a human failed. */
  falseApprovals: string[];
  falseRejections: string[];
  meanAbsError: number;
}

/**
 * Run the judge over every case. Leave-one-out: the case being graded is never among its own few-shot examples,
 * so the score measures generalisation, not recall.
 */
export async function calibrate(llm: LLM, system: string, cases: CalibrationCase[],
  thresholds: Record<string, number>, parse: <T>(raw: string) => T): Promise<CalibrationReport> {
  const rows: CalibrationRow[] = [];
  let err = 0, n = 0;
  for (const c of cases) {
    const raw = await llm("evaluator", system + fewShot(cases.filter((x) => x.id !== c.id)), c.input);
    const scores = parse<{ scores?: Record<string, number> }>(raw).scores ?? {};
    const pass = Object.entries(thresholds).every(([k, t]) => (scores[k] ?? 0) >= t);
    for (const [k, v] of Object.entries(c.human.scores)) { err += Math.abs((scores[k] ?? 0) - v); n++; }
    rows.push({ id: c.id, human: c.human, model: { pass, scores }, agree: pass === c.human.pass });
  }
  return {
    rows,
    agreement: rows.length ? rows.filter((r) => r.agree).length / rows.length : 1,
    falseApprovals: rows.filter((r) => r.model.pass && !r.human.pass).map((r) => r.id),
    falseRejections: rows.filter((r) => !r.model.pass && r.human.pass).map((r) => r.id),
    meanAbsError: n ? err / n : 0,
  };
}
