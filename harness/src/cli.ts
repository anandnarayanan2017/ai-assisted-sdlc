/**
 * Usage: tsx harness/src/cli.ts <example> [--approve] [--resume] [--llm scripted|anthropic]
 *        [--model <id>] [--max-features <n>] [--no-probe] [--no-calibration]
 * Every model call is saved to <workspace>/.harness/calls/ so the exact agent hand-offs can be read back.
 */
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Example } from "./example.js";
import { Harness, defaultConfig, type HarnessEvent } from "./harness.js";
import { anthropicLLM, type LLM } from "./llm.js";

const args = process.argv.slice(2);
const name = args.find((a) => !a.startsWith("--"));
const flag = (f: string) => args.includes(f);
const opt = (f: string, d: string) => (args.includes(f) ? (args[args.indexOf(f) + 1] ?? d) : d);
if (!name) {
  console.error("usage: cli <example> [--approve] [--resume] [--llm scripted|anthropic] [--model id] [--max-features n] [--no-probe] [--no-calibration]");
  process.exit(2);
}

const root = path.resolve(import.meta.dirname, "../..");
const exDir = path.join(root, "examples", name);
const ex = ((await import(pathToFileURL(path.join(exDir, "example.ts")).href)) as { default: Example }).default;
const workdir = path.join(exDir, "workspace");

// Build the model first: a missing API key must fail before the previous workspace is wiped.
const live = opt("--llm", "scripted") === "anthropic";
const model = live ? anthropicLLM(opt("--model", process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5")) : ex.scriptedLLM();

if (!flag("--resume")) {
  // Empty it rather than delete it: in Docker the workspace is a bind mount, so the host keeps the result.
  for (const e of await readdir(workdir).catch(() => [])) await rm(path.join(workdir, e), { recursive: true, force: true });
  await ex.reset?.();
}
const callsDir = path.join(workdir, ".harness", "calls");
await mkdir(callsDir, { recursive: true });
let calls = (await readdir(callsDir)).length;

/** Record each call (prompt in, reply out, latency) and show it as it happens. */
const llm: LLM = async (role, system, user) => {
  const n = String(++calls).padStart(3, "0");
  const t0 = Date.now();
  if (live) process.stdout.write(`  .. ${role} thinking`);
  const reply = await model(role, system, user);
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  if (live) process.stdout.write(` (${secs}s, ${reply.length} chars)\n`);
  await writeFile(path.join(callsDir, `${n}-${role}.json`), JSON.stringify({ role, secs, system, user, reply }, null, 2));
  return reply;
};
const maxFeatures = Number(opt("--max-features", "0")) || undefined;
const cfg = {
  ...defaultConfig(workdir), maxFeatures, seedDir: ex.seedDir, env: ex.env, architecture: ex.architecture, onEvent: print,
  app: flag("--no-probe") ? undefined : ex.app,
  calibration: flag("--no-calibration") ? undefined : ex.calibration,
};
const summary: string[] = [];

function print(e: HarnessEvent) {
  const f = e.feature ? `[${e.feature}]` : "";
  switch (e.type) {
    case "plan":
      console.log(`\nPLANNER  ${(e.features as string[]).length} features`);
      (e.features as string[]).forEach((x, i) => console.log(`  ${i + 1}. ${x}`));
      break;
    case "contract":
      console.log(`\nCONTRACT ${f}\n  tests: ${(e.tests as string[]).join(", ")}`);
      break;
    case "generate":
      console.log(`  GENERATOR attempt ${e.attempt}: wrote ${(e.files as string[]).length} file(s)`);
      break;
    case "verdict": {
      const sc = Object.entries(e.scores as Record<string, number>).map(([k, v]) => `${k}=${v}`).join(" ");
      console.log(`  CHECK ${e.gateOk ? "PASS" : "FAIL"} | EVALUATOR ${sc} => ${e.pass ? "PASS" : "FAIL"}`);
      if (e.gateOk && !e.pass) console.log("    (check passed but scores below threshold)");
      if ((e.violations as string[]).length) console.log(`    architecture: ${(e.violations as string[]).length} violation(s)`);
      if (!e.gateOk && (e.scores as Record<string, number>).functionality! >= 7)
        console.log("    !! evaluator approved, but the deterministic check failed: the check wins");
      for (const l of (e.failures as string[]) ?? []) console.log(`    ${l.slice(0, 150)}`);
      summary.push(`${e.feature}: attempt ${e.attempt} ${e.pass ? "pass" : "fail"}`);
      break;
    }
    case "probe":
      if (e.ran) console.log(`  PROBE ${e.ok ? "PASS" : "FAIL"} (evaluator's Playwright tests against the running app)`);
      for (const l of (e.failures as string[]) ?? []) console.log(`    ${l.slice(0, 150)}`);
      break;
    case "retry":
      console.log("  -> failures fed back to the generator");
      break;
    case "blocked":
      console.log(`\nBLOCKED ${f}: retries exhausted, escalating to a human`);
      break;
    default:
      console.log(`\n${e.type.toUpperCase()}`);
  }
}

const harness = new Harness(llm, cfg, () => flag("--approve"));
const progress = await harness.run(ex.request);
console.log("\n=== Summary ===");
for (const feat of progress.features) {
  console.log(`${progress.done[feat] === "pass" ? "PASS" : "----"}  ${feat}  (attempts: ${progress.attempts[feat] ?? 0})`);
}
console.log(`status: ${progress.status}`);
console.log(`model calls: ${calls} (transcripts in ${path.relative(root, callsDir)})`);
process.exit(progress.status === "blocked" ? 1 : 0);
