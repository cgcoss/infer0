import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

interface Env {
  INFER0_API: string;
  CLIENT_ID: string;
  CLIENT_SECRET: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/oauth/callback") {
      return handleCallback(request, env);
    }

    if (url.pathname === "/api/chat" && request.method === "POST") {
      return handleChat(request, env);
    }

    if (url.pathname === "/api/sdk-chat" && request.method === "POST") {
      return handleSdkChat(request, env);
    }

    if (url.pathname === "/api/sdk-chat/stream" && request.method === "POST") {
      return handleSdkChatStream(request, env);
    }

    if (url.pathname === "/api/anthropic-chat" && request.method === "POST") {
      return handleAnthropicChat(request, env);
    }

    if (url.pathname === "/api/anthropic-chat/stream" && request.method === "POST") {
      return handleAnthropicChatStream(request, env);
    }

    if (url.pathname === "/api/responses-chat" && request.method === "POST") {
      return handleResponsesChat(request, env);
    }

    if (url.pathname === "/api/responses-chat/stream" && request.method === "POST") {
      return handleResponsesChatStream(request, env);
    }

    if (url.pathname === "/") {
      return new Response(renderHTML(env.CLIENT_ID), { headers: { "Content-Type": "text/html" } });
    }

    if (url.pathname === "/sdk") {
      return new Response(renderSdkHTML(env.CLIENT_ID), { headers: { "Content-Type": "text/html" } });
    }

    if (url.pathname === "/sdk/stream") {
      return new Response(renderSdkStreamHTML(env.CLIENT_ID), { headers: { "Content-Type": "text/html" } });
    }

    if (url.pathname === "/anthropic-sdk") {
      return new Response(renderAnthropicHTML(env.CLIENT_ID), { headers: { "Content-Type": "text/html" } });
    }

    if (url.pathname === "/anthropic-sdk/stream") {
      return new Response(renderAnthropicStreamHTML(env.CLIENT_ID), { headers: { "Content-Type": "text/html" } });
    }

    if (url.pathname === "/responses-sdk") {
      return new Response(renderResponsesHTML(env.CLIENT_ID), { headers: { "Content-Type": "text/html" } });
    }

    if (url.pathname === "/responses-sdk/stream") {
      return new Response(renderResponsesStreamHTML(env.CLIENT_ID), { headers: { "Content-Type": "text/html" } });
    }

    return new Response("Not found", { status: 404 });
  },
};

async function handleCallback(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");

    if (error) {
      return new Response(`Authorization error: ${error}`, { status: 400 });
    }

    if (!code) {
      return new Response("Missing code", { status: 400 });
    }

    const tokenRes = await fetch(`${env.INFER0_API}/v1/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: env.CLIENT_ID,
        client_secret: env.CLIENT_SECRET,
        redirect_uri: `${url.origin}/oauth/callback`,
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      return new Response(
        `Token exchange failed: ${JSON.stringify(tokenData)}`,
        { status: 500 },
      );
    }

    return new Response(null, {
      status: 302,
      headers: { Location: `/?access_token=${encodeURIComponent(tokenData.access_token)}` },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(`Callback error: ${msg}`, { status: 500 });
  }
}

async function handleChat(request: Request, env: Env): Promise<Response> {
  try {
    const { accessToken, messages } = await request.json<{
      accessToken: string;
      messages: Array<{ role: string; content: string }>;
    }>();

    if (!accessToken || !messages?.length) {
      return Response.json(
        { error: { message: "Missing accessToken or messages" } },
        { status: 400 },
      );
    }

    const res = await fetch(`${env.INFER0_API}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ messages }),
    });

    const data = await res.json();
    return Response.json(data, { status: res.status });
  } catch (e) {
    return Response.json(
      { error: { message: e instanceof Error ? e.message : "Unknown error" } },
      { status: 500 },
    );
  }
}

async function handleSdkChat(request: Request, env: Env): Promise<Response> {
  try {
    const { accessToken, messages } = await request.json<{
      accessToken: string;
      messages: Array<{ role: string; content: string }>;
    }>();

    if (!accessToken || !messages?.length) {
      return Response.json(
        { error: { message: "Missing accessToken or messages" } },
        { status: 400 },
      );
    }

    const client = new OpenAI({
      baseURL: `${env.INFER0_API}/v1`,
      apiKey: accessToken,
    });

    const chat = await client.chat.completions.create({
      model: "ignored",
      messages,
    });

    return Response.json(chat);
  } catch (e) {
    return Response.json(
      { error: { message: e instanceof Error ? e.message : "Unknown error" } },
      { status: 500 },
    );
  }
}

async function handleSdkChatStream(request: Request, env: Env): Promise<Response> {
  try {
    const { accessToken, messages } = await request.json<{
      accessToken: string;
      messages: Array<{ role: string; content: string }>;
    }>();

    if (!accessToken || !messages?.length) {
      return Response.json(
        { error: { message: "Missing accessToken or messages" } },
        { status: 400 },
      );
    }

    const client = new OpenAI({
      baseURL: `${env.INFER0_API}/v1`,
      apiKey: accessToken,
    });

    const stream = await client.chat.completions.create({
      model: "ignored",
      messages,
      stream: true,
    });

    const encoder = new TextEncoder();
    const body = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices?.[0]?.delta?.content || "";
            if (content) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Stream error";
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (e) {
    return Response.json(
      { error: { message: e instanceof Error ? e.message : "Unknown error" } },
      { status: 500 },
    );
  }
}

async function handleAnthropicChat(request: Request, env: Env): Promise<Response> {
  try {
    const { accessToken, messages } = await request.json<{
      accessToken: string;
      messages: Array<{ role: string; content: string }>;
    }>();

    if (!accessToken || !messages?.length) {
      return Response.json(
        { error: { message: "Missing accessToken or messages" } },
        { status: 400 },
      );
    }

    const client = new Anthropic({
      baseURL: `${env.INFER0_API}/v1`,
      apiKey: accessToken,
    });

    const message = await client.messages.create({
      model: "ignored",
      max_tokens: 1024,
      messages: messages as any,
    });

    const text = (message.content as Array<{ type: string; text: string }>)
      .map((c) => c.text)
      .join("");

    return Response.json({ content: text, role: message.role });
  } catch (e) {
    return Response.json(
      { error: { message: e instanceof Error ? e.message : "Unknown error" } },
      { status: 500 },
    );
  }
}

async function handleAnthropicChatStream(request: Request, env: Env): Promise<Response> {
  try {
    const { accessToken, messages } = await request.json<{
      accessToken: string;
      messages: Array<{ role: string; content: string }>;
    }>();

    if (!accessToken || !messages?.length) {
      return Response.json(
        { error: { message: "Missing accessToken or messages" } },
        { status: 400 },
      );
    }

    const client = new Anthropic({
      baseURL: `${env.INFER0_API}/v1`,
      apiKey: accessToken,
    });

    const stream = await client.messages.create({
      model: "ignored",
      max_tokens: 1024,
      messages: messages as any,
      stream: true,
    });

    const encoder = new TextEncoder();
    const body = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: event.delta.text })}\n\n`));
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Stream error";
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (e) {
    return Response.json(
      { error: { message: e instanceof Error ? e.message : "Unknown error" } },
      { status: 500 },
    );
  }
}

async function handleResponsesChat(request: Request, env: Env): Promise<Response> {
  try {
    const { accessToken, input } = await request.json<{
      accessToken: string;
      input: string;
    }>();

    if (!accessToken || !input) {
      return Response.json({ error: { message: "Missing accessToken or input" } }, { status: 400 });
    }

    const client = new OpenAI({
      baseURL: `${env.INFER0_API}/v1`,
      apiKey: accessToken,
    });

    const response = await client.responses.create({
      model: "ignored",
      input,
    });

    return Response.json(response);
  } catch (e) {
    return Response.json(
      { error: { message: e instanceof Error ? e.message : "Unknown error" } },
      { status: 500 },
    );
  }
}

async function handleResponsesChatStream(request: Request, env: Env): Promise<Response> {
  try {
    const { accessToken, input } = await request.json<{
      accessToken: string;
      input: string;
    }>();

    if (!accessToken || !input) {
      return Response.json({ error: { message: "Missing accessToken or input" } }, { status: 400 });
    }

    const client = new OpenAI({
      baseURL: `${env.INFER0_API}/v1`,
      apiKey: accessToken,
    });

    const stream = await client.responses.create({
      model: "ignored",
      input,
      stream: true,
    });

    const encoder = new TextEncoder();
    const body = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === "response.output_text.delta") {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: event.delta })}\n\n`));
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Stream error";
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (e) {
    return Response.json(
      { error: { message: e instanceof Error ? e.message : "Unknown error" } },
      { status: 500 },
    );
  }
}

