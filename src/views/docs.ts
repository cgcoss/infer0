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
        <h1>infer0 for Developers</h1>
        <p>
          Let your users bring their own AI provider. infer0 handles the OAuth flow so each user
          connects their own API key. You call a single endpoint.
        </p>

        <h2>How it works</h2>
        <div class="flow">
          <div class="flow-step">
            <div class="num">1</div>
            <p>Your app redirects user<br />to infer0 to authorize</p>
          </div>
          <span class="flow-arrow">→</span>
          <div class="flow-step">
            <div class="num">2</div>
            <p>User picks their<br />provider &amp; approves</p>
          </div>
          <span class="flow-arrow">→</span>
          <div class="flow-step">
            <div class="num">3</div>
            <p>Your app receives<br />an access token</p>
          </div>
          <span class="flow-arrow">→</span>
          <div class="flow-step">
            <div class="num">4</div>
            <p>Call infer0 for inference<br />or user info (SSO)</p>
          </div>
        </div>

        <h2>1. Register your app</h2>
        <p>
          <a href="/login" style="color:var(--accent)">Sign in</a> to infer0 and register
          <a href="/dev/apps" style="color:var(--accent)">OAuth Apps</a>.
          You'll get a <strong>client_id</strong> and <strong>client_secret</strong>.
          The redirect URI must match your app's callback exactly, including protocol, hostname,
          and path.
        </p>

        <h2>2. Authorization redirect</h2>
        <div class="endpoint">
          <h3><span class="method get">GET</span><span class="path">/oauth/authorize</span></h3>
          <p>Redirect the user to infer0's authorization endpoint to start the OAuth flow.</p>
          <pre><code>https://infer0.com/oauth/authorize?client_id=&lt;client_id&gt;&redirect_uri=&lt;callback_url&gt;&response_type=code</code></pre>
          <p>The user signs in (if needed), selects a provider, and approves the request.
          infer0 redirects back to your callback with a <code>code</code> parameter.</p>
        </div>

        <h2>3. Exchange code for tokens</h2>
        <div class="endpoint">
          <h3><span class="method post">POST</span><span class="path">/v1/oauth/token</span></h3>
          <p>Trade the authorization code for an access token and refresh token.</p>
          <pre><code>POST https://infer0.com/v1/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&code=&lt;code&gt;&client_id=&lt;client_id&gt;&client_secret=&lt;client_secret&gt;&redirect_uri=&lt;redirect_uri&gt;</code></pre>
          <p>Returns an <code>access_token</code> (expires in 1 hour) and <code>refresh_token</code>
          (expires in 30 days). The access token works for both inference and fetching user info.</p>
        </div>

        <h2>4. Inference</h2>

        <p>Use the access token to call the OpenAI-compatible chat completions endpoint. infer0 routes the request to the user's configured provider and model automatically. You have two options:</p>

        <div class="endpoint">
          <h3><span class="method post">POST</span><span class="path">/v1/chat/completions</span></h3>

          <p><strong>Option 1: Raw HTTP request</strong> — works with any HTTP client or programming language.</p>
          <pre><code>curl https://infer0.com/v1/chat/completions \\
  -H "Authorization: Bearer &lt;access_token&gt;" \\
  -H "Content-Type: application/json" \\
  -d '{
    "messages": [{ "role": "user", "content": "Hello" }]
  }'</code></pre>

          <p style="margin-top:24px"><strong>Option 2: OpenAI SDK</strong> — use the official <code>openai</code> package by pointing <code>baseURL</code> to infer0 and passing the access token as the <code>apiKey</code>.</p>
          <pre><code>import OpenAI from "openai";

const accessToken = "&lt;access_token&gt;";

const client = new OpenAI({
  baseURL: "https://infer0.com/v1",
  apiKey: accessToken,
});

const chat = await client.chat.completions.create({
  model: "ignored",
  messages: [{ role: "user", content: "Hello" }],
});</code></pre>
          <p style="font-size:0.8125rem;color:var(--text-muted)">The <code>model</code> field is ignored. infer0 uses the model your user has configured on their end.</p>
        </div>

        <h2>5. Login / SSO (optional)</h2>
        <p>The same access token doubles as an identity token. Use the userinfo endpoint to get the user's profile:</p>

        <div class="endpoint">
          <h3><span class="method get">GET</span><span class="path">/v1/userinfo</span></h3>
          <pre><code>curl https://infer0.com/v1/userinfo \\
  -H "Authorization: Bearer &lt;access_token&gt;"

{
  "sub": "user-uuid",
  "email": "user@example.com",
  "name": "User Name",
  "picture": "https://..."
}</code></pre>
        </div>
        <p>Use this to look up or create users in your own database when they sign in with infer0. No extra setup is needed. The same OAuth flow gives you the token and the user profile.</p>

        <h2>6. Refreshing the access token</h2>
        <div class="endpoint">
          <h3><span class="method post">POST</span><span class="path">/v1/oauth/refresh</span></h3>
          <p>Access tokens expire after 1 hour. Use the refresh token to get a new one without asking the user to re-authorize. Refresh tokens are single-use. Each response includes a new <code>refresh_token</code>.</p>
          <pre><code>POST https://infer0.com/v1/oauth/refresh
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token&refresh_token=&lt;refresh_token&gt;&client_id=&lt;client_id&gt;&client_secret=&lt;client_secret&gt;</code></pre>
        </div>

        <h2>7. Managing provider configs</h2>
        <p>
          Your end users manage their own provider keys through
          <a href="/providers" style="color:var(--accent)">AI Providers</a>.
          They can add, remove, or switch providers at any time. Your app doesn't need to change
          anything. You never see or handle their API keys.
        </p>

      </div>
    `,
  });
}
