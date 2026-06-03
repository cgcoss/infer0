import { Hono } from "hono";
import { html } from "hono/html";
import type { Env } from "../types";
import { requireAuth } from "../middleware/session";
import { Layout } from "../views/layout";

export const servicePageRoutes = new Hono<{ Bindings: Env }>();

servicePageRoutes.get("/services", requireAuth, async (c) => {
  const user = c.get("user");

  const [appsResult, providersResult] = await Promise.all([
    c.env.DB.prepare(
      `SELECT a.id, a.app_prefix, a.developer_name, a.provider_config_id, a.last_used_at, a.expires_at, a.revoked_at, a.created_at
       FROM authorized_apps a
       WHERE a.user_id = ?
       ORDER BY a.created_at DESC`,
    ).bind(user.id).all(),
    c.env.DB.prepare(
      "SELECT id, provider, model, name FROM provider_configs WHERE user_id = ? ORDER BY is_default DESC",
    ).bind(user.id).all(),
  ]);

  const apps = appsResult.results as any[];
  const providers = providersResult.results as any[];

  return c.html(Layout({
    title: "Authorizations",
    user,
    children: html`
<div class="container">
  <h1>Authorizations</h1>
  <p>Developer apps that have access to your provider. Revoke access at any time.</p>

  ${apps.length === 0
    ? html`<p style="margin:24px 0;color:var(--text-muted)">No services authorized yet. They will appear here when a developer app uses your token.</p>`
    : html`
    <div class="card-grid">
      ${apps.map(a => html`
        <div class="record-card">
          <div class="card-title">
            ${a.developer_name || html`<code>${a.app_prefix}...</code>`}
            ${a.revoked_at
              ? html`<span class="badge badge-revoked" style="float:right">Revoked</span>`
              : html`<span class="badge badge-active" style="float:right">Active</span>`}
          </div>
          <div class="card-row">
            <span class="card-label">Provider</span>
            <select class="card-select provider-select" data-app-id="${a.id}" ${a.revoked_at ? 'disabled' : ''}>
              <option value="">Default provider</option>
              ${providers.map(p => html`
                <option value="${p.id}" ${a.provider_config_id === p.id ? 'selected' : ''}>${p.name || p.provider + ' ' + p.model}</option>
              `)}
            </select>
          </div>
          <div class="card-row">
            <span class="card-label">Last used</span>
            <span>${new Date(a.last_used_at + 'Z').toLocaleString()}</span>
          </div>
          <div class="card-row">
            <span class="card-label">Expires</span>
            <span>${new Date(a.expires_at + 'Z').toLocaleString()}</span>
          </div>
          ${a.revoked_at ? html`
          <div class="card-row">
            <span class="card-label">Revoked</span>
            <span>${new Date(a.revoked_at + 'Z').toLocaleString()}</span>
          </div>
          ` : ''}
          <div class="card-divider"></div>
          <div class="card-actions">
            ${!a.revoked_at ? html`
              <form method="POST" action="/v1/authorized-apps/${a.id}/revoke" style="display:inline">
                <button type="submit" style="background:#ef4444;color:#fff;border:none;padding:4px 12px;border-radius:4px;font-size:0.75rem;cursor:pointer">Revoke</button>
              </form>
            ` : ''}
          </div>
        </div>
      `)}
    </div>
    <script>
    document.querySelectorAll('.provider-select').forEach((sel) => {
      sel.addEventListener('change', async () => {
        const appId = sel.dataset.appId;
        const val = sel.value || null;
        await fetch('/v1/authorized-apps/' + appId + '/provider', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider_config_id: val }),
        });
      });
    });
    </script>
    `}
</div>
    `,
  }));
});
