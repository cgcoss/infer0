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
        <div style="max-width:640px">
          <h1 style="font-size:2.5rem;margin-bottom:8px">Pricing</h1>
          <p style="font-size:1.0625rem">
            infer0 charges for API requests routed through the platform.
            Your users still pay their AI provider directly &mdash; this is an additional platform fee.
          </p>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px;margin-top:48px">

          <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:36px;display:flex;flex-direction:column">
            <div style="font-family:var(--font-display);font-size:0.75rem;font-weight:600;color:var(--accent);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px">Free</div>
            <div style="font-family:var(--font-display);font-size:3rem;font-weight:800;color:var(--text);margin-bottom:24px">$0</div>
            <ul style="list-style:none;padding:0;margin:0 0 32px;font-size:0.875rem;display:flex;flex-direction:column;gap:12px;flex:1">
              <li style="display:flex;gap:10px;color:var(--text-muted)"><span style="color:var(--accent);font-weight:700">&#x2713;</span> Up to 10,000 requests per month</li>
              <li style="display:flex;gap:10px;color:var(--text-muted)"><span style="color:var(--accent);font-weight:700">&#x2713;</span> All providers supported</li>
              <li style="display:flex;gap:10px;color:var(--text-muted)"><span style="color:var(--accent);font-weight:700">&#x2713;</span> OpenAI SDK format</li>
              <li style="display:flex;gap:10px;color:var(--text-muted)"><span style="color:var(--accent);font-weight:700">&#x2713;</span> Community support</li>
            </ul>
            <a href="/login" class="btn-primary" style="text-align:center;justify-content:center">Start building</a>
          </div>

          <div style="background:var(--bg-card);border:2px solid var(--accent);border-radius:var(--radius);padding:36px;display:flex;flex-direction:column;position:relative">
            <div style="position:absolute;top:-1px;left:50%;transform:translateX(-50%);background:var(--accent);color:#000;font-size:0.6875rem;font-weight:700;padding:4px 16px;border-radius:0 0 4px 4px;font-family:var(--font-display);text-transform:uppercase;letter-spacing:0.05em">Popular</div>
            <div style="font-family:var(--font-display);font-size:0.75rem;font-weight:600;color:var(--accent);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px">Pro</div>
            <div style="font-family:var(--font-display);font-size:3rem;font-weight:800;color:var(--text);margin-bottom:4px">$5</div>
            <div style="font-size:0.875rem;color:var(--text-muted);margin-bottom:24px">per month</div>
            <ul style="list-style:none;padding:0;margin:0 0 32px;font-size:0.875rem;display:flex;flex-direction:column;gap:12px;flex:1">
              <li style="display:flex;gap:10px;color:var(--text-muted)"><span style="color:var(--accent);font-weight:700">&#x2713;</span> Unlimited requests</li>
              <li style="display:flex;gap:10px;color:var(--text-muted)"><span style="color:var(--accent);font-weight:700">&#x2713;</span> All providers supported</li>
              <li style="display:flex;gap:10px;color:var(--text-muted)"><span style="color:var(--accent);font-weight:700">&#x2713;</span> OpenAI SDK format</li>
              <li style="display:flex;gap:10px;color:var(--text-muted)"><span style="color:var(--accent);font-weight:700">&#x2713;</span> Priority support</li>
            </ul>
            <a href="/login" class="btn-primary" style="text-align:center;justify-content:center">Start building</a>
          </div>

        </div>

        <div style="margin-top:48px;padding:24px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);font-size:0.875rem;color:var(--text-muted);line-height:1.8">
          <strong style="color:var(--text);display:block;margin-bottom:8px;font-family:var(--font-display);font-weight:700">How billing works</strong>
          infer0 counts every inference request (<code>/v1/chat/completions</code>) as one request. Streaming connections count as one request regardless of the number of chunks. Authentication and userinfo requests are free. Your users continue to pay their AI provider (OpenAI, Anthropic, Google) directly for their own usage.
        </div>
      </div>
    `,
  });
}
