import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { baselineLLM, execute, extractCode, loadTasks, runCodegen, type CodegenTask } from "../src/bench/codegen.js";
import { costUSD, loadModels, selectModels, unavailable } from "../src/bench/models.js";
import { summarizeCodegen } from "../src/bench/report.js";
import { passAtK, wilson } from "../src/bench/stats.js";
import { openAICompatibleLLM } from "../src/llm.js";

const root = path.resolve(import.meta.dirname, "../..");
const tasksFile = path.join(root, "benchmarks/codegen/tasks.jsonl");

describe("stats", () => {
  it("pass@k matches the closed form 1 - C(n-c,k)/C(n,k)", () => {
    expect(passAtK(10, 3, 1)).toBeCloseTo(0.3);
    expect(passAtK(10, 0, 5)).toBe(0);
    expect(passAtK(10, 10, 1)).toBe(1);
    expect(passAtK(5, 1, 2)).toBeCloseTo(1 - 6 / 10); // C(4,2)/C(5,2)
    expect(() => passAtK(2, 1, 5)).toThrow(/at least 5 samples/);
  });
  it("Wilson interval brackets the estimate and never leaves [0, 1]", () => {
    const [lo, hi] = wilson(9, 10);
    expect(lo).toBeGreaterThan(0.55);
    expect(hi).toBeLessThan(1);
    expect(wilson(0, 12)[0]).toBe(0);
    expect(wilson(12, 12)[1]).toBe(1);
  });
});

describe("codegen suite", () => {
  it("extracts the last fenced block, or the whole reply", () => {
    expect(extractCode("text\n```js\na\n```\nmore\n```javascript\nb\n```")).toBe("b");
    expect(extractCode("function f(){}")).toBe("function f(){}");
  });

  it("dataset is valid: every canonical solution passes, every stub fails", async () => {
    const tasks = await loadTasks(tasksFile);
    expect(tasks.length).toBeGreaterThanOrEqual(12);
    expect(new Set(tasks.map((t) => t.task_id)).size).toBe(tasks.length);
    const run = (kind: "reference" | "empty") =>
      runCodegen({ tasks, samples: 1, concurrency: 8, withUsage: () => baselineLLM(kind, tasks) });
    const good = await run("reference");
    const bad = await run("empty");
    expect(good.filter((r) => !r.samples[0]!.pass).map((r) => r.task_id)).toEqual([]);
    expect(bad.filter((r) => r.samples[0]!.pass).map((r) => r.task_id)).toEqual([]);
  }, 60_000);

  const task: CodegenTask = {
    task_id: "t", prompt: "", entry_point: "f", canonical_solution: "",
    test: "function check(f) { assert.equal(f(), 1); }",
  };
  it("sandbox: model code cannot write files", async () => {
    const target = path.join(tmpdir(), `bench-pwned-${process.pid}`);
    const r = await execute(`function f() { process.getBuiltinModule("node:fs").writeFileSync(${JSON.stringify(target)}, "x"); return 1; }`, task);
    expect(r.pass).toBe(false);
    expect(r.output).toContain("ERR_ACCESS_DENIED");
    expect(existsSync(target)).toBe(false);
  });
  it("sandbox: an infinite loop is killed and counts as a failure", async () => {
    const r = await execute("function f() { for (;;) {} }", task, 1500);
    expect(r.pass).toBe(false);
    expect(r.output).toContain("TIMEOUT");
  });
  it("an API error is a failed sample, not a crash", async () => {
    const tasks = (await loadTasks(tasksFile)).slice(0, 2);
    const res = await runCodegen({
      tasks, samples: 2, concurrency: 2,
      withUsage: () => async () => { throw new Error("503 overloaded"); },
    });
    const s = summarizeCodegen({ id: "x", provider: "anthropic", model: "m" }, res, [1, 2]);
    expect(s.passAt).toEqual({ "pass@1": 0, "pass@2": 0 });
    expect(s.apiErrors).toBe(4);
  });
});

describe("model registry", () => {
  it("loads, selects and reports missing keys", async () => {
    const all = await loadModels(path.join(root, "benchmarks/models.json"));
    expect(selectModels(all, "reference,empty").map((m) => m.id)).toEqual(["reference", "empty"]);
    expect(() => selectModels(all, "nope")).toThrow(/unknown model/);
    const m = { id: "x", provider: "openai-compatible" as const, model: "m", baseUrl: "http://h", apiKeyEnv: "BENCH_TEST_UNSET_KEY" };
    expect(unavailable(m)).toMatch(/BENCH_TEST_UNSET_KEY/);
    expect(costUSD({ ...m, price: { inputPerMTok: 3, outputPerMTok: 15 } }, { inputTokens: 1e6, outputTokens: 1e5 })).toBeCloseTo(4.5);
    expect(costUSD(m, { inputTokens: 1, outputTokens: 1 })).toBeNull();
  });
});

describe("openai-compatible adapter", () => {
  it("sends the chat-completions shape and reads usage", async () => {
    let seen: { auth?: string; body?: Record<string, unknown> } = {};
    const server = createServer((req, res) => {
      let raw = "";
      req.on("data", (c) => (raw += c));
      req.on("end", () => {
        seen = { auth: req.headers.authorization, body: JSON.parse(raw) };
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({
          choices: [{ message: { content: "hello" }, finish_reason: "stop" }],
          usage: { prompt_tokens: 11, completion_tokens: 3 },
        }));
      });
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const port = (server.address() as AddressInfo).port;
    const usage: number[] = [];
    try {
      const llm = openAICompatibleLLM({
        baseUrl: `http://127.0.0.1:${port}/v1/`, model: "m1", apiKey: "k", maxTokens: 50,
        maxTokensParam: "max_completion_tokens", temperature: 0, onUsage: (u) => usage.push(u.inputTokens, u.outputTokens),
      });
      expect(await llm("generator", "sys", "hi")).toBe("hello");
    } finally {
      server.close();
    }
    expect(seen.auth).toBe("Bearer k");
    expect(seen.body).toEqual({
      model: "m1", max_completion_tokens: 50, temperature: 0,
      messages: [{ role: "system", content: "sys" }, { role: "user", content: "hi" }],
    });
    expect(usage).toEqual([11, 3]);
  });
});
