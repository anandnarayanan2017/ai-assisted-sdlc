/** The model registry (benchmarks/models.json): one entry per vendor/model under comparison. */
import { readFile } from "node:fs/promises";
import { anthropicLLM, cleanKey, openAICompatibleLLM, type LLM, type Usage } from "../llm.js";

export type Provider = "anthropic" | "openai-compatible" | "reference" | "empty";

export interface ModelSpec {
  id: string;
  provider: Provider;
  /** Vendor label for the leaderboard (defaults to the provider). */
  vendor?: string;
  model?: string;
  baseUrl?: string;
  /** Name of the env var holding the key; never the key itself. */
  apiKeyEnv?: string;
  maxTokens?: number;
  maxTokensParam?: "max_tokens" | "max_completion_tokens";
  /** USD per million tokens, copied from the vendor's pricing page. null = cost column shows "n/a". */
  price?: { inputPerMTok: number | null; outputPerMTok: number | null };
  notes?: string;
}

export async function loadModels(file: string): Promise<ModelSpec[]> {
  const { models } = JSON.parse(await readFile(file, "utf8")) as { models: ModelSpec[] };
  const ids = new Set<string>();
  for (const m of models) {
    if (ids.has(m.id)) throw new Error(`${file}: duplicate model id "${m.id}"`);
    ids.add(m.id);
    if ((m.provider === "anthropic" || m.provider === "openai-compatible") && !m.model)
      throw new Error(`${file}: "${m.id}" needs a "model"`);
    if (m.provider === "openai-compatible" && !m.baseUrl) throw new Error(`${file}: "${m.id}" needs a "baseUrl"`);
  }
  return models;
}

/** Pick models by comma-separated ids; "all" selects every entry. */
export function selectModels(all: ModelSpec[], ids: string): ModelSpec[] {
  if (ids === "all") return all;
  return ids.split(",").map((id) => {
    const m = all.find((x) => x.id === id.trim());
    if (!m) throw new Error(`unknown model "${id}" (known: ${all.map((x) => x.id).join(", ")})`);
    return m;
  });
}

/** Why a model cannot run here (missing key), or undefined when it can. */
export function unavailable(m: ModelSpec): string | undefined {
  if (m.provider === "anthropic" && !cleanKey(process.env[m.apiKeyEnv ?? "ANTHROPIC_API_KEY"]))
    return `${m.apiKeyEnv ?? "ANTHROPIC_API_KEY"} is not set`;
  if (m.provider === "openai-compatible" && m.apiKeyEnv && !cleanKey(process.env[m.apiKeyEnv]))
    return `${m.apiKeyEnv} is not set`;
  return undefined;
}

/** A real API client for the spec. The offline baselines ("reference", "empty") are built by each suite. */
export function liveLLM(m: ModelSpec, o: { temperature?: number; onUsage?: (u: Usage) => void } = {}): LLM {
  if (m.provider === "anthropic") {
    return anthropicLLM(m.model, m.maxTokens ?? 16000, { ...o, apiKey: process.env[m.apiKeyEnv ?? "ANTHROPIC_API_KEY"] });
  }
  if (m.provider === "openai-compatible") {
    return openAICompatibleLLM({
      baseUrl: m.baseUrl!, model: m.model!, maxTokens: m.maxTokens, maxTokensParam: m.maxTokensParam,
      apiKey: m.apiKeyEnv ? cleanKey(process.env[m.apiKeyEnv]) : undefined, ...o,
    });
  }
  throw new Error(`"${m.id}" (${m.provider}) is an offline baseline, not an API model`);
}

/** USD for the given usage, or null when the registry has no price for this model. */
export function costUSD(m: ModelSpec, u: Usage): number | null {
  const p = m.price;
  if (m.provider === "reference" || m.provider === "empty") return 0;
  if (p?.inputPerMTok == null || p.outputPerMTok == null) return null;
  return (u.inputTokens * p.inputPerMTok + u.outputTokens * p.outputPerMTok) / 1e6;
}
