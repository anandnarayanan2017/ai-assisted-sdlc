/** Usage: tsx harness/src/cli.ts <example> [--approve] [--resume] [--llm scripted|anthropic] */
import { rm } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Example } from "./example.js";
import { Harness, defaultConfig, type HarnessEvent } from "./harness.js";
import { anthropicLLM } from "./llm.js";

const args = process.argv.slice(2);
const name = args.find((a) => !a.startsWith("--"));
const flag = (f: string) => args.includes(f);
const opt = (f: string, d: string) => (args.includes(f) ? (args[args.indexOf(f) + 1] ?? d) : d);
if (!name) {
  console.error("usage: cli <example> [--approve] [--resume] [--llm scripted|anthropic]");
  process.exit(2);
}

const root = path.resolve(import.meta.dirname, "../..");
const exDir = path.join(root, "examples", name);
const ex = ((await import(pathToFileURL(path.join(exDir, "example.ts")).href)) as { default: Example }).default;
const workdir = path.join(exDir, "workspace");

if (!flag("--resume")) {
  await rm(workdir, { recursive: true, force: true });
  await ex.reset?.();
}

const live = opt("--llm", "scripted") === "anthropic";
const llm = live ? anthropicLLM() : ex.scriptedLLM();
const cfg = { ...defaultConfig(workdir), seedDir: ex.seedDir, env: ex.env, onEvent: print };
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
      if (!e.gateOk && (e.scores as Record<string, number>).functionality! >= 7)
        console.log("    !! evaluator approved, but the deterministic check failed: the check wins");
      for (const l of (e.failures as string[]) ?? []) console.log(`    ${l.slice(0, 150)}`);
      summary.push(`${e.feature}: attempt ${e.attempt} ${e.pass ? "pass" : "fail"}`);
      break;
    }
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
process.exit(progress.status === "blocked" ? 1 : 0);
