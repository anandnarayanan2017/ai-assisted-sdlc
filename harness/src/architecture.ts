/**
 * Architecture rules: the architect's constraints, enforced as a deterministic check.
 * Rules live outside the workspace (examples/<name>/architecture.json), so no agent can weaken them.
 * They cover what tests rarely catch: layering, dependency direction and the approved package list.
 */
import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

export interface ArchRule {
  name: string;
  /** Regex on the importing file's workspace-relative path, e.g. "^src/routes/". */
  from: string;
  /** Regex on the import target: a workspace-relative path for local imports, else the package name. */
  forbid: string;
  /** `import type` is erased at compile time, so it does not create a runtime dependency. */
  allowTypeOnly?: boolean;
  /** Why the rule exists. Shown to the generator so a retry can fix the design, not just the symptom. */
  because: string;
}

export interface ArchRules {
  /** Directory whose .ts files are checked (tests are excluded). */
  root: string;
  rules: ArchRule[];
  /** Third-party packages the code may import at runtime; node:* builtins are always allowed. */
  allowedPackages?: string[];
}

export interface Violation { file: string; target: string; rule: string; because: string }

const IMPORT = /^\s*(import|export)\s+(type\s+)?(?:[^'"]*?\s+from\s+)?["']([^"']+)["']/gm;
const DYNAMIC = /\bimport\(\s*["']([^"']+)["']\s*\)/g;

async function sources(dir: string, base: string): Promise<string[]> {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory() && e.name !== "node_modules") out.push(...(await sources(p, base)));
    else if (/\.(ts|tsx|mts)$/.test(e.name) && !/\.(test|spec)\.tsx?$/.test(e.name) && !e.name.endsWith(".d.ts"))
      out.push(path.relative(base, p).split(path.sep).join("/"));
  }
  return out;
}

/** Local imports resolve to a workspace path (".js" -> ".ts", NodeNext style); packages to their name. */
function target(file: string, spec: string): string {
  if (spec.startsWith(".")) return path.posix.normalize(path.posix.join(path.posix.dirname(file), spec)).replace(/\.js$/, ".ts");
  if (spec.startsWith("node:")) return spec;
  const parts = spec.split("/");
  return spec.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]!;
}

export async function checkArchitecture(workdir: string, a: ArchRules): Promise<Violation[]> {
  const out: Violation[] = [];
  const allowed = a.allowedPackages && new Set(a.allowedPackages);
  for (const file of await sources(path.join(workdir, a.root), workdir)) {
    const code = await readFile(path.join(workdir, file), "utf8");
    const imports = [
      ...[...code.matchAll(IMPORT)].map((m) => ({ spec: m[3]!, typeOnly: !!m[2] })),
      ...[...code.matchAll(DYNAMIC)].map((m) => ({ spec: m[1]!, typeOnly: false })),
    ];
    for (const { spec, typeOnly } of imports) {
      const t = target(file, spec);
      if (allowed && !typeOnly && !spec.startsWith(".") && !t.startsWith("node:") && !allowed.has(t))
        out.push({ file, target: t, rule: "allowed-packages", because: `only ${[...allowed].join(", ")} are approved` });
      for (const r of a.rules) {
        if (!new RegExp(r.from).test(file) || !new RegExp(r.forbid).test(t)) continue;
        if (typeOnly && r.allowTypeOnly) continue;
        if (t === file) continue;
        out.push({ file, target: t, rule: r.name, because: r.because });
      }
    }
  }
  return out;
}

/** One line per violation, prefixed so failureLines() picks them up as feedback. */
export const formatViolations = (v: Violation[]) =>
  v.map((x) => `ARCH ${x.rule}: ${x.file} -> ${x.target} (${x.because})`).join("\n");
