import { html } from "hono/html";
import { Layout } from "./layout";

interface QuickstartViewProps {
  user?: { name: string | null; email: string; avatar_url: string | null } | null;
}

export function QuickstartView({ user }: QuickstartViewProps) {
  return Layout({
    title: "Quickstart",
    user,
    children: html`
      <div class="container">
        <h1 style="font-size:2.5rem;margin-bottom:8px">Build a chat app in 5 minutes</h1>
        <p style="max-width:600px">Get up and running with infer0. Pick the API format that fits your stack: OpenAI Chat Completions, Anthropic Messages, or OpenAI Responses. infer0 translates behind the scenes.</p>

        <section>
          <h2>Prerequisites</h2>
          <ul style="margin-bottom:0;padding-left:20px;font-size:0.9375rem;color:var(--text-muted);line-height:2">
            <li>Node.js 18+ installed</li>
            <li>A terminal and your favorite editor</li>
          </ul>
        </section>

        <section>
          <h2>Step 1: Create your project</h2>
          <pre><code class="language-bash">mkdir infer0-chat
cd infer0-chat
npm init -y
npm install openai express</code></pre>
        </section>

        <section>
          <h2>Step 2: Sign in and register an OAuth app</h2>
          <p>
            Go to <a href="/login" style="color:var(--accent);font-weight:600">infer0.com</a> and sign in with Google or GitHub.
            Then go to <a href="/dev/apps" style="color:var(--accent);font-weight:600">OAuth Apps</a> and create a new app.
            Set the redirect URI to <code>http://localhost:3000/callback</code>.
            Copy your <strong>client_id</strong> and <strong>client_secret</strong>.
          </p>
        </section>

        <section>
          <h2>Step 3: Set environment variables</h2>
          <pre><code class="language-bash">export CLIENT_ID="your-client-id"
export CLIENT_SECRET="your-client-secret"
export REDIRECT_URI="http://localhost:3000/callback"
export PORT=3000</code></pre>
        </section>

        <section>
          <h2>Step 4: Create the server</h2>
          <p>Save this as <code>server.mjs</code>:</p>
          <pre><code class="language-javascript">import express from "express";
import OpenAI from "openai";

const app = express();
const PORT = process.env.PORT;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

app.use(express.json());

const tokens = {};

// Step 4a: Redirect user to infer0 to authorize
app.get("/login", (req, res) => {
  const url = "https://infer0.com/oauth/authorize?client_id=" + CLIENT_ID + "&redirect_uri=" + REDIRECT_URI + "&response_type=code";
  res.redirect(url);
});

// Step 4b: OAuth callback - exchange code for tokens
app.get("/callback", async (req, res) => {
  const { code } = req.query;

  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code: code,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: REDIRECT_URI,
  });

  const tokenRes = await fetch("https://infer0.com/v1/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });

  const data = await tokenRes.json();
  tokens.access = data.access_token;
  tokens.refresh = data.refresh_token;
  res.send("Authorized! You can close this tab and use the chat.");
});

// Step 4c: Non-streaming chat
app.get("/chat", async (req, res) => {
  if (!tokens.access) return res.redirect("/login");

  const client = new OpenAI({
    baseURL: "https://infer0.com/v1",
    apiKey: tokens.access,
  });

  const chat = await client.chat.completions.create({
    model: "ignored",
    messages: [{ role: "user", content: req.query.q || "Hello" }],
  });

  res.json(chat);
});

app.listen(PORT, () => console.log("Server running on http://localhost:" + PORT));</code></pre>
          <p style="font-size:0.8125rem;color:var(--text-muted)">The <code>model</code> field is ignored. infer0 uses the model your user has configured.</p>
        </section>

        <section>
          <h2>Step 5: Run it</h2>
          <pre><code class="language-bash">node server.mjs</code></pre>
          <ol style="font-size:0.9375rem;margin-bottom:0;padding-left:20px;color:var(--text-muted);line-height:2">
            <li>Open <code>http://localhost:3000/login</code> and authorize your app.</li>
            <li>Visit <code>http://localhost:3000/chat?q=What+is+the+capital+of+France</code> to see a non-streaming response.</li>
          </ol>
        </section>

        <section>
          <h2>Expected output</h2>
          <pre><code class="language-json">{
  "id": "chatcmpl-...",
  "object": "chat.completion",
  "created": 1717000000,
  "model": "gpt-4o-mini",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "The capital of France is Paris."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 14,
    "completion_tokens": 7,
    "total_tokens": 21
  }
}</code></pre>
        </section>

        <section>
          <h2>Troubleshooting</h2>
          <table>
            <tr>
              <th>Issue</th>
              <th>Fix</th>
            </tr>
            <tr>
              <td><code>redirect_uri_mismatch</code></td>
              <td>Make sure the redirect URI in your OAuth App settings matches <code>http://localhost:3000/callback</code> exactly.</td>
            </tr>
            <tr>
              <td><code>invalid_client</code></td>
              <td>Double-check your <code>CLIENT_ID</code> and <code>CLIENT_SECRET</code> environment variables.</td>
            </tr>
            <tr>
              <td><code>invalid_grant</code></td>
              <td>The auth code expired (10 min). Go through <code>/login</code> again to get a fresh code.</td>
            </tr>
            <tr>
              <td><code>No provider configured</code></td>
              <td>The user hasn't added an AI provider yet. Have them visit <code>https://infer0.com/providers</code> to add one.</td>
            </tr>
            <tr>
              <td><code>Provider error</code> with 401</td>
              <td>The user's provider API key is expired or invalid. They need to update it on AI Providers.</td>
            </tr>
            <tr>
              <td><code>Module not found: openai</code></td>
              <td>Run <code>npm install openai</code> and make sure <code>package.json</code> exists.</td>
            </tr>
          </table>
        </section>
      </div>
    `,
  });
}
