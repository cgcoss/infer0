import { html } from "hono/html";
import { Layout } from "./layout";

interface TosViewProps {
  user?: { name: string | null; email: string; avatar_url: string | null } | null;
}

export function TosView({ user }: TosViewProps) {
  return Layout({
    title: "Terms of Service",
    user,
    children: html`
      <div class="container">
        <div style="max-width:640px">
          <h1 style="font-size:2.5rem;margin-bottom:8px">Terms of Service</h1>
          <p style="font-size:0.875rem;color:var(--text-muted)">Last updated: June 12, 2026</p>

          <section style="margin-bottom:40px">
            <h3 style="font-size:1.125rem;font-weight:600;margin-bottom:8px">Service description</h3>
            <p style="font-size:0.875rem;color:var(--text-muted);line-height:1.8">infer0 is an OAuth-based inference routing service. It allows end users to connect their AI provider API keys and authorize third-party applications to use them. Developers integrate via a standard API and infer0 routes requests to each user's configured provider.</p>
          </section>

          <section style="margin-bottom:40px">
            <h3 style="font-size:1.125rem;font-weight:600;margin-bottom:8px">User responsibilities</h3>
            <p style="font-size:0.875rem;color:var(--text-muted);line-height:1.8">You are responsible for maintaining the confidentiality of your OAuth credentials and API keys. You agree not to use infer0 for any unlawful purpose or in violation of any applicable laws or regulations. You are responsible for all activity that occurs under your account.</p>
          </section>

          <section style="margin-bottom:40px">
            <h3 style="font-size:1.125rem;font-weight:600;margin-bottom:8px">Service availability</h3>
            <p style="font-size:0.875rem;color:var(--text-muted);line-height:1.8">infer0 is provided as-is without warranty of any kind. We strive for high availability but do not guarantee uninterrupted service. Your AI provider API keys remain valid and can be used directly if infer0 is unavailable.</p>
          </section>

          <section style="margin-bottom:40px">
            <h3 style="font-size:1.125rem;font-weight:600;margin-bottom:8px">Limitation of liability</h3>
            <p style="font-size:0.875rem;color:var(--text-muted);line-height:1.8">infer0 shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the service. Your sole remedy for dissatisfaction with the service is to stop using it and delete your account.</p>
          </section>

          <section style="margin-bottom:40px">
            <h3 style="font-size:1.125rem;font-weight:600;margin-bottom:8px">Changes to terms</h3>
            <p style="font-size:0.875rem;color:var(--text-muted);line-height:1.8">We may update these terms at any time. Continued use of infer0 after changes constitutes acceptance of the new terms. We will notify users of material changes via email.</p>
          </section>

          <section>
            <h3 style="font-size:1.125rem;font-weight:600;margin-bottom:8px">Contact</h3>
            <p style="font-size:0.875rem;color:var(--text-muted);line-height:1.8">For questions about these terms, email hi@infer0.com.</p>
          </section>
        </div>
      </div>
    `,
  });
}
