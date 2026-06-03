import { Hono } from "hono";
import { html } from "hono/html";
import type { Env } from "../types";
import { requireAuth } from "../middleware/session";
import { Layout } from "../views/layout";

export const providerPageRoutes = new Hono<{ Bindings: Env }>();

providerPageRoutes.get("/providers", requireAuth, async (c) => {
  const user = c.get("user");

  const { results } = await c.env.DB.prepare(
    "SELECT id, provider, model, name, is_default, created_at FROM provider_configs WHERE user_id = ? ORDER BY created_at DESC",
  ).bind(user.id).all();

  return c.html(Layout({
    title: "AI Providers",
    user,
    children: html`
<div class="container">
  <h1>AI Providers</h1>
  <p>Add the AI providers you want to use. Each app you authorize can use one of these.</p>

  ${(results as any[]).length === 0
    ? html`<p style="margin:24px 0;color:var(--text-muted)">No providers configured yet.</p>`
    : html`
    <div class="card-grid">
      ${(results as any[]).map(p => html`
        <div class="record-card">
          <div class="card-title">
            ${p.provider}${p.model ? html` &middot; ${p.model}` : ""}
            ${p.is_default ? html`<span class="badge badge-default" style="margin-left:8px">default</span>` : ""}
          </div>
          ${p.name ? html`<div class="card-sub">${p.name}</div>` : ""}
          <div class="card-divider"></div>
          <div class="card-actions">
            <form method="POST" action="/v1/providers/${p.id}/delete" style="display:inline">
              <button type="submit" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:0.8125rem">Remove</button>
            </form>
          </div>
        </div>
      `)}
    </div>
    `}

  <h2>Add Provider</h2>
  <form method="POST" action="/v1/providers" style="display:flex;flex-direction:column;gap:12px;max-width:400px">
    <input type="text" name="name" placeholder="Label (e.g. Work GPT-4, Personal Claude)" style="background:var(--bg-hover);border:1px solid var(--border);border-radius:var(--radius);padding:10px 12px;color:var(--text);font-size:0.875rem" />
    <select name="provider" required style="background:var(--bg-hover);border:1px solid var(--border);border-radius:var(--radius);padding:10px 12px;color:var(--text);font-size:0.875rem">
      <option value="">Select provider</option>
      <option value="openai">OpenAI</option>
      <option value="anthropic">Anthropic</option>
      <option value="google">Google AI</option>
    </select>
    <input type="text" name="model" placeholder="Model (e.g. gpt-4)" style="background:var(--bg-hover);border:1px solid var(--border);border-radius:var(--radius);padding:10px 12px;color:var(--text);font-size:0.875rem" />
    <input type="password" name="api_key" placeholder="API key" required style="background:var(--bg-hover);border:1px solid var(--border);border-radius:var(--radius);padding:10px 12px;color:var(--text);font-size:0.875rem" />
    <label style="font-size:0.875rem;color:var(--text-muted);display:flex;align-items:center;gap:8px">
      <input type="checkbox" name="is_default" value="1" />
      Set as default
    </label>
    <button type="submit" class="btn-primary" style="border:none;cursor:pointer">Add Provider</button>
  </form>
</div>
    `,
  }));
});
