import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { readFileSync, writeFileSync, rmSync } from "node:fs";

const INFER0_PORT = 8787;
const MOCK_PORT = 8788;
const INFER0_BASE = `http://localhost:${INFER0_PORT}`;
const MOCK_BASE = `http://localhost:${MOCK_PORT}`;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const DEV_VARS_PATH = new URL("../.dev.vars", import.meta.url).pathname;

let passed = 0, failed = 0;

function assert(condition, label, detail) {
  if (condition) { passed++; console.log(`  PASS  ${label}`); }
  else { failed++; console.log(`  FAIL  ${label}${detail ? `\n        ${detail}` : ""}`); }
}

async function waitForReady(proc, label) {
  let output = "";
  proc.stdout.on("data", (d) => { output += d.toString(); });
  proc.stderr.on("data", (d) => { output += d.toString(); });
  for (let i = 0; i < 60; i++) {
    if (output.includes("Ready on http")) return output;
    await sleep(1000);
  }
  console.error(`Timed out waiting for ${label}\n${output}`);
  proc.kill();
  process.exit(1);
}

async function main() {
  if (!OPENAI_KEY) { console.error("Error: OPENAI_API_KEY env var required"); process.exit(1); }
  if (!ANTHROPIC_KEY) { console.error("Error: ANTHROPIC_API_KEY env var required"); process.exit(1); }

  const originalDevVars = readFileSync(DEV_VARS_PATH, "utf-8");
  if (!originalDevVars.includes("TEST_MODE=true")) {
    writeFileSync(DEV_VARS_PATH, `${originalDevVars.trim()}\nTEST_MODE=true\n`);
  }

  // 1. Start infer0 main worker
  console.log("Starting infer0 main worker...");
  const infer0 = spawn("npx", ["wrangler", "dev", "--port", String(INFER0_PORT), "--ip", "127.0.0.1"], {
    stdio: ["ignore", "pipe", "pipe"],
    cwd: new URL("..", import.meta.url).pathname,
    env: { ...process.env, TEST_MODE: "true" },
  });
  await waitForReady(infer0, "infer0");
  console.log("infer0 main worker is ready\n");

  let mockDevVarsPath, existingMockDevVars;

  try {
    // 2. Create test data via __test/oauth-setup
    console.log("─── Setting up test data ───");
    const setupRes = await fetch(`${INFER0_BASE}/__test/oauth-setup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "openai",
        model: "gpt-4o-mini",
        apiKey: OPENAI_KEY,
        redirectUri: `${MOCK_BASE}/oauth/callback`,
      }),
    });
    assert(setupRes.status === 200, `oauth-setup -> 200`, `got ${setupRes.status}`);
    const setup = await setupRes.json();
    const { sessionCookie, appId, clientSecret, providerConfigId } = setup;
    const cookie = sessionCookie.split(";")[0];
    console.log("  Test app ID:", appId);
    console.log("  Provider config ID:", providerConfigId);

    // 3. Run OAuth flow
    console.log("\n─── OAuth flow ───");
    const formBody = new URLSearchParams({
      client_id: appId,
      redirect_uri: `${MOCK_BASE}/oauth/callback`,
      response_type: "code",
      provider_config_id: providerConfigId,
    });
    const postAuthRes = await fetch(`${INFER0_BASE}/oauth/authorize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: cookie,
      },
      body: formBody,
      redirect: "manual",
    });
    assert(postAuthRes.status === 302, `POST /oauth/authorize -> 302`, `got ${postAuthRes.status}`);
    const location = postAuthRes.headers.get("location") || "";
    const code = new URL(location).searchParams.get("code");
    assert(!!code, "authorization code present");

    const tokenRes = await fetch(`${INFER0_BASE}/v1/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: appId,
        client_secret: clientSecret,
        redirect_uri: `${MOCK_BASE}/oauth/callback`,
      }),
    });
    const tokenData = await tokenRes.json();
    assert(tokenRes.status === 200, `token exchange -> 200`, `got ${tokenRes.status}: ${JSON.stringify(tokenData)}`);
    assert(!!tokenData.access_token, "access_token present");
    const accessToken = tokenData.access_token;
    console.log("  Access token obtained");

    // 4. Start mock client on port 8788 with local vars
    console.log("\nStarting mock client...");
    const mockDevVars = `INFER0_API=${INFER0_BASE}\nCLIENT_ID=${appId}\nCLIENT_SECRET=${clientSecret}\n`;
    mockDevVarsPath = new URL("../mock-client/.dev.vars", import.meta.url).pathname;
    try { existingMockDevVars = readFileSync(mockDevVarsPath, "utf-8"); }
    catch { existingMockDevVars = null; }
    writeFileSync(mockDevVarsPath, mockDevVars);
    const mock = spawn("npx", ["wrangler", "dev", "--port", String(MOCK_PORT), "--ip", "127.0.0.1"], {
      stdio: ["ignore", "pipe", "pipe"],
      cwd: new URL("../mock-client", import.meta.url).pathname,
    });
    await waitForReady(mock, "mock client");
    console.log("mock client is ready\n");

    try {
      // 5. Test all three endpoints
      const endpoints = ["chat", "messages", "responses"];

      for (const ep of endpoints) {
        console.log(`\n━━━ ${ep} ━━━`);

        // Non-streaming
        const nsRes = await fetch(`${MOCK_BASE}/api/infer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accessToken,
            messages: [{ role: "user", content: "Say OK" }],
            endpoint: ep,
            stream: false,
            mode: "sdk",
          }),
        });

        if (nsRes.status !== 200) {
          const err = await nsRes.text();
          assert(false, `${ep} non-streaming -> 200`, `got ${nsRes.status}: ${err}`);
          continue;
        }

        const nsReader = nsRes.body.getReader();
        const nsDecoder = new TextDecoder();
        let nsText = "";
        while (true) {
          const { done, value } = await nsReader.read();
          if (done) break;
          nsText += nsDecoder.decode(value, { stream: true });
        }
        const nsContent = [...nsText.matchAll(/"content":"([^"]+)"/g)].map(m => m[1]).join("");
        assert(nsContent.length > 0, `${ep} non-streaming has content`, `got ${nsContent}`);

        // Streaming
        const sRes = await fetch(`${MOCK_BASE}/api/infer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accessToken,
            messages: [{ role: "user", content: "Say OK" }],
            endpoint: ep,
            stream: true,
            mode: "sdk",
          }),
        });
        assert(sRes.status === 200, `${ep} streaming -> 200`, `got ${sRes.status}`);

        const ct = sRes.headers.get("content-type") || "";
        assert(ct.includes("event-stream"), `${ep} streaming -> event-stream`, `got ${ct}`);

        const sReader = sRes.body.getReader();
        const sDecoder = new TextDecoder();
        let sText = "", sChunks = 0, sSawDone = false;
        while (true) {
          const { done, value } = await sReader.read();
          if (done) break;
          sText += sDecoder.decode(value, { stream: true });
        }
        for (const line of sText.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const p = line.slice(6).trim();
          if (p === "[DONE]") sSawDone = true;
          else sChunks++;
        }
        assert(sChunks > 0, `${ep} streaming -> ${sChunks} chunks`);
        assert(sSawDone, `${ep} streaming -> [DONE]`);

        const sContent = [...sText.matchAll(/"content":"([^"]+)"/g)].map(m => m[1]).join("");
        assert(sContent.length > 0, `${ep} streaming has content`, `got ${sContent}`);

        // Raw mode non-streaming
        const rawNsRes = await fetch(`${MOCK_BASE}/api/infer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accessToken,
            messages: [{ role: "user", content: "Say OK" }],
            endpoint: ep,
            stream: false,
            mode: "raw",
          }),
        });
        assert(rawNsRes.status === 200, `${ep} raw non-streaming -> 200`, `got ${rawNsRes.status}`);
        if (rawNsRes.status === 200) {
          const rawNsReader = rawNsRes.body.getReader();
          const rawNsDecoder = new TextDecoder();
          let rawNsText = "";
          while (true) { const { done, value } = await rawNsReader.read(); if (done) break; rawNsText += rawNsDecoder.decode(value, { stream: true }); }
          const rawNsContent = [...rawNsText.matchAll(/"content":"([^"]+)"/g)].map(m => m[1]).join("");
          assert(rawNsContent.length > 0, `${ep} raw non-streaming has content`);
        }

        // Raw mode streaming
        const rawSRes = await fetch(`${MOCK_BASE}/api/infer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accessToken,
            messages: [{ role: "user", content: "Say OK" }],
            endpoint: ep,
            stream: true,
            mode: "raw",
          }),
        });
        assert(rawSRes.status === 200, `${ep} raw streaming -> 200`, `got ${rawSRes.status}`);
        if (rawSRes.status === 200) {
          const rawCt = rawSRes.headers.get("content-type") || "";
          assert(rawCt.includes("event-stream"), `${ep} raw streaming -> event-stream`);
          const rawSReader = rawSRes.body.getReader();
          const rawSDecoder = new TextDecoder();
          let rawSText = "", rawSChunks = 0, rawSSawDone = false;
          while (true) {
            const { done, value } = await rawSReader.read();
            if (done) break;
            rawSText += rawSDecoder.decode(value, { stream: true });
          }
          for (const line of rawSText.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            const p = line.slice(6).trim();
            if (p === "[DONE]") rawSSawDone = true;
            else rawSChunks++;
          }
          assert(rawSChunks > 0, `${ep} raw streaming -> ${rawSChunks} chunks`);
          assert(rawSSawDone, `${ep} raw streaming -> [DONE]`);
        }
      }

      // 6. Test mock client homepage renders
      console.log("\n─── Homepage ───");
      const homeRes = await fetch(MOCK_BASE);
      assert(homeRes.status === 200, "homepage -> 200");
      const homeHtml = await homeRes.text();
      assert(homeHtml.includes("infer0"), "homepage shows infer0");
      assert(homeHtml.includes(appId), "homepage has client-id meta");

    } finally {
      mock.kill();
    }
  } catch (e) {
    console.error("\nERROR:", e);
  } finally {
    if (mockDevVarsPath) {
      if (existingMockDevVars) writeFileSync(mockDevVarsPath, existingMockDevVars);
      else try { rmSync(mockDevVarsPath); } catch {}
    }
    infer0.kill();
    writeFileSync(DEV_VARS_PATH, originalDevVars);
    console.log(`\n\n━━━ Results ━━━\n${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
  }
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
