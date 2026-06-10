import { Hono } from "hono";
import { html } from "hono/html";
import type { Env } from "../types";
import { requireAuth } from "../middleware/session";
import { getSessionUser } from "../middleware/session";
import { signToken } from "../lib/auth";
import { hashKey } from "../lib/crypto";
import { Layout } from "../views/layout";

export const oauthRoutes = new Hono<{ Bindings: Env }>();

function generateSecret(): string {
  const rand = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(rand).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Register an OAuth app (developer dashboard page)
oauthRoutes.get("/dev/apps", requireAuth, async (c) => {
  const user = c.get("user");
  const newSecret = c.req.query("new_secret");

  const { results } = await c.env.DB.prepare(
    "SELECT id, name, redirect_uri, client_secret, created_at FROM oauth_apps WHERE developer_id = ? ORDER BY created_at DESC",
  ).bind(user.id).all();

  return c.html(Layout({
    title: "OAuth Apps",
    user,
    children: html`
<style>
.banner { background:#1e40af;color:#fff;padding:16px 20px;border-radius:var(--radius);margin-bottom:24px;line-height:1.5 }
.banner strong { display:block;font-size:0.9375rem;margin-bottom:4px }
.banner .secret-display { background:rgba(0,0,0,0.3);padding:10px 14px;border-radius:4px;font-family:"SF Mono","Fira Code",monospace;font-size:0.8125rem;word-break:break-all;margin:8px 0;user-select:all }
.banner .hint { font-size:0.8125rem;opacity:0.9 }
.code-block { background:var(--bg-hover);padding:8px 12px;border-radius:4px;font-family:"SF Mono","Fira Code",monospace;font-size:0.75rem;word-break:break-all }
</style>
<div class="container">
  <h1>OAuth Apps</h1>
  <p>Register OAuth apps so users can sign in via infer0 and authorize your app to use their AI provider.</p>

  ${newSecret ? html`
    <div class="banner">
      <strong>App registered. Save this secret now</strong>
      <p>This is the only time you'll see it. If you lose it, you'll need to reset it.</p>
      <div class="secret-display">${newSecret}</div>
      <p class="hint">Copy this now. It won't be shown again.</p>
    </div>
  ` : ''}

  ${results.length === 0
    ? html`<p style="margin:24px 0;color:var(--text-muted)">No apps registered yet.</p>`
    : html`
    <div class="card-grid">
      ${results.map((app: Record<string, unknown>) => {
        const fullSecret = app.client_secret as string;
        const masked = '**** **** **** ' + fullSecret.slice(-4);
        return html`
        <div class="record-card">
          <div class="card-title">${app.name}</div>
          <div class="card-row">
            <span class="card-label">Client ID</span>
            <span class="code-block">${app.id}</span>
          </div>
          <div class="card-row">
            <span class="card-label">Client Secret</span>
            <span class="code-block">${masked}</span>
          </div>
          <div class="card-row">
            <span class="card-label">Redirect URI</span>
            <span class="code-block redirect-uri-display" data-app-id="${app.id}" style="font-size:0.7rem;cursor:pointer" title="Click to edit">${app.redirect_uri}</span>
          </div>
          <div class="card-row">
            <span class="card-label">Created</span>
            <span style="font-size:0.8125rem;color:var(--text-muted)"><time datetime="${(app.created_at as string).replace(' ', 'T')}Z">${app.created_at}</time></span>
          </div>
          <div class="card-divider"></div>
          <div class="card-actions">
            <form method="POST" action="/v1/oauth/apps/${app.id}/reset-secret" style="display:inline">
              <button type="submit" style="background:transparent;border:1px solid var(--border);color:var(--text);padding:6px 14px;border-radius:var(--radius);font-size:0.8125rem;cursor:pointer">Reset Secret</button>
            </form>
          </div>
        </div>
      `})}
    </div>
    `}

  <h2>Register New App</h2>
  <form method="POST" action="/v1/oauth/apps" style="display:flex;flex-direction:column;gap:12px;max-width:400px">
    <input type="text" name="name" placeholder="App name (e.g. Acme Chat)" required style="background:var(--bg-hover);border:1px solid var(--border);border-radius:var(--radius);padding:10px 12px;color:var(--text);font-size:0.875rem" />
    <input type="url" name="redirect_uri" placeholder="Redirect URI (e.g. https://myapp.com/callback)" required style="background:var(--bg-hover);border:1px solid var(--border);border-radius:var(--radius);padding:10px 12px;color:var(--text);font-size:0.875rem" />
    <button type="submit" class="btn-primary" style="border:none;cursor:pointer">Register App</button>
  </form>

  <script>
  document.querySelectorAll('time[datetime]').forEach(t => {
    const d = new Date(t.getAttribute('datetime'));
    if (!isNaN(d.getTime())) t.textContent = d.toLocaleString();
  });
  document.querySelectorAll('.redirect-uri-display').forEach(el => {
    el.addEventListener('click', () => {
        const appId = el.dataset.appId;
        const current = el.textContent;
      const input = document.createElement('input');
      input.type = 'url';
      input.value = current;
      input.style.width = '100%';
      input.style.background = 'var(--bg-hover)';
      input.style.border = '1px solid var(--accent)';
      input.style.borderRadius = '4px';
      input.style.padding = '4px 8px';
      input.style.color = 'var(--text)';
      input.style.fontFamily = 'var(--font-mono, monospace)';
      input.style.fontSize = '0.7rem';
      el.replaceWith(input);
      input.focus();
      input.select();

      async function save() {
        const val = input.value.trim();
        if (val && val !== current) {
          await fetch('/v1/oauth/apps/' + appId, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ redirect_uri: val }),
          });
        }
        location.reload();
      }

      input.addEventListener('blur', save);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
        if (e.key === 'Escape') { location.reload(); }
      });
    });
  });
  </script>
</div>
    `,
  }));
});

// Register app API
oauthRoutes.post("/v1/oauth/apps", requireAuth, async (c) => {
  const user = c.get("user");
  const body = await c.req.parseBody();
  const name = (body.name as string) || "";
  const redirectUri = (body.redirect_uri as string) || "";

  if (!name || !redirectUri) {
    return c.json({ error: { message: "Name and redirect_uri required", code: "validation_error" } }, 400);
  }

  const id = crypto.randomUUID();
  const secret = generateSecret();

  try {
    await c.env.DB.prepare(
      "INSERT INTO oauth_apps (id, developer_id, name, redirect_uri, client_secret) VALUES (?, ?, ?, ?, ?)",
    ).bind(id, user.id, name, redirectUri, secret).run();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.html(
      `<html><body style="font-family:system-ui;padding:48px;max-width:480px;margin:0 auto;background:#0b0b09;color:#d4d4c8">
        <h1>Failed to register app</h1>
        <p style="color:#a09f96">${message}</p>
        <p style="color:#a09f96">Try signing out and signing back in, then try again.</p>
        <a href="/login" style="color:#d97706">Sign in</a>
      </body></html>`,
      500,
    );
  }

  return c.redirect("/dev/apps?new_secret=" + encodeURIComponent(secret));
});

// Reset client secret
oauthRoutes.post("/v1/oauth/apps/:id/reset-secret", requireAuth, async (c) => {
  const user = c.get("user");
  const appId = c.req.param("id");

  try {
    const app = await c.env.DB.prepare(
      "SELECT id FROM oauth_apps WHERE id = ? AND developer_id = ?",
    ).bind(appId, user.id).first();

    if (!app) {
      return c.json({ error: { message: "App not found", code: "not_found" } }, 404);
    }

    const newSecret = generateSecret();

    await c.env.DB.prepare(
      "UPDATE oauth_apps SET client_secret = ? WHERE id = ?",
    ).bind(newSecret, appId).run();

    return c.redirect("/dev/apps?new_secret=" + encodeURIComponent(newSecret));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.html(
      `<html><body style="font-family:system-ui;padding:48px;max-width:480px;margin:0 auto;background:#0b0b09;color:#d4d4c8">
        <h1>Something went wrong</h1>
        <p style="color:#a09f96">${message}</p>
        <a href="/dev/apps" style="color:#d97706">Back to apps</a>
      </body></html>`,
      500,
    );
  }
});

// Update OAuth app (redirect URI, name)
oauthRoutes.put("/v1/oauth/apps/:id", requireAuth, async (c) => {
  const user = c.get("user");
  const appId = c.req.param("id");
  const body = await c.req.json<{ redirect_uri?: string; name?: string }>();

  const app = await c.env.DB.prepare(
    "SELECT id FROM oauth_apps WHERE id = ? AND developer_id = ?",
  ).bind(appId, user.id).first();

  if (!app) {
    return c.json({ error: { message: "App not found", code: "not_found" } }, 404);
  }

  if (body.redirect_uri) {
    await c.env.DB.prepare("UPDATE oauth_apps SET redirect_uri = ? WHERE id = ?")
      .bind(body.redirect_uri, appId).run();
  }

  if (body.name) {
    await c.env.DB.prepare("UPDATE oauth_apps SET name = ? WHERE id = ?")
      .bind(body.name, appId).run();
  }

  return c.json({ success: true });
});

// OAuth authorize endpoint
oauthRoutes.get("/oauth/authorize", async (c) => {
  const clientId = c.req.query("client_id");
  const redirectUri = c.req.query("redirect_uri");
  const responseType = c.req.query("response_type");

  if (!clientId || !redirectUri || responseType !== "code") {
    return c.html(`<!DOCTYPE html><html><body><p>Invalid request. Required: client_id, redirect_uri, response_type=code</p></body></html>`, 400);
  }

  // Validate the app
  const app = await c.env.DB.prepare(
    "SELECT id, name FROM oauth_apps WHERE id = ?",
  ).bind(clientId).first<{ id: string; name: string }>();

  if (!app) {
    return c.html(`<!DOCTYPE html><html><body><p>Unknown client_id</p></body></html>`, 400);
  }

  // Check if redirect_uri matches
  const appFull = await c.env.DB.prepare(
    "SELECT * FROM oauth_apps WHERE id = ? AND redirect_uri = ?",
  ).bind(clientId, redirectUri).first();

  if (!appFull) {
    return c.html(`<!DOCTYPE html><html><body><p>redirect_uri does not match registered URI</p></body></html>`, 400);
  }

  // Check if user is signed in
  const user = await getSessionUser(c);
  if (!user) {
    const redirectPath = `/oauth/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code`;
    return c.redirect(`/login?redirect=${encodeURIComponent(redirectPath)}`);
  }

  // Fetch user's providers for the consent screen
  const { results: providers } = await c.env.DB.prepare(
    "SELECT id, provider, model, name FROM provider_configs WHERE user_id = ? ORDER BY is_default DESC",
  ).bind(user.id).all();

  return c.html(Layout({
    title: "Authorize App",
    user,
    children: html`
<style>
.consent-box { max-width:480px;margin:48px auto;padding:0 24px;text-align:center }
.consent-box h1 { font-size:1.5rem;margin-bottom:8px }
.consent-box .app-name { color:var(--accent);font-weight:700 }
.consent-box p { font-size:0.9375rem;margin-bottom:24px }
.consent-card { background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:24px;text-align:left }
.consent-card label { display:block;font-size:0.875rem;color:var(--text-muted);margin-bottom:6px }
.consent-card select { width:100%;background:var(--bg-hover);border:1px solid var(--border);border-radius:var(--radius);padding:10px 12px;color:var(--text);font-size:0.875rem;margin-bottom:20px }
.consent-card .actions { display:flex;gap:12px;justify-content:flex-end }
.consent-card .actions button,.consent-card .actions a { padding:10px 24px;border-radius:var(--radius);font-size:0.875rem;font-weight:600;cursor:pointer;text-decoration:none;display:inline-block }
.consent-card .actions .cancel { background:transparent;border:1px solid var(--border);color:var(--text) }
.consent-card .actions .approve { background:var(--accent);border:none;color:#fff }
.consent-card .actions .approve:hover { background:var(--accent-hover) }
.consent-card .actions .retry { background:var(--accent);border:none;color:#fff;text-decoration:none;display:inline-block;padding:10px 24px;border-radius:var(--radius);font-size:0.875rem;font-weight:600 }
</style>
<div class="consent-box">
  <h1>Authorize <span class="app-name">${app.name}</span></h1>
  <p>This app will use your infer0 provider to make AI requests on your behalf.</p>
  ${providers.length === 0 ? html`
    <div class="consent-card" style="text-align:center">
      <p style="margin-bottom:16px">No AI providers configured yet.</p>
      <p style="margin-bottom:20px;font-size:0.875rem;color:var(--text-muted)">Add a provider first, then come back and authorize.</p>
      <div class="actions" style="justify-content:center">
        <a href="/providers" target="_blank" class="retry">Add Provider</a>
        <a href="/oauth/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code" class="retry">Retry</a>
        <a href="/" class="cancel">Cancel</a>
      </div>
    </div>
  ` : html`
    <form method="POST" action="/oauth/authorize">
      <input type="hidden" name="client_id" value="${clientId}" />
      <input type="hidden" name="redirect_uri" value="${redirectUri}" />
      <input type="hidden" name="response_type" value="code" />
      <div class="consent-card">
        <label for="provider">Which provider should this app use?</label>
        <select name="provider_config_id" id="provider">
          ${providers.map((p: Record<string, unknown>) => html`
            <option value="${p.id}">${(p.name as string) || (p.provider as string) + ' ' + (p.model as string)}</option>
          `)}
        </select>
        <div style="background:var(--bg-hover);border-radius:4px;padding:12px;margin-bottom:20px;font-size:0.8125rem;color:var(--text-muted);line-height:1.6">
          <strong style="color:var(--text)">What this means:</strong><br />
          ${app.name} will send prompts to infer0 using the provider you select above.
          infer0 does not store your prompts. Your API key is never shared with ${app.name}.
          You can revoke this access anytime from
          <a href="/services" style="color:var(--accent)">Authorizations</a>.
        </div>
        <div class="actions">
          <a href="/" class="cancel">Cancel</a>
          <button type="submit" class="approve">Authorize</button>
        </div>
      </div>
    </form>
  `}
</div>
    `,
  }));
});

// OAuth authorize POST (user approved)
oauthRoutes.post("/oauth/authorize", async (c) => {
  try {
    const user = await getSessionUser(c);
    if (!user) {
      return c.redirect("/login");
    }

    const body = await c.req.parseBody();
    const clientId = (body.client_id as string) || "";
    const redirectUri = (body.redirect_uri as string) || "";
    const providerConfigId = (body.provider_config_id as string) || "";
    const responseType = (body.response_type as string) || "";

    if (!clientId || !redirectUri || responseType !== "code") {
      return c.html(`<!DOCTYPE html><html><body><p>Invalid request</p></body></html>`, 400);
    }

    // Validate app
    const app = await c.env.DB.prepare(
      "SELECT id FROM oauth_apps WHERE id = ? AND redirect_uri = ?",
    ).bind(clientId, redirectUri).first();

    if (!app) {
      return c.html(`<!DOCTYPE html><html><body><p>Invalid client_id or redirect_uri</p></body></html>`, 400);
    }

    if (!providerConfigId) {
      return c.html(`<!DOCTYPE html><html><body><p>Please select a provider</p></body></html>`, 400);
    }

    // Validate provider belongs to user
    const provider = await c.env.DB.prepare(
      "SELECT id FROM provider_configs WHERE id = ? AND user_id = ?",
    ).bind(providerConfigId, user.id).first();
    if (!provider) {
      return c.html(`<!DOCTYPE html><html><body><p>Invalid provider selection</p></body></html>`, 400);
    }

    // Generate authorization code (10 min expiry)
    const code = crypto.randomUUID();
    const codeExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const authId = crypto.randomUUID();

    await c.env.DB.prepare(
      `INSERT INTO oauth_authorizations (id, user_id, oauth_app_id, provider_config_id, authorization_code, code_expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(authId, user.id, clientId, providerConfigId || null, code, codeExpiresAt).run();

    const sep = redirectUri.includes("?") ? "&" : "?";
    return c.redirect(`${redirectUri}${sep}code=${code}`);
  } catch (err) {
    console.error("POST /oauth/authorize error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return c.html(`<!DOCTYPE html><html><body><p>Error: ${message}</p></body></html>`, 500);
  }
});

// OAuth token endpoint
oauthRoutes.post("/v1/oauth/token", async (c) => {
  try {
    const body = await c.req.parseBody();
    const grantType = (body.grant_type as string) || "";
    const code = (body.code as string) || "";
    const clientId = (body.client_id as string) || "";
    const clientSecret = (body.client_secret as string) || "";

    if (grantType !== "authorization_code") {
      return c.json({ error: "unsupported_grant_type" }, 400);
    }

    if (!code || !clientId || !clientSecret) {
      return c.json({ error: "invalid_request" }, 400);
    }

    // Validate client credentials
    const app = await c.env.DB.prepare(
      "SELECT id, name FROM oauth_apps WHERE id = ? AND client_secret = ?",
    ).bind(clientId, clientSecret).first<{ id: string; name: string }>();

    if (!app) {
      return c.json({ error: "invalid_client" }, 401);
    }

    // Find and validate the authorization code
    const auth = await c.env.DB.prepare(
      `SELECT id, user_id, provider_config_id, code_expires_at
       FROM oauth_authorizations
       WHERE oauth_app_id = ? AND authorization_code = ? AND revoked_at IS NULL
       ORDER BY created_at DESC LIMIT 1`,
    ).bind(clientId, code).first<{
      id: string;
      user_id: string;
      provider_config_id: string | null;
      code_expires_at: string;
    }>();

    if (!auth) {
      return c.json({ error: "invalid_grant" }, 400);
    }

    // Check code expiry
    if (new Date(auth.code_expires_at) < new Date()) {
      return c.json({ error: "invalid_grant", message: "Code expired" }, 400);
    }

    // Generate access token (1 hour JWT)
    const accessToken = await signToken(
      { sub: auth.user_id, oauth_authorization_id: auth.id },
      c.env.JWT_SECRET,
      "1h",
    );

    // Generate refresh token (30 days)
    const refreshTokenRaw = crypto.randomUUID() + crypto.randomUUID();
    const refreshTokenHash = await hashKey(refreshTokenRaw);

    const accessTokenExpiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
    const refreshTokenExpiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();

    // Store token hashes and invalidate the code
    await c.env.DB.prepare(
      `UPDATE oauth_authorizations
       SET authorization_code = NULL,
           code_expires_at = NULL,
           access_token_hash = ?,
           refresh_token_hash = ?,
           refresh_token_previous_hash = NULL,
           access_token_expires_at = ?,
           refresh_token_expires_at = ?
       WHERE id = ?`,
    ).bind(
      await hashKey(accessToken),
      refreshTokenHash,
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
      auth.id,
    ).run();

    // Upsert authorized_apps so the dashboard shows it immediately
    const expiresAt = Date.now() + 3600000;
    await c.env.DB.prepare(
      `INSERT INTO authorized_apps (id, user_id, oauth_app_id, app_prefix, developer_name, provider_config_id, last_used_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime(? / 1000, 'unixepoch'))
       ON CONFLICT(user_id, oauth_app_id) DO UPDATE SET
         revoked_at = NULL,
         provider_config_id = ?,
         expires_at = datetime(? / 1000, 'unixepoch')`,
    ).bind(crypto.randomUUID(), auth.user_id, clientId, "oauth", app.name, auth.provider_config_id, expiresAt, auth.provider_config_id, expiresAt).run();

    return c.json({
      access_token: accessToken,
      refresh_token: refreshTokenRaw,
      expires_in: 3600,
      token_type: "Bearer",
    });
  } catch (err) {
    console.error("POST /v1/oauth/token error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: "server_error", message }, 500);
  }
});

// OAuth refresh endpoint with token rotation + reuse detection
oauthRoutes.post("/v1/oauth/refresh", async (c) => {
  const body = await c.req.parseBody();
  const grantType = (body.grant_type as string) || "";
  const refreshToken = (body.refresh_token as string) || "";
  const clientId = (body.client_id as string) || "";
  const clientSecret = (body.client_secret as string) || "";

  if (grantType !== "refresh_token") {
    return c.json({ error: "unsupported_grant_type" }, 400);
  }

  if (!refreshToken || !clientId || !clientSecret) {
    return c.json({ error: "invalid_request" }, 400);
  }

  // Validate client credentials
  const app = await c.env.DB.prepare(
    "SELECT id FROM oauth_apps WHERE id = ? AND client_secret = ?",
  ).bind(clientId, clientSecret).first();

  if (!app) {
    return c.json({ error: "invalid_client" }, 401);
  }

  const presentedHash = await hashKey(refreshToken);

  // Look up the authorization by current or previous refresh token hash
  const auth = await c.env.DB.prepare(
    `SELECT id, user_id, refresh_token_hash, refresh_token_previous_hash, refresh_token_expires_at
     FROM oauth_authorizations
     WHERE oauth_app_id = ? AND (refresh_token_hash = ? OR refresh_token_previous_hash = ?) AND revoked_at IS NULL`,
  ).bind(clientId, presentedHash, presentedHash).first<{
    id: string;
    user_id: string;
    refresh_token_hash: string | null;
    refresh_token_previous_hash: string | null;
    refresh_token_expires_at: string;
  }>();

  if (!auth) {
    return c.json({ error: "invalid_grant" }, 400);
  }

  // Reuse detection: presented token matches the previous (already-rotated) hash
  if (auth.refresh_token_previous_hash !== null && presentedHash === auth.refresh_token_previous_hash) {
    await c.env.DB.prepare(
      "UPDATE oauth_authorizations SET revoked_at = datetime('now') WHERE id = ?",
    ).bind(auth.id).run();
    return c.json({ error: "invalid_grant", message: "Refresh token has been revoked due to reuse" }, 400);
  }

  // Normal rotation path: presented token matches the current hash
  if (new Date(auth.refresh_token_expires_at) < new Date()) {
    return c.json({ error: "invalid_grant", message: "Refresh token expired" }, 400);
  }

  // Issue new access token
  const accessToken = await signToken(
    { sub: auth.user_id, oauth_authorization_id: auth.id },
    c.env.JWT_SECRET,
    "1h",
  );

  // Generate a new refresh token (rotate)
  const newRefreshTokenRaw = crypto.randomUUID() + crypto.randomUUID();
  const newRefreshHash = await hashKey(newRefreshTokenRaw);

  const accessTokenExpiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
  const refreshTokenExpiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();

  // Rotate: move current hash to previous_hash, set new hash
  await c.env.DB.prepare(
    `UPDATE oauth_authorizations
     SET access_token_hash = ?,
         access_token_expires_at = ?,
         refresh_token_previous_hash = refresh_token_hash,
         refresh_token_hash = ?,
         refresh_token_expires_at = ?
     WHERE id = ?`,
  ).bind(
    await hashKey(accessToken),
    accessTokenExpiresAt,
    newRefreshHash,
    refreshTokenExpiresAt,
    auth.id,
  ).run();

  return c.json({
    access_token: accessToken,
    refresh_token: newRefreshTokenRaw,
    expires_in: 3600,
    token_type: "Bearer",
  });
});
