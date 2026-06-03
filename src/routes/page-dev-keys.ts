import { Hono } from "hono";
import { html } from "hono/html";
import type { Env } from "../types";
import { requireAuth } from "../middleware/session";
import { Layout } from "../views/layout";

export const devKeysRoutes = new Hono<{ Bindings: Env }>();

devKeysRoutes.get("/dev/keys", requireAuth, async (c) => {
  const user = c.get("user");

  const { results } = await c.env.DB.prepare(
    "SELECT id, name, key_prefix, is_active, last_used_at, created_at FROM api_keys WHERE user_id = ? ORDER BY created_at DESC",
  ).bind(user.id).all<{
    id: string;
    name: string;
    key_prefix: string;
    is_active: number;
    last_used_at: string | null;
    created_at: string;
  }>();

  return c.html(
    Layout({
      title: "Developer API Keys",
      user,
      children: html`
<style>
.btn-danger { background:#ef4444;color:#fff;border:none;padding:4px 12px;border-radius:4px;font-size:0.75rem;cursor:pointer }
.btn-danger:hover { background:#dc2626 }
.create-btn { background:var(--accent);color:#fff;border:none;padding:8px 16px;border-radius:var(--radius);font-size:0.875rem;cursor:pointer }
.create-btn:hover { background:var(--accent-hover) }
</style>
<div class="container">
  <h1>Developer API Keys</h1>
  <p>Create API keys for your app to use when calling infer0.</p>

  <form id="create-form" style="margin-bottom:2rem;display:flex;gap:0.5rem;align-items:end">
    <div>
      <label for="name" style="display:block;font-size:0.875rem;color:var(--text-muted);margin-bottom:4px">Key name</label>
      <input type="text" id="name" name="name" placeholder="e.g. production" required style="background:var(--bg-hover);color:var(--text);border:1px solid var(--border);padding:8px 12px;border-radius:var(--radius);font-size:0.875rem" />
    </div>
    <button type="submit" class="create-btn">Create key</button>
  </form>

  <div id="new-key" style="display:none;background:var(--bg-hover);padding:1rem;border-radius:var(--radius);margin-bottom:2rem">
    <p style="color:var(--accent);font-weight:600">Copy this key now — it won't be shown again.</p>
    <pre id="new-key-value" style="user-select:all;word-break:break-all;background:var(--bg);border:1px solid var(--border);padding:12px;border-radius:var(--radius);margin-top:8px"></pre>
  </div>
  <div id="key-error" style="display:none;background:#7f1d1d;color:#fca5a5;padding:0.75rem 1rem;border-radius:var(--radius);margin-bottom:1rem;font-size:0.875rem"></div>

  <table>
    <thead>
      <tr>
        <th>Name</th>
        <th>Key prefix</th>
        <th>Status</th>
        <th>Last used</th>
        <th>Created</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      ${results.map((k) => html`
        <tr>
          <td>${k.name}</td>
          <td><code>${k.key_prefix}...</code></td>
          <td>${k.is_active ? 'Active' : 'Disabled'}</td>
          <td>${k.last_used_at ? new Date(k.last_used_at + 'Z').toLocaleString() : 'Never'}</td>
          <td>${new Date(k.created_at + 'Z').toLocaleString()}</td>
          <td>
            ${k.is_active
              ? html`<button class="btn-danger" data-id="${k.id}" data-action="revoke">Revoke</button>`
              : ''}
          </td>
        </tr>
      `)}
    </tbody>
  </table>
</div>

<script>
document.getElementById('create-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('name').value;
  const res = await fetch('/v1/api-keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  const data = await res.json();
  if (data.key) {
    document.getElementById('new-key').style.display = 'block';
    document.getElementById('new-key-value').textContent = data.key.plaintext_key;
    document.getElementById('name').value = '';
    document.getElementById('key-error').style.display = 'none';
    const tbody = document.querySelector('table tbody');
    if (tbody) {
      const row = document.createElement('tr');
      row.innerHTML = '<td>' + data.key.name + '</td><td><code>' + data.key.key_prefix + '...</code></td><td>Active</td><td>Never</td><td>' + new Date().toLocaleString() + '</td><td><button class="btn-danger" data-id="' + data.key.id + '" data-action="revoke">Revoke</button></td>';
      tbody.prepend(row);
      row.querySelector('[data-action="revoke"]')?.addEventListener('click', async () => {
        if (!confirm('Revoke this key? It will stop working immediately.')) return;
        await fetch('/v1/api-keys/' + row.querySelector('[data-action="revoke"]').dataset.id, { method: 'DELETE' });
        location.reload();
      });
    }
  } else {
    const err = document.getElementById('key-error');
    err.textContent = data.error?.message || 'Failed to create key';
    err.style.display = 'block';
  }
});

document.querySelectorAll('[data-action="revoke"]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    if (!confirm('Revoke this key? It will stop working immediately.')) return;
    await fetch('/v1/api-keys/' + btn.dataset.id, { method: 'DELETE' });
    location.reload();
  });
});
</script>
      `,
    }),
  );
});
