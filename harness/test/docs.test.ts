import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { checkDocs } from "../src/docs.js";

const root = path.resolve(import.meta.dirname, "../..");

describe("knowledge base", () => {
  it("has no broken links, unindexed docs, mislabelled plans or stale generated files", async () => {
    expect(await checkDocs(root)).toEqual([]);
  });
});

describe("harness layering (structural test)", () => {
  // Core modules must not depend on the benchmark; the benchmark builds on the core. cli.ts is the composition root.
  it("core modules never import bench/", async () => {
    const src = path.join(root, "harness/src");
    const core = (await readdir(src)).filter((f) => f.endsWith(".ts") && f !== "cli.ts");
    const offenders: string[] = [];
    for (const f of core) if (/from "\.\/bench\//.test(await readFile(path.join(src, f), "utf8"))) offenders.push(f);
    expect(offenders, "move shared code into the core, or the import into cli.ts").toEqual([]);
  });
});
