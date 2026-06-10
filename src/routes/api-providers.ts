import { Hono } from "hono";
import type { Env } from "../types";
import { requireAuth } from "../middleware/session";
import { encrypt, decrypt, CURRENT_KEY_VERSION } from "../lib/crypto";

export const providerRoutes = new Hono<{ Bindings: Env }>();

// List providers (API)
providerRoutes.get("/v1/providers", requireAuth, async (c) => {
  const user = c.get("user");

  const { results } = await c.env.DB.prepare(
    "SELECT id, provider, model, name, is_default, created_at, updated_at FROM provider_configs WHERE user_id = ? ORDER BY created_at DESC",
  )
    .bind(user.id)
    .all();

  return c.json({ providers: results });
});

// Create provider (from dashboard form or API)
providerRoutes.post("/v1/providers", requireAuth, async (c) => {
  const user = c.get("user");
  const contentType = c.req.header("Content-Type") ?? "";
  let provider: string;
  let model: string;
  let name: string;
  let apiKey: string;
  let isDefault: number;
  let redirect: string | undefined;

  if (contentType.includes("application/json")) {
    const body = await c.req.json<{
      provider: string;
      model?: string;
      name?: string;
      api_key: string;
      is_default?: boolean;
      redirect?: string;
    }>();
    provider = body.provider;
    model = body.model ?? "";
    name = body.name ?? "";
    apiKey = body.api_key;
    isDefault = body.is_default ? 1 : 0;
    redirect = body.redirect;
  } else {
    const body = await c.req.parseBody();
    provider = body.provider as string;
    model = (body.model as string) || "";
    name = (body.name as string) || "";
    apiKey = body.api_key as string;
    isDefault = body.is_default === "1" ? 1 : 0;
    redirect = body.redirect as string | undefined;
  }

  if (!provider || !apiKey) {
    return c.json({ error: { message: "Provider and API key required", code: "validation_error" } }, 400);
  }

  const encrypted = await encrypt(apiKey, c.env.ENCRYPTION_KEY);

  if (isDefault) {
    await c.env.DB.prepare(
      "UPDATE provider_configs SET is_default = 0 WHERE user_id = ?",
    )
      .bind(user.id)
      .run();
  }

  const id = crypto.randomUUID();
  const label = name || `${provider}${model ? " " + model : ""}`;
  await c.env.DB.prepare(
    "INSERT INTO provider_configs (id, user_id, provider, model, name, api_key_encrypted, is_default, key_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(id, user.id, provider, model, label, encrypted, isDefault, CURRENT_KEY_VERSION)
    .run();

  return c.redirect(redirect || "/providers");
});

// Update provider
providerRoutes.put("/v1/providers/:id", requireAuth, async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const body = await c.req.json<{
    provider?: string;
    model?: string;
    name?: string;
    api_key?: string;
    is_default?: boolean;
  }>();

  const existing = await c.env.DB.prepare(
    "SELECT * FROM provider_configs WHERE id = ? AND user_id = ?",
  )
    .bind(id, user.id)
    .first();

  if (!existing) {
    return c.json({ error: { message: "Provider not found", code: "not_found" } }, 404);
  }

  if (body.provider) {
    await c.env.DB.prepare("UPDATE provider_configs SET provider = ? WHERE id = ?")
      .bind(body.provider, id)
      .run();
  }

  if (body.model !== undefined) {
    await c.env.DB.prepare("UPDATE provider_configs SET model = ? WHERE id = ?")
      .bind(body.model, id)
      .run();
  }

  if (body.name !== undefined) {
    await c.env.DB.prepare("UPDATE provider_configs SET name = ? WHERE id = ?")
      .bind(body.name, id)
      .run();
  }

  if (body.api_key) {
    const encrypted = await encrypt(body.api_key, c.env.ENCRYPTION_KEY);
    await c.env.DB.prepare("UPDATE provider_configs SET api_key_encrypted = ?, key_version = ? WHERE id = ?")
      .bind(encrypted, CURRENT_KEY_VERSION, id)
      .run();
  }

  if (body.is_default !== undefined) {
    if (body.is_default) {
      await c.env.DB.prepare("UPDATE provider_configs SET is_default = 0 WHERE user_id = ?")
        .bind(user.id)
        .run();
    }
    await c.env.DB.prepare("UPDATE provider_configs SET is_default = ? WHERE id = ?")
      .bind(body.is_default ? 1 : 0, id)
      .run();
  }

  await c.env.DB.prepare("UPDATE provider_configs SET updated_at = datetime('now') WHERE id = ?")
    .bind(id)
    .run();

  return c.json({ success: true });
});

// Delete provider (from dashboard form)
providerRoutes.post("/v1/providers/:id/delete", requireAuth, async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  await c.env.DB.prepare(
    "DELETE FROM provider_configs WHERE id = ? AND user_id = ?",
  )
    .bind(id, user.id)
    .run();

  return c.redirect("/providers");
});

