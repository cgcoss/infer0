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
          <h1>Bring your own intelligence.</h1>
          <p>
            infer0 lets end users connect their AI provider keys and authorize
            apps to use them. Developers integrate once in OpenAI format and
            infer0 routes to whichever provider each user chooses.
          </p>
          <div style="margin:28px auto;max-width:420px;text-align:left;font-size:0.875rem;line-height:2.2">
            <div style="display:flex;gap:10px;align-items:center"><span style="color:var(--accent);font-family:var(--font-display);font-weight:700">01</span> Users add AI Providers (OpenAI, Anthropic, Google) and set daily spend limits.</div>
            <div style="display:flex;gap:10px;align-items:center"><span style="color:var(--accent);font-family:var(--font-display);font-weight:700">02</span> Authorized apps use the user's provider without ever seeing their keys.</div>
            <div style="display:flex;gap:10px;align-items:center"><span style="color:var(--accent);font-family:var(--font-display);font-weight:700">03</span> Users control spend and access per authorization from their dashboard.</div>
          </div>
          <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
            <a href="/login" class="btn-primary">Start building</a>
            <a href="/docs" class="btn-secondary">Read the docs</a>
          </div>
        </section>

        <section>
          <h2>A few primitives</h2>
          <div style="display:flex;flex-direction:column;gap:16px;margin-top:32px">
            <div style="display:flex;gap:20px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:24px">
              <div style="flex-shrink:0;width:40px;height:40px;border-radius:50%;background:rgba(217,119,6,0.1);border:1px solid rgba(217,119,6,0.2);color:var(--accent);display:flex;align-items:center;justify-content:center;font-family:var(--font-display);font-weight:700;font-size:0.875rem">1</div>
              <div>
                <h3 style="font-size:1rem;font-weight:600;margin-bottom:4px">Developers register apps</h3>
                <p style="margin:0;font-size:0.875rem">Create an OAuth app in Developer Settings to get a client ID and secret. Add the infer0 OAuth flow to your app. Use the OpenAI SDK. infer0 translates responses from any provider into OpenAI format automatically.</p>
              </div>
            </div>
            <div style="display:flex;gap:20px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:24px">
              <div style="flex-shrink:0;width:40px;height:40px;border-radius:50%;background:rgba(217,119,6,0.1);border:1px solid rgba(217,119,6,0.2);color:var(--accent);display:flex;align-items:center;justify-content:center;font-family:var(--font-display);font-weight:700;font-size:0.875rem">2</div>
              <div>
                <h3 style="font-size:1rem;font-weight:600;margin-bottom:4px">Users add AI Providers</h3>
                <p style="margin:0;font-size:0.875rem">Each user connects their OpenAI, Anthropic, or Google API key. Keys are encrypted with AES-256-GCM and stored securely. Users can set a per-provider daily spend limit to control costs.</p>
              </div>
            </div>
            <div style="display:flex;gap:20px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:24px">
              <div style="flex-shrink:0;width:40px;height:40px;border-radius:50%;background:rgba(217,119,6,0.1);border:1px solid rgba(217,119,6,0.2);color:var(--accent);display:flex;align-items:center;justify-content:center;font-family:var(--font-display);font-weight:700;font-size:0.875rem">3</div>
              <div>
                <h3 style="font-size:1rem;font-weight:600;margin-bottom:4px">Users authorize apps</h3>
                <p style="margin:0;font-size:0.875rem">During the OAuth flow, each user chooses which AI Provider the app may use. They can change the assigned provider or set a per-authorization daily spend limit later from their Authorizations page.</p>
              </div>
            </div>
            <div style="display:flex;gap:20px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:24px">
              <div style="flex-shrink:0;width:40px;height:40px;border-radius:50%;background:rgba(217,119,6,0.1);border:1px solid rgba(217,119,6,0.2);color:var(--accent);display:flex;align-items:center;justify-content:center;font-family:var(--font-display);font-weight:700;font-size:0.875rem">4</div>
              <div>
                <h3 style="font-size:1rem;font-weight:600;margin-bottom:4px">Apps route through infer0</h3>
                <p style="margin:0;font-size:0.875rem">Your app passes the user's access token to <code>/v1/chat/completions</code> using the OpenAI SDK. infer0 looks up their AI Provider, checks spend limits, forwards the request, translates the response, and returns it in OpenAI format.</p>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2>For developers</h2>
          <div class="grid">
            <div class="card">
              <div style="font-size:1.5rem;margin-bottom:12px;font-family:var(--font-display);color:var(--accent);font-weight:700">//</div>
              <h3>OpenAI Chat format</h3>
              <p>Use the OpenAI SDK your codebase already has. infer0 translates responses from any provider into OpenAI format. No provider-specific routing logic needed.</p>
            </div>
            <div class="card">
              <div style="font-size:1.5rem;margin-bottom:12px;font-family:var(--font-display);color:var(--accent);font-weight:700">/**</div>
              <h3>Zero key management</h3>
              <p>Provider API keys are encrypted with AES-256-GCM and never exposed to your app. You don't store, handle, or even see them.</p>
            </div>
            <div class="card">
              <div style="font-size:1.5rem;margin-bottom:12px;font-family:var(--font-display);color:var(--accent);font-weight:700">*/</div>
              <h3>Built for streaming</h3>
              <p>All cross-format streaming is handled server-side. Your client always receives OpenAI SSE chunks regardless of the upstream provider.</p>
            </div>
          </div>
        </section>

        <section>
          <h2>For end users</h2>
          <div class="grid">
            <div class="card">
              <div style="font-size:1.5rem;margin-bottom:12px;color:var(--accent)">&#x25B3;</div>
              <h3>AI Providers, your way</h3>
              <p>Connect your OpenAI, Anthropic, or Google API key. Switch which provider each authorized app uses. Set daily spend limits per provider to stay within budget.</p>
            </div>
            <div class="card">
              <div style="font-size:1.5rem;margin-bottom:12px;color:var(--accent)">&#x25B3;</div>
              <h3>Authorizations, per app</h3>
              <p>Each authorized app gets its own provider assignment and daily spend limit. Change these anytime from your Authorizations page. Pause or revoke an app in one click.</p>
            </div>
            <div class="card">
              <div style="font-size:1.5rem;margin-bottom:12px;color:var(--accent)">&#x25B3;</div>
              <h3>Full control</h3>
              <p>Add, remove, or switch providers anytime. Set daily spend limits per authorization and per provider. Revoke any app's access instantly from your dashboard.</p>
            </div>
          </div>
        </section>

        <section style="text-align:center">
          <h2 style="display:inline-block">Early projects using infer0</h2>
          <p style="max-width:600px;margin:24px auto 0">
            infer0 is in early development. If you are building something with it,
            <a href="mailto:hi@infer0.com" style="color:var(--accent);text-decoration:none;font-weight:600">tell us about it</a>
            and we will feature your project here.
          </p>
        </section>

        <section>
          <h2>Security &amp; privacy</h2>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;margin-top:32px">
            <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:24px">
              <h3 style="font-size:0.875rem;font-weight:600;margin-bottom:6px">Prompts stay private</h3>
              <p style="margin:0;font-size:0.8125rem">infer0 does not log or store prompt or completion content. Metadata for rate limiting is retained, but message bodies are never written to disk.</p>
            </div>
            <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:24px">
              <h3 style="font-size:0.875rem;font-weight:600;margin-bottom:6px">Encrypted credentials</h3>
              <p style="margin:0;font-size:0.8125rem">Provider API keys use AES-256-GCM before storage. Tokens are hashed. Encryption keys live in Cloudflare's secure infrastructure, separate from the database.</p>
            </div>
            <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:24px">
              <h3 style="font-size:0.875rem;font-weight:600;margin-bottom:6px">Staff cannot read keys</h3>
              <p style="margin:0;font-size:0.8125rem">Encrypted data cannot be read by infer0 staff. The encryption keys are stored in Cloudflare's secure infrastructure, separate from the database.</p>
            </div>
            <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:24px">
              <h3 style="font-size:0.875rem;font-weight:600;margin-bottom:6px">Revoke anytime</h3>
              <p style="margin:0;font-size:0.8125rem">Users can revoke any app's access from their Authorizations page. Revoking immediately invalidates all associated tokens and blocks further requests.</p>
            </div>
            <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:24px">
              <h3 style="font-size:0.875rem;font-weight:600;margin-bottom:6px">Data retention</h3>
              <p style="margin:0;font-size:0.8125rem">Account profiles, encrypted provider configs, and OAuth authorization records are retained. Users can delete providers and revoke authorizations at any time.</p>
            </div>
            <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:24px">
              <h3 style="font-size:0.875rem;font-weight:600;margin-bottom:6px">If infer0 is unavailable</h3>
              <p style="margin:0;font-size:0.8125rem">User API keys with their AI provider remain valid and unaffected. App requests to infer0 will fail until service resumes. Handle this gracefully in your app.</p>
            </div>
          </div>
        </section>
      </div>
    `,
  });
}
