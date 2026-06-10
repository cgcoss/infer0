import { html } from "hono/html";

interface LayoutProps {
  title: string;
  user?: { name: string | null; email: string; avatar_url: string | null } | null;
  children: unknown;
}

export function Layout({ title, user, children }: LayoutProps) {
  return html`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${title} | infer0</title>
        <meta name="description" content="infer0 is an inference routing service. Developers integrate once, end users bring their own provider." />
        <meta property="og:title" content="${title} | infer0" />
        <meta property="og:description" content="infer0 is an inference routing service. Developers integrate once, end users bring their own provider." />
        <meta property="og:image" content="https://infer0.com/og-image" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="${title} | infer0" />
        <meta name="twitter:description" content="infer0 is an inference routing service. Developers integrate once, end users bring their own provider." />
        <meta name="twitter:image" content="https://infer0.com/og-image" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=Syne:wght@600;700;800&display=swap" rel="stylesheet" />
        <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='6' fill='%230b0b09' stroke='%232a2a22' stroke-width='1'/><text x='16' y='23' font-size='20' font-weight='800' text-anchor='middle' fill='%23d97706'>0</text></svg>" />
<link rel="apple-touch-icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='6' fill='%230b0b09' stroke='%232a2a22' stroke-width='1'/><text x='16' y='23' font-size='20' font-weight='800' text-anchor='middle' fill='%23d97706'>0</text></svg>" />
        <style>
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          :root {
            --bg: #0b0b09;
            --bg-card: #151512;
            --bg-hover: #1d1d18;
            --border: #2a2a22;
            --text: #f5f4ef;
            --text-muted: #a09f96;
            --accent: #d97706;
            --accent-hover: #f59e0b;
            --accent-glow: rgba(217, 119, 6, 0.15);
            --radius: 6px;
            --max-w: 1000px;
            --font-display: "Syne", sans-serif;
            --font-body: "DM Sans", sans-serif;
            --font-code: "SF Mono", "Fira Code", "JetBrains Mono", monospace;
          }
          body {
            font-family: var(--font-body);
            background: var(--bg);
            color: var(--text);
            line-height: 1.7;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            background-image:
              linear-gradient(rgba(217, 119, 6, 0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(217, 119, 6, 0.03) 1px, transparent 1px);
            background-size: 64px 64px;
            -webkit-font-smoothing: antialiased;
          }
          nav {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 20px 24px;
            max-width: var(--max-w);
            margin: 0 auto;
            width: 100%;
            position: relative;
          }
          nav::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 24px;
            right: 24px;
            height: 1px;
            background: linear-gradient(90deg, transparent, var(--border), var(--accent), var(--border), transparent);
          }
          nav .logo {
            font-family: var(--font-display);
            font-size: 1.25rem;
            font-weight: 800;
            color: var(--text);
            text-decoration: none;
            letter-spacing: -0.02em;
          }
          nav .logo span { color: var(--accent); }
          nav .links { display: flex; gap: 28px; align-items: center; }
          nav .links a {
            color: var(--text-muted);
            text-decoration: none;
            font-size: 0.8125rem;
            font-weight: 500;
            letter-spacing: 0.02em;
            text-transform: uppercase;
            transition: color 0.15s;
          }
          nav .links a:hover { color: var(--text); }
          nav .links .btn {
            background: var(--accent);
            color: #fff;
            padding: 7px 20px;
            border-radius: var(--radius);
            font-size: 0.8125rem;
            text-transform: none;
            letter-spacing: normal;
            font-weight: 600;
            transition: background 0.15s;
          }
          nav .links .btn:hover { background: var(--accent-hover); color: #fff; }
          nav .avatar { width: 28px; height: 28px; border-radius: 50%; object-fit: cover; }
          .hamburger { display:none; background:none; border:none; cursor:pointer; padding:0; color:var(--text-muted) }
          .hamburger:hover { color:var(--text) }
          .hamburger svg { width:24px; height:24px; display:block }
          .hamburger .avatar { width:28px;height:28px;border-radius:50%;object-fit:cover;display:block }
          .mobile-user-link { display:block;padding:6px 0;color:var(--text-muted);text-decoration:none;font-size:0.8125rem;font-weight:500;letter-spacing:0.02em;text-transform:uppercase;transition:color 0.15s }
          .mobile-user-link:hover { color:var(--text) }
          .mobile-divider { height:1px;background:var(--border);margin:8px 0 }
          .mobile-user-section { padding-top:12px;border-top:1px solid var(--border);margin-top:4px }
          .mobile-user-header { font-size:0.8125rem;color:var(--text-muted);margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis }
          .desktop-only { display:block }
          .mobile-only { display:none }
          @media (max-width:700px) {
            .desktop-only { display:none !important }
            .mobile-only { display:block }
            nav .links { display:none; flex-direction:column; position:absolute; top:100%; left:0; right:0; background:var(--bg-card); border-bottom:1px solid var(--border); padding:12px 24px; gap:12px; z-index:200 }
            nav .links.open { display:flex }
            .hamburger { display:block }
            .container { padding:32px 16px }
            h1 { font-size:1.75rem !important }
            h2 { font-size:1.25rem !important }
            table { display:block; overflow-x:auto; white-space:nowrap }
          }
          pre { overflow-x:auto; white-space:pre; word-break:normal }
          img, video, iframe { max-width:100%; height:auto }
          .avatar-dropdown { position:relative }
          .avatar-btn { display:flex;align-items:center;gap:4px;background:none;border:none;cursor:pointer;padding:0;color:var(--text-muted) }
          .avatar-btn:hover { color:var(--text) }
          .avatar-btn .chevron { width:16px;height:16px;transition:transform 0.15s }
          .avatar-dropdown.open .avatar-btn .chevron { transform:rotate(180deg);color:var(--text) }
          .avatar-dropdown.open .dropdown-menu { display:block }
          .dropdown-menu { display:none;position:absolute;top:calc(100% + 10px);right:0;min-width:220px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:4px 0;z-index:100;box-shadow:0 8px 24px rgba(0,0,0,0.4) }
          .dropdown-menu a { display:block;padding:8px 16px;font-size:0.875rem;color:var(--text);text-decoration:none }
          .dropdown-menu a:hover { background:var(--bg-hover) }
          .dropdown-header { padding:8px 16px;font-size:0.8125rem;color:var(--text-muted);border-bottom:1px solid var(--border);margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis }
          .dropdown-divider { height:1px;background:var(--border);margin:4px 0 }
          .card-grid { display:flex;flex-direction:column;gap:12px;margin-bottom:24px }
          .record-card { background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:20px }
          .record-card .card-title { font-size:1rem;font-weight:600;margin-bottom:4px }
          .record-card .card-sub { font-size:0.8125rem;color:var(--text-muted);margin-bottom:12px }
          .record-card .card-row { display:flex;justify-content:space-between;align-items:center;padding:3px 0;font-size:0.875rem }
          .record-card .card-label { color:var(--text-muted);font-size:0.75rem }
          .record-card .card-divider { height:1px;background:var(--border);margin:12px 0 }
          .record-card .card-actions { display:flex;gap:8px;flex-wrap:wrap;align-items:center }
          .record-card select.card-select { background:var(--bg-hover);border:1px solid var(--border);border-radius:4px;padding:4px 6px;color:var(--text);font-size:0.75rem;max-width:200px }
          .spend-row { display:flex;align-items:center;gap:6px;font-size:0.875rem }
          .spend-label { color:var(--text-muted);font-size:0.75rem }
          .spend-value { font-weight:600 }
          .spend-max { color:var(--text-muted);font-size:0.75rem }
          .spend-limit-form { display:flex;gap:8px;align-items:center;margin-bottom:12px }
          .spend-limit-input { background:var(--bg-hover);border:1px solid var(--border);border-radius:var(--radius);padding:6px 10px;color:var(--text);font-size:0.8125rem;width:140px }
          .spend-limit-input::placeholder { color:var(--text-muted) }
          .btn-save-limit { background:var(--accent);color:#fff;border:none;border-radius:var(--radius);padding:6px 14px;font-size:0.8125rem;cursor:pointer;font-weight:600 }
          .btn-save-limit:hover { background:var(--accent-hover) }
          .badge { display:inline-block;padding:2px 8px;border-radius:4px;font-size:0.75rem;font-weight:600 }
          .badge-active { background:rgba(52,211,153,0.15);color:#34d399 }
          .badge-revoked { background:rgba(239,68,68,0.15);color:#ef4444 }
          .badge-default { background:rgba(217,119,6,0.15);color:var(--accent) }
          .hub-grid { display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-top:24px }
          .hub-card { background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:24px;text-decoration:none;color:var(--text);transition:border-color 0.15s }
          .hub-card:hover { border-color:var(--accent) }
          .hub-card h3 { font-size:1rem;font-weight:600;margin-bottom:4px }
          .hub-card .count { font-size:2rem;font-weight:800;color:var(--accent);margin:8px 0 }
          .hub-card p { font-size:0.8125rem;color:var(--text-muted);margin:0 }
          main { flex: 1; }
          .container { max-width: var(--max-w); margin: 0 auto; padding: 64px 24px; }
          footer { text-align: center; padding: 32px 24px; color: var(--text-muted); font-size: 0.75rem; border-top: 1px solid var(--border); position: relative; }
          footer::before {
            content: '';
            position: absolute;
            top: -1px;
            left: 24px;
            right: 24px;
            height: 1px;
            background: linear-gradient(90deg, transparent, var(--border), var(--accent), var(--border), transparent);
          }
          h1 {
            font-family: var(--font-display);
            font-weight: 800;
            letter-spacing: -0.03em;
            line-height: 1.1;
          }
          h2 {
            font-family: var(--font-display);
            font-weight: 700;
            letter-spacing: -0.02em;
            line-height: 1.2;
          }
          h3 { font-family: var(--font-body); font-weight: 600; }
          p { color: var(--text-muted); margin-bottom: 16px; line-height: 1.7; }
          pre {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 20px;
            overflow-x: auto;
            font-size: 0.8125rem;
            margin-bottom: 16px;
            line-height: 1.6;
            position: relative;
          }
          code { font-family: var(--font-code); font-size: 0.8125rem; }
          .badge-pill {
            display: inline-block;
            background: rgba(217,119,6,0.1);
            border: 1px solid rgba(217,119,6,0.2);
            color: var(--accent);
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.75rem;
            font-weight: 600;
            font-family: var(--font-body);
          }
          .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(260px, 100%), 1fr)); gap: 20px; margin-bottom: 48px; }
          .card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 28px; transition: border-color 0.15s; }
          .card:hover { border-color: rgba(217,119,6,0.3); }
          .card h3 { font-size: 1rem; font-weight: 600; margin-bottom: 8px; color: var(--text); }
          .card p { font-size: 0.875rem; margin-bottom: 0; }
          .hero {
            text-align: center;
            padding: 80px 0 56px;
            position: relative;
          }
          .hero::before {
            content: '';
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 600px;
            height: 600px;
            background: radial-gradient(circle, rgba(217,119,6,0.04) 0%, transparent 70%);
            pointer-events: none;
          }
          .hero h1 { font-size: 3rem; position: relative; }
          .hero p { font-size: 1.125rem; max-width: 600px; margin: 16px auto; position: relative; }
          .btn-primary {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: var(--accent);
            color: #fff;
            padding: 12px 28px;
            border-radius: var(--radius);
            text-decoration: none;
            font-weight: 600;
            font-size: 0.875rem;
            transition: background 0.15s;
            border: none;
            cursor: pointer;
          }
          .btn-primary:hover { background: var(--accent-hover); }
          .btn-secondary {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: transparent;
            color: var(--text);
            padding: 12px 28px;
            border-radius: var(--radius);
            text-decoration: none;
            font-weight: 600;
            font-size: 0.875rem;
            border: 1px solid var(--border);
            transition: background 0.15s, border-color 0.15s;
          }
          .btn-secondary:hover {
            background: var(--bg-hover);
            border-color: var(--accent);
          }
          .flow { display: flex; align-items: center; justify-content: center; gap: 16px; flex-wrap: wrap; margin: 32px 0; }
          .flow-step { text-align: center; }
          .flow-step .num {
            width: 44px;
            height: 44px;
            border-radius: 50%;
            background: rgba(217,119,6,0.1);
            border: 1px solid rgba(217,119,6,0.2);
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 10px;
            font-weight: 700;
            font-size: 0.875rem;
            font-family: var(--font-display);
            color: var(--accent);
          }
          .flow-step p { font-size: 0.8125rem; margin: 0; max-width: 140px; }
          .flow-arrow { color: var(--border); font-size: 1.25rem; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 0.875rem; }
          th, td { text-align: left; padding: 12px 16px; border-bottom: 1px solid var(--border); }
          th {
            color: var(--text-muted);
            font-weight: 600;
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            font-family: var(--font-body);
          }
          td { font-family: var(--font-code); font-size: 0.8125rem; }
          .endpoint { margin-bottom: 32px; }
          .endpoint h3 { font-size: 0.9375rem; margin-bottom: 8px; }
          .endpoint .method {
            display: inline-block;
            background: var(--accent);
            color: #fff;
            padding: 2px 10px;
            border-radius: 4px;
            font-size: 0.6875rem;
            font-weight: 700;
            margin-right: 8px;
            font-family: var(--font-body);
            letter-spacing: 0.03em;
          }
          .endpoint .method.get { background: #059669; }
          .endpoint .method.post { background: var(--accent); }
          .endpoint .method.put { background: #d97706; }
          .endpoint .method.delete { background: #dc2626; }
          .endpoint .path {
            color: var(--text-muted);
            font-family: var(--font-code);
            font-size: 0.8125rem;
          }
          ::selection {
            background: rgba(217, 119, 6, 0.3);
            color: var(--text);
          }
          /* Subtle scrollbar */
          ::-webkit-scrollbar { width: 8px; height: 8px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
          ::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }
          /* Section spacing */
          section { margin-bottom: 80px; }
          section:last-child { margin-bottom: 0; }
          section h2 {
            font-size: 1.75rem;
            margin-bottom: 24px;
            position: relative;
            display: inline-block;
          }
          section h2::after {
            content: '';
            position: absolute;
            bottom: -4px;
            left: 0;
            width: 40px;
            height: 3px;
            background: var(--accent);
            border-radius: 2px;
          }
        </style>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css" />
        <style>
          pre code.hljs { background: transparent !important; padding: 0 !important; }
          .hljs { color: var(--text) !important; background: transparent !important; }
          .hljs-keyword { color: #f59e0b !important; }
          .hljs-string { color: #a3e635 !important; }
          .hljs-number { color: #f97316 !important; }
          .hljs-built_in { color: #f59e0b !important; }
          .hljs-literal { color: #f97316 !important; }
          .hljs-function { color: #60a5fa !important; }
          .hljs-title { color: #60a5fa !important; }
          .hljs-params { color: var(--text) !important; }
          .hljs-attr { color: #f59e0b !important; }
          .hljs-attribute { color: #f59e0b !important; }
          .hljs-property { color: #60a5fa !important; }
          .hljs-selector-tag { color: #f59e0b !important; }
          .hljs-meta { color: #6a6a5e !important; }
          .hljs-punctuation { color: #a09f96 !important; }
          .hljs-section { color: #60a5fa !important; }
          .hljs-variable { color: var(--text) !important; }
          .hljs-comment,
          .hljs-quote,
          .hljs-doctag { color: #6a6a5e !important; font-style: italic !important; }
          .hljs-tag,
          .hljs-name { color: #f59e0b !important; }
          .hljs-selector-class { color: #60a5fa !important; }
          .hljs-regexp,
          .hljs-symbol { color: #a3e635 !important; }
          .hljs-deletion { color: #ef4444 !important; }
          .hljs-addition { color: #a3e635 !important; }
          .hljs-link { color: #60a5fa !important; text-decoration: underline !important; }
          .hljs-emphasis { font-style: italic !important; }
          .hljs-strong { font-weight: bold !important; }
        </style>
      </head>
      <body>
        <nav>
          <a href="/" class="logo">infer<span>0</span></a>
          <button class="hamburger" id="hamburger" aria-label="Menu">
            ${user
              ? html`<img class="avatar" src="${user.avatar_url ?? ""}" alt="${user.name ?? "Avatar"}" referrerpolicy="no-referrer" />`
              : html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>`}
          </button>
          <div class="links" id="nav-links">
            <a href="/quickstart">Quickstart</a>
            <a href="/pricing">Pricing</a>
            <a href="/faq">FAQ</a>
            <a href="/docs">Docs</a>
            ${user
              ? html`
                <div class="avatar-dropdown desktop-only" id="avatar-dropdown">
                  <button class="avatar-btn" onclick="document.getElementById('avatar-dropdown').classList.toggle('open')" aria-label="User menu">
                    <img class="avatar" src="${user.avatar_url ?? ""}" alt="${user.name ?? "Avatar"}" referrerpolicy="no-referrer" />
                    <svg class="chevron" viewBox="0 0 20 20" fill="currentColor"><path d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"/></svg>
                  </button>
                  <div class="dropdown-menu">
                    <div class="dropdown-header">${user.email}</div>
                    <a href="/providers">AI Providers</a>
                    <a href="/services">Authorizations</a>
                    <a href="/dev/apps">Developer Settings</a>
                    <div class="dropdown-divider"></div>
                    <a href="/logout">Sign out</a>
                  </div>
                </div>
                <div class="mobile-only mobile-user-section">
                  <div class="mobile-user-header">${user.email}</div>
                  <a href="/providers" class="mobile-user-link">AI Providers</a>
                  <a href="/services" class="mobile-user-link">Authorizations</a>
                  <a href="/dev/apps" class="mobile-user-link">Developer Settings</a>
                  <div class="mobile-divider"></div>
                  <a href="/logout" class="mobile-user-link">Sign out</a>
                </div>
                <script>
                document.addEventListener('click',function(e){var d=document.getElementById('avatar-dropdown');if(d&&!d.contains(e.target))d.classList.remove('open')});
                </script>`
              : html`<a href="/login" class="btn desktop-only">Sign in</a>
                <a href="/login" class="mobile-only mobile-user-link">Sign in</a>`}
          </div>
          <script>
          (function(){
            var h=document.getElementById('hamburger'),l=document.getElementById('nav-links');
            if(h&&l){
              h.addEventListener('click',function(e){e.stopPropagation();l.classList.toggle('open')});
              document.addEventListener('click',function(e){if(!l.contains(e.target)&&e.target!==h)l.classList.remove('open')});
              l.querySelectorAll('a').forEach(function(a){a.addEventListener('click',function(){l.classList.remove('open')})});
            }
          })();
          </script>
        </nav>
        <main>${children}</main>
        <footer>infer0 &mdash; use your own intelligence</footer>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
        <script>hljs.highlightAll();</script>
      </body>
    </html>
  `;
}
