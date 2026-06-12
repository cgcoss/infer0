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

    if (url.pathname === "/api/infer" && request.method === "POST") {
      return handleInfer(request, env);
    }

    if (url.pathname === "/") {
      return new Response(renderHTML(env.CLIENT_ID, env.INFER0_API), { headers: { "Content-Type": "text/html" } });
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
      return new Response(`Token exchange failed: ${JSON.stringify(tokenData)}`, { status: 500 });
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

async function* chatContent(stream: any): AsyncGenerator<string> {
  for await (const chunk of stream) {
    const content = chunk.choices?.[0]?.delta?.content || "";
    if (content) yield content;
  }
}

async function* messagesContent(stream: any): AsyncGenerator<string> {
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta?.text) {
      yield event.delta.text;
    }
  }
}

async function* responsesContent(stream: any): AsyncGenerator<string> {
  for await (const event of stream) {
    if (event.type === "response.output_text.delta") {
      yield event.delta;
    }
  }
}

function simplifiedSSE(gen: AsyncGenerator<string>): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      try {
        for await (const content of gen) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (e) {
        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({ error: e instanceof Error ? e.message : "stream error" })}\n\n`,
        ));
      } finally {
        try { controller.close(); } catch {}
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
}

function extractContent(endpoint: string, data: any): string {
  if (endpoint === "chat") return data.choices?.[0]?.message?.content || "";
  if (endpoint === "messages") return data.content?.[0]?.text || "";
  if (endpoint === "responses") return data.output?.[0]?.content?.[0]?.text || "";
  return "";
}

function extractChunk(endpoint: string, data: any): string | null {
  if (endpoint === "chat") return data.choices?.[0]?.delta?.content || null;
  if (endpoint === "messages") {
    if (data.type === "content_block_delta" && data.delta?.text) return data.delta.text;
    return null;
  }
  if (endpoint === "responses") {
    if (data.type === "response.output_text.delta") return data.delta;
    return null;
  }
  return null;
}

async function* rawStreamContent(res: Response, endpoint: string): AsyncGenerator<string> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop() || "";
    for (const part of parts) {
      for (const line of part.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        if (payload === "[DONE]") continue;
        try {
          const chunk = extractChunk(endpoint, JSON.parse(payload));
          if (chunk) yield chunk;
        } catch {}
      }
    }
  }
}

async function handleInfer(request: Request, env: Env): Promise<Response> {
  try {
    const { accessToken, messages, endpoint, stream, mode } = await request.json<{
      accessToken: string;
      messages: Array<{ role: string; content: string }>;
      endpoint: string;
      stream: boolean;
      mode: string;
    }>();

    if (!accessToken || !messages?.length) {
      return Response.json({ error: { message: "Missing accessToken or messages" } }, { status: 400 });
    }

    const api = env.INFER0_API.replace(/\/$/, "");

    if (mode === "raw") {
      const body: Record<string, unknown> = {};
      if (endpoint === "chat" || endpoint === "messages") {
        body.model = endpoint === "chat" ? "gpt-4o-mini" : "claude-sonnet-4-6";
        body.messages = messages;
      } else {
        body.model = "gpt-4o-mini";
        body.input = messages.map((m: { content: string }) => m.content).join("\n");
      }
      if (stream) body.stream = true;

      const rawPath = endpoint === "chat" ? "chat/completions" : endpoint;
      const res = await fetch(`${api}/v1/${rawPath}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.text();
        return Response.json({ error: { message: `HTTP ${res.status}: ${err.slice(0, 200)}` } }, { status: 500 });
      }

      if (stream) return simplifiedSSE(rawStreamContent(res, endpoint));

      const data = await res.json() as any;
      return simplifiedSSE(async function* () { yield extractContent(endpoint, data); }());
    }

    if (endpoint === "chat") {
      const openai = new OpenAI({ baseURL: api + "/v1", apiKey: accessToken });
      if (stream) {
        const sdkStream = await openai.chat.completions.create({ model: "gpt-4o-mini", messages, stream: true });
        return simplifiedSSE(chatContent(sdkStream as any));
      }
      const resp = await openai.chat.completions.create({ model: "gpt-4o-mini", messages }) as any;
      return simplifiedSSE(async function* () { yield resp.choices?.[0]?.message?.content || ""; }());
    }

    if (endpoint === "messages") {
      const anthropic = new Anthropic({ baseURL: api, authToken: accessToken });
      if (stream) {
        const sdkStream = await anthropic.messages.create({ model: "claude-sonnet-4-6", messages, stream: true } as any);
        return simplifiedSSE(messagesContent(sdkStream));
      }
      const resp = await anthropic.messages.create({ model: "claude-sonnet-4-6", messages }) as any;
      return simplifiedSSE(async function* () { yield resp.content?.[0]?.text || ""; }());
    }

    if (endpoint === "responses") {
      const openai = new OpenAI({ baseURL: api + "/v1", apiKey: accessToken });
      const input = messages.map((m) => m.content).join("\n");
      if (stream) {
        const sdkStream = await openai.responses.create({ model: "gpt-4o-mini", input, stream: true } as any);
        return simplifiedSSE(responsesContent(sdkStream as any));
      }
      const resp = await openai.responses.create({ model: "gpt-4o-mini", input }) as any;
      return simplifiedSSE(async function* () { yield resp.output?.[0]?.content?.[0]?.text || ""; }());
    }

    return Response.json({ error: { message: "Unknown endpoint: " + endpoint } }, { status: 400 });
  } catch (e) {
    return Response.json({ error: { message: e instanceof Error ? e.message : "Unknown error" } }, { status: 500 });
  }
}

