import { html } from "hono/html";
import { Layout } from "./layout";

interface PricingViewProps {
  user?: { name: string | null; email: string; avatar_url: string | null } | null;
}

export function PricingView({ user }: PricingViewProps) {
  return Layout({
    title: "Pricing",
    user,
    children: html`
      <div class="container">
        <h1>Pricing</h1>
        <p style="max-width:600px">
          infer0 charges for API requests routed through the platform.
          Your users still pay their AI provider directly &mdash; this is an additional platform fee.
        </p>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px;margin-top:32px">

          <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:32px;display:flex;flex-direction:column">
            <h2 style="font-size:1.25rem;font-weight:700;margin-bottom:4px">Free</h2>
            <p style="font-size:0.875rem;color:var(--text-muted);margin-bottom:16px">For getting started</p>
            <div style="font-size:2.5rem;font-weight:800;color:var(--text);margin-bottom:24px">$0</div>
            <ul style="list-style:none;padding:0;margin:0 0 32px;font-size:0.875rem;display:flex;flex-direction:column;gap:10px;flex:1">
              <li style="display:flex;gap:8px;color:var(--text-muted)"><span style="color:var(--accent)">✓</span> Up to 10,000 requests per month</li>
              <li style="display:flex;gap:8px;color:var(--text-muted)"><span style="color:var(--accent)">✓</span> All providers supported</li>
              <li style="display:flex;gap:8px;color:var(--text-muted)"><span style="color:var(--accent)">✓</span> OpenAI-compatible API</li>
              <li style="display:flex;gap:8px;color:var(--text-muted)"><span style="color:var(--accent)">✓</span> Community support</li>
            </ul>
            <a href="/login" class="btn-primary" style="text-align:center">Start building</a>
          </div>

          <div style="background:var(--bg-card);border:2px solid var(--accent);border-radius:var(--radius);padding:32px;display:flex;flex-direction:column;position:relative">
            <div style="position:absolute;top:-1px;left:50%;transform:translateX(-50%);background:var(--accent);color:#fff;font-size:0.75rem;font-weight:600;padding:4px 16px;border-radius:0 0 4px 4px">POPULAR</div>
            <h2 style="font-size:1.25rem;font-weight:700;margin-bottom:4px">Pro</h2>
            <p style="font-size:0.875rem;color:var(--text-muted);margin-bottom:16px">For growing apps</p>
            <div style="font-size:2.5rem;font-weight:800;color:var(--text);margin-bottom:4px">$5</div>
            <div style="font-size:0.875rem;color:var(--text-muted);margin-bottom:24px">per month</div>
            <ul style="list-style:none;padding:0;margin:0 0 32px;font-size:0.875rem;display:flex;flex-direction:column;gap:10px;flex:1">
              <li style="display:flex;gap:8px;color:var(--text-muted)"><span style="color:var(--accent)">✓</span> Unlimited requests</li>
              <li style="display:flex;gap:8px;color:var(--text-muted)"><span style="color:var(--accent)">✓</span> All providers supported</li>
              <li style="display:flex;gap:8px;color:var(--text-muted)"><span style="color:var(--accent)">✓</span> OpenAI-compatible API</li>
              <li style="display:flex;gap:8px;color:var(--text-muted)"><span style="color:var(--accent)">✓</span> Priority support</li>
            </ul>
            <a href="/login" class="btn-primary" style="text-align:center">Start building</a>
          </div>

        </div>

        <div style="margin-top:40px;padding:20px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);font-size:0.875rem;color:var(--text-muted);line-height:1.7">
          <strong style="color:var(--text);display:block;margin-bottom:6px">How billing works</strong>
          infer0 counts every request to <code>/v1/chat/completions</code> as one request. Streaming connections count as one request regardless of the number of chunks. Authentication and userinfo requests are free. Your users continue to pay their AI provider (OpenAI, Anthropic, Google) directly for their own usage.
        </div>
      </div>
    `,
  });
}