function renderHTML(clientId: string): string { return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="client-id" content="${clientId}" />
<title>infer0 Test Client</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#0a0a0b;--bg-card:#141416;--bg-hover:#1c1c1f;--border:#27272a;--text:#fafafa;--text-muted:#a1a1aa;--accent:#6366f1;--radius:8px}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:var(--bg);color:var(--text);line-height:1.6;min-height:100vh;display:flex;flex-direction:column}
.container{max-width:640px;margin:0 auto;padding:48px 24px;width:100%}
h1{font-size:1.75rem;font-weight:800;letter-spacing:-0.03em;margin-bottom:4px}
h1 span{color:var(--accent)}
p{color:var(--text-muted);margin-bottom:24px;font-size:0.875rem}
.card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:20px;margin-bottom:16px}
label{display:block;font-size:0.8125rem;color:var(--text-muted);margin-bottom:4px;font-weight:500}
input,textarea{width:100%;background:var(--bg-hover);border:1px solid var(--border);border-radius:var(--radius);padding:10px 12px;color:var(--text);font-size:0.875rem;font-family:inherit}
input{margin-bottom:12px}
textarea{min-height:80px;resize:vertical;margin-bottom:12px;font-family:"SF Mono","Fira Code",monospace;font-size:0.8125rem}
.chat-box{background:var(--bg-hover);border:1px solid var(--border);border-radius:var(--radius);padding:16px;min-height:200px;max-height:400px;overflow-y:auto;margin-bottom:12px;font-size:0.875rem;white-space:pre-wrap}
.chat-box .empty{color:var(--text-muted);text-align:center;padding:40px 0}
.chat-box .msg{margin-bottom:12px;padding:8px 12px;border-radius:var(--radius);line-height:1.5}
.chat-box .msg.user{background:var(--accent);color:#fff;margin-left:24px}
.chat-box .msg.assistant{background:var(--bg-card);border:1px solid var(--border);margin-right:24px}
.chat-box .msg.error{background:#7f1d1d;color:#fca5a5}
.chat-box .msg .role{font-size:0.6875rem;text-transform:uppercase;letter-spacing:0.05em;opacity:0.7;margin-bottom:4px}
.input-row{display:flex;gap:8px}
.input-row input{flex:1;margin-bottom:0}
button{background:var(--accent);color:#fff;border:none;padding:10px 20px;border-radius:var(--radius);font-size:0.875rem;cursor:pointer;white-space:nowrap}
button:hover{background:#818cf8}
button:disabled{opacity:0.5;cursor:not-allowed}
.badge{display:inline-block;background:var(--bg-hover);border:1px solid var(--border);padding:2px 8px;border-radius:4px;font-size:0.6875rem;color:var(--text-muted);margin-bottom:16px}
.hint{font-size:0.75rem;color:var(--text-muted);margin-top:4px}
a{color:var(--accent)}
</style>
</head>
<body>
<div class="container">
<div class="badge">infer0 Test Client</div>
<h1>Acme <span>Chat</span></h1>
    <p>A third-party app powered by <a href="https://infer0.com" target="_blank">infer0</a>.</p>
     <p style="font-size:0.75rem;color:var(--text-muted);margin-top:-20px;margin-bottom:24px">Using <strong>raw fetch</strong> — try <a href="/sdk" style="color:var(--accent)">OpenAI SDK</a>, <a href="/anthropic-sdk" style="color:var(--accent)">Anthropic SDK</a>, <a href="/responses-sdk" style="color:var(--accent)">Responses API</a>, or <a href="/sdk/stream" style="color:var(--accent)">streaming</a></p>

<div class="card" id="sign-in-card">
  <p style="margin-bottom:16px">Sign in with infer0 to use this app.</p>
  <p class="hint" style="margin-bottom:12px">You'll be asked which provider to use.</p>
  <button id="sign-in-btn">Sign in with infer0</button>
</div>

<div class="card" id="chat-card" style="display:none">
  <div class="chat-box" id="chat">
    <div class="empty">Send a message to start chatting.</div>
  </div>
  <div class="input-row">
    <input type="text" id="message" placeholder="Type a message..." autocomplete="off" />
    <button id="send-btn">Send</button>
  </div>
</div>
</div>

<script>
const accessToken = new URLSearchParams(location.search).get('access_token');

const signInCard = document.getElementById('sign-in-card');
const chatCard = document.getElementById('chat-card');
const messageInput = document.getElementById('message');
const sendBtn = document.getElementById('send-btn');
const chat = document.getElementById('chat');
const signInBtn = document.getElementById('sign-in-btn');

if (accessToken) {
  signInCard.style.display = 'none';
  chatCard.style.display = 'block';
  history.replaceState({}, '', '/');
}

signInBtn.addEventListener('click', () => {
  const clientId = document.querySelector('meta[name="client-id"]')?.getAttribute('content');
  if (!clientId) { alert('Client ID not configured'); return; }
  const redirectUri = location.origin + '/oauth/callback';
  window.location.href = 'https://infer0.com/oauth/authorize?client_id=' + encodeURIComponent(clientId) + '&redirect_uri=' + encodeURIComponent(redirectUri) + '&response_type=code';
});

function addMessage(role, content) {
  const empty = chat.querySelector('.empty');
  if (empty) empty.remove();
  const msg = document.createElement('div');
  msg.className = 'msg ' + role;
  msg.innerHTML = '<div class="role">' + role + '</div>' + escapeHtml(content);
  chat.appendChild(msg);
  chat.scrollTop = chat.scrollHeight;
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

sendBtn.addEventListener('click', async () => {
  const text = messageInput.value.trim();

  if (!accessToken) { addMessage('error', 'Not signed in. Please sign in with infer0 first.'); return; }
  if (!text) return;

  messageInput.value = '';
  addMessage('user', text);

  sendBtn.disabled = true;
  sendBtn.textContent = 'Sending...';

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessToken,
        messages: [{ role: 'user', content: text }],
      }),
    });

    const data = await res.json();

    if (data.error) {
      addMessage('error', data.error.message || 'Request failed');
    } else if (data.choices?.[0]?.message?.content) {
      addMessage('assistant', data.choices[0].message.content);
    } else {
      addMessage('error', 'Unexpected response: ' + JSON.stringify(data));
    }
  } catch (e) {
    addMessage('error', 'Network error: ' + e.message);
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = 'Send';
  }
});

messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendBtn.click();
  }
});
</script>
</body>
</html>`; }

function renderSdkHTML(clientId: string): string { return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="client-id" content="${clientId}" />
<title>infer0 SDK Demo</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#0a0a0b;--bg-card:#141416;--bg-hover:#1c1c1f;--border:#27272a;--text:#fafafa;--text-muted:#a1a1aa;--accent:#6366f1;--radius:8px}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:var(--bg);color:var(--text);line-height:1.6;min-height:100vh;display:flex;flex-direction:column}
.container{max-width:640px;margin:0 auto;padding:48px 24px;width:100%}
h1{font-size:1.75rem;font-weight:800;letter-spacing:-0.03em;margin-bottom:4px}
h1 span{color:var(--accent)}
p{color:var(--text-muted);margin-bottom:24px;font-size:0.875rem}
.card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:20px;margin-bottom:16px}
pre{background:var(--bg-hover);border:1px solid var(--border);border-radius:var(--radius);padding:12px;font-size:0.75rem;overflow-x:auto;margin-bottom:16px;font-family:"SF Mono","Fira Code",monospace}
code{font-family:"SF Mono","Fira Code",monospace}
.chat-box{background:var(--bg-hover);border:1px solid var(--border);border-radius:var(--radius);padding:16px;min-height:200px;max-height:400px;overflow-y:auto;margin-bottom:12px;font-size:0.875rem;white-space:pre-wrap}
.chat-box .empty{color:var(--text-muted);text-align:center;padding:40px 0}
.chat-box .msg{margin-bottom:12px;padding:8px 12px;border-radius:var(--radius);line-height:1.5}
.chat-box .msg.user{background:var(--accent);color:#fff;margin-left:24px}
.chat-box .msg.assistant{background:var(--bg-card);border:1px solid var(--border);margin-right:24px}
.chat-box .msg.error{background:#7f1d1d;color:#fca5a5}
.chat-box .msg .role{font-size:0.6875rem;text-transform:uppercase;letter-spacing:0.05em;opacity:0.7;margin-bottom:4px}
.input-row{display:flex;gap:8px}
.input-row input{flex:1;margin-bottom:0}
button{background:var(--accent);color:#fff;border:none;padding:10px 20px;border-radius:var(--radius);font-size:0.875rem;cursor:pointer;white-space:nowrap}
button:hover{background:#818cf8}
button:disabled{opacity:0.5;cursor:not-allowed}
.badge{display:inline-block;background:var(--bg-hover);border:1px solid var(--border);padding:2px 8px;border-radius:4px;font-size:0.6875rem;color:var(--text-muted);margin-bottom:16px}
.hint{font-size:0.75rem;color:var(--text-muted);margin-top:4px}
a{color:var(--accent)}
</style>
</head>
<body>
<div class="container">
<div class="badge">infer0 SDK Demo</div>
<h1>SDK <span>Mode</span></h1>
<p>Calls infer0 via the <code>openai</code> npm package with <code>apiKey</code> set to the OAuth access token.</p>
<p style="font-size:0.75rem;color:var(--text-muted);margin-top:-20px;margin-bottom:24px">Using <strong>OpenAI SDK</strong> — <a href="/" style="color:var(--accent)">raw fetch</a> · <a href="/responses-sdk" style="color:var(--accent)">Responses API</a> · <a href="/sdk/stream" style="color:var(--accent)">streaming</a></p>

<pre><code>import OpenAI from "openai";

const accessToken = "&lt;token&gt;";

const client = new OpenAI({
  baseURL: "https://infer0.com/v1",
  apiKey: accessToken,
});

const chat = await client.chat.completions.create({
  messages: [{ role: "user", content: "..." }],
});</code></pre>

<div class="card" id="sign-in-card">
  <p style="margin-bottom:16px">First, <a href="/" style="color:var(--accent)">sign in</a> on the main page to get an access token, then paste it here:</p>
  <input type="text" id="token-input" placeholder="Paste access_token from URL..." style="margin-bottom:12px" />
  <button id="token-btn">Use token</button>
</div>

<div class="card" id="chat-card" style="display:none">
  <div class="chat-box" id="chat">
    <div class="empty">Send a message to start chatting.</div>
  </div>
  <div class="input-row">
    <input type="text" id="message" placeholder="Type a message..." autocomplete="off" />
    <button id="send-btn">Send</button>
  </div>
</div>
</div>

<script>
const urlToken = new URLSearchParams(location.search).get('access_token');

const signInCard = document.getElementById('sign-in-card');
const tokenInput = document.getElementById('token-input');
const tokenBtn = document.getElementById('token-btn');
const chatCard = document.getElementById('chat-card');
const messageInput = document.getElementById('message');
const sendBtn = document.getElementById('send-btn');
const chat = document.getElementById('chat');

let accessToken = urlToken;

if (accessToken) {
  tokenInput.value = accessToken;
  signInCard.style.display = 'none';
  chatCard.style.display = 'block';
  history.replaceState({}, '', '/sdk');
}

tokenBtn.addEventListener('click', () => {
  const token = tokenInput.value.trim();
  if (!token) { alert('Paste your access token'); return; }
  accessToken = token;
  signInCard.style.display = 'none';
  chatCard.style.display = 'block';
  history.replaceState({}, '', '/sdk');
});

tokenInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); tokenBtn.click(); }
});

function addMessage(role, content) {
  const empty = chat.querySelector('.empty');
  if (empty) empty.remove();
  const msg = document.createElement('div');
  msg.className = 'msg ' + role;
  msg.innerHTML = '<div class="role">' + role + '</div>' + escapeHtml(content);
  chat.appendChild(msg);
  chat.scrollTop = chat.scrollHeight;
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

sendBtn.addEventListener('click', async () => {
  const text = messageInput.value.trim();

  if (!accessToken) { addMessage('error', 'No access token. Paste one above.'); return; }
  if (!text) return;

  messageInput.value = '';
  addMessage('user', text);

  sendBtn.disabled = true;
  sendBtn.textContent = 'Sending...';

  try {
    const res = await fetch('/api/sdk-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessToken,
        messages: [{ role: 'user', content: text }],
      }),
    });

    const data = await res.json();

    if (data.error) {
      addMessage('error', data.error.message || 'Request failed');
    } else if (data.choices?.[0]?.message?.content) {
      addMessage('assistant', data.choices[0].message.content);
    } else {
      addMessage('error', 'Unexpected response: ' + JSON.stringify(data));
    }
  } catch (e) {
    addMessage('error', 'Network error: ' + e.message);
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = 'Send';
  }
});

messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendBtn.click();
  }
});
</script>
</body>
</html>`; }

