import { Hono } from "hono";
import { html } from "hono/html";
import type { Env } from "../types";
import { requireAuth } from "../middleware/session";
import { Layout } from "../views/layout";

export const servicePageRoutes = new Hono<{ Bindings: Env }>();

servicePageRoutes.get("/services", requireAuth, async (c) => {
  const user = c.get("user");
  const today = new Date().toISOString().slice(0, 10);

  const [appsResult, providersResult, usageResult] = await Promise.all([
    c.env.DB.prepare(
      `SELECT a.id, a.app_prefix, a.developer_name, a.provider_config_id, a.last_used_at, a.expires_at, a.revoked_at, a.created_at,
              (SELECT id FROM oauth_authorizations
               WHERE user_id = a.user_id AND oauth_app_id = a.oauth_app_id AND revoked_at IS NULL
               ORDER BY created_at DESC LIMIT 1) AS oauth_authorization_id,
              (SELECT daily_spend_limit_cents FROM oauth_authorizations
               WHERE user_id = a.user_id AND oauth_app_id = a.oauth_app_id AND revoked_at IS NULL
               ORDER BY created_at DESC LIMIT 1) AS daily_spend_limit_cents
       FROM authorized_apps a
       WHERE a.user_id = ?
       ORDER BY a.created_at DESC`,
    ).bind(user.id).all(),
    c.env.DB.prepare(
      "SELECT id, provider, model, name FROM provider_configs WHERE user_id = ? ORDER BY is_default DESC",
    ).bind(user.id).all(),
    c.env.DB.prepare(
      "SELECT oauth_authorization_id, cost_cents FROM daily_usage WHERE user_id = ? AND date = ? AND oauth_authorization_id != ''",
    ).bind(user.id, today).all(),
  ]);

  const apps = appsResult.results as any[];
  const providers = providersResult.results as any[];

  const usageByAuth: Record<string, number> = {};
  for (const r of usageResult.results as any[]) {
    usageByAuth[r.oauth_authorization_id] = (usageByAuth[r.oauth_authorization_id] ?? 0) + r.cost_cents;
  }

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
      ${apps.map(a => {
        const todayCents = usageByAuth[a.oauth_authorization_id] ?? 0;
        const limitCents = a.daily_spend_limit_cents;
        const exceeded = limitCents !== null && todayCents >= limitCents;
        return html`
        <div class="record-card" style="${exceeded ? 'opacity:0.6' : ''}">
          <div class="card-title">
            ${a.developer_name || html`<code>${a.app_prefix}...</code>`}
            ${a.revoked_at
              ? html`<span class="badge badge-revoked" style="float:right">Revoked</span>`
              : html`<span class="badge badge-active" style="float:right">Active</span>`}
            ${exceeded ? html`<span class="badge" style="margin-left:8px;background:#ef4444;color:#fff;font-size:0.7rem;padding:1px 6px;border-radius:4px">paused</span>` : ""}
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
          <div class="card-divider"></div>
          <div class="spend-row">
            <span class="spend-label">Today</span>
            <span class="spend-value">$${(todayCents / 100).toFixed(2)}</span>
            ${limitCents !== null ? html`<span class="spend-max">/ $${(limitCents / 100).toFixed(2)}</span>` : ""}
          </div>
          <div class="card-divider"></div>
          <div class="spend-limit-form">
            <input type="number" class="spend-limit-input" data-app-id="${a.id}" placeholder="Daily limit ($)" value="${limitCents !== null ? (limitCents / 100).toFixed(2) : ""}" min="0" step="0.01" ${a.revoked_at ? 'disabled' : ''} />
            <button class="btn-save-limit" data-app-id="${a.id}">${limitCents !== null ? "Update" : "Set limit"}</button>
            ${limitCents !== null ? html`<button class="btn-remove-limit" data-app-id="${a.id}" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:0.8125rem">Remove</button>` : ""}
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
      `})}
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
    document.querySelectorAll('.btn-save-limit').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const appId = btn.dataset.appId;
        const input = document.querySelector('.spend-limit-input[data-app-id="' + appId + '"]');
        const val = parseFloat(input.value);
        const cents = isNaN(val) || val <= 0 ? null : Math.round(val * 100);
        await fetch('/v1/authorized-apps/' + appId + '/spend-limit', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ daily_spend_limit_cents: cents }),
        });
        location.reload();
      });
    });
    document.querySelectorAll('.btn-remove-limit').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const appId = btn.dataset.appId;
        await fetch('/v1/authorized-apps/' + appId + '/spend-limit', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ daily_spend_limit_cents: null }),
        });
        location.reload();
      });
    });
    </script>
    `}
</div>
    `,
  }));
});
