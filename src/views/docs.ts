import { html } from "hono/html";
import { Layout } from "./layout";

interface DocsViewProps {
  user?: { name: string | null; email: string; avatar_url: string | null } | null;
}

export function DocsView({ user }: DocsViewProps) {
  return Layout({
    title: "Docs",
    user,
    children: html`
      <div class="container">
        <div style="max-width:640px">
          <h1 style="font-size:2.5rem;margin-bottom:8px">infer0 for developers</h1>
          <p style="font-size:1.0625rem">
            Let your users bring their own AI provider. infer0 handles the OAuth flow so each user
            connects their own API key. You call a single API in the SDK format you prefer.
          </p>
        </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin:48px 0;padding:24px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius)">
            <div style="text-align:center"><span style="display:block;font-family:var(--font-display);font-size:1.5rem;font-weight:800;color:var(--accent)">01</span><span style="font-size:0.75rem;color:var(--text-muted)">Register app</span></div>
            <div style="text-align:center"><span style="display:block;font-family:var(--font-display);font-size:1.5rem;font-weight:800;color:var(--accent)">02</span><span style="font-size:0.75rem;color:var(--text-muted)">Auth redirect</span></div>
            <div style="text-align:center"><span style="display:block;font-family:var(--font-display);font-size:1.5rem;font-weight:800;color:var(--accent)">03</span><span style="font-size:0.75rem;color:var(--text-muted)">Exchange code</span></div>
            <div style="text-align:center"><span style="display:block;font-family:var(--font-display);font-size:1.5rem;font-weight:800;color:var(--accent)">04</span><span style="font-size:0.75rem;color:var(--text-muted)">Inference</span></div>
          </div>

        <section>
          <h2>1. Register your app</h2>
          <p>
            <a href="/login" style="color:var(--accent);font-weight:600">Sign in</a> to infer0 and register
            <a href="/dev/apps" style="color:var(--accent);font-weight:600">OAuth Apps</a>.
            You'll get a <strong>client_id</strong> and <strong>client_secret</strong>.
            The redirect URI must match your app's callback exactly, including protocol, hostname,
            and path.
          </p>
        </section>

        <section>
          <h2>2. Authorization redirect</h2>
          <div class="endpoint">
            <h3><span class="method get">GET</span><span class="path">/oauth/authorize</span></h3>
            <p>Redirect the user to infer0's authorization endpoint to start the OAuth flow.</p>
            <pre><code class="language-http">https://infer0.com/oauth/authorize?client_id=&lt;client_id&gt;&redirect_uri=&lt;callback_url&gt;&response_type=code</code></pre>
            <p>The user signs in (if needed), selects a provider, and approves the request.
            infer0 redirects back to your callback with a <code>code</code> parameter.</p>
          </div>
        </section>

        <section>
          <h2>3. Exchange code for tokens</h2>
          <div class="endpoint">
            <h3><span class="method post">POST</span><span class="path">/v1/oauth/token</span></h3>
            <p>Trade the authorization code for an access token and refresh token.</p>
            <pre><code class="language-http">POST https://infer0.com/v1/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&code=&lt;code&gt;&client_id=&lt;client_id&gt;&client_secret=&lt;client_secret&gt;&redirect_uri=&lt;redirect_uri&gt;</code></pre>

            <pre><code class="language-json">HTTP 200

{
  "access_token": "infer0_at_xxx",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "infer0_rt_xxx",
  "scope": "inference userinfo"
}</code></pre>
            <p>The <code>access_token</code> expires in 1 hour. The <code>refresh_token</code>
            expires in 30 days and is single-use. The access token works for the inference endpoint and for fetching user info.</p>
          </div>
        </section>

        <section>
          <h2>4. Inference</h2>

          <p>Use the access token to call infer0's API. infer0 routes the request to the user's configured provider and model automatically. Send your request in OpenAI Chat Completions format. infer0 translates the response from the upstream provider back to OpenAI format, regardless of which provider handles it.</p>

          <div class="endpoint">
            <h3><span class="method post">POST</span><span class="path">/v1/chat/completions</span></h3>
            <p style="margin:0 0 12px 0">OpenAI Chat Completions format.</p>

            <pre><code class="language-http">POST https://infer0.com/v1/chat/completions
Authorization: Bearer &lt;access_token&gt;
Content-Type: application/json

{
  "messages": [
    { "role": "user", "content": "Hello" }
  ]
}</code></pre>

            <pre><code class="language-json">HTTP 200

{
  "id": "chatcmpl-xxx",
  "object": "chat.completion",
  "created": 1718000000,
  "model": "gpt-4o-mini",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! How can I help you today?"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 9,
    "total_tokens": 19
  }
}</code></pre>

            <p style="font-size:0.8125rem;color:var(--text-muted);margin:0 0 8px 0">or with the OpenAI SDK:</p>
            <pre><code class="language-javascript">import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://infer0.com/v1",
  apiKey: "&lt;access_token&gt;",
});

const chat = await client.chat.completions.create({
  messages: [{ role: "user", content: "Hello" }],
});</code></pre>
          </div>
        </section>

        <section>
          <h2>5. Parameters</h2>

          <p>For cross-provider compatibility, only these request parameters are accepted. All other parameters (<code>temperature</code>, <code>top_p</code>, <code>max_tokens</code>, <code>tools</code>, <code>response_format</code>, etc.) are silently ignored.</p>

          <table style="width:100%;border-collapse:collapse;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;margin:24px 0">
            <tr>
              <th style="text-align:left;padding:12px 16px;font-size:0.75rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-muted);border-bottom:1px solid var(--border)">Parameter</th>
              <th style="text-align:left;padding:12px 16px;font-size:0.75rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-muted);border-bottom:1px solid var(--border)">Endpoints</th>
              <th style="text-align:left;padding:12px 16px;font-size:0.75rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-muted);border-bottom:1px solid var(--border)">Description</th>
            </tr>
            <tr>
              <td style="padding:12px 16px;border-bottom:1px solid var(--border);font-family:var(--font-mono,monospace);font-size:0.8125rem"><code>messages</code></td>
              <td style="padding:12px 16px;border-bottom:1px solid var(--border);font-size:0.875rem"><code>/v1/chat/completions</code></td>
              <td style="padding:12px 16px;border-bottom:1px solid var(--border);font-size:0.875rem;color:var(--text-muted)">Array of message objects with <code>role</code> and <code>content</code>.</td>
            </tr>
            <tr>
              <td style="padding:12px 16px;border-bottom:1px solid var(--border);font-family:var(--font-mono,monospace);font-size:0.8125rem"><code>model</code></td>
              <td style="padding:12px 16px;border-bottom:1px solid var(--border);font-size:0.875rem">All</td>
              <td style="padding:12px 16px;border-bottom:1px solid var(--border);font-size:0.875rem;color:var(--text-muted)">Accepted but ignored. The user's configured model is always used.</td>
            </tr>
            <tr>
              <td style="padding:12px 16px;font-family:var(--font-mono,monospace);font-size:0.8125rem"><code>stream</code></td>
              <td style="padding:12px 16px;font-size:0.875rem">All</td>
              <td style="padding:12px 16px;font-size:0.875rem;color:var(--text-muted)">Set to <code>true</code> to receive a server-sent event stream. Defaults to <code>false</code>.</td>
            </tr>
          </table>
        </section>

        <section>
          <h2>6. How model selection works</h2>

          <p>Your app always uses the OpenAI Chat Completions format. The <code>model</code> field value you send is ignored. The actual model is determined by each user's provider configuration, not by your app.</p>

          <h3 style="font-size:1rem;font-weight:600;margin-bottom:8px">Requested vs actual model</h3>

          <pre><code class="language-plaintext">// Your app always sends the same request:
POST /v1/chat/completions
{ "model": "ignored", "messages": [...] }

// User A has OpenAI / gpt-4o-mini
// infer0 routes to: OpenAI gpt-4o-mini

// User B has Anthropic / claude-sonnet-4-20250514
// infer0 routes to: Anthropic claude-sonnet-4-20250514

// User C has Google / gemini-2.5-pro
// infer0 routes to: Google gemini-2.5-pro</code></pre>

          <p>The <code>model</code> field in your request acts as a placeholder. infer0 replaces it with the user's configured model before forwarding to the upstream provider.</p>

          <h3 style="font-size:1rem;font-weight:600;margin-bottom:8px">Tradeoffs</h3>

          <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:20px;margin-bottom:12px">
            <h4 style="font-size:0.875rem;font-weight:600;margin-bottom:4px">User control (by design)</h4>
            <p style="margin:0;font-size:0.875rem;color:var(--text-muted)">Each user chooses their own provider and model. Your app doesn't need to know or care. This means different users may get different results from the same request, which is the intended behavior for a BYO-provider app.</p>
          </div>

          <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:20px;margin-bottom:12px">
            <h4 style="font-size:0.875rem;font-weight:600;margin-bottom:4px">Reproducibility</h4>
            <p style="margin:0;font-size:0.875rem;color:var(--text-muted)">The same request can produce different results across users because each may be using a different provider or model. If your app needs deterministic model behavior, consider whether a BYO-provider approach fits your use case.</p>
          </div>

          <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:20px;margin-bottom:12px">
            <h4 style="font-size:0.875rem;font-weight:600;margin-bottom:4px">Debugging</h4>
            <p style="margin:0;font-size:0.875rem;color:var(--text-muted)">When a user reports an issue, you'll need to know which provider and model they're using. Ask them to check their AI Providers page. The resolved model is not currently returned in the API response.</p>
          </div>

          <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:20px;margin-bottom:12px">
            <h4 style="font-size:0.875rem;font-weight:600;margin-bottom:4px">Developer constraints</h4>
            <p style="margin:0;font-size:0.875rem;color:var(--text-muted)">You cannot pin a specific model version across all users. If your app requires a particular model or provider to function correctly, infer0's routing model may not be the right fit.</p>
          </div>
        </section>

        <section>
          <h2>7. Errors and edge cases</h2>

          <p>infer0 returns JSON error responses with a consistent structure. Your app should handle these cases gracefully.</p>

          <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:20px;margin-bottom:12px">
            <h4 style="font-size:0.875rem;font-weight:600;margin-bottom:4px">No provider configured</h4>
            <p style="margin:0;font-size:0.875rem;color:var(--text-muted);margin-bottom:8px">The user signed in and authorized your app but has not connected an AI provider. Your app cannot make inference requests until the user adds a provider.</p>
            <pre style="font-size:0.8125rem;margin:0"><code class="language-json">HTTP 400
{
  "error": {
    "message": "No provider configured",
    "code": "no_provider"
  }
}</code></pre>
            <p style="margin:8px 0 0;font-size:0.8125rem;color:var(--text-muted)"><strong>Recommended:</strong> Ask the user to add a provider on infer0's AI Providers page. You can redirect them to <code>https://infer0.com/providers</code> or let them retry after configuring one.</p>
          </div>

          <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:20px;margin-bottom:12px">
            <h4 style="font-size:0.875rem;font-weight:600;margin-bottom:4px">Authorization revoked</h4>
            <p style="margin:0;font-size:0.875rem;color:var(--text-muted);margin-bottom:8px">The user revoked your app's access from their Authorizations page. The access token is no longer valid.</p>
            <pre style="font-size:0.8125rem;margin:0"><code class="language-json">HTTP 403
{
  "error": {
    "message": "Authorization revoked or not found",
    "code": "auth_revoked"
  }
}</code></pre>
            <p style="margin:8px 0 0;font-size:0.8125rem;color:var(--text-muted)"><strong>Recommended:</strong> Prompt the user to re-authorize your app by redirecting them through the OAuth flow again.</p>
          </div>

          <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:20px;margin-bottom:12px">
            <h4 style="font-size:0.875rem;font-weight:600;margin-bottom:4px">Access token expired</h4>
            <p style="margin:0;font-size:0.875rem;color:var(--text-muted);margin-bottom:8px">Access tokens expire after 1 hour. The token is no longer accepted.</p>
            <pre style="font-size:0.8125rem;margin:0"><code class="language-json">HTTP 401
{
  "error": {
    "message": "Invalid or expired token",
    "code": "auth_error"
  }
}</code></pre>
            <p style="margin:8px 0 0;font-size:0.8125rem;color:var(--text-muted)"><strong>Recommended:</strong> Use the refresh token to get a new access token. If the refresh token is also expired or revoked, redirect the user through the full OAuth flow again.</p>
          </div>

          <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:20px;margin-bottom:12px">
            <h4 style="font-size:0.875rem;font-weight:600;margin-bottom:4px">Provider token expired</h4>
            <p style="margin:0;font-size:0.875rem;color:var(--text-muted);margin-bottom:8px">The user's provider API key is invalid or has been revoked. This is surfaced as a provider error from the upstream API.</p>
            <pre style="font-size:0.8125rem;margin:0"><code class="language-json">HTTP 401
{
  "error": {
    "message": "Provider error: 401 Unauthorized",
    "code": "provider_error"
  }
}</code></pre>
            <p style="margin:8px 0 0;font-size:0.8125rem;color:var(--text-muted)"><strong>Recommended:</strong> Ask the user to check their provider key on the AI Providers page and re-enter it if needed.</p>
          </div>

          <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:20px;margin-bottom:12px">
            <h4 style="font-size:0.875rem;font-weight:600;margin-bottom:4px">Provider quota or rate exceeded</h4>
            <p style="margin:0;font-size:0.875rem;color:var(--text-muted);margin-bottom:8px">The user's provider account has hit a rate limit or quota. The error message is forwarded from the upstream provider.</p>
            <pre style="font-size:0.8125rem;margin:0"><code class="language-json">HTTP 429
{
  "error": {
    "message": "Provider error: 429 Too Many Requests",
    "code": "provider_error"
  }
}</code></pre>
            <p style="margin:8px 0 0;font-size:0.8125rem;color:var(--text-muted)"><strong>Recommended:</strong> Implement exponential backoff and retry. If the error persists, notify the user that their provider account may need a plan upgrade.</p>
          </div>

          <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:20px;margin-bottom:12px">
            <h4 style="font-size:0.875rem;font-weight:600;margin-bottom:4px">Unsupported model or feature</h4>
            <p style="margin:0;font-size:0.875rem;color:var(--text-muted);margin-bottom:8px">The user's provider does not support a feature your app requested (e.g. a parameter the provider doesn't accept). The upstream provider returns the error.</p>
            <pre style="font-size:0.8125rem;margin:0"><code class="language-json">HTTP 400
{
  "error": {
    "message": "Provider error: 400 {'error': {'message': 'Unsupported parameter: ...'}}",
    "code": "provider_error"
  }
}</code></pre>
            <p style="margin:8px 0 0;font-size:0.8125rem;color:var(--text-muted)"><strong>Recommended:</strong> Check which provider the user has configured and adjust request parameters accordingly. Some features (like <code>response_format</code> or <code>tools</code>) are provider-specific.</p>
          </div>

          <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:20px;margin-bottom:12px">
            <h4 style="font-size:0.875rem;font-weight:600;margin-bottom:4px">infer0 service unavailable</h4>
            <p style="margin:0;font-size:0.875rem;color:var(--text-muted);margin-bottom:8px">infer0 is down or unreachable. The user's provider keys remain unaffected.</p>
            <pre style="font-size:0.8125rem;margin:0"><code class="language-json">HTTP 502 / 503 / 504
{
  "error": {
    "message": "Provider error: upstream failure",
    "code": "provider_error"
  }
}</code></pre>
            <p style="margin:8px 0 0;font-size:0.8125rem;color:var(--text-muted)"><strong>Recommended:</strong> Implement a retry with backoff. If requests continue to fail, degrade gracefully, inform the user, and avoid blocking the rest of your app.</p>
          </div>
        </section>

        <section>
          <h2>8. Login / SSO (optional)</h2>
          <p>The same access token doubles as an identity token. Use the userinfo endpoint to get the user's profile:</p>

          <div class="endpoint">
            <h3><span class="method get">GET</span><span class="path">/v1/userinfo</span></h3>
            <pre><code class="language-http">curl https://infer0.com/v1/userinfo \
  -H "Authorization: Bearer &lt;access_token&gt;"

{
  "sub": "user-uuid",
  "email": "user@example.com",
  "name": "User Name",
  "picture": "https://..."
}</code></pre>
          </div>
          <p>Use this to look up or create users in your own database when they sign in with infer0. No extra setup is needed. The same OAuth flow gives you the token and the user profile.</p>
        </section>

        <section>
          <h2>9. Refreshing the access token</h2>
          <div class="endpoint">
            <h3><span class="method post">POST</span><span class="path">/v1/oauth/refresh</span></h3>
            <p>Access tokens expire after 1 hour. Use the refresh token to get a new one without asking the user to re-authorize. Refresh tokens are single-use. Each response includes a new <code>refresh_token</code>.</p>
            <pre><code class="language-http">POST https://infer0.com/v1/oauth/refresh
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token&refresh_token=&lt;refresh_token&gt;&client_id=&lt;client_id&gt;&client_secret=&lt;client_secret&gt;</code></pre>

            <pre><code class="language-json">HTTP 200

{
  "access_token": "infer0_at_xxx",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "infer0_rt_xxx",
  "scope": "inference userinfo"
}</code></pre>
            <p style="font-size:0.8125rem;color:var(--text-muted)">The previous <code>refresh_token</code> is invalidated. Each refresh returns a new <code>refresh_token</code>.</p>
          </div>
        </section>

        <section>
          <h2>10. Managing provider configs</h2>
          <p>
            Your end users manage their own provider keys through
            <a href="/providers" style="color:var(--accent);font-weight:600">AI Providers</a>.
            They can add, remove, or switch providers at any time. Your app doesn't need to change
            anything. You never see or handle their API keys.
          </p>
        </section>

        <section>
          <h2>Security &amp; privacy</h2>

          <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:24px;margin-bottom:12px">
            <h3 style="font-size:0.9375rem;font-weight:600;margin-bottom:6px">Prompts and completions stay private.</h3>
            <p style="margin:0;font-size:0.875rem;color:var(--text-muted)">infer0 does not log or store prompt or completion content. Metadata such as timestamps and token counts may be retained for rate limiting, but message bodies are never stored.</p>
          </div>

          <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:24px;margin-bottom:12px">
            <h3 style="font-size:0.9375rem;font-weight:600;margin-bottom:6px">Credentials are encrypted.</h3>
            <p style="margin:0;font-size:0.875rem;color:var(--text-muted)">Provider API keys are encrypted with AES-256-GCM before storage. Access tokens and refresh tokens are hashed. Encryption keys are managed by Cloudflare's secure infrastructure and never exposed to the application.</p>
          </div>

          <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:24px;margin-bottom:12px">
            <h3 style="font-size:0.9375rem;font-weight:600;margin-bottom:6px">Staff cannot read your keys.</h3>
            <p style="margin:0;font-size:0.875rem;color:var(--text-muted)">Encrypted data cannot be read by infer0 staff. The encryption keys are stored in Cloudflare's secure infrastructure, separate from the database.</p>
          </div>

          <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:24px;margin-bottom:12px">
            <h3 style="font-size:0.9375rem;font-weight:600;margin-bottom:6px">Revoke access anytime.</h3>
            <p style="margin:0;font-size:0.875rem;color:var(--text-muted)">Users can revoke any app's access from their Authorizations page. Revoking immediately invalidates the associated tokens and blocks further requests. Providers can be deleted from AI Providers.</p>
          </div>

          <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:24px;margin-bottom:12px">
            <h3 style="font-size:0.9375rem;font-weight:600;margin-bottom:6px">Data retention.</h3>
            <p style="margin:0;font-size:0.875rem;color:var(--text-muted)">infer0 retains account profiles (email, name, avatar), encrypted provider configurations, and OAuth authorization records. Users can delete their providers and revoke authorizations at any time.</p>
          </div>

          <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:24px">
            <h3 style="font-size:0.9375rem;font-weight:600;margin-bottom:6px">If infer0 is unavailable.</h3>
            <p style="margin:0;font-size:0.875rem;color:var(--text-muted)">A user's API keys with their AI provider (OpenAI, Anthropic, etc.) remain valid and are unaffected. App requests to infer0 will fail until service resumes. We recommend developers handle this gracefully.</p>
          </div>
        </section>
      </div>
    `,
  });
}