function renderSdkStreamHTML(clientId: string): string { return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="client-id" content="${clientId}" />
<title>infer0 Streaming Demo</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#0a0a0b;--bg-card:#141416;--bg-hover:#1c1c1f;--border:#27272a;--text:#fafafa;--text-muted:#a1a1aa;--accent:#6366f1;--radius:8px}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:var(--bg);color:var(--text);line-height:1.6;min-height:100vh;display:flex;flex-direction:column}
.container{max-width:640px;margin:0 auto;padding:48px 24px;width:100%}
h1{font-size:1.75rem;font-weight:800;letter-spacing:-0.03em;margin-bottom:4px}
h1 span{color:var(--accent)}
p{color:var(--text-muted);margin-bottom:24px;font-size:0.875rem}
.card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:20px;margin-bottom:16px}
pre{background:var(--bg-hover);border:1px solid var(--border);border-radius:var(--radius);padding:12px;font-size:0.75rem;overflow-x:auto;margin-bottom:16px;font-family:"SF Mono","Fira Code",monospace}
code{font-family:"SF Mono","Fira Code",monospace}
.chat-box{background:var(--bg-hover);border:1px solid var(--border);border-radius:var(--radius);padding:16px;min-height:200px;max-height:400px;overflow-y:auto;margin-bottom:12px;font-size:0.875rem;white-space:pre-wrap}
.chat-box .empty{color:var(--text-muted);text-align:center;padding:40px 0}
.chat-box .msg{margin-bottom:12px;padding:8px 12px;border-radius:var(--radius);line-height:1.5}
.chat-box .msg.user{background:var(--accent);color:#fff;margin-left:24px}
.chat-box .msg.assistant{background:var(--bg-card);border:1px solid var(--border);margin-right:24px}
.chat-box .msg.error{background:#7f1d1d;color:#fca5a5}
.chat-box .msg .role{font-size:0.6875rem;text-transform:uppercase;letter-spacing:0.05em;opacity:0.7;margin-bottom:4px}
.input-row{display:flex;gap:8px}
.input-row input{flex:1;margin-bottom:0}
button{background:var(--accent);color:#fff;border:none;padding:10px 20px;border-radius:var(--radius);font-size:0.875rem;cursor:pointer;white-space:nowrap}
button:hover{background:#818cf8}
button:disabled{opacity:0.5;cursor:not-allowed}
.badge{display:inline-block;background:var(--bg-hover);border:1px solid var(--border);padding:2px 8px;border-radius:4px;font-size:0.6875rem;color:var(--text-muted);margin-bottom:16px}
.hint{font-size:0.75rem;color:var(--text-muted);margin-top:4px}
a{color:var(--accent)}
</style>
</head>
<body>
<div class="container">
<div class="badge">infer0 Streaming Demo</div>
<h1>Streaming <span>SDK</span></h1>
<p>Uses the <code>openai</code> SDK with <code>stream: true</code>. Response appears token by token.</p>
<p style="font-size:0.75rem;color:var(--text-muted);margin-top:-20px;margin-bottom:24px">Back to <a href="/sdk" style="color:var(--accent)">non-streaming SDK</a></p>

<pre><code>import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://infer0.com/v1",
  apiKey: accessToken,
});

const stream = await client.chat.completions.create({
  model: "ignored",
  messages: [{ role: "user", content: "..." }],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || "");
}</code></pre>

<div class="card" id="sign-in-card">
  <p style="margin-bottom:16px">First, <a href="/" style="color:var(--accent)">sign in</a> on the main page to get an access token, then paste it here:</p>
  <input type="text" id="token-input" placeholder="Paste access_token from URL..." style="margin-bottom:12px" />
  <button id="token-btn">Use token</button>
</div>

<div class="card" id="chat-card" style="display:none">
  <div class="chat-box" id="chat">
    <div class="empty">Send a message to start chatting.</div>
  </div>
  <div class="input-row">
    <input type="text" id="message" placeholder="Type a message..." autocomplete="off" />
    <button id="send-btn">Send</button>
  </div>
</div>
</div>

<script>
const urlToken = new URLSearchParams(location.search).get('access_token');

const signInCard = document.getElementById('sign-in-card');
const tokenInput = document.getElementById('token-input');
const tokenBtn = document.getElementById('token-btn');
const chatCard = document.getElementById('chat-card');
const messageInput = document.getElementById('message');
const sendBtn = document.getElementById('send-btn');
const chat = document.getElementById('chat');

let accessToken = urlToken;

if (accessToken) {
  tokenInput.value = accessToken;
  signInCard.style.display = 'none';
  chatCard.style.display = 'block';
  history.replaceState({}, '', '/sdk/stream');
}

tokenBtn.addEventListener('click', () => {
  const token = tokenInput.value.trim();
  if (!token) { alert('Paste your access token'); return; }
  accessToken = token;
  signInCard.style.display = 'none';
  chatCard.style.display = 'block';
  history.replaceState({}, '', '/sdk/stream');
});

tokenInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); tokenBtn.click(); }
});

