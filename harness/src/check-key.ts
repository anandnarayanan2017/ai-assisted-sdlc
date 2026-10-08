import { testKey } from "./llm.js";

testKey().then(
  (r) => console.log(`key OK: ${r.trim()}`),
  (e) => {
    console.error(`key check failed: ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  },
);
