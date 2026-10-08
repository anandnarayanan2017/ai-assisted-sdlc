/**
 * AI-assisted SDLC harness:
 *   planner -> ( contract -> generate -> check -> evaluate )* -> human gate
 * Agents never share a context window. State moves through files in the workspace
 * (.harness/*) and git history, so a fresh process can resume.
 */
import { execFile, spawn } from "node:child_process";
import { cp, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import type { LLM } from "./llm.js";

const sh = promisify(execFile);

export const PROMPTS = {
  planner:
    'You are the PLANNER. Expand the request into an ambitious product spec as JSON {"features": ["..."]}, ' +
    "ordered so each feature builds on earlier ones. No implementation detail: spec errors cascade downstream. " +
    "Reply with the JSON object only.",
  contract:
    "You are the CONTRACT negotiator (QA). For one feature define done and write the acceptance tests. Reply JSON " +
    '{"done": "...", "check": ["argv", "..."], "tests": {"relative/path": "content"}}. ' +
    "The generator may NOT edit these tests; the harness restores them before every check. `workspace` holds the " +
    "current project files: use its existing test command and conventions for `check`. Reply with the JSON only.",
  generator:
    "You are the GENERATOR. Implement ONLY the given feature so the contract check passes. Reply JSON " +
    '{"files": {"relative/path": "full new content"}}. `workspace` holds the current project files, including the ' +
    "contract tests. Fix every QA bug listed. Never touch contract tests. Reply with the JSON only.",
  evaluator:
    "You are a skeptical EVALUATOR. Do not approve work with unresolved defects, and do not trust a " +
    "generator's claims; judge the changed files and the check output. Reply JSON " +
    '{"scores": {"functionality": 0-10, "craft": 0-10}, "bugs": ["..."]} and nothing else.',
} as const;

export interface Contract { done: string; check: string[]; tests?: Record<string, string> }
export interface Evaluation { scores: Record<string, number>; bugs: string[] }
export interface GateResult { ok: boolean; output: string }
export type Status = "planning" | "building" | "blocked" | "awaiting_approval" | "released";

export interface Progress {
  features: string[];
  done: Record<string, "pass" | "failed">;
  attempts: Record<string, number>;
  status: Status;
}

export interface HarnessEvent { type: string; feature?: string; attempt?: number; [k: string]: unknown }

export interface Config {
  workdir: string;
  seedDir?: string; // copied into workdir on first run (scaffold, configs)
  thresholds: Record<string, number>;
  maxAttempts: number;
  maxFeatures?: number; // cap the plan (keeps live runs affordable)
  checkTimeoutMs: number;
  env?: Record<string, string>;
  onEvent?: (e: HarnessEvent) => void;
}

export const defaultConfig = (workdir: string): Config => ({
  workdir, thresholds: { functionality: 7, craft: 6 }, maxAttempts: 3, checkTimeoutMs: 180_000,
});

/** Failing-test / compiler-error lines from check output (for QA feedback and logs). */
export function failureLines(output: string, max = 6): string[] {
  const hits = output.split("\n").map((l) => l.trim()).filter((l) => /^(FAIL|AssertionError|Error:|TypeError)|error TS\d+/.test(l));
  return [...new Set(hits)].slice(0, max);
}

/** Parse a model reply that should be JSON but may arrive wrapped in a code fence or prose. */
export function parseJSON<T>(raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    const fenced = /```(?:json)?\s*\n([\s\S]*?)\n```/.exec(raw)?.[1];
    if (fenced) return JSON.parse(fenced) as T;
    const a = raw.indexOf("{"), b = raw.lastIndexOf("}");
    if (a >= 0 && b > a) return JSON.parse(raw.slice(a, b + 1)) as T;
    throw new Error(`model reply is not JSON: ${raw.slice(0, 200)}`);
  }
}

const slug = (i: number) => String(i + 1).padStart(2, "0");
const SKIP = new Set(["node_modules", ".git", ".harness"]);

export class Harness {
  private w: string;
  private hdir: string;

