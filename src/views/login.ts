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
      </div>
    `,
  });
}
