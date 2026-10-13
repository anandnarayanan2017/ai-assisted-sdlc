/** Turns raw benchmark rows into a leaderboard (summary.json + report.md). */
import type { Usage } from "../llm.js";
import type { TaskResult } from "./codegen.js";
import { costUSD, type ModelSpec } from "./models.js";
import { mean, passAtK, percentile, wilson } from "./stats.js";

export interface CodegenSummary {
  id: string; vendor: string; model: string;
  samplesPerTask: number; tasks: number;
  passAt: Record<string, number>;
  /** 95% Wilson interval over all samples (pass@1 granularity). */
  ci95: [number, number];
  solved: number; apiErrors: number;
  p50Secs: number; p95Secs: number;
  usage: Usage; costUSD: number | null;
  perTask: Record<string, string>;
}

export function summarizeCodegen(m: ModelSpec, results: TaskResult[], ks: number[]): CodegenSummary {
  const all = results.flatMap((r) => r.samples);
  const n = results[0]?.samples.length ?? 0;
  const passAt: Record<string, number> = {};
  for (const k of ks.filter((k) => k <= n))
    passAt[`pass@${k}`] = mean(results.map((r) => passAtK(r.samples.length, r.samples.filter((s) => s.pass).length, k)));
  const usage = all.reduce((u, s) => ({ inputTokens: u.inputTokens + s.usage.inputTokens, outputTokens: u.outputTokens + s.usage.outputTokens }),
    { inputTokens: 0, outputTokens: 0 });
  return {
    id: m.id, vendor: m.vendor ?? m.provider, model: m.model ?? m.provider,
    samplesPerTask: n, tasks: results.length, passAt,
    ci95: wilson(all.filter((s) => s.pass).length, all.length),
    solved: results.filter((r) => r.samples.some((s) => s.pass)).length,
    apiErrors: all.filter((s) => s.error?.startsWith("API:")).length,
    p50Secs: percentile(all.map((s) => s.secs), 0.5), p95Secs: percentile(all.map((s) => s.secs), 0.95),
    usage, costUSD: costUSD(m, usage),
    perTask: Object.fromEntries(results.map((r) => [r.task_id, `${r.samples.filter((s) => s.pass).length}/${r.samples.length}`])),
  };
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const usd = (x: number | null) => (x === null ? "n/a" : `$${x.toFixed(4)}`);
const tok = (n: number) => (n >= 10_000 ? `${(n / 1000).toFixed(0)}k` : String(n));

export function codegenMarkdown(rows: CodegenSummary[], meta: Record<string, string>): string {
  const sorted = [...rows].sort((a, b) => (b.passAt["pass@1"] ?? 0) - (a.passAt["pass@1"] ?? 0));
  const ks = Object.keys(sorted[0]?.passAt ?? {});
  const lines = [
    "# Codegen benchmark (HumanEval-style, execution-based)",
    "",
    ...Object.entries(meta).map(([k, v]) => `- **${k}**: ${v}`),
    "",
    `| Rank | Model | Vendor | ${ks.join(" | ")} | 95% CI (pass@1) | Solved | API errors | p50 / p95 latency | Tokens in / out | Cost |`,
    `|---|---|---|${ks.map(() => "---|").join("")}---|---|---|---|---|---|`,
    ...sorted.map((r, i) =>
      `| ${i + 1} | \`${r.id}\` | ${r.vendor} | ${ks.map((k) => pct(r.passAt[k] ?? 0)).join(" | ")} | ` +
      `${pct(r.ci95[0])} - ${pct(r.ci95[1])} | ${r.solved}/${r.tasks} | ${r.apiErrors} | ` +
      `${r.p50Secs.toFixed(1)}s / ${r.p95Secs.toFixed(1)}s | ${tok(r.usage.inputTokens)} / ${tok(r.usage.outputTokens)} | ${usd(r.costUSD)} |`),
    "",
    "## Per task (passing samples / samples)",
    "",
    `| Task | ${sorted.map((r) => `\`${r.id}\``).join(" | ")} |`,
    `|---|${sorted.map(() => "---|").join("")}`,
    ...Object.keys(sorted[0]?.perTask ?? {}).map((t) => `| ${t} | ${sorted.map((r) => r.perTask[t]).join(" | ")} |`),
    "",
    "Overlapping confidence intervals mean the ranking between those models is not established by this run;",
    "raise `--samples` or add tasks before drawing a conclusion. See docs/design-docs/benchmark-methodology.md.",
    "",
  ];
  return lines.join("\n");
}

/** One model's end-to-end SDLC run, as written by cli.ts to .harness/metrics.json. */
export interface SdlcMetrics {
  model: string; liveRoles: string[]; status: string;
  sprints: number; passed: number; firstTry: number; attempts: number;
  calls: number; usage: Usage; costUSD: number | null; wallSecs: number;
  perSprint: { feature: string; result: string; attempts: number }[];
}

export function sdlcMarkdown(rows: (SdlcMetrics & { id: string; vendor: string })[], meta: Record<string, string>): string {
  const sorted = [...rows].sort((a, b) => b.passed - a.passed || b.firstTry - a.firstTry || a.attempts - b.attempts);
  const features = sorted[0]?.perSprint.map((s) => s.feature) ?? [];
  return [
    "# SDLC benchmark (agentic, fixed contracts, hidden tests)",
    "",
    ...Object.entries(meta).map(([k, v]) => `- **${k}**: ${v}`),
    "",
    "| Rank | Model | Vendor | Resolved sprints | First-try passes | Attempts used | Final status | Calls | Tokens in / out | Cost | Wall time |",
    "|---|---|---|---|---|---|---|---|---|---|---|",
    ...sorted.map((r, i) =>
      `| ${i + 1} | \`${r.id}\` | ${r.vendor} | ${r.passed}/${r.sprints} (${pct(r.sprints ? r.passed / r.sprints : 0)}) | ` +
      `${r.firstTry}/${r.sprints} | ${r.attempts} | ${r.status} | ${r.calls} | ${tok(r.usage.inputTokens)} / ${tok(r.usage.outputTokens)} | ` +
      `${usd(r.costUSD)} | ${r.wallSecs.toFixed(0)}s |`),
    "",
    "## Per sprint (result, attempts)",
    "",
    `| Sprint | ${sorted.map((r) => `\`${r.id}\``).join(" | ")} |`,
    `|---|${sorted.map(() => "---|").join("")}`,
    ...features.map((f, i) => `| ${f} | ${sorted.map((r) => {
      const s = r.perSprint[i];
      return s ? `${s.result} (${s.attempts})` : "not reached";
    }).join(" | ")} |`),
    "",
    "A sprint after a blocked one is never reached: the harness escalates instead of building on a broken base.",
    "",
  ].join("\n");
}
