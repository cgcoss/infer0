import { Hono, type Context } from "hono";
import type { Env, ProviderConfig } from "../types";
import { verifyToken } from "../lib/auth";
import { getUserProvider } from "./api-providers";
import { extractRequestModel } from "../lib/normalize";
import { execute } from "../lib/gateway";

export const inferenceRoutes = new Hono<{ Bindings: Env }>();

type AppContext = Context<{ Bindings: Env }>;

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

async function checkDailyLimit(
  db: D1Database,
  userId: string,
  configId: string,
  limitCents: number | null | undefined,
  oauthAuthorizationId?: string,
): Promise<{ allowed: boolean; todayCents: number }> {
  if (!limitCents || limitCents <= 0) return { allowed: true, todayCents: 0 };
  const today = new Date().toISOString().slice(0, 10);
  const row = oauthAuthorizationId
    ? await db.prepare(
        "SELECT cost_cents FROM daily_usage WHERE user_id = ? AND provider_config_id = ? AND oauth_authorization_id = ? AND date = ?",
      ).bind(userId, configId, oauthAuthorizationId, today).first<{ cost_cents: number }>()
    : await db.prepare(
        "SELECT cost_cents FROM daily_usage WHERE user_id = ? AND provider_config_id = ? AND date = ?",
      ).bind(userId, configId, today).first<{ cost_cents: number }>();
  const todayCents = row?.cost_cents ?? 0;
  return { allowed: todayCents < limitCents, todayCents };
}

const inferenceRateLimitMap = new Map<string, { count: number; resetAt: number }>();

async function handleInference(c: AppContext): Promise<Response> {
  const auth = await authenticateRequest(c);
  if ("status" in auth) return auth;

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

  const oauthAuth = await c.env.DB.prepare(
    `SELECT oa.oauth_app_id, oa.revoked_at, app.name as app_name,
            COALESCE(aa.provider_config_id, oa.provider_config_id) as provider_config_id
     FROM oauth_authorizations oa
     JOIN oauth_apps app ON app.id = oa.oauth_app_id
     LEFT JOIN authorized_apps aa ON aa.user_id = oa.user_id AND aa.oauth_app_id = oa.oauth_app_id
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

  const body: Record<string, unknown> = await c.req.json();
  const requestModel = extractRequestModel(body);

  try {
    await c.env.DB.prepare(
      `INSERT INTO authorized_apps (id, user_id, oauth_app_id, app_prefix, developer_name, provider_config_id, last_used_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime(? / 1000, 'unixepoch'))
       ON CONFLICT(user_id, oauth_app_id) DO UPDATE SET
         revoked_at = NULL,
         last_used_at = datetime('now'),
         expires_at = datetime(? / 1000, 'unixepoch'),
         developer_name = CASE WHEN authorized_apps.developer_name = '' THEN ? ELSE authorized_apps.developer_name END`,
    ).bind(crypto.randomUUID(), auth.userId, oauthAuth.oauth_app_id, "oauth", oauthAuth.app_name, oauthAuth.provider_config_id ?? null, Date.now() + 3600000, Date.now() + 3600000, oauthAuth.app_name).run();
  } catch (err) {
    console.error("Failed to record authorization:", err);
  }

  const [limitRow, authRow] = await Promise.all([
    c.env.DB.prepare(
      "SELECT daily_spend_limit_cents FROM provider_configs WHERE id = ?",
    ).bind(provider.configId).first<Pick<ProviderConfig, "daily_spend_limit_cents">>(),
    c.env.DB.prepare(
      "SELECT daily_spend_limit_cents FROM oauth_authorizations WHERE id = ?",
    ).bind(auth.oauthAuthorizationId).first<{ daily_spend_limit_cents: number | null }>(),
  ]);

  const providerLimitCheck = await checkDailyLimit(c.env.DB, auth.userId, provider.configId, limitRow?.daily_spend_limit_cents);
  if (!providerLimitCheck.allowed) {
    return c.json({
      error: {
        message: `Daily spend limit of $${((limitRow!.daily_spend_limit_cents ?? 0) / 100).toFixed(2)} exceeded. Today's spend: $${(providerLimitCheck.todayCents / 100).toFixed(2)}.`,
        code: "spend_limit_exceeded",
      },
    }, 429);
  }

  const authLimitCheck = await checkDailyLimit(c.env.DB, auth.userId, provider.configId, authRow?.daily_spend_limit_cents, auth.oauthAuthorizationId);
  if (!authLimitCheck.allowed) {
    return c.json({
      error: {
        message: `Daily spend limit of $${((authRow!.daily_spend_limit_cents ?? 0) / 100).toFixed(2)} exceeded for this authorization. Today's spend: $${(authLimitCheck.todayCents / 100).toFixed(2)}.`,
        code: "spend_limit_exceeded",
      },
    }, 429);
  }

  const response = await execute(c.env, provider, body, requestModel, auth.userId, provider.configId, auth.oauthAuthorizationId);

  if (response.status === 429) {
    return c.json({
      error: {
        message: "Daily spend limit exceeded. Check your provider settings or Cloudflare AI Gateway dashboard.",
        code: "spend_limit_exceeded",
      },
    }, 429);
  }

  return response;
}

inferenceRoutes.post("/v1/chat/completions", handleInference);
