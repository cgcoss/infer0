import { html } from "hono/html";
import { Layout } from "./layout";

interface PrivacyViewProps {
  user?: { name: string | null; email: string; avatar_url: string | null } | null;
}

export function PrivacyView({ user }: PrivacyViewProps) {
  return Layout({
    title: "Privacy Policy",
    user,
    children: html`
      <div class="container">
        <div style="max-width:640px">
          <h1 style="font-size:2.5rem;margin-bottom:8px">Privacy Policy</h1>
          <p style="font-size:0.875rem;color:var(--text-muted)">Last updated: June 12, 2026</p>

          <section style="margin-bottom:40px">
            <h3 style="font-size:1.125rem;font-weight:600;margin-bottom:8px">Data we collect</h3>
            <p style="font-size:0.875rem;color:var(--text-muted);line-height:1.8">We collect your email address and avatar from your OAuth provider (Google or GitHub) when you sign in. We store your AI provider API keys encrypted with AES-256-GCM. We retain metadata about inference requests (timestamps, token counts, cost) for rate limiting and spend tracking. We do not log or store prompt or completion content.</p>
          </section>

          <section style="margin-bottom:40px">
            <h3 style="font-size:1.125rem;font-weight:600;margin-bottom:8px">How we use data</h3>
            <p style="font-size:0.875rem;color:var(--text-muted);line-height:1.8">Your email and avatar are used for account identification. API keys are used solely to forward inference requests to your chosen AI provider. Metadata is used to enforce daily spend limits and display usage statistics. We do not sell or share your data with third parties except as required to route inference requests to your chosen AI provider.</p>
          </section>

          <section style="margin-bottom:40px">
            <h3 style="font-size:1.125rem;font-weight:600;margin-bottom:8px">Data retention</h3>
            <p style="font-size:0.875rem;color:var(--text-muted);line-height:1.8">Account profiles, encrypted provider configurations, and OAuth authorization records are retained until you delete them. You may revoke authorizations, delete providers, and remove your account at any time. Usage metadata is retained for the purpose of spend tracking.</p>
          </section>

          <section style="margin-bottom:40px">
            <h3 style="font-size:1.125rem;font-weight:600;margin-bottom:8px">Data deletion</h3>
            <p style="font-size:0.875rem;color:var(--text-muted);line-height:1.8">You can delete AI providers and revoke OAuth authorizations from your dashboard. To delete your account entirely, email hi@infer0.com. We will remove your profile, encrypted provider keys, and authorization records within 30 days.</p>
          </section>

          <section>
            <h3 style="font-size:1.125rem;font-weight:600;margin-bottom:8px">Contact</h3>
            <p style="font-size:0.875rem;color:var(--text-muted);line-height:1.8">For questions about this policy, email hi@infer0.com.</p>
          </section>
        </div>
      </div>
    `,
  });
}
