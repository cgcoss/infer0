import { Hono } from "hono";
import type { Env } from "../types";
import { encrypt } from "../lib/crypto";
import { SignJWT } from "jose";
import { signToken } from "../lib/auth";

export const testRoutes = new Hono<{ Bindings: Env }>();

testRoutes.post("/__test/setup", async (c) => {
  // Only allow requests from localhost
  if (c.req.header("CF-Connecting-IP") && c.req.header("CF-Connecting-IP") !== "127.0.0.1" && c.req.header("CF-Connecting-IP") !== "::1") {
    return c.json({ error: "Not allowed from remote" }, 403);
  }

  const body = await c.req.json<{
    provider: string;
    model: string;
    apiKey: string;
  }>();

  if (!body.provider || !body.model || !body.apiKey) {
    return c.json({ error: "Missing provider, model, or apiKey" }, 400);
  }

  const userId = crypto.randomUUID();
  const providerConfigId = crypto.randomUUID();
  const appId = crypto.randomUUID();
  const authId = crypto.randomUUID();

  await c.env.DB.prepare(
    "INSERT OR IGNORE INTO users (id, email, name) VALUES (?, ?, ?)",
  ).bind(userId, `test-${userId.slice(0, 8)}@test.local`, "Test User").run();

  const encrypted = await encrypt(body.apiKey, c.env.ENCRYPTION_KEY);

  await c.env.DB.prepare(
    "INSERT INTO provider_configs (id, user_id, provider, model, api_key_encrypted, key_version) VALUES (?, ?, ?, ?, ?, 'v1')",
  ).bind(providerConfigId, userId, body.provider, body.model, encrypted).run();

  await c.env.DB.prepare(
    "INSERT INTO oauth_apps (id, developer_id, name, redirect_uri, client_secret) VALUES (?, ?, ?, ?, ?)",
  ).bind(appId, userId, "Test App", "http://localhost:8787/callback", "test-client-secret").run();

  await c.env.DB.prepare(
    "INSERT INTO oauth_authorizations (id, user_id, oauth_app_id, provider_config_id) VALUES (?, ?, ?, ?)",
  ).bind(authId, userId, appId, providerConfigId).run();

  const secretBytes = new TextEncoder().encode(c.env.JWT_SECRET);
  const token = await new SignJWT({
    sub: userId,
    oauth_authorization_id: authId,
    email: "test@test.local",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secretBytes);

  return c.json({
    userId,
    token,
    providerConfigId,
    appId,
    authId,
    provider: body.provider,
    model: body.model,
  });
});

// Create a user + session + provider + app for OAuth flow testing
testRoutes.post("/__test/oauth-setup", async (c) => {
  if (c.req.header("CF-Connecting-IP") && c.req.header("CF-Connecting-IP") !== "127.0.0.1" && c.req.header("CF-Connecting-IP") !== "::1") {
    return c.json({ error: "Not allowed from remote" }, 403);
  }

  const body = await c.req.json<{
    provider: string;
    model: string;
    apiKey: string;
    redirectUri?: string;
  }>();

  if (!body.provider || !body.model || !body.apiKey) {
    return c.json({ error: "Missing provider, model, or apiKey" }, 400);
  }

  const userId = crypto.randomUUID();
  const email = `test-${userId.slice(0, 8)}@test.local`;

  await c.env.DB.prepare(
    "INSERT INTO users (id, email, name) VALUES (?, ?, ?)",
  ).bind(userId, email, "Test User").run();

  const token = await signToken(
    { sub: userId, email, name: "Test User", avatar_url: null },
    c.env.JWT_SECRET,
    "7d",
  );

  const tokenHash = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await c.env.DB
    .prepare("INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)")
    .bind(crypto.randomUUID(), userId, tokenHash, expiresAt.toISOString())
    .run();

  const encrypted = await encrypt(body.apiKey, c.env.ENCRYPTION_KEY);
  const providerConfigId = crypto.randomUUID();

  await c.env.DB.prepare(
    "INSERT INTO provider_configs (id, user_id, provider, model, api_key_encrypted, key_version) VALUES (?, ?, ?, ?, ?, 'v1')",
  ).bind(providerConfigId, userId, body.provider, body.model, encrypted).run();

  const appId = crypto.randomUUID();
  const redirectUri = body.redirectUri || "http://localhost:8787/oauth/callback";
  const clientSecret = "test-client-secret-" + crypto.randomUUID().slice(0, 8);

  await c.env.DB.prepare(
    "INSERT INTO oauth_apps (id, developer_id, name, redirect_uri, client_secret) VALUES (?, ?, ?, ?, ?)",
  ).bind(appId, userId, "Test App", redirectUri, clientSecret).run();

  const secure = (c.env.APP_URL ?? "").startsWith("https");
  const cookie = `session=${token}; Path=/; HttpOnly${secure ? "; Secure" : ""}; SameSite=Lax; Expires=${expiresAt.toUTCString()}`;

  return c.json({
    userId,
    email,
    providerConfigId,
    appId,
    clientSecret,
    redirectUri,
    provider: body.provider,
    model: body.model,
    sessionCookie: cookie,
  });
});