const SNIPPETS: Record<string, Record<string, Record<string, string>>> = {
  chat: {
    sdk: {
      stream: [
        "const openai = new OpenAI({",
        '  baseURL: "https://infer0.com",',
        "  apiKey: accessToken,",
        "});",
        "const stream = await openai.chat.completions.create({",
        '  // ignored — determined per-user by their provider config',
        '  model: "gpt-4o",',
        '  messages: [{ role: "user", content: "Hello" }],',
        "  stream: true,",
        "});",
        "for await (const chunk of stream) {",
        '  process.stdout.write(chunk.choices[0]?.delta?.content || "");',
        "}",
      ].join("\\n"),
      nonstream: [
        "const openai = new OpenAI({",
        '  baseURL: "https://infer0.com",',
        "  apiKey: accessToken,",
        "});",
        "const resp = await openai.chat.completions.create({",
        '  // ignored — determined per-user by their provider config',
        '  model: "gpt-4o",',
        '  messages: [{ role: "user", content: "Hello" }],',
        "});",
        "console.log(resp.choices[0].message.content);",
      ].join("\n"),
    },
    raw: {
      stream: [
        'const res = await fetch("https://infer0.com/v1/chat/completions", {',
        '  method: "POST",',
        '  headers: { "Content-Type": "application/json", Authorization: "Bearer " + accessToken },',
        '  body: JSON.stringify({',
        '    // ignored — determined per-user by their provider config',
        '    model: "gpt-4o",',
        '    messages: [{ role: "user", content: "Hello" }],',
        "    stream: true,",
        "  }),",
        "});",
        "const reader = res.body.getReader();",
        "const decoder = new TextDecoder();",
        'let buf = "";',
        "while (true) {",
        "  const { done, value } = await reader.read();",
        "  if (done) break;",
        '  buf += decoder.decode(value, { stream: true });',
        '  for (const line of buf.split("\\n")) {',
        '    if (!line.startsWith("data: ")) continue;',
        '    const data = line.slice(6);',
        '    if (data === "[DONE]") continue;',
        "    const json = JSON.parse(data);",
        '    process.stdout.write(json.choices[0]?.delta?.content || "");',
        "  }",
        "}",
      ].join("\n"),
      nonstream: [
        'const res = await fetch("https://infer0.com/v1/chat/completions", {',
        '  method: "POST",',
        '  headers: { "Content-Type": "application/json", Authorization: "Bearer " + accessToken },',
        '  body: JSON.stringify({',
        '    // ignored — determined per-user by their provider config',
        '    model: "gpt-4o",',
        '    messages: [{ role: "user", content: "Hello" }],',
        "  }),",
        "});",
        "const data = await res.json();",
        "console.log(data.choices[0].message.content);",
      ].join("\n"),
    },
  },
  responses: {
    sdk: {
      stream: [
        "const openai = new OpenAI({",
        '  baseURL: "https://infer0.com",',
        "  apiKey: accessToken,",
        "});",
        "const stream = await openai.responses.create({",
        '  // ignored — determined per-user by their provider config',
        '  model: "gpt-4o",',
        '  input: "Hello",',
        "  stream: true,",
        "});",
        "for await (const event of stream) {",
        '  if (event.type === "response.output_text.delta") {',
        "    process.stdout.write(event.delta);",
        "  }",
        "}",
      ].join("\n"),
      nonstream: [
        "const openai = new OpenAI({",
        '  baseURL: "https://infer0.com",',
        "  apiKey: accessToken,",
        "});",
        "const resp = await openai.responses.create({",
        '  // ignored — determined per-user by their provider config',
        '  model: "gpt-4o",',
        '  input: "Hello",',
        "});",
        "console.log(resp.output[0].content[0].text);",
      ].join("\n"),
    },
    raw: {
      stream: [
        'const res = await fetch("https://infer0.com/v1/responses", {',
        '  method: "POST",',
        '  headers: { "Content-Type": "application/json", Authorization: "Bearer " + accessToken },',
        '  body: JSON.stringify({',
        '    // ignored — determined per-user by their provider config',
        '    model: "gpt-4o",',
        '    input: "Hello",',
        "    stream: true,",
        "  }),",
        "});",
        "const reader = res.body.getReader();",
        "const decoder = new TextDecoder();",
        'let buf = "";',
        "while (true) {",
        "  const { done, value } = await reader.read();",
        "  if (done) break;",
        '  buf += decoder.decode(value, { stream: true });',
        '  for (const line of buf.split("\\n")) {',
        '    if (!line.startsWith("data: ")) continue;',
        "    const json = JSON.parse(line.slice(6));",
        '    if (json.type === "response.output_text.delta") {',
        "      process.stdout.write(json.delta);",
        "    }",
        "  }",
        "}",
      ].join("\n"),
      nonstream: [
        'const res = await fetch("https://infer0.com/v1/responses", {',
        '  method: "POST",',
        '  headers: { "Content-Type": "application/json", Authorization: "Bearer " + accessToken },',
        '  body: JSON.stringify({',
        '    // ignored — determined per-user by their provider config',
        '    model: "gpt-4o",',
        '    input: "Hello",',
        "  }),",
        "});",
        "const data = await res.json();",
        "console.log(data.output[0].content[0].text);",
      ].join("\n"),
    },
  },
  messages: {
    sdk: {
      stream: [
        "const anthropic = new Anthropic({",
        '  baseURL: "https://infer0.com",',
        "  authToken: accessToken,",
        "});",
        "const stream = await anthropic.messages.create({",
        '  // ignored — determined per-user by their provider config',
        '  model: "claude-sonnet-4-6",',
        '  messages: [{ role: "user", content: "Hello" }],',
        "  stream: true,",
        "});",
        "for await (const event of stream) {",
        '  if (event.type === "content_block_delta") {',
        "    process.stdout.write(event.delta.text);",
        "  }",
        "}",
      ].join("\n"),
      nonstream: [
        "const anthropic = new Anthropic({",
        '  baseURL: "https://infer0.com",',
        "  authToken: accessToken,",
        "});",
        "const resp = await anthropic.messages.create({",
        '  // ignored — determined per-user by their provider config',
        '  model: "claude-sonnet-4-6",',
        '  messages: [{ role: "user", content: "Hello" }],',
        "});",
        "console.log(resp.content[0].text);",
      ].join("\n"),
    },
    raw: {
      stream: [
        'const res = await fetch("https://infer0.com/v1/messages", {',
        '  method: "POST",',
        '  headers: { "Content-Type": "application/json", Authorization: "Bearer " + accessToken },',
        '  body: JSON.stringify({',
        '    // ignored — determined per-user by their provider config',
        '    model: "claude-sonnet-4-6",',
        '    messages: [{ role: "user", content: "Hello" }],',
        "    stream: true,",
        "  }),",
        "});",
        "const reader = res.body.getReader();",
        "const decoder = new TextDecoder();",
        'let buf = "";',
        "while (true) {",
        "  const { done, value } = await reader.read();",
        "  if (done) break;",
        '  buf += decoder.decode(value, { stream: true });',
        '  for (const line of buf.split("\\n")) {',
        '    if (!line.startsWith("data: ")) continue;',
        "    const json = JSON.parse(line.slice(6));",
        '    if (json.type === "content_block_delta") {',
        "      process.stdout.write(json.delta.text);",
        "    }",
        "  }",
        "}",
      ].join("\n"),
      nonstream: [
        'const res = await fetch("https://infer0.com/v1/messages", {',
        '  method: "POST",',
        '  headers: { "Content-Type": "application/json", Authorization: "Bearer " + accessToken },',
        '  body: JSON.stringify({',
        '    // ignored — determined per-user by their provider config',
        '    model: "claude-sonnet-4-6",',
        '    messages: [{ role: "user", content: "Hello" }],',
        "  }),",
        "});",
        "const data = await res.json();",
        "console.log(data.content[0].text);",
      ].join("\n"),
    },
  },
};

