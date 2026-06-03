import { html } from "hono/html";
import { Layout } from "./layout";
import type { SessionUser } from "../middleware/session";
import type { ProviderConfig, AuthorizedApp } from "../types";

interface DashboardViewProps {
  user: SessionUser;
  providers: ProviderConfig[];
  authorizedApps: AuthorizedApp[];
}

export function DashboardView({ user, providers, authorizedApps }: DashboardViewProps) {
  return Layout({
    title: "Dashboard",
    user,
    children: html`
<style>
.name-input { background:var(--bg-hover);border:1px solid var(--border);border-radius:var(--radius);padding:10px 12px;color:var(--text);font-size:0.875rem }
.revoke-btn { background:#ef4444;color:#fff;border:none;padding:4px 12px;border-radius:4px;font-size:0.75rem;cursor:pointer }
.revoke-btn:hover { background:#dc2626 }
</style>
<div class="container">
  <h1>Dashboard</h1>
  <p>Welcome, ${user.name ?? user.email}. Manage your provider configurations below.</p>

  <h2>Your Providers</h2>

  ${providers.length === 0
    ? html`<p>No providers configured yet. Add one below.</p>`
    : html`
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Provider</th>
              <th>Model</th>
              <th>Default</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${providers.map(
              (p) => html`
                <tr>
                  <td>${p.name || html`<span style="color:var(--text-muted)">—</span>`}</td>
                  <td>${p.provider}</td>
                  <td>${p.model || "—"}</td>
                  <td>${p.is_default ? "✓" : ""}</td>
                  <td>
                    <form
                      method="POST"
                      action="/v1/providers/${p.id}/delete"
                      style="display:inline"
                    >
                      <button
                        type="submit"
                        style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:0.8125rem"
                      >
                        Remove
                      </button>
                    </form>
                  </td>
                </tr>
              `,
            )}
          </tbody>
        </table>
      `}

  <h2>Add Provider</h2>
  <form
    method="POST"
    action="/v1/providers"
    style="display:flex;flex-direction:column;gap:12px;max-width:400px"
  >
    <input
      type="text"
      name="name"
      placeholder="Label (e.g. Work GPT-4, Personal Claude)"
      class="name-input"
    />
    <select
      name="provider"
      required
      style="background:var(--bg-hover);border:1px solid var(--border);border-radius:var(--radius);padding:10px 12px;color:var(--text);font-size:0.875rem"
    >
      <option value="">Select provider</option>
      <option value="openai">OpenAI</option>
      <option value="anthropic">Anthropic</option>
      <option value="google">Google AI</option>
    </select>
    <input
      type="text"
      name="model"
      placeholder="Model (e.g. gpt-4)"
      style="background:var(--bg-hover);border:1px solid var(--border);border-radius:var(--radius);padding:10px 12px;color:var(--text);font-size:0.875rem"
    />
    <input
      type="password"
      name="api_key"
      placeholder="API key"
      required
      style="background:var(--bg-hover);border:1px solid var(--border);border-radius:var(--radius);padding:10px 12px;color:var(--text);font-size:0.875rem"
    />
    <label style="font-size:0.875rem;color:var(--text-muted);display:flex;align-items:center;gap:8px">
      <input type="checkbox" name="is_default" value="1" />
      Set as default
    </label>
    <button type="submit" class="btn-primary" style="border:none;cursor:pointer">
      Add Provider
    </button>
  </form>

  <h2 style="margin-top:3rem">Authorized Services</h2>
  <p>Developer apps that have access to your provider. Revoke access at any time.</p>

  ${authorizedApps.length === 0
    ? html`<p style="margin-top:1rem;color:var(--text-muted)">No services authorized yet. They will appear here when a developer app uses your token.</p>`
    : html`
        <table>
          <thead>
            <tr>
              <th>Service</th>
              <th>Provider</th>
              <th>Last used</th>
              <th>Expires</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${authorizedApps.map(
              (a) => html`
                <tr>
                  <td>${a.developer_name || html`<code>${a.app_prefix}...</code>`}</td>
                  <td>
                    <select class="provider-select" data-app-id="${a.id}" style="background:var(--bg-hover);border:1px solid var(--border);border-radius:4px;padding:4px 6px;color:var(--text);font-size:0.75rem;max-width:180px">
                      <option value="">Default provider</option>
                      ${providers.map((p) => html`
                        <option value="${p.id}" ${a.provider_config_id === p.id ? 'selected' : ''}>${p.name || p.provider + ' ' + p.model}</option>
                      `)}
                    </select>
                  </td>
                  <td>${new Date(a.last_used_at + 'Z').toLocaleString()}</td>
                  <td>${new Date(a.expires_at + 'Z').toLocaleString()}</td>
                  <td>${a.revoked_at ? html`<span style="color:#ef4444">Revoked</span>` : html`<span style="color:#22c55e">Active</span>`}</td>
                  <td>
                    ${a.revoked_at
                      ? html`<span style="color:var(--text-muted);font-size:0.75rem">Revoked ${new Date(a.revoked_at + 'Z').toLocaleString()}</span>`
                      : html`<form method="POST" action="/v1/authorized-apps/${a.id}/revoke" style="display:inline">
                          <button type="submit" class="revoke-btn">Revoke</button>
                        </form>`}
                  </td>
                </tr>
              `,
            )}
          </tbody>
        </table>
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
  });
}
