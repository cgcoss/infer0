import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { readFileSync, writeFileSync } from "node:fs";

const BASE = "http://localhost:8787";
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_MODEL = "gpt-4o-mini";
const ANTHROPIC_MODEL = "claude-sonnet-4-20250514";

const DEV_VARS_PATH = new URL("../.dev.vars", import.meta.url).pathname;

let passed = 0, failed = 0;

function assert(condition, label, detail) {
  if (condition) { passed++; console.log(`  PASS  ${label}`); }
  else { failed++; console.log(`  FAIL  ${label}${detail ? `\n        ${detail}` : ""}`); }
}

async function setupSession(provider, model, apiKey) {
  const res = await fetch(`${BASE}/__test/setup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider, model, apiKey }),
  });
  if (!res.ok) throw new Error(`Setup failed (${res.status}): ${await res.text()}`);
  return res.json();
}

async function testNonStreaming(label, provider, model, apiKey, body, check) {
  const { token } = await setupSession(provider, model, apiKey);
  const res = await fetch(`${BASE}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const status = res.status;
  let data;
  try { data = await res.json(); } catch { data = null; }
  assert(status === 200, `${label} → 200`, `got ${status} — ${JSON.stringify(data)}`);
  if (status === 200) check(data);
}

async function testStreaming(label, provider, model, apiKey, body) {
  const { token } = await setupSession(provider, model, apiKey);
  const res = await fetch(`${BASE}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ ...body, stream: true }),
  });
  assert(res.status === 200, `${label} → 200`, `got ${res.status}`);
  if (res.status !== 200) return;

  const ct = res.headers.get("content-type") || "";
  assert(ct.includes("event-stream"), `${label} → event-stream`, `got ${ct}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "", chunks = 0, sawDone = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() || "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const p = line.slice(6).trim();
      if (p === "[DONE]") sawDone = true;
      else chunks++;
    }
  }
  assert(chunks > 0, `${label} → ${chunks} chunks`);
  assert(sawDone, `${label} → [DONE]`);
}

async function main() {
  if (!OPENAI_KEY) { console.error("Error: OPENAI_API_KEY env var required"); process.exit(1); }
  if (!ANTHROPIC_KEY) { console.error("Error: ANTHROPIC_API_KEY env var required"); process.exit(1); }

  const originalDevVars = readFileSync(DEV_VARS_PATH, "utf-8");
  writeFileSync(DEV_VARS_PATH, `${originalDevVars.trim()}\nTEST_MODE=true\n`);

  const dev = spawn("npx", ["wrangler", "dev", "--port", "8787", "--ip", "127.0.0.1"], {
    stdio: ["ignore", "pipe", "pipe"],
    cwd: new URL("..", import.meta.url).pathname,
  });

  let devOutput = "";
  dev.stdout.on("data", (d) => { devOutput += d.toString(); });
  dev.stderr.on("data", (d) => { devOutput += d.toString(); });

  console.log("Starting wrangler dev...");
  for (let i = 0; i < 60; i++) {
    await sleep(1000);
    if (devOutput.includes("Ready on http")) break;
  }

  if (!devOutput.includes("Ready on http")) {
    console.error("Timed out waiting for wrangler dev\n" + devOutput);
    dev.kill();
    writeFileSync(DEV_VARS_PATH, originalDevVars);
    process.exit(1);
  }
  console.log("wrangler dev is ready\n");

  const msg = { role: "user", content: "Hi" };

  try {
    const tests = [
      ["OpenAI SDK → OpenAI",    "openai",    OPENAI_MODEL,    OPENAI_KEY],
      ["OpenAI SDK → Anthropic", "anthropic", ANTHROPIC_MODEL, ANTHROPIC_KEY],
    ];
    for (const [desc, prov, model, key] of tests) {
      console.log(`\n━━━ ${desc} ━━━`);
      await testNonStreaming(`${desc} non-streaming`, prov, model, key,
        { messages: [msg] },
        (d) => { assert(d.object === "chat.completion", "object = chat.completion"); assert(d.choices?.[0]?.message?.content?.length > 0, "has content"); });
      await testStreaming(`${desc} streaming`, prov, model, key,
        { messages: [msg] });
    }
  } catch (e) {
    console.error("\nERROR:", e);
  } finally {
    dev.kill();
    writeFileSync(DEV_VARS_PATH, originalDevVars);
    console.log(`\n\n━━━ Results ━━━\n${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
  }
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