// Set daily spend limit
providerRoutes.put("/v1/providers/:id/spend-limit", requireAuth, async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  if (!id) return c.json({ error: { message: "Provider not found", code: "not_found" } }, 404);
  const body = await c.req.json<{ daily_spend_limit_cents: number | null }>();

  const existing = await c.env.DB.prepare(
    "SELECT id FROM provider_configs WHERE id = ? AND user_id = ?",
  ).bind(id, user.id).first();

  if (!existing) {
    return c.json({ error: { message: "Provider not found", code: "not_found" } }, 404);
  }

  await c.env.DB.prepare(
    "UPDATE provider_configs SET daily_spend_limit_cents = ?, updated_at = datetime('now') WHERE id = ?",
  ).bind(body.daily_spend_limit_cents ?? null, id).run();

  return c.json({ success: true });
});

// Get today's usage for a provider
providerRoutes.get("/v1/providers/:id/today-usage", requireAuth, async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  const today = new Date().toISOString().slice(0, 10);
  const row = await c.env.DB.prepare(
    "SELECT cost_cents FROM daily_usage WHERE user_id = ? AND provider_config_id = ? AND date = ?",
  ).bind(user.id, id, today).first<{ cost_cents: number }>();

  const limitRow = await c.env.DB.prepare(
    "SELECT daily_spend_limit_cents FROM provider_configs WHERE id = ? AND user_id = ?",
  ).bind(id, user.id).first<{ daily_spend_limit_cents: number | null }>();

  return c.json({
    today_cents: row?.cost_cents ?? 0,
    limit_cents: limitRow?.daily_spend_limit_cents ?? null,
  });
});

// Delete provider (API)
providerRoutes.delete("/v1/providers/:id", requireAuth, async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  const existing = await c.env.DB.prepare(
    "SELECT id FROM provider_configs WHERE id = ? AND user_id = ?",
  )
    .bind(id, user.id)
    .first();

  if (!existing) {
    return c.json({ error: { message: "Provider not found", code: "not_found" } }, 404 as any);
  }

  await c.env.DB.prepare(
    "DELETE FROM provider_configs WHERE id = ? AND user_id = ?",
  )
    .bind(id, user.id)
    .run();

  return c.json({ success: true });
});

// Pause provider
providerRoutes.put("/v1/providers/:id/pause", requireAuth, async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const existing = await c.env.DB.prepare(
    "SELECT id FROM provider_configs WHERE id = ? AND user_id = ?",
  ).bind(id, user.id).first();
  if (!existing) return c.json({ error: { message: "Provider not found", code: "not_found" } }, 404);
  await c.env.DB.prepare(
    "UPDATE provider_configs SET paused_at = datetime('now'), updated_at = datetime('now') WHERE id = ?",
  ).bind(id).run();
  return c.json({ success: true });
});

// Resume provider
providerRoutes.put("/v1/providers/:id/resume", requireAuth, async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const existing = await c.env.DB.prepare(
    "SELECT id FROM provider_configs WHERE id = ? AND user_id = ?",
  ).bind(id, user.id).first();
  if (!existing) return c.json({ error: { message: "Provider not found", code: "not_found" } }, 404);
  await c.env.DB.prepare(
    "UPDATE provider_configs SET paused_at = NULL, updated_at = datetime('now') WHERE id = ?",
  ).bind(id).run();
  return c.json({ success: true });
});

// Internal helper: get decrypted provider config (used by inference)
export async function getUserProvider(
  db: D1Database,
  userId: string,
  encryptionKey: string,
  providerConfigId?: string | null,
  previousEncryptionKey?: string,
): Promise<{ configId: string; provider: string; model: string; apiKey: string } | null> {
  const config = providerConfigId
    ? await db.prepare(
        "SELECT id, provider, model, api_key_encrypted, key_version, paused_at FROM provider_configs WHERE id = ? AND user_id = ?",
      ).bind(providerConfigId, userId).first<{ id: string; provider: string; model: string; api_key_encrypted: string; key_version: string; paused_at: string | null }>()
    : await db.prepare(
        "SELECT id, provider, model, api_key_encrypted, key_version, paused_at FROM provider_configs WHERE user_id = ? AND paused_at IS NULL ORDER BY is_default DESC LIMIT 1",
      ).bind(userId).first<{ id: string; provider: string; model: string; api_key_encrypted: string; key_version: string; paused_at: string | null }>();

  if (!config) return null;

  if (config.paused_at) return null;

  const keyVersion = config.key_version || "v1";

  // If row is on an older key version, decrypt with old key and re-wrap with current key
  if (keyVersion !== CURRENT_KEY_VERSION) {
    if (!previousEncryptionKey) return null;

    const apiKey = await decrypt(config.api_key_encrypted, previousEncryptionKey);
    db.prepare(
      "UPDATE provider_configs SET api_key_encrypted = ?, key_version = ?, updated_at = datetime('now') WHERE id = ?",
    ).bind(await encrypt(apiKey, encryptionKey), CURRENT_KEY_VERSION, config.id).run().catch(() => {});
    return { configId: config.id, provider: config.provider, model: config.model, apiKey };
  }

  const apiKey = await decrypt(config.api_key_encrypted, encryptionKey);
  return {
    configId: config.id,
    provider: config.provider,
    model: config.model,
    apiKey,
  };
}
