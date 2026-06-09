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

async function oauthFlow(provider, model, apiKey) {
  console.log(`\n─── OAuth Flow: ${provider} ───`);

  // 1. Setup: create user, session, provider config, and OAuth app
  const setupRes = await fetch(`${BASE}/__test/oauth-setup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider, model, apiKey, redirectUri: `${BASE}/oauth/callback` }),
  });
  assert(setupRes.status === 200, `oauth-setup → 200`, `got ${setupRes.status}`);
  const setup = await setupRes.json();
  const { sessionCookie, appId, clientSecret, redirectUri, providerConfigId } = setup;

  const cookie = sessionCookie.split(";")[0]; // Extract "session=TOKEN" from full Set-Cookie

  // 2. GET /oauth/authorize → consent page
  const authUrl = `${BASE}/oauth/authorize?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code`;
  const consentRes = await fetch(authUrl, {
    headers: { Cookie: cookie },
  });
  assert(consentRes.status === 200, `GET /oauth/authorize → 200`, `got ${consentRes.status}`);
  const consentHtml = await consentRes.text();
  assert(consentHtml.includes("Authorize"), "consent page shows Authorize");
  assert(consentHtml.includes("Test App"), "consent page shows app name");

  // 3. POST /oauth/authorize → authorization code redirect
  const formBody = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: "code",
    provider_config_id: providerConfigId,
  });
  const postAuthRes = await fetch(`${BASE}/oauth/authorize`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookie,
    },
    body: formBody,
    redirect: "manual",
  });
  assert(postAuthRes.status === 302, `POST /oauth/authorize → 302`, `got ${postAuthRes.status}`);
  const location = postAuthRes.headers.get("location") || "";
  const code = new URL(location).searchParams.get("code");
  assert(!!code, "authorization code present", code ? "" : `no code in ${location}`);

  // 4. Exchange code for tokens
  const tokenRes = await fetch(`${BASE}/v1/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: appId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
  });
  const tokenData = await tokenRes.json();
  assert(tokenRes.status === 200, `token exchange → 200`, `got ${tokenRes.status}: ${JSON.stringify(tokenData)}`);
  assert(!!tokenData.access_token, "access_token present");
  assert(!!tokenData.refresh_token, "refresh_token present");
  assert(tokenData.expires_in === 3600, "expires_in = 3600");
  assert(tokenData.token_type === "Bearer", "token_type = Bearer");
  const { access_token: accessToken, refresh_token: refreshToken } = tokenData;

  // 5. Inference with access token
  const inferRes = await fetch(`${BASE}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ messages: [{ role: "user", content: "Say OK" }] }),
  });
  const inferData = await inferRes.json();
  assert(inferRes.status === 200, `inference → 200`, `got ${inferRes.status}: ${JSON.stringify(inferData).slice(0, 200)}`);
  assert(inferData.object === "chat.completion", "object = chat.completion");
  assert(inferData.choices?.[0]?.message?.content?.length > 0, "has content");

  // 6. Refresh token (rotation)
  const refreshRes = await fetch(`${BASE}/v1/oauth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: appId,
      client_secret: clientSecret,
    }),
  });
  const refreshData = await refreshRes.json();
  assert(refreshRes.status === 200, `token refresh → 200`, `got ${refreshRes.status}: ${JSON.stringify(refreshData)}`);
  assert(!!refreshData.access_token, "new access_token present");
  assert(!!refreshData.refresh_token, "new refresh_token present");
  assert(refreshData.access_token !== accessToken, "access token rotated");
  const { access_token: newAccessToken, refresh_token: newRefreshToken } = refreshData;

  // 7. Inference with new access token
  const infer2Res = await fetch(`${BASE}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${newAccessToken}`,
    },
    body: JSON.stringify({ messages: [{ role: "user", content: "Say OK" }] }),
  });
  const infer2Data = await infer2Res.json();
  assert(infer2Res.status === 200, `inference with new token → 200`, `got ${infer2Res.status}`);
  assert(infer2Data.choices?.[0]?.message?.content?.length > 0, "has content with new token");

  // 8. Reuse detection: present the old (rotated) refresh token
  const reuseRes = await fetch(`${BASE}/v1/oauth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: appId,
      client_secret: clientSecret,
    }),
  });
  const reuseData = await reuseRes.json();
  assert(reuseRes.status === 400, `reuse detection → 400`, `got ${reuseRes.status}: ${JSON.stringify(reuseData)}`);
  assert(reuseData.error === "invalid_grant", "reuse error = invalid_grant");

  // 9. The old refresh token was revoked, so the new one should also fail now
  const revokeRes = await fetch(`${BASE}/v1/oauth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: newRefreshToken,
      client_id: appId,
      client_secret: clientSecret,
    }),
  });
  assert(revokeRes.status === 400, `post-reuse refresh → 400`, `got ${revokeRes.status}`);

  return { setup };
}

async function main() {
  if (!OPENAI_KEY) { console.error("Error: OPENAI_API_KEY env var required"); process.exit(1); }

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

  try {
    await oauthFlow("openai", OPENAI_MODEL, OPENAI_KEY);
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
