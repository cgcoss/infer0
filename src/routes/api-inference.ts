import { Hono, type Context } from "hono";
import type { Env } from "../types";
import { verifyToken } from "../lib/auth";
import { getUserProvider } from "./api-providers";
import { scrubProviderError } from "../lib/scrub";

export const inferenceRoutes = new Hono<{ Bindings: Env }>();

type AppContext = Context<{ Bindings: Env }>;

type InferenceBody = {
  messages?: Array<{ role: string; content: string }>;
  stream?: boolean;
  max_tokens?: number;
  temperature?: number;
};

type AnthropicContent = { type: string; text: string };
type AnthropicResponse = {
  id: string;
  type: string;
  role: string;
  content: AnthropicContent[];
  model: string;
  stop_reason: string;
  stop_sequence: string | null;
  usage: { input_tokens: number; output_tokens: number };
};

async function authenticateRequest(
  c: AppContext,
): Promise<{ userId: string; exp: number; oauthAuthorizationId: string } | Response> {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: { message: "Missing or invalid Authorization header", code: "auth_error" } }, 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);
  if (!payload?.sub) {
    return c.json({ error: { message: "Invalid or expired token", code: "auth_error" } }, 401);
  }

  const oauthAuthorizationId = (payload as Record<string, unknown>).oauth_authorization_id as string | undefined;
  if (!oauthAuthorizationId) {
    return c.json({ error: { message: "Only OAuth access tokens are supported", code: "auth_error" } }, 401);
  }

  return { userId: payload.sub, exp: payload.exp ?? 0, oauthAuthorizationId };
}

function finishReason(stopReason: string): string {
  if (stopReason === "end_turn" || stopReason === "stop") return "stop";
  if (stopReason === "max_tokens" || stopReason === "length") return "length";
  return stopReason;
}

async function callAnthropic(
  c: AppContext,
  provider: { apiKey: string; model: string },
  body: InferenceBody,
): Promise<Response> {
  const url = `${c.env.AI_GATEWAY_URL}/${c.env.ACCOUNT_ID}/default/anthropic/v1/messages`;

  const gwBody: Record<string, unknown> = {
    model: provider.model,
    max_tokens: body.max_tokens ?? 4096,
    messages: body.messages,
  };
  if (body.temperature !== undefined) gwBody.temperature = body.temperature;

  const gwRes = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": provider.apiKey,
      "anthropic-version": "2023-06-01",
      "cf-aig-authorization": `Bearer ${c.env.CF_API_TOKEN}`,
    },
    body: JSON.stringify(gwBody),
  });

  if (!gwRes.ok) {
    const err = scrubProviderError(await gwRes.text());
    return c.json({ error: { message: `Provider error: ${err}`, code: "provider_error" } }, gwRes.status as any);
  }

  const data = (await gwRes.json()) as AnthropicResponse;
  return c.json({
    id: data.id,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: data.model,
    choices: [
      {
        index: 0,
        message: {
          role: data.role,
          content: data.content.map((c) => c.text).join(""),
        },
        finish_reason: finishReason(data.stop_reason),
      },
    ],
    usage: {
      prompt_tokens: data.usage.input_tokens,
      completion_tokens: data.usage.output_tokens,
      total_tokens: data.usage.input_tokens + data.usage.output_tokens,
    },
  });
}

async function callOpenAICompatible(
  c: AppContext,
  provider: { apiKey: string; provider: string; model: string },
  body: InferenceBody,
): Promise<Response> {
  const url = `${c.env.AI_GATEWAY_URL}/${c.env.ACCOUNT_ID}/default/${provider.provider}/chat/completions`;

  const gwBody: Record<string, unknown> = {
    model: provider.model,
    messages: body.messages,
    stream: body.stream ?? false,
  };
  if (body.max_tokens) gwBody.max_tokens = body.max_tokens;
  if (body.temperature !== undefined) gwBody.temperature = body.temperature;

  const gwRes = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "cf-aig-authorization": `Bearer ${c.env.CF_API_TOKEN}`,
      Authorization: `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify(gwBody),
  });

  if (!gwRes.ok) {
    const err = scrubProviderError(await gwRes.text());
    return c.json({ error: { message: `Provider error: ${err}`, code: "provider_error" } }, gwRes.status as any);
  }

  const data = await gwRes.json();
  return c.json(data);
}

const inferenceRateLimitMap = new Map<string, { count: number; resetAt: number }>();

inferenceRoutes.post("/v1/chat/completions", async (c) => {
  const auth = await authenticateRequest(c);
  if ("status" in auth) return auth;

  // Per-user rate limit (30 req / 60s) for spend control
  const now = Date.now();
  const rlEntry = inferenceRateLimitMap.get(auth.userId);
  if (rlEntry && now < rlEntry.resetAt) {
    rlEntry.count++;
    if (rlEntry.count > 30) {
      return c.json({ error: { message: "Rate limit exceeded. Try again in 60 seconds.", code: "rate_limited" } }, 429);
    }
  } else {
    inferenceRateLimitMap.set(auth.userId, { count: 1, resetAt: now + 60_000 });
  }

  // Look up the authorization + linked OAuth app
  const oauthAuth = await c.env.DB.prepare(
    `SELECT oa.provider_config_id, oa.oauth_app_id, oa.revoked_at, app.name as app_name
     FROM oauth_authorizations oa
     JOIN oauth_apps app ON app.id = oa.oauth_app_id
     WHERE oa.id = ? AND oa.user_id = ?`,
  ).bind(auth.oauthAuthorizationId, auth.userId).first<{
    provider_config_id: string | null;
    oauth_app_id: string;
    revoked_at: string | null;
    app_name: string;
  }>();

  if (!oauthAuth || oauthAuth.revoked_at) {
    return c.json({ error: { message: "Authorization revoked or not found", code: "auth_revoked" } }, 403);
  }

  const provider = await getUserProvider(c.env.DB, auth.userId, c.env.ENCRYPTION_KEY, oauthAuth.provider_config_id, c.env.ENCRYPTION_KEY_PREVIOUS);
  if (!provider) {
    return c.json({ error: { message: "No provider configured", code: "no_provider" } }, 400);
  }

  const body: InferenceBody = await c.req.json();

  // Record the authorization (tracked in authorized_apps for dashboard)
  try {
    await c.env.DB.prepare(
      `INSERT INTO authorized_apps (id, user_id, oauth_app_id, app_prefix, developer_name, provider_config_id, last_used_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime(? / 1000, 'unixepoch'))
       ON CONFLICT(user_id, oauth_app_id) DO UPDATE SET
         revoked_at = NULL,
         last_used_at = datetime('now'),
         expires_at = datetime(? / 1000, 'unixepoch'),
         developer_name = CASE WHEN authorized_apps.developer_name = '' THEN ? ELSE authorized_apps.developer_name END,
         provider_config_id = ?`,
    ).bind(crypto.randomUUID(), auth.userId, oauthAuth.oauth_app_id, "oauth", oauthAuth.app_name, oauthAuth.provider_config_id ?? null, Date.now() + 3600000, Date.now() + 3600000, oauthAuth.app_name, oauthAuth.provider_config_id ?? null).run();
  } catch (err) {
    console.error("Failed to record authorization:", err);
  }

  if (provider.provider === "anthropic") {
    return callAnthropic(c, provider, body);
  }

  return callOpenAICompatible(c, provider, body);
});