function renderHTML(clientId: string, infer0Api: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="client-id" content="${clientId}" />
<meta name="infer0-api" content="${infer0Api}" />
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='6' fill='%230b0b09' stroke='%232a2a22' stroke-width='1'/><text x='16' y='23' font-size='20' font-weight='800' text-anchor='middle' fill='%23d97706'>0</text></svg>" />
<link rel="apple-touch-icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='6' fill='%230b0b09' stroke='%232a2a22' stroke-width='1'/><text x='16' y='23' font-size='20' font-weight='800' text-anchor='middle' fill='%23d97706'>0</text></svg>" />
<title>infer0 Test Client</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css" />
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#0b0b09;--bg-card:#151512;--bg-hover:#1d1d18;--border:#27272a;--text:#fafafa;--text-muted:#a1a1aa;--accent:#d97706;--radius:8px}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:var(--bg);color:var(--text);line-height:1.6;min-height:100vh;display:flex;flex-direction:column;background-image:linear-gradient(rgba(217,119,6,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(217,119,6,0.03) 1px,transparent 1px);background-size:64px 64px}
.container{max-width:720px;margin:0 auto;padding:48px 24px;width:100%}
h1{font-size:1.75rem;font-weight:800;letter-spacing:-0.03em;margin-bottom:4px}
h1 span{color:var(--accent)}
p{color:var(--text-muted);margin-bottom:24px;font-size:0.875rem}
.card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:20px;margin-bottom:16px}
pre{background:var(--bg-hover);border:1px solid var(--border);border-radius:var(--radius);padding:12px;font-size:0.75rem;overflow-x:auto;margin-bottom:16px;font-family:"SF Mono","Fira Code",monospace}
code{font-family:"SF Mono","Fira Code",monospace}
.tabs{display:flex;gap:0;margin-bottom:0;border-bottom:1px solid var(--border)}
.tab{padding:10px 16px;cursor:pointer;font-size:0.8125rem;color:var(--text-muted);border:1px solid transparent;border-bottom:none;border-radius:var(--radius) var(--radius) 0 0;background:transparent;transition:all .15s}
.tab:hover{color:var(--text);background:var(--bg-hover)}
.tab.active{color:var(--accent);border-color:var(--border);background:var(--bg-card);margin-bottom:-1px}
.controls{display:flex;align-items:center;gap:16px;margin:16px 0}
.toggle-label{display:flex;align-items:center;gap:8px;font-size:0.8125rem;color:var(--text-muted);cursor:pointer}
.toggle-label input[type=checkbox]{accent-color:var(--accent);width:16px;height:16px}
.chat-box{background:var(--bg-hover);border:1px solid var(--border);border-radius:var(--radius);padding:16px;min-height:200px;max-height:400px;overflow-y:auto;margin-bottom:12px;font-size:1rem;white-space:pre-wrap}
.chat-box .empty{color:var(--text-muted);text-align:center;padding:40px 0}
.chat-box .msg{margin-bottom:12px;padding:8px 12px;border-radius:var(--radius);line-height:1.5}
.chat-box .msg.user{background:var(--accent);color:#fff;margin-left:24px}
.chat-box .msg.assistant{background:var(--bg-card);border:1px solid var(--border);margin-right:24px}
.chat-box .msg.error{background:#7f1d1d;color:#fca5a5}
.chat-box .msg .role{font-size:0.6875rem;text-transform:uppercase;letter-spacing:0.05em;opacity:0.7;margin-bottom:4px}
.input-row{display:flex;gap:8px}
.input-row input{flex:1;margin-bottom:0;font-size:1rem}
button{background:var(--accent);color:#fff;border:none;padding:10px 20px;border-radius:var(--radius);font-size:0.875rem;cursor:pointer;white-space:nowrap}
button:hover{background:#f59e0b}
button:disabled{opacity:0.5;cursor:not-allowed}
.badge{display:inline-block;background:var(--bg-hover);border:1px solid var(--border);padding:2px 8px;border-radius:4px;font-size:0.6875rem;color:var(--text-muted);margin-bottom:16px}
.hint{font-size:0.75rem;color:var(--text-muted);margin-top:4px}
a{color:var(--accent)}
pre code.hljs{background:transparent!important;padding:0!important}
.hljs{color:var(--text)!important;background:transparent!important}
.hljs-keyword{color:#f59e0b!important}
.hljs-string{color:#a3e635!important}
.hljs-number{color:#f97316!important}
.hljs-built_in{color:#f59e0b!important}
.hljs-function{color:#60a5fa!important}
.hljs-title{color:#60a5fa!important}
.hljs-property{color:#60a5fa!important}
.hljs-comment,.hljs-quote{color:#6a6a5e!important;font-style:italic!important}
.hljs-variable{color:var(--text)!important}
</style>
</head>
<body>
<div class="container">
<div class="badge">infer0 Test Client</div>
<h1><span>infer0</span> Test Client</h1>
<p>A third-party app powered by <a href="https://infer0.com" target="_blank">infer0</a>.</p>

<div class="card" id="sign-in-card">
  <p style="margin-bottom:16px">Sign in with infer0 to use this app.</p>
  <p class="hint" style="margin-bottom:12px">You'll be asked which provider to use.</p>
  <button id="sign-in-btn">Sign in with infer0</button>
</div>

<div id="app" style="display:none">
  <div class="tabs">
    <div class="tab active" data-endpoint="chat">Chat Completions</div>
    <div class="tab" data-endpoint="responses">Responses</div>
    <div class="tab" data-endpoint="messages">Messages</div>
  </div>

  <div class="controls">
    <label class="toggle-label">
      <input type="checkbox" id="stream-toggle" checked />
      Stream
    </label>
    <label class="toggle-label">
      <input type="checkbox" id="sdk-toggle" checked />
      Use SDK
    </label>
  </div>

  <pre><code id="snippet" class="language-javascript"></code></pre>

  <div class="card" id="chat-card">
    <div class="chat-box" id="chat">
      <div class="empty">Send a message to start chatting.</div>
    </div>
    <div class="input-row">
      <input type="text" id="message" placeholder="Type a message..." autocomplete="off" />
      <button id="send-btn">Send</button>
    </div>
  </div>
</div>
</div>

<script>
const accessToken = new URLSearchParams(location.search).get('access_token');

const signInCard = document.getElementById('sign-in-card');
const app = document.getElementById('app');
const messageInput = document.getElementById('message');
const sendBtn = document.getElementById('send-btn');
const chat = document.getElementById('chat');
const signInBtn = document.getElementById('sign-in-btn');
const snippet = document.getElementById('snippet');
const streamToggle = document.getElementById('stream-toggle');
const sdkToggle = document.getElementById('sdk-toggle');
const tabs = document.querySelectorAll('.tab');
const messages = [];
let currentEndpoint = 'chat';

const SNIPPETS = ${JSON.stringify(SNIPPETS)};

if (accessToken) {
  signInCard.style.display = 'none';
  app.style.display = 'block';
  history.replaceState({}, '', '/');
  updateSnippet();
}

signInBtn.addEventListener('click', () => {
  const clientId = document.querySelector('meta[name="client-id"]')?.getAttribute('content');
  const infer0Api = document.querySelector('meta[name="infer0-api"]')?.getAttribute('content') || 'https://infer0.com';
  if (!clientId) { alert('Client ID not configured'); return; }
  const redirectUri = location.origin + '/oauth/callback';
  window.location.href = infer0Api + '/oauth/authorize?client_id=' + encodeURIComponent(clientId) + '&redirect_uri=' + encodeURIComponent(redirectUri) + '&response_type=code';
});

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentEndpoint = tab.dataset.endpoint;
    updateSnippet();
  });
});

streamToggle.addEventListener('change', updateSnippet);
sdkToggle.addEventListener('change', updateSnippet);

function updateSnippet() {
  const ep = currentEndpoint;
  const mode = sdkToggle.checked ? 'sdk' : 'raw';
  const stream = streamToggle.checked ? 'stream' : 'nonstream';
  const code = SNIPPETS[ep][mode][stream];
  if (typeof hljs !== 'undefined') {
    snippet.innerHTML = hljs.highlight(code, { language: 'javascript' }).value;
  } else {
    snippet.textContent = code;
  }
}

function addMessage(role, content) {
  const empty = chat.querySelector('.empty');
  if (empty) empty.remove();
  const msg = document.createElement('div');
  msg.className = 'msg ' + role;
  const roleDiv = document.createElement('div');
  roleDiv.className = 'role';
  roleDiv.textContent = role;
  msg.appendChild(roleDiv);
  const contentDiv = document.createElement('div');
  contentDiv.className = 'content';
  contentDiv.textContent = content;
  msg.appendChild(contentDiv);
  chat.appendChild(msg);
  chat.scrollTop = chat.scrollHeight;
  return contentDiv;
}

sendBtn.addEventListener('click', async () => {
  const text = messageInput.value.trim();

  if (!accessToken) { addMessage('error', 'Not signed in. Please sign in with infer0 first.'); return; }
  if (!text) return;

  messageInput.value = '';
  addMessage('user', text);
  messages.push({ role: 'user', content: text });

  sendBtn.disabled = true;
  sendBtn.textContent = 'Streaming...';

  const contentDiv = addMessage('assistant', '');
  let responseText = '';

  try {
    const res = await fetch('/api/infer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessToken,
        messages,
        endpoint: currentEndpoint,
        stream: streamToggle.checked,
        mode: sdkToggle.checked ? 'sdk' : 'raw',
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
      contentDiv.textContent = err.error?.message || 'Request failed';
      contentDiv.className = 'msg error';
      responseText = contentDiv.textContent;
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split('\\n\\n');
      buffer = parts.pop() || '';

      for (const part of parts) {
        for (const line of part.split('\\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const json = JSON.parse(data);
            if (json.error) {
              contentDiv.textContent += json.error;
              responseText += json.error;
            } else if (json.content) {
              contentDiv.textContent += json.content;
              contentDiv.scrollIntoView({ behavior: 'smooth' });
              responseText += json.content;
            }
          } catch {}
        }
      }
    }
  } catch (e) {
    contentDiv.textContent += '\\n[Network error: ' + e.message + ']';
    responseText += '\\n[Network error: ' + e.message + ']';
  } finally {
    if (responseText) {
      messages.push({ role: 'assistant', content: responseText });
    }
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
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
<script>hljs.highlightAll(); updateSnippet();</script>
</body>
</html>`;
}
