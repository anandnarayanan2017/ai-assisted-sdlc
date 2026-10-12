import type { ArchRules } from "./architecture.js";
import type { CalibrationCase } from "./calibration.js";
import type { AppConfig } from "./probe.js";
import type { LLM } from "./llm.js";

/** A runnable demo project: a request, a (scripted or live) LLM, and a scaffold for the workspace. */
export interface Example {
  request: string;
  seedDir: string;
  /** Environment passed to the contract check command. */
  env: Record<string, string>;
  /** Architect-owned rules enforced on every sprint (kept outside the workspace). */
  architecture?: ArchRules;
  /** How to start the built app so the evaluator can probe it live. */
  app?: AppConfig;
  /** Human-graded evaluator cases: few-shot examples for the evaluator and the `calibrate` test set. */
  calibration?: CalibrationCase[];
  scriptedLLM(): LLM;
  /** Put external state (e.g. the database) back to a clean slate before a fresh run. */
  reset?(): Promise<void>;
}
