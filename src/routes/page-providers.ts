import { Hono } from "hono";
import { html } from "hono/html";
import type { Env } from "../types";
import { requireAuth } from "../middleware/session";
import { Layout } from "../views/layout";

export const providerPageRoutes = new Hono<{ Bindings: Env }>();

providerPageRoutes.get("/providers", requireAuth, async (c) => {
  const user = c.get("user");

  const today = new Date().toISOString().slice(0, 10);
  const { results } = await c.env.DB.prepare(
    "SELECT id, provider, model, name, is_default, daily_spend_limit_cents, paused_at, created_at FROM provider_configs WHERE user_id = ? ORDER BY created_at DESC",
  ).bind(user.id).all();

  const usageRows = await c.env.DB.prepare(
    "SELECT provider_config_id, cost_cents FROM daily_usage WHERE user_id = ? AND date = ?",
  ).bind(user.id, today).all();

  const usageMap: Record<string, number> = {};
  for (const r of usageRows.results as any[]) {
    usageMap[r.provider_config_id] = r.cost_cents;
  }

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
      ${(results as any[]).map(p => {
        const todayCents = usageMap[p.id] ?? 0;
        const limitCents = p.daily_spend_limit_cents;
        const exceeded = limitCents !== null && todayCents >= limitCents;
        const isPaused = !!p.paused_at;
        return html`
        <div class="record-card" style="${exceeded || isPaused ? 'opacity:0.6' : ''}">
          <div class="card-title">
            ${p.provider}${p.model ? html` &middot; ${p.model}` : ""}
            ${p.is_default ? html`<span class="badge badge-default" style="margin-left:8px">default</span>` : ""}
            ${isPaused
              ? html`<span class="badge" style="margin-left:8px;background:#d97706;color:#fff;font-size:0.7rem;padding:1px 6px;border-radius:4px">Paused</span>`
              : exceeded ? html`<span class="badge" style="margin-left:8px;background:#ef4444;color:#fff;font-size:0.7rem;padding:1px 6px;border-radius:4px">Exceeded</span>` : ""}
          </div>
          ${p.name ? html`<div class="card-sub">${p.name}</div>` : ""}
          <div class="card-divider"></div>
          <div class="spend-row">
            <span class="spend-label">Today</span>
            <span class="spend-value">$${(todayCents / 100).toFixed(2)}</span>
            ${limitCents !== null ? html`<span class="spend-max">/ $${(limitCents / 100).toFixed(2)}</span>` : ""}
          </div>
          <div class="card-divider"></div>
          <div class="spend-limit-form">
            <input type="number" class="spend-limit-input" data-id="${p.id}" placeholder="Daily limit ($)" value="${limitCents !== null ? (limitCents / 100).toFixed(2) : ""}" min="0" step="0.01" ${isPaused ? 'disabled' : ''} />
            <button class="btn-save-limit" data-id="${p.id}">${limitCents !== null ? "Update" : "Set limit"}</button>
            ${limitCents !== null ? html`<button class="btn-remove-limit" data-id="${p.id}" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:0.8125rem">Remove</button>` : ""}
          </div>
          <div class="card-actions">
            ${isPaused
              ? html`<button class="btn-resume" data-id="${p.id}" style="background:var(--accent);color:#fff;border:none;padding:4px 12px;border-radius:4px;font-size:0.75rem;cursor:pointer">Resume</button>`
              : html`<button class="btn-pause" data-id="${p.id}" style="background:none;border:1px solid var(--border);color:var(--text);padding:4px 12px;border-radius:4px;font-size:0.75rem;cursor:pointer">Pause</button>`
            }
            ${!p.is_default ? html`<button class="btn-set-default" data-id="${p.id}" style="background:none;border:none;color:var(--accent);cursor:pointer;font-size:0.8125rem">Set as default</button>` : ""}
            <form method="POST" action="/v1/providers/${p.id}/delete" style="display:inline">
              <button type="submit" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:0.8125rem">Remove</button>
            </form>
          </div>
        </div>
        `;
      })}
    </div>
    `}

  <script>
  document.querySelectorAll('.btn-set-default').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      await fetch('/v1/providers/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_default: true }),
      });
      location.reload();
    });
  });

  document.querySelectorAll('.btn-save-limit').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const input = document.querySelector('.spend-limit-input[data-id="' + id + '"]');
      const val = parseFloat(input.value);
      const cents = isNaN(val) || val <= 0 ? null : Math.round(val * 100);
      await fetch('/v1/providers/' + id + '/spend-limit', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ daily_spend_limit_cents: cents }),
      });
      location.reload();
    });
  });

  document.querySelectorAll('.btn-remove-limit').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      await fetch('/v1/providers/' + id + '/spend-limit', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ daily_spend_limit_cents: null }),
      });
      location.reload();
    });
  });

  document.querySelectorAll('.btn-pause').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      await fetch('/v1/providers/' + id + '/pause', { method: 'PUT' });
      location.reload();
    });
  });

  document.querySelectorAll('.btn-resume').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      await fetch('/v1/providers/' + id + '/resume', { method: 'PUT' });
      location.reload();
    });
  });
  </script>
  <script>
  const MODELS = {
    openai: ["gpt-4o", "gpt-4o-mini", "gpt-4", "gpt-4-turbo", "gpt-3.5-turbo", "o1", "o3-mini"],
    anthropic: ["claude-sonnet-4-5", "claude-3-5-haiku", "claude-3-5-sonnet", "claude-3-opus", "claude-3-haiku"],
    "google-ai-studio": ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"],
  };
  function updateModels() {
    const provider = document.getElementById("provider-select").value;
    const input = document.getElementById("model-input");
    const list = document.getElementById("model-suggestions");
    list.innerHTML = "";
    if (!provider) {
      input.placeholder = "Select a provider first";
      return;
    }
    input.placeholder = "Type or select a model";
    const models = MODELS[provider] || [];
    models.forEach(m => { const o = document.createElement("option"); o.value = m; list.appendChild(o); });
  }
  </script>

  <h2>Add Provider</h2>
  <form method="POST" action="/v1/providers" style="display:flex;flex-direction:column;gap:12px;max-width:400px">
    <input type="text" name="name" placeholder="Label (e.g. Work GPT-4, Personal Claude)" style="background:var(--bg-hover);border:1px solid var(--border);border-radius:var(--radius);padding:10px 12px;color:var(--text);font-size:0.875rem" />
    <select name="provider" id="provider-select" required style="background:var(--bg-hover);border:1px solid var(--border);border-radius:var(--radius);padding:10px 12px;color:var(--text);font-size:0.875rem" onchange="updateModels()">
      <option value="">Select provider</option>
      <option value="openai">OpenAI</option>
      <option value="anthropic">Anthropic</option>
      <option value="google-ai-studio">Google AI</option>
    </select>
    <input type="text" name="model" id="model-input" list="model-suggestions" placeholder="Select a provider first" style="background:var(--bg-hover);border:1px solid var(--border);border-radius:var(--radius);padding:10px 12px;color:var(--text);font-size:0.875rem" />
    <datalist id="model-suggestions"></datalist>
    <input type="password" name="api_key" placeholder="API key" required style="background:var(--bg-hover);border:1px solid var(--border);border-radius:var(--radius);padding:10px 12px;color:var(--text);font-size:0.875rem" />
    <label style="font-size:0.875rem;color:var(--text-muted);display:flex;align-items:center;gap:8px">
      <input type="checkbox" name="is_default" value="1" />
      Set as default
    </label>
    <p style="font-size:0.8125rem;color:var(--text-muted);margin:0">
      Your API key is encrypted before storage. infer0 staff cannot read it. You can delete it anytime.
    </p>
    <button type="submit" class="btn-primary" style="border:none;cursor:pointer">Add Provider</button>
  </form>
</div>
    `,
  }));
});