function addMessage(role, content) {
  const empty = chat.querySelector('.empty');
  if (empty) empty.remove();
  const msg = document.createElement('div');
  msg.className = 'msg ' + role;
  msg.innerHTML = '<div class="role">' + role + '</div>' + escapeHtml(content);
  chat.appendChild(msg);
  chat.scrollTop = chat.scrollHeight;
  return msg;
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

sendBtn.addEventListener('click', async () => {
  const text = messageInput.value.trim();

  if (!accessToken) { addMessage('error', 'No access token. Paste one above.'); return; }
  if (!text) return;

  messageInput.value = '';
  addMessage('user', text);

  sendBtn.disabled = true;
  sendBtn.textContent = 'Streaming...';

  const aiMsg = addMessage('assistant', '');

  try {
    const res = await fetch('/api/sdk-chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessToken,
        messages: [{ role: 'user', content: text }],
      }),
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        try {
          const json = JSON.parse(data);
          if (json.error) {
            aiMsg.textContent += '\\n[Error: ' + json.error + ']';
          } else if (json.content) {
            aiMsg.textContent += json.content;
            aiMsg.scrollIntoView({ behavior: 'smooth' });
          }
        } catch {}
      }
    }
  } catch (e) {
    aiMsg.textContent += '\\n[Network error: ' + e.message + ']';
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = 'Send';
  }
});

messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendBtn.click();
  }
});
</script>
</body>
</html>\`; }

function renderAnthropicHTML(clientId: string): string { return \`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="client-id" content="${clientId}" />
<title>infer0 Anthropic SDK Demo</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#0a0a0b;--bg-card:#141416;--bg-hover:#1c1c1f;--border:#27272a;--text:#fafafa;--text-muted:#a1a1aa;--accent:#6366f1;--radius:8px}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:var(--bg);color:var(--text);line-height:1.6;min-height:100vh;display:flex;flex-direction:column}
.container{max-width:640px;margin:0 auto;padding:48px 24px;width:100%}
h1{font-size:1.75rem;font-weight:800;letter-spacing:-0.03em;margin-bottom:4px}
h1 span{color:var(--accent)}
p{color:var(--text-muted);margin-bottom:24px;font-size:0.875rem}
.card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:20px;margin-bottom:16px}
pre{background:var(--bg-hover);border:1px solid var(--border);border-radius:var(--radius);padding:12px;font-size:0.75rem;overflow-x:auto;margin-bottom:16px;font-family:"SF Mono","Fira Code",monospace}
code{font-family:"SF Mono","Fira Code",monospace}
.chat-box{background:var(--bg-hover);border:1px solid var(--border);border-radius:var(--radius);padding:16px;min-height:200px;max-height:400px;overflow-y:auto;margin-bottom:12px;font-size:0.875rem;white-space:pre-wrap}
.chat-box .empty{color:var(--text-muted);text-align:center;padding:40px 0}
.chat-box .msg{margin-bottom:12px;padding:8px 12px;border-radius:var(--radius);line-height:1.5}
.chat-box .msg.user{background:var(--accent);color:#fff;margin-left:24px}
.chat-box .msg.assistant{background:var(--bg-card);border:1px solid var(--border);margin-right:24px}
.chat-box .msg.error{background:#7f1d1d;color:#fca5a5}
.chat-box .msg .role{font-size:0.6875rem;text-transform:uppercase;letter-spacing:0.05em;opacity:0.7;margin-bottom:4px}
.input-row{display:flex;gap:8px}
.input-row input{flex:1;margin-bottom:0}
button{background:var(--accent);color:#fff;border:none;padding:10px 20px;border-radius:var(--radius);font-size:0.875rem;cursor:pointer;white-space:nowrap}
button:hover{background:#818cf8}
button:disabled{opacity:0.5;cursor:not-allowed}
.badge{display:inline-block;background:var(--bg-hover);border:1px solid var(--border);padding:2px 8px;border-radius:4px;font-size:0.6875rem;color:var(--text-muted);margin-bottom:16px}
.hint{font-size:0.75rem;color:var(--text-muted);margin-top:4px}
a{color:var(--accent)}
</style>
</head>
<body>
<div class="container">
<div class="badge">infer0 Anthropic SDK Demo</div>
<h1>Anthropic <span>SDK</span></h1>
<p>Calls infer0 via the <code>@anthropic-ai/sdk</code> package with <code>apiKey</code> set to the OAuth access token.</p>
<p style="font-size:0.75rem;color:var(--text-muted);margin-top:-20px;margin-bottom:24px">Try <a href="/anthropic-sdk/stream" style="color:var(--accent)">streaming</a> or <a href="/sdk" style="color:var(--accent)">OpenAI SDK</a></p>

<pre><code>import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  baseURL: "https://infer0.com/v1",
  apiKey: accessToken,
});

const message = await client.messages.create({
  model: "ignored",
  max_tokens: 1024,
  messages: [{ role: "user", content: "..." }],
});</code></pre>

<div class="card" id="sign-in-card">
  <p style="margin-bottom:16px">First, <a href="/" style="color:var(--accent)">sign in</a> on the main page to get an access token, then paste it here:</p>
  <input type="text" id="token-input" placeholder="Paste access_token from URL..." style="margin-bottom:12px" />
  <button id="token-btn">Use token</button>
</div>

<div class="card" id="chat-card" style="display:none">
  <div class="chat-box" id="chat">
    <div class="empty">Send a message to start chatting.</div>
  </div>
  <div class="input-row">
    <input type="text" id="message" placeholder="Type a message..." autocomplete="off" />
    <button id="send-btn">Send</button>
  </div>
</div>
</div>

<script>
const urlToken = new URLSearchParams(location.search).get('access_token');

const signInCard = document.getElementById('sign-in-card');
const tokenInput = document.getElementById('token-input');
const tokenBtn = document.getElementById('token-btn');
const chatCard = document.getElementById('chat-card');
const messageInput = document.getElementById('message');
const sendBtn = document.getElementById('send-btn');
const chat = document.getElementById('chat');

let accessToken = urlToken;

if (accessToken) {
  tokenInput.value = accessToken;
  signInCard.style.display = 'none';
  chatCard.style.display = 'block';
  history.replaceState({}, '', '/anthropic-sdk');
}

tokenBtn.addEventListener('click', () => {
  const token = tokenInput.value.trim();
  if (!token) { alert('Paste your access token'); return; }
  accessToken = token;
  signInCard.style.display = 'none';
  chatCard.style.display = 'block';
  history.replaceState({}, '', '/anthropic-sdk');
});

tokenInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); tokenBtn.click(); }
});

function addMessage(role, content) {
  const empty = chat.querySelector('.empty');
  if (empty) empty.remove();
  const msg = document.createElement('div');
  msg.className = 'msg ' + role;
  msg.innerHTML = '<div class="role">' + role + '</div>' + escapeHtml(content);
  chat.appendChild(msg);
  chat.scrollTop = chat.scrollHeight;
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

sendBtn.addEventListener('click', async () => {
  const text = messageInput.value.trim();

  if (!accessToken) { addMessage('error', 'No access token. Paste one above.'); return; }
  if (!text) return;

  messageInput.value = '';
  addMessage('user', text);

  sendBtn.disabled = true;
  sendBtn.textContent = 'Sending...';

  try {
    const res = await fetch('/api/anthropic-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessToken,
        messages: [{ role: 'user', content: text }],
      }),
    });

    const data = await res.json();

    if (data.error) {
      addMessage('error', data.error.message || 'Request failed');
    } else if (data.content) {
      addMessage('assistant', data.content);
    } else {
      addMessage('error', 'Unexpected response: ' + JSON.stringify(data));
    }
  } catch (e) {
    addMessage('error', 'Network error: ' + e.message);
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = 'Send';
  }
});

messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendBtn.click();
  }
});
</script>
</body>
</html>\`; }

function renderResponsesHTML(clientId: string): string { return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="client-id" content="${clientId}" />
<title>infer0 Responses SDK Demo</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#0a0a0b;--bg-card:#141416;--bg-hover:#1c1c1f;--border:#27272a;--text:#fafafa;--text-muted:#a1a1aa;--accent:#6366f1;--radius:8px}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:var(--bg);color:var(--text);line-height:1.6;min-height:100vh;display:flex;flex-direction:column}
.container{max-width:640px;margin:0 auto;padding:48px 24px;width:100%}
h1{font-size:1.75rem;font-weight:800;letter-spacing:-0.03em;margin-bottom:4px}
h1 span{color:var(--accent)}
p{color:var(--text-muted);margin-bottom:24px;font-size:0.875rem}
.card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:20px;margin-bottom:16px}
pre{background:var(--bg-hover);border:1px solid var(--border);border-radius:var(--radius);padding:12px;font-size:0.75rem;overflow-x:auto;margin-bottom:16px;font-family:"SF Mono","Fira Code",monospace}
code{font-family:"SF Mono","Fira Code",monospace}
.chat-box{background:var(--bg-hover);border:1px solid var(--border);border-radius:var(--radius);padding:16px;min-height:200px;max-height:400px;overflow-y:auto;margin-bottom:12px;font-size:0.875rem;white-space:pre-wrap}
.chat-box .empty{color:var(--text-muted);text-align:center;padding:40px 0}
.chat-box .msg{margin-bottom:12px;padding:8px 12px;border-radius:var(--radius);line-height:1.5}
.chat-box .msg.user{background:var(--accent);color:#fff;margin-left:24px}
.chat-box .msg.assistant{background:var(--bg-card);border:1px solid var(--border);margin-right:24px}
.chat-box .msg.error{background:#7f1d1d;color:#fca5a5}
.chat-box .msg .role{font-size:0.6875rem;text-transform:uppercase;letter-spacing:0.05em;opacity:0.7;margin-bottom:4px}
.input-row{display:flex;gap:8px}
.input-row input{flex:1;margin-bottom:0}
button{background:var(--accent);color:#fff;border:none;padding:10px 20px;border-radius:var(--radius);font-size:0.875rem;cursor:pointer;white-space:nowrap}
button:hover{background:#818cf8}
button:disabled{opacity:0.5;cursor:not-allowed}
.badge{display:inline-block;background:var(--bg-hover);border:1px solid var(--border);padding:2px 8px;border-radius:4px;font-size:0.6875rem;color:var(--text-muted);margin-bottom:16px}
.hint{font-size:0.75rem;color:var(--text-muted);margin-top:4px}
a{color:var(--accent)}
</style>
</head>
<body>
<div class="container">
<div class="badge">infer0 Responses SDK Demo</div>
<h1>Responses <span>API</span></h1>
<p>Calls infer0 via the <code>openai</code> package's <code>client.responses.create()</code> with <code>apiKey</code> set to the OAuth access token.</p>
<p style="font-size:0.75rem;color:var(--text-muted);margin-top:-20px;margin-bottom:24px">Try <a href="/responses-sdk/stream" style="color:var(--accent)">streaming</a> or <a href="/sdk" style="color:var(--accent)">chat completions</a></p>

<pre><code>import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://infer0.com/v1",
  apiKey: accessToken,
});

const response = await client.responses.create({
  model: "ignored",
  input: "Hello",
});</code></pre>

<div class="card" id="sign-in-card">
  <p style="margin-bottom:16px">First, <a href="/" style="color:var(--accent)">sign in</a> on the main page to get an access token, then paste it here:</p>
  <input type="text" id="token-input" placeholder="Paste access_token from URL..." style="margin-bottom:12px" />
  <button id="token-btn">Use token</button>
</div>

<div class="card" id="chat-card" style="display:none">
  <div class="chat-box" id="chat">
    <div class="empty">Send a message to start chatting.</div>
  </div>
  <div class="input-row">
    <input type="text" id="message" placeholder="Type a message..." autocomplete="off" />
    <button id="send-btn">Send</button>
  </div>
</div>
</div>

<script>
const urlToken = new URLSearchParams(location.search).get('access_token');

const signInCard = document.getElementById('sign-in-card');
const tokenInput = document.getElementById('token-input');
const tokenBtn = document.getElementById('token-btn');
const chatCard = document.getElementById('chat-card');
const messageInput = document.getElementById('message');
const sendBtn = document.getElementById('send-btn');
const chat = document.getElementById('chat');

let accessToken = urlToken;

if (accessToken) {
  tokenInput.value = accessToken;
  signInCard.style.display = 'none';
  chatCard.style.display = 'block';
  history.replaceState({}, '', '/responses-sdk');
}

tokenBtn.addEventListener('click', () => {
  const token = tokenInput.value.trim();
  if (!token) { alert('Paste your access token'); return; }
  accessToken = token;
  signInCard.style.display = 'none';
  chatCard.style.display = 'block';
  history.replaceState({}, '', '/responses-sdk');
});

tokenInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); tokenBtn.click(); }
});

function addMessage(role, content) {
  const empty = chat.querySelector('.empty');
  if (empty) empty.remove();
  const msg = document.createElement('div');
  msg.className = 'msg ' + role;
  msg.innerHTML = '<div class="role">' + role + '</div>' + escapeHtml(content);
  chat.appendChild(msg);
  chat.scrollTop = chat.scrollHeight;
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

sendBtn.addEventListener('click', async () => {
  const text = messageInput.value.trim();

  if (!accessToken) { addMessage('error', 'No access token. Paste one above.'); return; }
  if (!text) return;

  messageInput.value = '';
  addMessage('user', text);

  sendBtn.disabled = true;
  sendBtn.textContent = 'Sending...';

  try {
    const res = await fetch('/api/responses-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessToken,
        input: text,
      }),
    });

    const data = await res.json();

    if (data.error) {
      addMessage('error', data.error.message || 'Request failed');
    } else if (data.output?.[0]?.content?.[0]?.text) {
      addMessage('assistant', data.output[0].content[0].text);
    } else {
      addMessage('error', 'Unexpected response: ' + JSON.stringify(data));
    }
  } catch (e) {
    addMessage('error', 'Network error: ' + e.message);
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = 'Send';
  }
});

messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendBtn.click();
  }
});
</script>
</body>
</html>`; }

