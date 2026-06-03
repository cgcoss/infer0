import { html } from "hono/html";
import { Layout } from "./layout";

interface HomeViewProps {
  user?: { name: string | null; email: string; avatar_url: string | null } | null;
}

export function HomeView({ user }: HomeViewProps) {
  return Layout({
    title: "Home",
    user,
    children: html`
      <div class="container">
        <section class="hero">
          <h1>Your code calls one API.<br />Your users bring the keys.</h1>
          <p>
            infer0 is the OAuth layer for AI. Each of your users connects their own provider account
            (OpenAI, Anthropic, Google). You get a token, you call one OpenAI-compatible endpoint,
            and we route to their provider.
          </p>
          <div style="margin:24px auto;max-width:380px;text-align:left;font-size:0.9375rem;line-height:2">
            <div>✓ <strong>One integration.</strong> One API replaces every provider SDK.</div>
            <div>✓ <strong>Zero key handling.</strong> We encrypt user keys. You never touch them.</div>
            <div>✓ <strong>Users pay their way.</strong> They use their own subscriptions and API keys.</div>
          </div>
          <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
            <a href="/login" class="btn-primary">Start building</a>
            <a href="/docs" class="btn-secondary">Read the docs</a>
          </div>
        </section>

        <section>
          <h2>How infer0 works</h2>
          <div style="display:flex;flex-direction:column;gap:16px;margin-top:24px">
            <div style="display:flex;gap:16px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:20px">
              <div style="flex-shrink:0;width:32px;height:32px;border-radius:50%;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.875rem">1</div>
              <div>
                <h3 style="font-size:1rem;font-weight:600;margin-bottom:4px">Developer integrates once</h3>
                <p style="margin:0;font-size:0.875rem">You add the infer0 OAuth flow to your app and call a single OpenAI-compatible endpoint. No per-provider SDKs. No provider-specific logic.</p>
              </div>
            </div>
            <div style="display:flex;gap:16px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:20px">
              <div style="flex-shrink:0;width:32px;height:32px;border-radius:50%;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.875rem">2</div>
              <div>
                <h3 style="font-size:1rem;font-weight:600;margin-bottom:4px">User connects their provider</h3>
                <p style="margin:0;font-size:0.875rem">During the OAuth flow, each user picks a provider (OpenAI, Anthropic, Google) and enters their API key. You never see or handle their credentials.</p>
              </div>
            </div>
            <div style="display:flex;gap:16px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:20px">
              <div style="flex-shrink:0;width:32px;height:32px;border-radius:50%;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.875rem">3</div>
              <div>
                <h3 style="font-size:1rem;font-weight:600;margin-bottom:4px">App sends requests to infer0</h3>
                <p style="margin:0;font-size:0.875rem">Your app passes the user's access token to <code>/v1/chat/completions</code>. The API is OpenAI-compatible, so the OpenAI SDK works out of the box.</p>
              </div>
            </div>
            <div style="display:flex;gap:16px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:20px">
              <div style="flex-shrink:0;width:32px;height:32px;border-radius:50%;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.875rem">4</div>
              <div>
                <h3 style="font-size:1rem;font-weight:600;margin-bottom:4px">infer0 routes to their provider</h3>
                <p style="margin:0;font-size:0.875rem">We look up the user's configured provider and model, forward the request, and return the response. Your app doesn't need to know or care which provider is behind the scenes.</p>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2>For Developers</h2>
          <div class="grid">
            <div class="card">
              <h3>Single Integration</h3>
              <p>One OpenAI-compatible API. No need to support every provider individually.</p>
            </div>
            <div class="card">
              <h3>User Choice</h3>
              <p>Let users pick their preferred provider and bring their own API key.</p>
            </div>
            <div class="card">
              <h3>No Key Management</h3>
              <p>We handle provider API key storage and encryption. You never touch them.</p>
            </div>
          </div>
        </section>

        <section>
          <h2>For End Users</h2>
          <div class="grid">
            <div class="card">
              <h3>Your Account, Your Keys</h3>
              <p>Connect your existing OpenAI, Anthropic, or Google account. No need to share credentials.</p>
            </div>
            <div class="card">
              <h3>Use What You Pay For</h3>
              <p>Already have a subscription? Use it across any infer0-integrated app.</p>
            </div>
            <div class="card">
              <h3>Full Control</h3>
              <p>Add, remove, or switch providers anytime from your dashboard.</p>
            </div>
          </div>
        </section>

        <section style="text-align:center">
          <h2>Early projects using infer0</h2>
          <p style="max-width:600px;margin:0 auto 24px">
            infer0 is in early development. If you are building something with it,
            <a href="mailto:hi@infer0.com" style="color:var(--accent)">tell us about it</a>
            and we will feature your project here.
          </p>
        </section>

        <section>
          <h2>Security &amp; privacy</h2>
          <div style="display:flex;flex-direction:column;gap:16px;margin-top:24px">
            <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:20px">
              <h3 style="font-size:0.9375rem;font-weight:600;margin-bottom:6px">Prompts and completions stay private.</h3>
              <p style="margin:0;font-size:0.875rem;color:var(--text-muted)">infer0 does not log or store prompt or completion content. Metadata such as timestamps and token counts may be retained for rate limiting, but message bodies are never stored.</p>
            </div>
            <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:20px">
              <h3 style="font-size:0.9375rem;font-weight:600;margin-bottom:6px">Credentials are encrypted.</h3>
              <p style="margin:0;font-size:0.875rem;color:var(--text-muted)">Provider API keys are encrypted with AES-256-GCM before storage. Access tokens and refresh tokens are hashed. Encryption keys are managed by Cloudflare's secure infrastructure and never exposed to the application.</p>
            </div>
            <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:20px">
              <h3 style="font-size:0.9375rem;font-weight:600;margin-bottom:6px">Staff cannot read your keys.</h3>
              <p style="margin:0;font-size:0.875rem;color:var(--text-muted)">Encrypted data cannot be read by infer0 staff. The encryption keys are stored in Cloudflare's secure infrastructure, separate from the database.</p>
            </div>
            <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:20px">
              <h3 style="font-size:0.9375rem;font-weight:600;margin-bottom:6px">Revoke access anytime.</h3>
              <p style="margin:0;font-size:0.875rem;color:var(--text-muted)">You can revoke any app's access from your Authorizations page. Revoking immediately invalidates the associated tokens and blocks further requests. Providers can be deleted from your AI Providers page.</p>
            </div>
            <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:20px">
              <h3 style="font-size:0.9375rem;font-weight:600;margin-bottom:6px">Data retention.</h3>
              <p style="margin:0;font-size:0.875rem;color:var(--text-muted)">infer0 retains your account profile (email, name, avatar), encrypted provider configurations, and OAuth authorization records. You can delete your providers and revoke authorizations at any time.</p>
            </div>
            <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:20px">
              <h3 style="font-size:0.9375rem;font-weight:600;margin-bottom:6px">If infer0 is unavailable.</h3>
              <p style="margin:0;font-size:0.875rem;color:var(--text-muted)">Your API keys with your AI provider (OpenAI, Anthropic, etc.) remain valid and are unaffected. Your app's requests to infer0 will fail until service resumes. We recommend developers handle this gracefully in their applications.</p>
            </div>
          </div>
        </section>
      </div>
    `,
  });
}
