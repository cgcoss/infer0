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
          infer0 lets your app offer BYO-provider AI inference via OAuth 2.0. Each of your end users
          connects their own provider account (OpenAI, Anthropic, etc.), and you call a single API.
          You can also use infer0 as a login provider — the same OAuth flow gives you the user's
          profile via the userinfo endpoint.
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
          <a href="/login" style="color:var(--accent)">Sign in</a> to the infer0 dashboard and
          register your OAuth app at <a href="/dev/apps" style="color:var(--accent)">/dev/apps</a>.
          You'll get a <strong>client_id</strong> and <strong>client_secret</strong>.
        </p>

        <h2>2. Authorization redirect</h2>
        <p>Send the user to infer0's authorization endpoint:</p>
        <pre><code>GET https://infer0.com/oauth/authorize?client_id=&lt;client_id&gt;&redirect_uri=&lt;callback_url&gt;&response_type=code</code></pre>
        <p>The user signs in (if needed), selects which provider to use, and approves the request.
        infer0 redirects back to your callback with a <code>code</code> parameter.</p>

        <h2>3. Exchange code for tokens</h2>
        <pre><code>POST https://infer0.com/v1/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
  &code=&lt;code&gt;
  &client_id=&lt;client_id&gt;
  &client_secret=&lt;client_secret&gt;
  &redirect_uri=&lt;callback_url&gt;</code></pre>
          <p>Returns <code>access_token</code> (1 hour) and <code>refresh_token</code> (30 days). The access token can be used for both inference <em>and</em> identifying the user.</p>

        <h2>4. Inference</h2>

        <div class="endpoint">
          <h3><span class="method post">POST</span><span class="path">/v1/chat/completions</span></h3>
          <p>OpenAI-compatible chat completions. Routes to the end user's configured provider and model automatically.</p>
          <pre><code>curl https://infer0.com/v1/chat/completions \\
  -H "Authorization: Bearer &lt;access_token&gt;" \\
  -H "Content-Type: application/json" \\
  -d '{
    "messages": [{ "role": "user", "content": "Hello" }]
  }'</code></pre>
          <pre><code>import OpenAI from "openai";

const accessToken = "&lt;access_token&gt;";

const client = new OpenAI({
  baseURL: "https://infer0.com/v1",
  apiKey: accessToken,
});

const chat = await client.chat.completions.create({
  model: "(ignored — uses user's configured model)",
  messages: [{ role: "user", content: "Hello" }],
});</code></pre>
        </div>

        <h2>Login / SSO (optional)</h2>
        <p>The access token also acts as an identity token. Call the userinfo endpoint to get the user's profile:</p>

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
        <p>Use this to look up or create a user in your own database when they sign in with infer0. You only need the OAuth access token — no extra API keys required.</p>

        <h2>Refreshing the access token</h2>
        <pre><code>POST https://infer0.com/v1/oauth/refresh
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token
  &refresh_token=&lt;refresh_token&gt;
  &client_id=&lt;client_id&gt;
  &client_secret=&lt;client_secret&gt;</code></pre>

        <h2>Managing provider configs</h2>
        <p>
          Your end users manage their own provider keys through the
          <a href="/providers" style="color:var(--accent)">infer0 dashboard</a>.
          Your app never sees or handles their API keys.
        </p>
      </div>
    `,
  });
}
