import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { Harness, defaultConfig, type Progress } from "../src/harness.js";
import { ScriptedLLM } from "../src/llm.js";

const GOOD = "console.log('ok')";
const BAD = "process.exit(1)";

async function make(opts: {
  attempts: string[]; score?: number; approve?: boolean; tamper?: boolean; dir?: string;
}) {
  const dir = opts.dir ?? (await mkdtemp(path.join(tmpdir(), "h-")));
  const llm = new ScriptedLLM({
    planner: () => JSON.stringify({ features: ["add", "list"] }),
    contract: () => JSON.stringify({
      done: "prints ok", check: ["node", "app.js"],
      tests: { "tests/accept.txt": "contract-owned" },
    }),
    generator: (u) => {
      const n = (JSON.parse(u) as { attempt: number }).attempt;
      const files: Record<string, string> = { "app.js": opts.attempts[Math.min(n, opts.attempts.length) - 1]! };
      if (opts.tamper) files["tests/accept.txt"] = "weakened by generator";
      return JSON.stringify({ files });
    },
    evaluator: () => JSON.stringify({ scores: { functionality: opts.score ?? 8, craft: 7 }, bugs: ["x"] }),
  });
  const cfg = { ...defaultConfig(dir), maxAttempts: 3 };
  return { dir, llm, h: new Harness(llm.call, cfg, () => opts.approve ?? false), cfg };
}

describe("harness", () => {
  it("retries until the check passes, then waits for a human", async () => {
    const { h } = await make({ attempts: [BAD, GOOD] });
    const p = await h.run("todo");
    expect(p.done).toEqual({ add: "pass", list: "pass" });
    expect(p.attempts.add).toBe(2);
    expect(p.status).toBe("awaiting_approval");
  });

  it("a deterministic check overrides a lenient evaluator", async () => {
    const { h } = await make({ attempts: [BAD], score: 10 });
    const p = await h.run("todo");
    expect(p.status).toBe("blocked");
    expect(p.done.add).toBe("failed");
  });

  it("low scores fail even when the check passes", async () => {
    const { h } = await make({ attempts: [GOOD], score: 3 });
    expect((await h.run("todo")).status).toBe("blocked");
  });

  it("blocks before starting later features", async () => {
    const { h } = await make({ attempts: [BAD] });
    expect("list" in (await h.run("todo")).done).toBe(false);
  });

  it("releases only with human approval", async () => {
    const { h } = await make({ attempts: [GOOD], approve: true });
    expect((await h.run("todo")).status).toBe("released");
  });

  it("restores contract-owned tests the generator tampered with", async () => {
    const { h, dir } = await make({ attempts: [GOOD], tamper: true });
    await h.run("todo");
    expect(await readFile(path.join(dir, "tests/accept.txt"), "utf8")).toBe("contract-owned");
  });

  it("rejects generator paths that escape the workspace", async () => {
    const { dir } = await make({ attempts: [GOOD] });
    const llm = new ScriptedLLM({
      planner: () => JSON.stringify({ features: ["a"] }),
      contract: () => JSON.stringify({ done: "", check: ["true"] }),
      generator: () => JSON.stringify({ files: { "../evil.txt": "x" } }),
      evaluator: () => "{}",
    });
    const h = new Harness(llm.call, defaultConfig(dir + "-esc"));
    await expect(h.run("x")).rejects.toThrow(/escapes workspace/);
  });

  it("resumes from progress.json without replanning or rebuilding", async () => {
    const first = await make({ attempts: [GOOD] });
    await first.h.run("todo");
    first.llm.calls.length = 0;
    const again = new Harness(first.llm.call, first.cfg);
    const p: Progress = await again.run("todo");
    expect(first.llm.calls).toEqual([]);
    expect(p.status).toBe("awaiting_approval");
  });
});
