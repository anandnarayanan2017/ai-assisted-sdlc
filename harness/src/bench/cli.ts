/**
 * Multi-vendor model benchmark.
 *   tsx harness/src/bench/cli.ts --suite codegen --models reference,empty,claude-sonnet-5-5,openai-gpt [--samples 5 --k 1,5]
 *   tsx harness/src/bench/cli.ts --suite sdlc    --models reference,claude-sonnet-5-5 [--live-roles generator]
 * Options: --tasks <jsonl> --temperature <t> --concurrency <n> --limit <n tasks> --out <dir> --publish
 * Writes <out>/<suite>-<timestamp>/{results.jsonl, summary.json, report.md}; --publish also copies the report
 * to docs/generated/benchmark-<suite>.md. Models whose API key is missing are skipped, not failed.
 */
import { spawn } from "node:child_process";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { baselineLLM, loadTasks, runCodegen } from "./codegen.js";
import { liveLLM, loadModels, selectModels, unavailable, type ModelSpec } from "./models.js";
import { codegenMarkdown, sdlcMarkdown, summarizeCodegen, type CodegenSummary, type SdlcMetrics } from "./report.js";

const args = process.argv.slice(2);
const opt = (f: string, d: string) => (args.includes(f) ? (args[args.indexOf(f) + 1] ?? d) : d);
const root = path.resolve(import.meta.dirname, "../../..");
const suite = opt("--suite", "codegen");
if (suite !== "codegen" && suite !== "sdlc") {
  console.error("usage: bench --suite codegen|sdlc --models id1,id2|all [--samples n] [--k 1,5] [--temperature t] [--publish]");
  process.exit(2);
}
const models = selectModels(await loadModels(path.join(root, opt("--registry", "benchmarks/models.json"))), opt("--models", "reference,empty"));
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outDir = path.join(root, opt("--out", "benchmarks/results"), `${suite}-${stamp}`);
await mkdir(outDir, { recursive: true });

const runnable: ModelSpec[] = [];
for (const m of models) {
  const why = unavailable(m);
  if (why) console.log(`SKIP ${m.id}: ${why}`);
  else runnable.push(m);
}
if (runnable.length === 0) {
  console.error("no runnable models (set the API keys named in benchmarks/models.json)");
  process.exit(2);
}

