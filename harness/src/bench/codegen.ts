/**
 * Codegen suite: HumanEval-style, execution-based. Each task is a function signature + docstring;
 * the model writes the function; hidden unit tests decide pass/fail. No LLM judge anywhere.
 * Task schema matches HumanEval's JSONL (task_id, prompt, entry_point, canonical_solution, test),
 * with JavaScript in place of Python, so translated suites (e.g. MultiPL-E HumanEval-JS) can be dropped in.
 */
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { LLM, Usage } from "../llm.js";

export interface CodegenTask {
  task_id: string;
  prompt: string;
  entry_point: string;
  canonical_solution: string;
  /** Defines `function check(candidate)` that throws on a wrong answer; `assert` is in scope. */
  test: string;
}

export interface Sample { pass: boolean; secs: number; usage: Usage; error?: string }
export interface TaskResult { task_id: string; samples: Sample[] }

export const SYSTEM =
  "You are an expert JavaScript programmer. Complete the function described below. Reply with the complete " +
  "function (signature included) in a single ```javascript code block. Plain JavaScript (ES2023): no TypeScript, " +
  "no imports, no console output, no example usage.";

export async function loadTasks(file: string): Promise<CodegenTask[]> {
  return (await readFile(file, "utf8")).split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l) as CodegenTask);
}

/** The code from a reply: the last fenced block if there is one, else the whole reply. */
export function extractCode(reply: string): string {
  const blocks = [...reply.matchAll(/```[\w-]*\n([\s\S]*?)```/g)].map((m) => m[1]!);
  return (blocks.at(-1) ?? reply).trim();
}

/**
 * Run model-written code against the task's tests in a separate Node process with the permission model on:
 * no file writes, no child processes, no workers (and no network on Node >= 25). Exit 0 = pass.
 */
export async function execute(code: string, task: CodegenTask, timeoutMs = 10_000): Promise<{ pass: boolean; output: string }> {
  const dir = await mkdtemp(path.join(tmpdir(), "bench-"));
  const file = path.join(dir, "run.mjs");
  // The candidate is compiled as a function body so a stray `export` or helper name cannot clash with the test.
  const src = code.replace(/^\s*export\s+(default\s+)?/gm, "");
  await writeFile(file, [
    'import assert from "node:assert/strict";',
    `const candidate = new Function(${JSON.stringify(`${src}\nreturn ${task.entry_point};`)})();`,
    'if (typeof candidate !== "function") throw new Error("entry point is not a function");',
    task.test,
    "check(candidate);",
  ].join("\n"));
  try {
    return await new Promise((resolve) => {
      const child = spawn(process.execPath, ["--permission", `--allow-fs-read=${dir}`, file], { cwd: dir });
      let out = "";
      const cap = (b: Buffer) => { out = (out + b.toString()).slice(-4000); };
      child.stdout.on("data", cap);
      child.stderr.on("data", cap);
      const timer = setTimeout(() => { out += "\nTIMEOUT"; child.kill("SIGKILL"); }, timeoutMs);
      child.on("close", (code) => { clearTimeout(timer); resolve({ pass: code === 0, output: out }); });
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Offline baselines: "reference" returns the canonical solution (must score 100%), "empty" a stub (0%). */
export function baselineLLM(kind: "reference" | "empty", tasks: CodegenTask[]): LLM {
  const byPrompt = new Map(tasks.map((t) => [t.prompt, t]));
  return async (_role, _system, user) => {
    const t = byPrompt.get(user);
    if (!t) throw new Error("baseline got an unknown prompt");
    return kind === "reference"
      ? "```javascript\n" + t.prompt + t.canonical_solution + "\n```"
      : "```javascript\n" + t.prompt + "  return undefined;\n}\n```";
  };
}

/** n samples per task, `concurrency` calls in flight. Usage is attributed per call via `withUsage`. */
export async function runCodegen(o: {
  tasks: CodegenTask[]; samples: number; concurrency: number;
  /** Builds a client whose usage callback is bound to one call. */
  withUsage: (onUsage: (u: Usage) => void) => LLM;
  onSample?: (taskId: string, s: Sample) => void;
}): Promise<TaskResult[]> {
  const jobs = o.tasks.flatMap((t) => Array.from({ length: o.samples }, () => t));
  const results = new Map(o.tasks.map((t) => [t.task_id, [] as Sample[]]));
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const t = jobs[next++]!;
      const usage: Usage = { inputTokens: 0, outputTokens: 0 };
      const llm = o.withUsage((u) => { usage.inputTokens += u.inputTokens; usage.outputTokens += u.outputTokens; });
      const t0 = Date.now();
      let s: Sample;
      try {
        const reply = await llm("generator", SYSTEM, t.prompt);
        const secs = (Date.now() - t0) / 1000;
        const r = await execute(extractCode(reply), t);
        s = { pass: r.pass, secs, usage, ...(r.pass ? {} : { error: lastLine(r.output) }) };
      } catch (e) {
        // An API error counts as a failed sample: availability is part of what is being compared.
        s = { pass: false, secs: (Date.now() - t0) / 1000, usage, error: `API: ${e instanceof Error ? e.message : e}`.slice(0, 300) };
      }
      results.get(t.task_id)!.push(s);
      o.onSample?.(t.task_id, s);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, o.concurrency) }, worker));
  return o.tasks.map((t) => ({ task_id: t.task_id, samples: results.get(t.task_id)! }));
}

const lastLine = (out: string) =>
  out.split("\n").map((l) => l.trim()).filter((l) => /Error|TIMEOUT|expected|actual/i.test(l)).slice(0, 2).join(" | ").slice(0, 200) ||
  out.trim().split("\n").at(-1)?.slice(0, 200) || "failed";
