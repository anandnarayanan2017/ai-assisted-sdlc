/**
 * Live probing for the evaluator: start the built app, run evaluator-written Playwright tests against it,
 * stop the app. The contract tests prove the feature; probes look for what the contract did not think of.
 * Probe results inform the evaluator's scores. They are not a gate: an evaluator-written probe can be wrong.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export interface AppConfig {
  /** argv that starts the app in the workspace, e.g. ["npx", "tsx", "src/server.ts"]. */
  start: string[];
  port: number;
  /** Path that returns 2xx once the app is ready, e.g. "/health". */
  ready: string;
  startTimeoutMs?: number;
}

export interface ProbeResult { ran: boolean; ok: boolean; output: string }

const strip = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");

function run(cmd: string, args: string[], cwd: string, env: NodeJS.ProcessEnv, timeoutMs: number) {
  return new Promise<{ code: number | null; out: string }>((resolve) => {
    const child = spawn(cmd, args, { cwd, env });
    let out = "";
    const cap = (b: Buffer) => { out = (out + b.toString()).slice(-20_000); };
    child.stdout.on("data", cap);
    child.stderr.on("data", cap);
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.on("error", (e) => { clearTimeout(timer); resolve({ code: -1, out: `${out}\n${e.message}` }); });
    child.on("close", (code) => { clearTimeout(timer); resolve({ code, out: strip(out) }); });
  });
}

async function startApp(workdir: string, app: AppConfig, env: NodeJS.ProcessEnv): Promise<{ child: ChildProcess; log: () => string }> {
  const [cmd, ...args] = app.start;
  // detached: the app gets its own process group, so stopping it also stops whatever it spawned (tsx -> node).
  const child = spawn(cmd!, args, { cwd: workdir, env: { ...env, PORT: String(app.port) }, detached: true });
  let log = "";
  const cap = (b: Buffer) => { log = (log + b.toString()).slice(-5_000); };
  child.stdout?.on("data", cap);
  child.stderr?.on("data", cap);
  const deadline = Date.now() + (app.startTimeoutMs ?? 20_000);
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`app exited with ${child.exitCode} before it was ready:\n${strip(log)}`);
    const ok = await fetch(`http://127.0.0.1:${app.port}${app.ready}`).then((r) => r.ok, () => false);
    if (ok) return { child, log: () => strip(log) };
    await new Promise((r) => setTimeout(r, 250));
  }
  stopApp(child);
  throw new Error(`app not ready on :${app.port}${app.ready} within ${app.startTimeoutMs ?? 20_000}ms:\n${strip(log)}`);
}

function stopApp(child: ChildProcess) {
  try { process.kill(-child.pid!, "SIGKILL"); } catch { /* already gone */ }
}

/** Write the probe files under <workdir>/<dir>, run them with Playwright against the live app. */
export async function runProbes(workdir: string, dir: string, files: Record<string, string>, app: AppConfig,
  env: Record<string, string> = {}, timeoutMs = 120_000): Promise<ProbeResult> {
  const specs = Object.entries(files).filter(([f]) => /\.spec\.[mc]?[tj]s$/.test(f));
  if (specs.length === 0) return { ran: false, ok: true, output: "no probes written" };
  const abs = path.join(workdir, dir);
  for (const [rel, content] of specs) {
    const p = path.join(abs, path.basename(rel)); // flat: probe files cannot land anywhere else
    await mkdir(path.dirname(p), { recursive: true });
    await writeFile(p, content);
  }
  const baseURL = `http://127.0.0.1:${app.port}`;
  await writeFile(path.join(abs, "playwright.config.mjs"),
    `export default { testDir: ".", timeout: 15000, retries: 0, workers: 1, reporter: "list", use: { baseURL: "${baseURL}" } };\n`);

  const fullEnv = { ...process.env, ...env };
  let started;
  try {
    started = await startApp(workdir, app, fullEnv);
  } catch (e) {
    return { ran: true, ok: false, output: `app failed to start: ${e instanceof Error ? e.message : e}` };
  }
  try {
    const r = await run("npx", ["--no-install", "playwright", "test", "-c", "playwright.config.mjs"], abs,
      { ...fullEnv, CI: "1", BASE_URL: baseURL }, timeoutMs);
    return { ran: true, ok: r.code === 0, output: `exit=${r.code}\n${r.out}` };
  } finally {
    stopApp(started.child);
  }
}
