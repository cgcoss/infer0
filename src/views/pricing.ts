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
            infer0 is free while we figure out the right pricing model.
            Your users continue to pay their AI provider directly.
          </p>
        </div>

        <div style="margin-top:48px;padding:36px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);display:flex;flex-direction:column;align-items:center;text-align:center">
          <div style="font-family:var(--font-display);font-size:3rem;font-weight:800;color:var(--text);margin-bottom:8px">Free</div>
          <div style="font-size:0.9375rem;color:var(--text-muted);margin-bottom:32px;max-width:440px">
            infer0 is in early development and we are still figuring out pricing.
            While we build traction, the platform is free to use.
          </div>
          <a href="/login" class="btn-primary" style="text-align:center;justify-content:center">Start building</a>
        </div>

        <div style="margin-top:48px;padding:24px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);font-size:0.875rem;color:var(--text-muted);line-height:1.8">
          <strong style="color:var(--text);display:block;margin-bottom:8px;font-family:var(--font-display);font-weight:700">Whats included</strong>
          All features are available now: connect any provider (OpenAI, Anthropic, Google), use any supported API format, set daily spend limits, manage per-app authorizations, and pause or revoke access at any time. We will announce pricing before any charges take effect.
        </div>
      </div>
    `,
  });
}
