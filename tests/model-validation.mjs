import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { readFileSync, writeFileSync } from "node:fs";

const BASE = "http://localhost:8787";
const DEV_VARS_PATH = new URL("../.dev.vars", import.meta.url).pathname;
const SRC_PATH = new URL("../src/routes/page-providers.ts", import.meta.url).pathname;

const PROVIDER_KEYS = {
  openai: process.env.OPENAI_API_KEY,
  anthropic: process.env.ANTHROPIC_API_KEY,
  "google-ai-studio": process.env.GOOGLE_API_KEY,
};

const PROVIDER_LABELS = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  "google-ai-studio": "Google",
};

let passed = 0, failed = 0;

function assert(condition, label, detail) {
  if (condition) { passed++; console.log(`  PASS  ${label}`); }
  else { failed++; console.log(`  FAIL  ${label}${detail ? `\n        ${detail}` : ""}`); }
}

async function testModel(provider, model) {
  const apiKey = PROVIDER_KEYS[provider];
  const label = `${PROVIDER_LABELS[provider] || provider}: ${model}`;

  const setupRes = await fetch(`${BASE}/__test/setup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider, model, apiKey }),
  });
  if (!setupRes.ok) {
    const err = await setupRes.text();
    console.log(`  FAIL  ${label}\n        setup failed (${setupRes.status}): ${err}`);
    failed++;
    return;
  }

  const { token } = await setupRes.json();
  const res = await fetch(`${BASE}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      messages: [{ role: "user", content: "Say exactly one word: OK" }],
      max_tokens: 10,
    }),
  });

  let data;
  try { data = await res.json(); } catch { data = null; }

  const providerError = data?.error?.message || "";
  const modelNotFound =
    providerError.includes("not_found_error") ||
    providerError.includes("model_not_found") ||
    providerError.includes("Model not found") ||
    providerError.includes("does not exist");

  if (res.status === 200 && data?.choices?.[0]?.message?.content) {
    passed++;
    console.log(`  PASS  ${label}`);
  } else if (modelNotFound) {
    console.log(`  FAIL  ${label}\n        404 — model not found: ${providerError}`);
    failed++;
  } else {
    const detail = `${res.status} — ${providerError.slice(0, 200)}`;
    console.log(`  FAIL  ${label}\n        ${detail}`);
    failed++;
  }
}

async function main() {
  const missing = Object.entries(PROVIDER_KEYS)
    .filter(([, v]) => !v)
    .map(([k]) => PROVIDER_LABELS[k] || k);
  if (missing.length > 0) {
    console.error(`Missing API keys for: ${missing.join(", ")}`);
    console.error("Set them in .env or as environment variables before running.");
    process.exit(1);
  }

  const src = readFileSync(SRC_PATH, "utf-8");
  const modelSection = src.match(/const MODELS = \{[^}]+\}/s);
  if (!modelSection) { console.error("Could not find MODELS in page-providers.ts"); process.exit(1); }

  const models = {};
  const providerMatches = modelSection[0].matchAll(/(\S+?):\s*\[([^\]]+)\]/g);
  for (const [, provider, list] of providerMatches) {
    const cleanProvider = provider.replace(/"/g, "");
    models[cleanProvider] = list.split(",").map(m => m.trim().replace(/"/g, "")).filter(Boolean);
  }

  // Also test streaming and new endpoints
  async function testEndpoint(label, path, body, checkFn) {
    const apiKey = PROVIDER_KEYS.openai;
    const setupRes = await fetch(`${BASE}/__test/setup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "openai", model: "gpt-4o-mini", apiKey }),
    });
    if (!setupRes.ok) { console.log(`  SKIP  ${label} (setup failed)`); failed++; return; }
    const { token } = await setupRes.json();
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    await checkFn(res, label);
  }

  console.log(`\n━━━ Streaming & multi-endpoint (OpenAI: gpt-4o-mini) ━━━`);

  await testEndpoint("/v1/chat/completions streaming", "/v1/chat/completions",
    { messages: [{ role: "user", content: "Say OK" }], stream: true, max_tokens: 10 },
    (res, label) => {
      const ct = res.headers.get("content-type") || "";
      assert(res.status === 200, `${label} → 200`, `got ${res.status}`);
      assert(ct.includes("event-stream"), `${label} → SSE`, `got ${ct}`);
    });

  await testEndpoint("/v1/messages streaming", "/v1/messages",
    { messages: [{ role: "user", content: "Say OK" }], stream: true, max_tokens: 10 },
    (res, label) => {
      const ct = res.headers.get("content-type") || "";
      assert(res.status === 200, `${label} → 200`, `got ${res.status}`);
      assert(ct.includes("event-stream"), `${label} → SSE`, `got ${ct}`);
    });

  await testEndpoint("/v1/responses streaming", "/v1/responses",
    { input: "Say OK", stream: true, max_tokens: 10 },
    (res, label) => {
      const ct = res.headers.get("content-type") || "";
      assert(res.status === 200, `${label} → 200`, `got ${res.status}`);
      assert(ct.includes("event-stream"), `${label} → SSE`, `got ${ct}`);
    });

  await testEndpoint("/v1/messages (non-streaming)", "/v1/messages",
    { messages: [{ role: "user", content: "Say OK" }], max_tokens: 10 },
    async (res, label) => {
      const body = await res.json();
      assert(res.status === 200, `${label} → 200`, `got ${res.status}`);
      assert(body.type === "message", `${label} → message type`, `got ${body.type}`);
      assert(body.content?.[0]?.text, `${label} → has text`, `no text`);
      assert(body.stop_reason === "end_turn", `${label} → end_turn`, `got ${body.stop_reason}`);
    });

  await testEndpoint("/v1/responses (non-streaming)", "/v1/responses",
    { input: "Say OK", max_tokens: 10 },
    async (res, label) => {
      const body = await res.json();
      assert(res.status === 200, `${label} → 200`, `got ${res.status}`);
      assert(body.object === "response", `${label} → response object`, `got ${body.object}`);
      assert(body.output?.[0]?.content?.[0]?.text, `${label} → has text`, `no text`);
    });

  const total = Object.values(models).flat().length;

  for (const [provider, modelList] of Object.entries(models)) {
    console.log(`\n━━━ ${PROVIDER_LABELS[provider] || provider} (${modelList.length} models) ━━━`);
    for (const model of modelList) {
      await testModel(provider, model);
    }
  }

  console.log(`\n\n━━━ Results ━━━\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

(async () => {
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
  let ready = false;
  for (let i = 0; i < 60; i++) {
    await sleep(1000);
    if (devOutput.includes("Ready on http")) { ready = true; break; }
  }

  if (!ready) {
    console.error("Timed out waiting for wrangler dev\n" + devOutput);
    dev.kill();
    writeFileSync(DEV_VARS_PATH, originalDevVars);
    process.exit(1);
  }
  console.log("wrangler dev is ready\n");

  try {
    await main();
  } catch (e) {
    console.error("\nFATAL:", e);
    process.exit(1);
  } finally {
    dev.kill();
    writeFileSync(DEV_VARS_PATH, originalDevVars);
  }
})();
