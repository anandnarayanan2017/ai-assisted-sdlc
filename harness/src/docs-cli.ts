/** Usage: tsx harness/src/docs-cli.ts gen|check  (npm run docs:gen / npm run docs:check) */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { checkDocs, generateDbSchema } from "./docs.js";

const root = path.resolve(import.meta.dirname, "../..");
if (process.argv[2] === "gen") {
  await writeFile(path.join(root, "docs", "generated", "db-schema.md"), await generateDbSchema(root));
  console.log("wrote docs/generated/db-schema.md");
} else {
  const problems = await checkDocs(root);
  for (const p of problems) console.log(`DOCS ${p}`);
  console.log(problems.length ? `\n${problems.length} knowledge-base problem(s)` : "knowledge base OK");
  process.exit(problems.length ? 1 : 0);
}
