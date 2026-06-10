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

    if (url.pathname === "/api/chat/stream" && request.method === "POST") {
      return handleChatStream(request, env);
    }

    if (url.pathname === "/") {
      return new Response(renderHTML(env.CLIENT_ID), { headers: { "Content-Type": "text/html" } });
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

async function handleChatStream(request: Request, env: Env): Promise<Response> {
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

    const gwRes = await fetch(`${env.INFER0_API}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ messages, stream: true }),
    });

    if (!gwRes.ok) {
      const errText = await gwRes.text();
      return Response.json(
        { error: { message: `HTTP ${gwRes.status}: ${errText.slice(0, 500)}` } },
        { status: gwRes.status },
      );
    }

    const contentType = gwRes.headers.get("content-type") ?? "";
    if (!contentType.includes("event-stream")) {
      const data = await gwRes.json() as Record<string, unknown>;
      return Response.json(data);
    }

    const reader = gwRes.body!.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    let bodySize = 0;

    const body = new ReadableStream({
      async start(controller) {
        let buf = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            bodySize += value.length;
            buf += decoder.decode(value, { stream: true });
            const parts = buf.split("\n\n");
            buf = parts.pop() ?? "";
            for (const part of parts) {
              for (const line of part.split("\n")) {
                if (!line.startsWith("data: ")) continue;
                const data = line.slice(6);
                if (data === "[DONE]") {
                  controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                  continue;
                }
                try {
                  const json = JSON.parse(data);
                  const content =
                    json.choices?.[0]?.delta?.content ?? "";
                  if (content) {
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ content })}\n\n`),
                    );
                  }
                  if (json.choices?.[0]?.finish_reason) {
                    controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                  }
                } catch {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ error: "parse error: " + data.slice(0, 200) })}\n\n`),
                  );
                }
              }
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        } catch (e) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: e instanceof Error ? e.message : "stream error" })}\n\n`,
            ),
          );
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
<div class="badge">infer0 Test Client</div>
<h1><span>infer0</span> Test Client</h1>
<p>A third-party app powered by <a href="https://infer0.com" target="_blank">infer0</a>.</p>

<pre><code>const res = await fetch("https://infer0.com/v1/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: "Bearer " + accessToken,
  },
  body: JSON.stringify({ messages, stream: true }),
});

const reader = res.body.getReader();
const decoder = new TextDecoder();
let buffer = "";

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  for (const p of buffer.split("\\n\\n")) {
    // parse and render chunks
  }
}</code></pre>

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
const messages = [];

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
    const res = await fetch('/api/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessToken,
        messages,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
      const msg = err.error?.message || 'Request failed';
      contentDiv.textContent = msg;
      contentDiv.className = 'msg error';
      responseText = msg;
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
              } else {
                const content = json.content || '';
                if (content) {
                  contentDiv.textContent += content;
                  contentDiv.scrollIntoView({ behavior: 'smooth' });
                  responseText += content;
                }
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
</body>
</html>`; }
