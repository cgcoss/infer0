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
        <title>${title} — infer0</title>
        <meta
          name="description"
          content="infer0 is an inference routing service. Developers integrate once, end users bring their own provider."
        />
        <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><text y='28' font-size='28'>0</text></svg>" />
        <style>
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          :root {
            --bg: #0a0a0b;
            --bg-card: #141416;
            --bg-hover: #1c1c1f;
            --border: #27272a;
            --text: #fafafa;
            --text-muted: #a1a1aa;
            --accent: #6366f1;
            --accent-hover: #818cf8;
            --radius: 8px;
            --max-w: 960px;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: var(--bg);
            color: var(--text);
            line-height: 1.6;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
          }
          nav {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px 24px;
            max-width: var(--max-w);
            margin: 0 auto;
            width: 100%;
            border-bottom: 1px solid var(--border);
          }
          nav .logo { font-size: 1.25rem; font-weight: 700; color: var(--text); text-decoration: none; letter-spacing: -0.02em; }
          nav .logo span { color: var(--accent); }
          nav .links { display: flex; gap: 24px; align-items: center; }
          nav .links a { color: var(--text-muted); text-decoration: none; font-size: 0.875rem; transition: color 0.15s; }
          nav .links a:hover { color: var(--text); }
          nav .links .btn { background: var(--accent); color: #fff; padding: 6px 16px; border-radius: var(--radius); font-size: 0.875rem; }
          nav .links .btn:hover { background: var(--accent-hover); color: #fff; }
          nav .avatar { width: 28px; height: 28px; border-radius: 50%; object-fit: cover; }
          main { flex: 1; }
          .container { max-width: var(--max-w); margin: 0 auto; padding: 48px 24px; }
          footer { text-align: center; padding: 24px; color: var(--text-muted); font-size: 0.75rem; border-top: 1px solid var(--border); }
          h1 { font-size: 2.5rem; font-weight: 800; letter-spacing: -0.03em; line-height: 1.15; }
          h2 { font-size: 1.5rem; font-weight: 700; letter-spacing: -0.02em; margin-bottom: 16px; }
          p { color: var(--text-muted); margin-bottom: 16px; }
          pre { background: var(--bg-hover); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; overflow-x: auto; font-size: 0.8125rem; margin-bottom: 16px; }
          code { font-family: "SF Mono", "Fira Code", monospace; }
          .badge { display: inline-block; background: var(--bg-hover); border: 1px solid var(--border); padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; color: var(--text-muted); }
          .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-bottom: 32px; }
          .card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 24px; }
          .card h3 { font-size: 1rem; font-weight: 600; margin-bottom: 8px; }
          .card p { font-size: 0.875rem; }
          .hero { text-align: center; padding: 64px 0 48px; }
          .hero p { font-size: 1.125rem; max-width: 600px; margin: 16px auto; }
          .hero .badge-group { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; margin-bottom: 24px; }
          .btn-primary { display: inline-block; background: var(--accent); color: #fff; padding: 10px 24px; border-radius: var(--radius); text-decoration: none; font-weight: 600; font-size: 0.9375rem; transition: background 0.15s; }
          .btn-primary:hover { background: var(--accent-hover); }
          .btn-secondary { display: inline-block; background: transparent; color: var(--text); padding: 10px 24px; border-radius: var(--radius); text-decoration: none; font-weight: 600; font-size: 0.9375rem; border: 1px solid var(--border); transition: background 0.15s; }
          .btn-secondary:hover { background: var(--bg-hover); }
          .flow { display: flex; align-items: center; justify-content: center; gap: 16px; flex-wrap: wrap; margin: 32px 0; }
          .flow-step { text-align: center; }
          .flow-step .num { width: 40px; height: 40px; border-radius: 50%; background: var(--bg-card); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; margin: 0 auto 8px; font-weight: 700; font-size: 0.875rem; }
          .flow-step p { font-size: 0.8125rem; margin: 0; }
          .flow-arrow { color: var(--text-muted); font-size: 1.25rem; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 0.875rem; }
          th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--border); }
          th { color: var(--text-muted); font-weight: 500; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; }
          td { font-family: "SF Mono", "Fira Code", monospace; font-size: 0.8125rem; }
          .endpoint { margin-bottom: 24px; }
          .endpoint h3 { font-size: 0.9375rem; margin-bottom: 8px; }
          .endpoint .method { display: inline-block; background: var(--accent); color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600; margin-right: 8px; }
          .endpoint .method.get { background: #22c55e; }
          .endpoint .method.post { background: var(--accent); }
          .endpoint .method.put { background: #f59e0b; }
          .endpoint .method.delete { background: #ef4444; }
          .endpoint .path { color: var(--text-muted); font-family: "SF Mono", "Fira Code", monospace; font-size: 0.8125rem; }
        </style>
      </head>
      <body>
        <nav>
          <a href="/" class="logo">infer<span>0</span></a>
          <div class="links">
            <a href="/">Home</a>
            <a href="/docs">Docs</a>
            ${user
              ? html`<img class="avatar" src="${user.avatar_url ?? ""}" alt="" /><a href="/dashboard">Dashboard</a><a href="/dev/apps">OAuth Apps</a><a href="/logout">Logout</a>`
              : html`<a href="/login" class="btn">Sign in</a>`}
          </div>
        </nav>
        <main>${children}</main>
        <footer>infer0 &mdash; bring your own inference provider</footer>
      </body>
    </html>
  `;
}
