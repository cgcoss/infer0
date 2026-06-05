import { html } from "hono/html";
import { Layout } from "./layout";

interface FaqViewProps {
  user?: { name: string | null; email: string; avatar_url: string | null } | null;
}

export function FaqView({ user }: FaqViewProps) {
  return Layout({
    title: "FAQ",
    user,
    children: html`
      <div class="container">
        <h1 style="font-size:2.5rem;margin-bottom:8px">Frequently asked questions</h1>
        <p style="max-width:500px">Answers to common questions about infer0's approach to inference routing.</p>

        <div style="display:flex;flex-direction:column;gap:16px;margin-top:48px">

          <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:24px">
            <div style="display:flex;gap:16px">
              <div style="flex-shrink:0;font-family:var(--font-display);color:var(--accent);font-weight:700">?</div>
              <div>
                <h2 style="font-size:1rem;font-weight:600;margin-bottom:6px;font-family:var(--font-body)">Why not ask users to paste API keys directly?</h2>
                <p style="margin:0;font-size:0.875rem;color:var(--text-muted)">Pasting API keys into third-party apps is a security risk. OAuth lets users authorize your app without ever sharing their key with you. Keys stay encrypted inside infer0 and are never visible to developers.</p>
              </div>
            </div>
          </div>

          <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:24px">
            <div style="display:flex;gap:16px">
              <div style="flex-shrink:0;font-family:var(--font-display);color:var(--accent);font-weight:700">?</div>
              <div>
                <h2 style="font-size:1rem;font-weight:600;margin-bottom:6px;font-family:var(--font-body)">Does infer0 store prompts?</h2>
                <p style="margin:0;font-size:0.875rem;color:var(--text-muted)">No. Prompts and completions pass through infer0 in memory and are forwarded to the user's AI provider. They are never written to disk or logged. Metadata such as timestamps and token counts may be retained for rate limiting but message bodies are never stored.</p>
              </div>
            </div>
          </div>

          <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:24px">
            <div style="display:flex;gap:16px">
              <div style="flex-shrink:0;font-family:var(--font-display);color:var(--accent);font-weight:700">?</div>
              <div>
                <h2 style="font-size:1rem;font-weight:600;margin-bottom:6px;font-family:var(--font-body)">Who pays the AI provider bill?</h2>
                <p style="margin:0;font-size:0.875rem;color:var(--text-muted)">Each user pays their own AI provider (OpenAI, Anthropic, Google, etc.) directly. Your app never handles billing or API costs. You only need to handle your own hosting costs.</p>
              </div>
            </div>
          </div>

          <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:24px">
            <div style="display:flex;gap:16px">
              <div style="flex-shrink:0;font-family:var(--font-display);color:var(--accent);font-weight:700">?</div>
              <div>
                <h2 style="font-size:1rem;font-weight:600;margin-bottom:6px;font-family:var(--font-body)">Can users choose OpenAI, Anthropic, or Gemini?</h2>
                <p style="margin:0;font-size:0.875rem;color:var(--text-muted)">Yes. Users add their own provider and model from <a href="/providers" style="color:var(--accent);font-weight:600">AI Providers</a>. They can switch at any time. The developer's app calls infer0's API and it routes to whatever the user has configured.</p>
              </div>
            </div>
          </div>

          <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:24px">
            <div style="display:flex;gap:16px">
              <div style="flex-shrink:0;font-family:var(--font-display);color:var(--accent);font-weight:700">?</div>
              <div>
                <h2 style="font-size:1rem;font-weight:600;margin-bottom:6px;font-family:var(--font-body)">Can developers restrict providers or models?</h2>
                <p style="margin:0;font-size:0.875rem;color:var(--text-muted)">Not currently. The user's configured provider and model are used for every request. If your app requires a specific model, infer0's routing approach may not be the right fit. This may change in the future.</p>
              </div>
            </div>
          </div>

          <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:24px">
            <div style="display:flex;gap:16px">
              <div style="flex-shrink:0;font-family:var(--font-display);color:var(--accent);font-weight:700">?</div>
              <div>
                <h2 style="font-size:1rem;font-weight:600;margin-bottom:6px;font-family:var(--font-body)">What happens if a user disconnects their provider?</h2>
                <p style="margin:0;font-size:0.875rem;color:var(--text-muted)">Inference requests for that user will return a <code>no_provider</code> error. The user can reconnect a provider from <a href="/providers" style="color:var(--accent);font-weight:600">AI Providers</a> at any time. Their authorizations for your app remain intact.</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    `,
  });
}
