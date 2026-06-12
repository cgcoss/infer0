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

async function handleInfer(request: Request, env: Env): Promise<Response> {
  try {
    const { accessToken, messages, endpoint, stream } = await request.json<{
      accessToken: string;
      messages: Array<{ role: string; content: string }>;
      endpoint: string;
      stream: boolean;
    }>();

    if (!accessToken || !messages?.length) {
      return Response.json({ error: { message: "Missing accessToken or messages" } }, { status: 400 });
    }

    if (endpoint === "chat") {
      const openai = new OpenAI({ baseURL: env.INFER0_API, apiKey: accessToken });
      if (stream) {
        const sdkStream = await openai.chat.completions.create({ model: "gpt-4o-mini", messages, stream: true });
        return simplifiedSSE(chatContent(sdkStream as any));
      }
      const resp = await openai.chat.completions.create({ model: "gpt-4o-mini", messages }) as any;
      const text = resp.choices?.[0]?.message?.content || "";
      return simplifiedSSE(async function* () { yield text; }());
    }

    if (endpoint === "messages") {
      const anthropic = new Anthropic({ baseURL: env.INFER0_API, apiKey: accessToken });
      if (stream) {
        const sdkStream = await anthropic.messages.create({ model: "claude-sonnet-4-6", messages, stream: true } as any);
        return simplifiedSSE(messagesContent(sdkStream));
      }
      const resp = await anthropic.messages.create({ model: "claude-sonnet-4-6", messages }) as any;
      const text = resp.content?.[0]?.text || "";
      return simplifiedSSE(async function* () { yield text; }());
    }

    if (endpoint === "responses") {
      const openai = new OpenAI({ baseURL: env.INFER0_API, apiKey: accessToken });
      const input = messages.map((m) => m.content).join("\n");
      if (stream) {
        const sdkStream = await openai.responses.create({ model: "gpt-4o-mini", input, stream: true } as any);
        return simplifiedSSE(responsesContent(sdkStream as any));
      }
      const resp = await openai.responses.create({ model: "gpt-4o-mini", input }) as any;
      const text = resp.output?.[0]?.content?.[0]?.text || "";
      return simplifiedSSE(async function* () { yield text; }());
    }

    return Response.json({ error: { message: "Unknown endpoint: " + endpoint } }, { status: 400 });
  } catch (e) {
    return Response.json({ error: { message: e instanceof Error ? e.message : "Unknown error" } }, { status: 500 });
  }
}

const SNIPPETS: Record<string, string> = {
  chat: `const openai = new OpenAI({
  baseURL: "https://infer0.com",
  apiKey: accessToken,
});
const stream = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [
    { role: "user", content: "Hello" },
  ],
  stream: true,
});
for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || "");
}`,
  messages: `const anthropic = new Anthropic({
  baseURL: "https://infer0.com",
  apiKey: accessToken,
});
const stream = await anthropic.messages.create({
  model: "claude-sonnet-4-6",
  messages: [
    { role: "user", content: "Hello" },
  ],
  stream: true,
});
for await (const event of stream) {
  if (event.type === "content_block_delta") {
    process.stdout.write(event.delta.text);
  }
}`,
  responses: `const openai = new OpenAI({
  baseURL: "https://infer0.com",
  apiKey: accessToken,
});
const stream = await openai.responses.create({
  model: "gpt-4o",
  input: "Hello",
  stream: true,
});
for await (const event of stream) {
  if (event.type === "response.output_text.delta") {
    process.stdout.write(event.delta);
  }
}`,
};

function renderHTML(clientId: string, infer0Api: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="client-id" content="${clientId}" />
<meta name="infer0-api" content="${infer0Api}" />
<title>infer0 Test Client</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css" />
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#0a0a0b;--bg-card:#141416;--bg-hover:#1c1c1f;--border:#27272a;--text:#fafafa;--text-muted:#a1a1aa;--accent:#d97706;--radius:8px}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:var(--bg);color:var(--text);line-height:1.6;min-height:100vh;display:flex;flex-direction:column}
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
    <div class="tab" data-endpoint="messages">Messages</div>
    <div class="tab" data-endpoint="responses">Responses</div>
  </div>

  <div class="controls">
    <label class="toggle-label">
      <input type="checkbox" id="stream-toggle" checked />
      Stream response
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
  if (!clientId) { alert('Client ID not configured'); return; }
  const redirectUri = location.origin + '/oauth/callback';
  window.location.href = 'https://infer0.com/oauth/authorize?client_id=' + encodeURIComponent(clientId) + '&redirect_uri=' + encodeURIComponent(redirectUri) + '&response_type=code';
});

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentEndpoint = tab.dataset.endpoint;
    updateSnippet();
  });
});

function updateSnippet() {
  snippet.textContent = SNIPPETS[currentEndpoint];
  if (typeof hljs !== 'undefined') hljs.highlightElement(snippet);
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