let report: string;
/** Baseline sanity: reference must score 100% and empty 0%, or the benchmark itself is broken. */
const broken: string[] = [];
if (suite === "codegen") {
  const tasksFile = opt("--tasks", "benchmarks/codegen/tasks.jsonl");
  const tasks = (await loadTasks(path.join(root, tasksFile))).slice(0, Number(opt("--limit", "0")) || undefined);
  const samples = Number(opt("--samples", "1"));
  const ks = opt("--k", "1").split(",").map(Number);
  const tempArg = opt("--temperature", "");
  // HumanEval convention: greedy-ish for pass@1 with one sample, T=0.8 when sampling for pass@k (k > 1).
  const temperature = tempArg === "default" ? undefined : tempArg ? Number(tempArg) : samples > 1 ? 0.8 : 0;
  const rows: CodegenSummary[] = [];
  for (const m of runnable) {
    console.log(`\n${m.id}: ${tasks.length} tasks x ${samples} sample(s)`);
    const results = await runCodegen({
      tasks, samples, concurrency: Number(opt("--concurrency", "4")),
      withUsage: (onUsage) =>
        m.provider === "reference" || m.provider === "empty" ? baselineLLM(m.provider, tasks) : liveLLM(m, { temperature, onUsage }),
      onSample: (id, s) => process.stdout.write(s.pass ? "." : s.error?.startsWith("API:") ? "E" : "F"),
    });
    for (const r of results) {
      await writeFile(path.join(outDir, "results.jsonl"), JSON.stringify({ model: m.id, ...r }) + "\n", { flag: "a" });
    }
    const s = summarizeCodegen(m, results, ks);
    rows.push(s);
    const p1 = s.passAt["pass@1"] ?? 0;
    if (m.provider === "reference" && p1 < 1) broken.push(`reference scored ${(p1 * 100).toFixed(1)}%: a task's tests or the sandbox are wrong`);
    if (m.provider === "empty" && p1 > 0) broken.push(`empty scored ${(p1 * 100).toFixed(1)}%: a task's tests are vacuous`);
    console.log(`  ${Object.entries(s.passAt).map(([k, v]) => `${k}=${(v * 100).toFixed(1)}%`).join(" ")}`);
  }
  await writeFile(path.join(outDir, "summary.json"), JSON.stringify(rows, null, 2));
  report = codegenMarkdown(rows, {
    date: new Date().toISOString().slice(0, 10), tasks: `${tasks.length} (${tasksFile})`, "samples per task": String(samples),
    temperature: temperature === undefined ? "provider default" : String(temperature),
    scoring: "hidden unit tests, executed in a sandboxed Node process (no LLM judge)",
  });
} else {
  const liveRoles = opt("--live-roles", "generator");
  const rows: (SdlcMetrics & { id: string; vendor: string })[] = [];
  const workspace = path.join(root, "examples", "room-booking", "workspace");
  for (const m of runnable) {
    console.log(`\n=== ${m.id} (live roles: ${liveRoles}) ===`);
    const cliArgs = ["tsx", "harness/src/cli.ts", "room-booking", "--llm", m.id, "--live-roles", liveRoles, "--approve"];
    const mf = opt("--max-features", "");
    if (mf) cliArgs.push("--max-features", mf);
    // One process per model: a crash or hang in one run cannot take down the comparison.
    const code = await new Promise<number>((resolve) => {
      const child = spawn("npx", cliArgs, { cwd: root, stdio: "inherit", env: process.env });
      child.on("close", (c) => resolve(c ?? 1));
    });
    const metricsFile = path.join(workspace, ".harness", "metrics.json");
    const metrics = JSON.parse(await readFile(metricsFile, "utf8").catch(() => "null")) as SdlcMetrics | null;
    if (!metrics || metrics.model !== m.id) {
      console.log(`  no metrics for ${m.id} (exit ${code}); recorded as a failed run`);
      continue;
    }
    rows.push({ ...metrics, id: m.id, vendor: m.vendor ?? m.provider });
    if (m.provider === "reference" && metrics.passed < metrics.sprints) broken.push(`reference resolved ${metrics.passed}/${metrics.sprints} sprints: the recorded script or the environment is broken`);
    if (m.provider === "empty" && metrics.passed > 0) broken.push(`empty resolved ${metrics.passed} sprint(s): a contract check is vacuous`);
    // Keep every transcript, contract and verdict next to the score: a leaderboard row must be auditable.
    await cp(path.join(workspace, ".harness"), path.join(outDir, m.id, ".harness"), { recursive: true });
    await writeFile(path.join(outDir, "results.jsonl"), JSON.stringify({ ...metrics, model: m.id, exit: code }) + "\n", { flag: "a" });
  }
  await writeFile(path.join(outDir, "summary.json"), JSON.stringify(rows, null, 2));
  report = sdlcMarkdown(rows, {
    date: new Date().toISOString().slice(0, 10), project: "examples/room-booking (6 sprints, Postgres)",
    "live roles": liveRoles, "fixed": "plan, contract tests, Playwright probes and evaluator are the recorded ones unless listed as live",
    scoring: "deterministic check (tsc + vitest + architecture rules) per sprint, 3 attempts max",
  });
}

await writeFile(path.join(outDir, "report.md"), report);
console.log(`\n${report}\nresults: ${path.relative(root, outDir)}`);
if (args.includes("--publish")) {
  const dest = path.join(root, "docs", "generated", `benchmark-${suite}.md`);
  await writeFile(dest, `<!-- GENERATED by npm run bench -- --publish. Do not edit by hand. -->\n${report}`);
  console.log(`published: ${path.relative(root, dest)}`);
}
for (const b of broken) console.error(`BASELINE BROKEN: ${b}`);
process.exit(broken.length ? 1 : 0);
