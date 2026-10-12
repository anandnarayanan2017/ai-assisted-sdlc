import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { checkArchitecture, type ArchRules } from "../src/architecture.js";
import { Harness, defaultConfig, parseJSON, type Progress } from "../src/harness.js";
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

describe("parseJSON", () => {
  it("accepts bare, fenced and prose-wrapped JSON", () => {
    expect(parseJSON('{"a":1}')).toEqual({ a: 1 });
    expect(parseJSON('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseJSON('Here you go:\n{"a":{"b":2}}\nDone.')).toEqual({ a: { b: 2 } });
    expect(() => parseJSON("no json here")).toThrow(/not JSON/);
  });
});

describe("agent context", () => {
  it("gives the generator the contract tests and existing files on its first attempt", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "h-"));
    let seen: Record<string, string> = {};
    const llm = new ScriptedLLM({
      planner: () => '```json\n{"features": ["a"]}\n```',
      contract: () => JSON.stringify({ done: "", check: ["true"], tests: { "tests/a.txt": "spec" } }),
      generator: (u) => {
        seen = (JSON.parse(u) as { workspace: Record<string, string> }).workspace;
        return JSON.stringify({ files: { "app.js": GOOD } });
      },
      evaluator: () => "Verdict: " + JSON.stringify({ scores: { functionality: 9, craft: 9 }, bugs: [] }),
    });
    const p = await new Harness(llm.call, defaultConfig(dir)).run("x");
    expect(seen["tests/a.txt"]).toBe("spec");
    expect(Object.keys(seen).some((k) => k.startsWith(".harness") || k.startsWith(".git/"))).toBe(false);
    expect(p.status).toBe("awaiting_approval");
  });

  it("caps the plan with maxFeatures", async () => {
    const { h, cfg } = await make({ attempts: [GOOD] });
    cfg.maxFeatures = 1;
    expect((await h.run("todo")).features).toEqual(["add"]);
  });
});

describe("architecture rules", () => {
  const rules: ArchRules = {
    root: "src",
    allowedPackages: ["express", "pg"],
    rules: [
      { name: "routes-independent", from: "^src/routes/", forbid: "^src/routes/", because: "decoupled routes" },
      { name: "pool-at-root", from: "^src/(?!server\\.ts$)", forbid: "^pg$", allowTypeOnly: true, because: "inject the pool" },
    ],
  };
  async function ws(files: Record<string, string>) {
    const dir = await mkdtemp(path.join(tmpdir(), "arch-"));
    for (const [rel, content] of Object.entries(files)) {
      await mkdir(path.dirname(path.join(dir, rel)), { recursive: true });
      await writeFile(path.join(dir, rel), content);
    }
    return dir;
  }

  it("flags forbidden imports, unapproved packages and runtime imports of type-only modules", async () => {
    const dir = await ws({
      "src/server.ts": 'import pg from "pg";\nimport { a } from "./routes/a.js";',
      "src/routes/a.ts": 'import type { Pool } from "pg";\nimport { b } from "./b.js";\nexport const a = 1;',
      "src/routes/b.ts": 'import pg from "pg";\nconst m = await import("lodash/fp");\nexport const b = 1;',
      "src/routes/b.test.ts": 'import { a } from "./a.js";',
    });
    const v = (await checkArchitecture(dir, rules)).map((x) => `${x.rule} ${x.file} -> ${x.target}`).sort();
    expect(v).toEqual([
      "allowed-packages src/routes/b.ts -> lodash",
      "pool-at-root src/routes/b.ts -> pg",
      "routes-independent src/routes/a.ts -> src/routes/b.ts",
    ]);
  });

  it("fails the sprint and feeds the violation back to the generator", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "h-"));
    const seen: string[][] = [];
    const llm = new ScriptedLLM({
      planner: () => JSON.stringify({ features: ["a"] }),
      contract: () => JSON.stringify({ done: "", check: ["true"] }),
      generator: (u) => {
        const { attempt, qa_bugs, architecture } = JSON.parse(u) as { attempt: number; qa_bugs: string[]; architecture: ArchRules };
        expect(architecture.rules).toHaveLength(2); // rules are given up front, not only on failure
        seen.push(qa_bugs);
        const imp = attempt === 1 ? 'import { b } from "./b.js";' : 'import { b } from "../shared.js";';
        return JSON.stringify({ files: { "src/routes/a.ts": imp, "src/routes/b.ts": "", "src/shared.ts": "" } });
      },
      evaluator: () => JSON.stringify({ scores: { functionality: 9, craft: 9 }, bugs: [] }),
    });
    const p = await new Harness(llm.call, { ...defaultConfig(dir), architecture: rules }).run("x");
    expect(p.done.a).toBe("pass");
    expect(p.attempts.a).toBe(2);
    expect(seen[1]!.join("\n")).toMatch(/ARCH routes-independent: src\/routes\/a\.ts -> src\/routes\/b\.ts/);
  });
});
