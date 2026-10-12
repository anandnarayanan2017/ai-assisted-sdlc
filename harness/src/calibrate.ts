/**
 * Usage: tsx harness/src/calibrate.ts <example> [--llm scripted|anthropic] [--model <id>]
 * Grades the example's human-labelled evaluator cases with the evaluator and reports agreement.
 * Exit 1 when the judge approves anything a human failed: that judge cannot be trusted near the release gate.
 */
import path from "node:path";
import { pathToFileURL } from "node:url";
import { calibrate } from "./calibration.js";
import type { Example } from "./example.js";
import { PROMPTS, defaultConfig, parseJSON } from "./harness.js";
import { anthropicLLM } from "./llm.js";

const args = process.argv.slice(2);
const name = args.find((a) => !a.startsWith("--"));
const opt = (f: string, d: string) => (args.includes(f) ? (args[args.indexOf(f) + 1] ?? d) : d);
if (!name) {
  console.error("usage: calibrate <example> [--llm scripted|anthropic] [--model id]");
  process.exit(2);
}
const root = path.resolve(import.meta.dirname, "../..");
const ex = ((await import(pathToFileURL(path.join(root, "examples", name, "example.ts")).href)) as { default: Example }).default;
const cases = ex.calibration ?? [];
if (cases.length === 0) {
  console.error(`examples/${name} has no calibration cases`);
  process.exit(2);
}
const llm = opt("--llm", "scripted") === "anthropic"
  ? anthropicLLM(opt("--model", process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5"))
  : ex.scriptedLLM();
const { thresholds } = defaultConfig("");

const r = await calibrate(llm, PROMPTS.evaluator, cases, thresholds, parseJSON);
const fmt = (s: Record<string, number>) => Object.entries(s).map(([k, v]) => `${k}=${v}`).join(" ");
const grade = (g: { pass: boolean; scores: Record<string, number> }) => `${g.pass ? "PASS" : "FAIL"} ${fmt(g.scores)}`;
console.log(`${"case".padEnd(20)} ${"human".padEnd(32)} ${"evaluator".padEnd(32)} agree`);
for (const row of r.rows) {
  console.log(`${row.id.padEnd(20)} ${grade(row.human).padEnd(32)} ${grade(row.model).padEnd(32)} ${row.agree ? "yes" : "NO"}`);
}
console.log(`\nagreement: ${(r.agreement * 100).toFixed(0)}% of ${r.rows.length} cases, mean score error ${r.meanAbsError.toFixed(1)}`);
console.log(`false approvals (judge passed what a human failed): ${r.falseApprovals.join(", ") || "none"}`);
console.log(`false rejections: ${r.falseRejections.join(", ") || "none"}`);
if (r.falseApprovals.length) console.log("=> miscalibrated: keep the deterministic check in front of this judge, and add these cases to its few-shot set");
process.exit(r.falseApprovals.length ? 1 : 0);