  constructor(
    private llm: LLM,
    private cfg: Config,
    private approve: (p: Progress) => boolean | Promise<boolean> = () => false,
  ) {
    this.w = path.resolve(cfg.workdir);
    this.hdir = path.join(this.w, ".harness");
  }

  // ---- file handoff ----------------------------------------------------
  private async write(rel: string, content: string) {
    const p = path.join(this.w, rel);
    if (!p.startsWith(this.w + path.sep)) throw new Error(`path escapes workspace: ${rel}`);
    await mkdir(path.dirname(p), { recursive: true });
    await writeFile(p, content);
  }
  private async readIf(rel: string) {
    const p = path.join(this.w, rel);
    return existsSync(p) ? readFile(p, "utf8") : "";
  }
  /** Current project files, so a fresh-context agent sees what earlier sprints built. */
  private async snapshot(maxBytes = 200_000): Promise<Record<string, string>> {
    const out: Record<string, string> = {};
    let used = 0;
    const walk = async (dir: string) => {
      for (const e of (await readdir(dir, { withFileTypes: true })).sort((x, y) => x.name.localeCompare(y.name))) {
        if (SKIP.has(e.name)) continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) await walk(p);
        else if (e.isFile() && (used += (await stat(p)).size) <= maxBytes)
          out[path.relative(this.w, p).split(path.sep).join("/")] = await readFile(p, "utf8");
      }
    };
    await walk(this.w);
    return out;
  }
  private async save(p: Progress) {
    await this.write(".harness/progress.json", JSON.stringify(p, null, 2));
  }
  private async git(...args: string[]) {
    await sh("git", ["-c", "user.name=harness", "-c", "user.email=harness@local", ...args], { cwd: this.w }).catch(() => {});
  }
  private emit(e: HarnessEvent) {
    this.cfg.onEvent?.(e);
  }

  // ---- stages ----------------------------------------------------------
  private async plan(request: string): Promise<string[]> {
    const raw = await this.llm("planner", PROMPTS.planner, request);
    await this.write(".harness/spec.json", raw);
    const features = parseJSON<{ features: string[] }>(raw).features.slice(0, this.cfg.maxFeatures);
    this.emit({ type: "plan", features });
    return features;
  }

  private async negotiate(index: number, feature: string): Promise<Contract> {
    const raw = await this.llm("contract", PROMPTS.contract,
      JSON.stringify({ feature, spec: await this.readIf(".harness/spec.json"), workspace: await this.snapshot() }));
    const c = parseJSON<Contract>(raw);
    await this.write(`.harness/contracts/${slug(index)}.json`, JSON.stringify(c, null, 2));
    await this.restoreTests(); // the generator sees the tests from attempt 1
    this.emit({ type: "contract", feature, done: c.done, tests: Object.keys(c.tests ?? {}) });
    return c;
  }

  /** Acceptance tests belong to the contract, not the generator: restore them before every check. */
  private async restoreTests() {
    const dir = path.join(this.hdir, "contracts");
    if (!existsSync(dir)) return;
    for (const f of (await readdir(dir)).sort()) {
      const c = JSON.parse(await readFile(path.join(dir, f), "utf8")) as Contract;
      for (const [rel, content] of Object.entries(c.tests ?? {})) await this.write(rel, content);
    }
  }

  private async generate(feature: string, c: Contract, attempt: number, bugs: string[]) {
    const raw = await this.llm("generator", PROMPTS.generator,
      JSON.stringify({ feature, contract: { done: c.done, check: c.check }, attempt, qa_bugs: bugs,
        workspace: await this.snapshot() }));
    const files = parseJSON<{ files: Record<string, string> }>(raw).files;
    for (const [rel, content] of Object.entries(files)) await this.write(rel, content);
    await this.restoreTests();
    await this.git("add", "-A");
    await this.git("commit", "-qm", `${feature}: attempt ${attempt}`);
    this.emit({ type: "generate", feature, attempt, files: Object.keys(files) });
    return files;
  }

  /** Deterministic verification. It cannot be argued with, unlike the LLM evaluator. */
  private gate(c: Contract): Promise<GateResult> {
    return new Promise((resolve) => {
      const [cmd, ...args] = c.check;
      if (!cmd) return resolve({ ok: false, output: "contract has an empty check" });
      const child = spawn(cmd, args, { cwd: this.w, env: { ...process.env, ...this.cfg.env } });
      let out = "";
      const cap = (b: Buffer) => { out = (out + b.toString()).slice(-20_000); };
      child.stdout.on("data", cap);
      child.stderr.on("data", cap);
      const timer = setTimeout(() => child.kill("SIGKILL"), this.cfg.checkTimeoutMs);
      child.on("error", (e) => { clearTimeout(timer); resolve({ ok: false, output: `gate error: ${e.message}` }); });
      child.on("close", (code) => {
        clearTimeout(timer);
        resolve({ ok: code === 0, output: `exit=${code}\n${out.replace(/\x1b\[[0-9;]*m/g, "")}` });
      });
    });
  }

  private async evaluate(feature: string, attempt: number, c: Contract, g: GateResult,
    changed: Record<string, string>): Promise<Evaluation> {
    const raw = await this.llm("evaluator", PROMPTS.evaluator,
      JSON.stringify({ feature, attempt, contract: { done: c.done }, changed, gate: { ok: g.ok, output: g.output.slice(-6000) } }));
    const e = parseJSON<Partial<Evaluation>>(raw);
    return { scores: e.scores ?? {}, bugs: e.bugs ?? [] };
  }

  private passes(g: GateResult, e: Evaluation) {
    return g.ok && Object.entries(this.cfg.thresholds).every(([k, t]) => (e.scores[k] ?? 0) >= t);
  }

  // ---- orchestration ---------------------------------------------------
  async run(request: string): Promise<Progress> {
    await mkdir(this.hdir, { recursive: true });
    if (this.cfg.seedDir && !existsSync(path.join(this.hdir, "progress.json"))) {
      await cp(this.cfg.seedDir, this.w, { recursive: true });
    }
    if (!existsSync(path.join(this.w, ".git"))) await this.git("init", "-q", "-b", "main");

    const saved = await this.readIf(".harness/progress.json");
    const p: Progress = saved
      ? (JSON.parse(saved) as Progress)
      : { features: [], done: {}, attempts: {}, status: "planning" };
    if (p.features.length === 0) {
      p.features = await this.plan(request);
      p.status = "building";
      await this.save(p);
    }

    for (const [i, feature] of p.features.entries()) {
      if (p.done[feature] === "pass") continue; // resume: skip finished sprints
      const contract = await this.negotiate(i, feature);
      let bugs: string[] = [];
      p.done[feature] = "failed";
      for (let attempt = 1; attempt <= this.cfg.maxAttempts; attempt++) {
        p.attempts[feature] = attempt;
        const changed = await this.generate(feature, contract, attempt, bugs);
        const g = await this.gate(contract);
        const e = await this.evaluate(feature, attempt, contract, g, changed);
        const ok = this.passes(g, e);
        this.emit({ type: "verdict", feature, attempt, gateOk: g.ok, scores: e.scores, pass: ok, failures: g.ok ? [] : failureLines(g.output) });
        if (ok) { p.done[feature] = "pass"; break; }
        bugs = [...e.bugs, ...(g.ok ? [] : [
          `check failed:\n${failureLines(g.output, 20).join("\n")}\n--- output tail ---\n${g.output.slice(-3000)}`])];
        this.emit({ type: "retry", feature, attempt, bugs: e.bugs });
      }
      await this.save(p);
      if (p.done[feature] !== "pass") {
        p.status = "blocked"; // escalate instead of building on a broken base
        await this.save(p);
        this.emit({ type: "blocked", feature });
        return p;
      }
    }
    p.status = (await this.approve(p)) ? "released" : "awaiting_approval";
    await this.save(p);
    this.emit({ type: p.status });
    return p;
  }
}
