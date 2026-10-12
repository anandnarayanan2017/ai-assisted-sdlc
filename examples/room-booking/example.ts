/** Room-booking demo: a scripted "model" replays recorded planner/contract/generator/evaluator turns. */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import type { ArchRules } from "../../harness/src/architecture.js";
import type { Example } from "../../harness/src/example.js";
import { failureLines } from "../../harness/src/harness.js";
import { ScriptedLLM } from "../../harness/src/llm.js";

const here = import.meta.dirname;
const scriptDir = path.join(here, "script");
const DATABASE_URL = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/rooms";

interface Sprint {
  title: string;
  done: string;
  check: string[];
  lenientAttempts?: number[];
  dir: string;
}

async function sprints(): Promise<Sprint[]> {
  const dirs = (await readdir(scriptDir)).filter((d) => /^\d\d-/.test(d)).sort();
  return Promise.all(
    dirs.map(async (d) => ({
      ...(JSON.parse(await readFile(path.join(scriptDir, d, "sprint.json"), "utf8")) as Omit<Sprint, "dir">),
      dir: path.join(scriptDir, d),
    })),
  );
}

async function tree(dir: string, base = dir): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) Object.assign(out, await tree(p, base));
    else out[path.relative(base, p).split(path.sep).join("/")] = await readFile(p, "utf8");
  }
  return out;
}

const byTitle = async (title: string) => {
  const s = (await sprints()).find((x) => x.title === title);
  if (!s) throw new Error(`no scripted sprint titled "${title}"`);
  return s;
};

const example: Example = {
  request:
    "Build a meeting-room booking REST API in TypeScript (Node, Express, PostgreSQL): users, rooms, bookings, " +
    "no double-booking even under concurrent load, and availability search. Installed packages (add no others): " +
    "express 5, pg, zod, supertest, vitest, tsx, typescript. Tests run with `npm run verify` against the empty " +
    "Postgres 16 at process.env.DATABASE_URL.",
  seedDir: path.join(here, "seed"),
  env: { DATABASE_URL },
  architecture: JSON.parse(await readFile(path.join(here, "architecture.json"), "utf8")) as ArchRules,

  async reset() {
    const pool = new pg.Pool({ connectionString: DATABASE_URL });
    try {
      await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
    } finally {
      await pool.end();
    }
  },

  scriptedLLM() {
    return new ScriptedLLM({
      planner: async () => JSON.stringify({ features: (await sprints()).map((s) => s.title) }),

      contract: async (user) => {
        const { feature } = JSON.parse(user) as { feature: string };
        const s = await byTitle(feature);
        const tests = await tree(path.join(s.dir, "tests"), s.dir);
        return JSON.stringify({ done: s.done, check: s.check, tests });
      },

      generator: async (user) => {
        const { feature, attempt } = JSON.parse(user) as { feature: string; attempt: number };
        const s = await byTitle(feature);
        const dir = path.join(s.dir, `attempt-${attempt}`);
        const files = await tree(dir).catch(() => {
          throw new Error(`script exhausted: "${feature}" has no attempt-${attempt}`);
        });
        return JSON.stringify({ files });
      },

      evaluator: async (user) => {
        const { feature, attempt, gate } = JSON.parse(user) as {
          feature: string; attempt: number; gate: { ok: boolean; output: string };
        };
        const s = await byTitle(feature);
        const approves = gate.ok || (s.lenientAttempts ?? []).includes(attempt); // a lenient judge rubber-stamps
        return JSON.stringify(
          approves
            ? { scores: { functionality: 9, craft: 8 }, bugs: [] }
            : { scores: { functionality: 3, craft: 6 }, bugs: failureLines(gate.output) },
        );
      },
    }).call;
  },
};

export default example;
