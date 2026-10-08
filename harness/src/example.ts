import type { LLM } from "./llm.js";

/** A runnable demo project: a request, a (scripted or live) LLM, and a scaffold for the workspace. */
export interface Example {
  request: string;
  seedDir: string;
  /** Environment passed to the contract check command. */
  env: Record<string, string>;
  scriptedLLM(): LLM;
  /** Put external state (e.g. the database) back to a clean slate before a fresh run. */
  reset?(): Promise<void>;
}
