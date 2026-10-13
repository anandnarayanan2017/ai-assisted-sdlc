/** LLM access. Every call is a fresh context: the harness's unit of "context reset". */
export type Role = "planner" | "contract" | "generator" | "prober" | "evaluator";
export type LLM = (role: Role, system: string, user: string) => Promise<string>;

/** Tokens reported by the provider for one call (used for benchmark cost and efficiency columns). */
export interface Usage { inputTokens: number; outputTokens: number }
export interface CallOptions {
  /** Omit to use the provider default (some reasoning models reject anything else). */
  temperature?: number;
  onUsage?: (u: Usage) => void;
}

/** Keys pasted into .env / compose often carry quotes, CR/LF or spaces, which APIs reject as 401. */
export const cleanKey = (raw: string | undefined) => (raw ?? "").trim().replace(/^["']|["']$/g, "").trim();

/** POST JSON with backoff on 429 / 5xx; throws with the provider's error body otherwise. */
async function post(url: string, headers: Record<string, string>, body: unknown, vendor: string): Promise<unknown> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
    if ((res.status === 429 || res.status >= 500) && attempt < 5) {
      await new Promise((r) => setTimeout(r, 2 ** attempt * 1000));
      continue;
    }
    if (!res.ok) throw new Error(`${vendor} API ${res.status}: ${await res.text()}`);
    return res.json();
  }
}

/** Minimal Messages API client over fetch (no SDK dependency). */
export function anthropicLLM(
  model = "claude-sonnet-5-5", maxTokens = 16000, opts: CallOptions & { apiKey?: string } = {},
): LLM {
  const key = cleanKey(opts.apiKey ?? process.env.ANTHROPIC_API_KEY);
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
  return async (_role, system, user) => {
    const body = (await post("https://api.anthropic.com/v1/messages",
      { "x-api-key": key, "anthropic-version": "2023-06-01" },
      { model, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }],
        ...(opts.temperature === undefined ? {} : { temperature: opts.temperature }) },
      "Anthropic")) as {
      content: { type: string; text?: string }[]; stop_reason?: string;
      usage?: { input_tokens: number; output_tokens: number };
    };
    opts.onUsage?.({ inputTokens: body.usage?.input_tokens ?? 0, outputTokens: body.usage?.output_tokens ?? 0 });
    if (body.stop_reason === "max_tokens") throw new Error(`reply truncated at max_tokens=${maxTokens}`);
    return body.content.map((c) => c.text ?? "").join("");
  };
}

/**
 * OpenAI Chat Completions wire format. Most vendors and local servers speak it (OpenAI, Google Gemini's
 * OpenAI-compatible endpoint, Mistral, DeepSeek, Groq, Together, OpenRouter, Azure OpenAI, vLLM, Ollama),
 * so one adapter plus a base URL covers them.
 */
export function openAICompatibleLLM(o: {
  baseUrl: string; model: string; apiKey?: string; maxTokens?: number;
  /** OpenAI reasoning models want max_completion_tokens; most other servers want max_tokens. */
  maxTokensParam?: "max_tokens" | "max_completion_tokens";
} & CallOptions): LLM {
  const maxTokens = o.maxTokens ?? 16000;
  const url = `${o.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const headers: Record<string, string> = o.apiKey ? { authorization: `Bearer ${o.apiKey}` } : {};
  return async (_role, system, user) => {
    const body = (await post(url, headers, {
      model: o.model,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      [o.maxTokensParam ?? "max_tokens"]: maxTokens,
      ...(o.temperature === undefined ? {} : { temperature: o.temperature }),
    }, `${o.baseUrl}`)) as {
      choices?: { message?: { content?: string | null }; finish_reason?: string }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    o.onUsage?.({ inputTokens: body.usage?.prompt_tokens ?? 0, outputTokens: body.usage?.completion_tokens ?? 0 });
    const choice = body.choices?.[0];
    if (choice?.finish_reason === "length") throw new Error(`reply truncated at ${o.maxTokensParam ?? "max_tokens"}=${maxTokens}`);
    return choice?.message?.content ?? "";
  };
}

type Handler = (user: string) => string | Promise<string>;

/** Deterministic stand-in for tests and offline demos: role -> handler(user) -> reply. */
export class ScriptedLLM {
  readonly calls: Role[] = [];
  constructor(
    private handlers: Record<Exclude<Role, "prober">, Handler> & { prober?: Handler },
  ) {}
  readonly call: LLM = async (role, _system, user) => {
    this.calls.push(role);
    const h = this.handlers[role];
    if (!h) throw new Error(`scripted LLM has no "${role}" handler`);
    return h(user);
  };
}

/** One minimal call to verify the key end to end; returns the model's reply. */
export async function testKey(model = "claude-sonnet-5-5"): Promise<string> {
  return anthropicLLM(model, 16)("planner", "Reply with the single word: ok", "ping");
}
