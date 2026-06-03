import { html } from "hono/html";
import { Layout } from "./layout";

interface LoginViewProps {
  user?: { name: string | null; email: string; avatar_url: string | null } | null;
  redirect?: string | null;
}

export function LoginView({ user, redirect }: LoginViewProps) {
  const redirectParam = redirect ? `?redirect=${encodeURIComponent(redirect)}` : "";
  return Layout({
    title: "Sign in",
    user,
    children: html`
      <div class="container" style="max-width:400px">
        <h1 style="text-align:center;margin-bottom:8px">Sign in</h1>
        <p style="text-align:center;margin-bottom:32px">
          Sign in with Google or GitHub to get started.
        </p>
        <div style="display:flex;flex-direction:column;gap:12px">
          <a
            href="/auth/google/login${redirectParam}"
            class="btn-primary"
            style="text-align:center"
          >
            Sign in with Google
          </a>
          <a
            href="/auth/github/login${redirectParam}"
            class="btn-secondary"
            style="text-align:center"
          >
            Sign in with GitHub
          </a>
        </div>

        <div style="margin-top:40px;padding:20px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);font-size:0.8125rem;color:var(--text-muted);line-height:1.7">
          <strong style="color:var(--text);display:block;margin-bottom:8px">What data does infer0 store?</strong>
          infer0 receives your email, name, and profile picture from your Google or GitHub account.
          We use this to create your account and show your profile. Your password is never shared with us
          — OAuth handles authentication directly with Google or GitHub.
          Any API keys you add for AI providers are encrypted before storage.
          You can revoke any app's access or remove your providers at any time from your dashboard.
        </div>
      </div>
    `,
  });
}
