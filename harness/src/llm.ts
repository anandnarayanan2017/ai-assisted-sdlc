/** LLM access. Every call is a fresh context: the harness's unit of "context reset". */
export type Role = "planner" | "contract" | "generator" | "evaluator";
export type LLM = (role: Role, system: string, user: string) => Promise<string>;

/** Minimal Messages API client over fetch (no SDK dependency). */
export function anthropicLLM(model = "claude-sonnet-5-5", maxTokens = 16000): LLM {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
  return async (_role, system, user) => {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }),
    });
    if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
    const body = (await res.json()) as { content: { type: string; text?: string }[] };
    return body.content.map((c) => c.text ?? "").join("");
  };
}

/** Deterministic stand-in for tests and offline demos: role -> handler(user) -> reply. */
export class ScriptedLLM {
  readonly calls: Role[] = [];
  constructor(private handlers: Record<Role, (user: string) => string | Promise<string>>) {}
  readonly call: LLM = async (role, _system, user) => {
    this.calls.push(role);
    return this.handlers[role](user);
  };
}