function renderResponsesStreamHTML(clientId: string): string { return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="client-id" content="${clientId}" />
<title>infer0 Responses SDK Streaming Demo</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#0a0a0b;--bg-card:#141416;--bg-hover:#1c1c1f;--border:#27272a;--text:#fafafa;--text-muted:#a1a1aa;--accent:#6366f1;--radius:8px}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:var(--bg);color:var(--text);line-height:1.6;min-height:100vh;display:flex;flex-direction:column}
.container{max-width:640px;margin:0 auto;padding:48px 24px;width:100%}
h1{font-size:1.75rem;font-weight:800;letter-spacing:-0.03em;margin-bottom:4px}
h1 span{color:var(--accent)}
p{color:var(--text-muted);margin-bottom:24px;font-size:0.875rem}
.card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:20px;margin-bottom:16px}
pre{background:var(--bg-hover);border:1px solid var(--border);border-radius:var(--radius);padding:12px;font-size:0.75rem;overflow-x:auto;margin-bottom:16px;font-family:"SF Mono","Fira Code",monospace}
code{font-family:"SF Mono","Fira Code",monospace}
.chat-box{background:var(--bg-hover);border:1px solid var(--border);border-radius:var(--radius);padding:16px;min-height:200px;max-height:400px;overflow-y:auto;margin-bottom:12px;font-size:0.875rem;white-space:pre-wrap}
.chat-box .empty{color:var(--text-muted);text-align:center;padding:40px 0}
.chat-box .msg{margin-bottom:12px;padding:8px 12px;border-radius:var(--radius);line-height:1.5}
.chat-box .msg.user{background:var(--accent);color:#fff;margin-left:24px}
.chat-box .msg.assistant{background:var(--bg-card);border:1px solid var(--border);margin-right:24px}
.chat-box .msg.error{background:#7f1d1d;color:#fca5a5}
.chat-box .msg .role{font-size:0.6875rem;text-transform:uppercase;letter-spacing:0.05em;opacity:0.7;margin-bottom:4px}
.input-row{display:flex;gap:8px}
.input-row input{flex:1;margin-bottom:0}
button{background:var(--accent);color:#fff;border:none;padding:10px 20px;border-radius:var(--radius);font-size:0.875rem;cursor:pointer;white-space:nowrap}
button:hover{background:#818cf8}
button:disabled{opacity:0.5;cursor:not-allowed}
.badge{display:inline-block;background:var(--bg-hover);border:1px solid var(--border);padding:2px 8px;border-radius:4px;font-size:0.6875rem;color:var(--text-muted);margin-bottom:16px}
.hint{font-size:0.75rem;color:var(--text-muted);margin-top:4px}
a{color:var(--accent)}
</style>
</head>
<body>
<div class="container">
<div class="badge">infer0 Responses Streaming Demo</div>
<h1>Responses API <span>Streaming</span></h1>
<p>Uses <code>client.responses.create()</code> with <code>stream: true</code>. Response appears token by token.</p>
<p style="font-size:0.75rem;color:var(--text-muted);margin-top:-20px;margin-bottom:24px"><a href="/responses-sdk" style="color:var(--accent)">Non-streaming version</a></p>

<pre><code>const stream = await client.responses.create({
  model: "ignored",
  input: "Hello",
  stream: true,
});

for await (const event of stream) {
  if (event.type === "response.output_text.delta") {
    process.stdout.write(event.delta);
  }
}</code></pre>

<div class="card" id="sign-in-card">
  <p style="margin-bottom:16px">First, <a href="/" style="color:var(--accent)">sign in</a> on the main page to get an access token, then paste it here:</p>
  <input type="text" id="token-input" placeholder="Paste access_token from URL..." style="margin-bottom:12px" />
  <button id="token-btn">Use token</button>
</div>

<div class="card" id="chat-card" style="display:none">
  <div class="chat-box" id="chat">
    <div class="empty">Send a message to start chatting.</div>
  </div>
  <div class="input-row">
    <input type="text" id="message" placeholder="Type a message..." autocomplete="off" />
    <button id="send-btn">Send</button>
  </div>
</div>
</div>

<script>
const urlToken = new URLSearchParams(location.search).get('access_token');

const signInCard = document.getElementById('sign-in-card');
const tokenInput = document.getElementById('token-input');
const tokenBtn = document.getElementById('token-btn');
const chatCard = document.getElementById('chat-card');
const messageInput = document.getElementById('message');
const sendBtn = document.getElementById('send-btn');
const chat = document.getElementById('chat');

let accessToken = urlToken;

if (accessToken) {
  tokenInput.value = accessToken;
  signInCard.style.display = 'none';
  chatCard.style.display = 'block';
  history.replaceState({}, '', '/responses-sdk/stream');
}

tokenBtn.addEventListener('click', () => {
  const token = tokenInput.value.trim();
  if (!token) { alert('Paste your access token'); return; }
  accessToken = token;
  signInCard.style.display = 'none';
  chatCard.style.display = 'block';
  history.replaceState({}, '', '/responses-sdk/stream');
});

tokenInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); tokenBtn.click(); }
});

function addMessage(role, content) {
  const empty = chat.querySelector('.empty');
  if (empty) empty.remove();
  const msg = document.createElement('div');
  msg.className = 'msg ' + role;
  msg.innerHTML = '<div class="role">' + role + '</div>' + escapeHtml(content);
  chat.appendChild(msg);
  chat.scrollTop = chat.scrollHeight;
  return msg;
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

sendBtn.addEventListener('click', async () => {
  const text = messageInput.value.trim();

  if (!accessToken) { addMessage('error', 'No access token. Paste one above.'); return; }
  if (!text) return;

  messageInput.value = '';
  addMessage('user', text);

  sendBtn.disabled = true;
  sendBtn.textContent = 'Streaming...';

  const aiMsg = addMessage('assistant', '');

  try {
    const res = await fetch('/api/responses-chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessToken,
        input: text,
      }),
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        try {
          const json = JSON.parse(data);
          if (json.error) {
            aiMsg.textContent += '\\n[Error: ' + json.error + ']';
          } else if (json.content) {
            aiMsg.textContent += json.content;
            aiMsg.scrollIntoView({ behavior: 'smooth' });
          }
        } catch {}
      }
    }
  } catch (e) {
    aiMsg.textContent += '\\n[Network error: ' + e.message + ']';
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = 'Send';
  }
});

messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendBtn.click();
  }
});
</script>
</body>
</html>`; }

function renderAnthropicStreamHTML(clientId: string): string { return `<!DOCTYPE html
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#0a0a0b;--bg-card:#141416;--bg-hover:#1c1c1f;--border:#27272a;--text:#fafafa;--text-muted:#a1a1aa;--accent:#6366f1;--radius:8px}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:var(--bg);color:var(--text);line-height:1.6;min-height:100vh;display:flex;flex-direction:column}
.container{max-width:640px;margin:0 auto;padding:48px 24px;width:100%}
h1{font-size:1.75rem;font-weight:800;letter-spacing:-0.03em;margin-bottom:4px}
h1 span{color:var(--accent)}
p{color:var(--text-muted);margin-bottom:24px;font-size:0.875rem}
.card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:20px;margin-bottom:16px}
pre{background:var(--bg-hover);border:1px solid var(--border);border-radius:var(--radius);padding:12px;font-size:0.75rem;overflow-x:auto;margin-bottom:16px;font-family:"SF Mono","Fira Code",monospace}
code{font-family:"SF Mono","Fira Code",monospace}
.chat-box{background:var(--bg-hover);border:1px solid var(--border);border-radius:var(--radius);padding:16px;min-height:200px;max-height:400px;overflow-y:auto;margin-bottom:12px;font-size:0.875rem;white-space:pre-wrap}
.chat-box .empty{color:var(--text-muted);text-align:center;padding:40px 0}
.chat-box .msg{margin-bottom:12px;padding:8px 12px;border-radius:var(--radius);line-height:1.5}
.chat-box .msg.user{background:var(--accent);color:#fff;margin-left:24px}
.chat-box .msg.assistant{background:var(--bg-card);border:1px solid var(--border);margin-right:24px}
.chat-box .msg.error{background:#7f1d1d;color:#fca5a5}
.chat-box .msg .role{font-size:0.6875rem;text-transform:uppercase;letter-spacing:0.05em;opacity:0.7;margin-bottom:4px}
.input-row{display:flex;gap:8px}
.input-row input{flex:1;margin-bottom:0}
button{background:var(--accent);color:#fff;border:none;padding:10px 20px;border-radius:var(--radius);font-size:0.875rem;cursor:pointer;white-space:nowrap}
button:hover{background:#818cf8}
button:disabled{opacity:0.5;cursor:not-allowed}
.badge{display:inline-block;background:var(--bg-hover);border:1px solid var(--border);padding:2px 8px;border-radius:4px;font-size:0.6875rem;color:var(--text-muted);margin-bottom:16px}
.hint{font-size:0.75rem;color:var(--text-muted);margin-top:4px}
a{color:var(--accent)}
</style>
</head>
<body>
<div class="container">
<div class="badge">infer0 Anthropic Streaming Demo</div>
<h1>Anthropic SDK <span>Streaming</span></h1>
<p>Uses the <code>@anthropic-ai/sdk</code> with <code>stream: true</code>. Response appears token by token.</p>
<p style="font-size:0.75rem;color:var(--text-muted);margin-top:-20px;margin-bottom:24px"><a href="/anthropic-sdk" style="color:var(--accent)">Non-streaming version</a></p>

<pre><code>const stream = await client.messages.create({
  model: "ignored",
  max_tokens: 1024,
  messages: [{ role: "user", content: "..." }],
  stream: true,
});

for await (const event of stream) {
  if (event.type === "content_block_delta") {
    process.stdout.write(event.delta.text);
  }
}</code></pre>

<div class="card" id="sign-in-card">
  <p style="margin-bottom:16px">First, <a href="/" style="color:var(--accent)">sign in</a> on the main page to get an access token, then paste it here:</p>
  <input type="text" id="token-input" placeholder="Paste access_token from URL..." style="margin-bottom:12px" />
  <button id="token-btn">Use token</button>
</div>

<div class="card" id="chat-card" style="display:none">
  <div class="chat-box" id="chat">
    <div class="empty">Send a message to start chatting.</div>
  </div>
  <div class="input-row">
    <input type="text" id="message" placeholder="Type a message..." autocomplete="off" />
    <button id="send-btn">Send</button>
  </div>
</div>
</div>

<script>
const urlToken = new URLSearchParams(location.search).get('access_token');

const signInCard = document.getElementById('sign-in-card');
const tokenInput = document.getElementById('token-input');
const tokenBtn = document.getElementById('token-btn');
const chatCard = document.getElementById('chat-card');
const messageInput = document.getElementById('message');
const sendBtn = document.getElementById('send-btn');
const chat = document.getElementById('chat');

let accessToken = urlToken;

if (accessToken) {
  tokenInput.value = accessToken;
  signInCard.style.display = 'none';
  chatCard.style.display = 'block';
  history.replaceState({}, '', '/anthropic-sdk/stream');
}

tokenBtn.addEventListener('click', () => {
  const token = tokenInput.value.trim();
  if (!token) { alert('Paste your access token'); return; }
  accessToken = token;
  signInCard.style.display = 'none';
  chatCard.style.display = 'block';
  history.replaceState({}, '', '/anthropic-sdk/stream');
});

tokenInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); tokenBtn.click(); }
});

function addMessage(role, content) {
  const empty = chat.querySelector('.empty');
  if (empty) empty.remove();
  const msg = document.createElement('div');
  msg.className = 'msg ' + role;
  msg.innerHTML = '<div class="role">' + role + '</div>' + escapeHtml(content);
  chat.appendChild(msg);
  chat.scrollTop = chat.scrollHeight;
  return msg;
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

sendBtn.addEventListener('click', async () => {
  const text = messageInput.value.trim();

  if (!accessToken) { addMessage('error', 'No access token. Paste one above.'); return; }
  if (!text) return;

  messageInput.value = '';
  addMessage('user', text);

  sendBtn.disabled = true;
  sendBtn.textContent = 'Streaming...';

  const aiMsg = addMessage('assistant', '');

  try {
    const res = await fetch('/api/anthropic-chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessToken,
        messages: [{ role: 'user', content: text }],
      }),
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        try {
          const json = JSON.parse(data);
          if (json.error) {
            aiMsg.textContent += '\\n[Error: ' + json.error + ']';
          } else if (json.content) {
            aiMsg.textContent += json.content;
            aiMsg.scrollIntoView({ behavior: 'smooth' });
          }
        } catch {}
      }
    }
  } catch (e) {
    aiMsg.textContent += '\\n[Network error: ' + e.message + ']';
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = 'Send';
  }
});

messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendBtn.click();
  }
});
</script>
</body>
</html>\`; }