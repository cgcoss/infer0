import { Hono } from "hono";
import { deleteCookie } from "hono/cookie";
import type { Env } from "../types";
import { signToken } from "../lib/auth";
import { exchangeGoogleCode, exchangeGitHubCode } from "../lib/oauth";
import { LoginView } from "../views/login";
import { getSessionUser } from "../middleware/session";

export const authRoutes = new Hono<{ Bindings: Env }>();

authRoutes.get("/login", async (c) => {
  const user = await getSessionUser(c);
  if (user) return c.redirect(c.req.query("redirect") || "/dashboard");
  return c.html(LoginView({ redirect: c.req.query("redirect") }));
});

authRoutes.get("/auth/google/login", (c) => {
  const redirect = c.req.query("redirect");
  const params = new URLSearchParams({
    client_id: c.env.GOOGLE_CLIENT_ID,
    redirect_uri: `${c.env.APP_URL}/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    access_type: "online",
  });
  if (redirect) params.set("state", redirect);
  return c.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
  );
});

authRoutes.get("/auth/google/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  if (!code) return c.redirect("/login");

  try {
    const profile = await exchangeGoogleCode(
      code,
      c.env.GOOGLE_CLIENT_ID,
      c.env.GOOGLE_CLIENT_SECRET,
      `${c.env.APP_URL}/auth/google/callback`,
    );

    const { id: userId } = await upsertUser(c.env.DB, "google", profile);
    const token = await createSessionToken(userId, profile, c.env.JWT_SECRET, c.env.DB);
    const cookie = serializeSessionCookie(token, c.env.APP_URL);

    let redirect = "/dashboard";
    if (state) {
      try { redirect = decodeURIComponent(state); } catch {}
    }

    return new Response(null, {
      status: 302,
      headers: { Location: redirect, "Set-Cookie": cookie },
    });
  } catch (err) {
    console.error("Google OAuth error:", err);
    return c.redirect("/login");
  }
});

authRoutes.get("/auth/github/login", (c) => {
  const redirect = c.req.query("redirect");
  const params = new URLSearchParams({
    client_id: c.env.GITHUB_CLIENT_ID,
    redirect_uri: `${c.env.APP_URL}/auth/github/callback`,
    scope: "read:user user:email",
  });
  if (redirect) params.set("state", redirect);
  return c.redirect(
    `https://github.com/login/oauth/authorize?${params}`,
  );
});

authRoutes.get("/auth/github/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  if (!code) return c.redirect("/login");

  try {
    const profile = await exchangeGitHubCode(
      code,
      c.env.GITHUB_CLIENT_ID,
      c.env.GITHUB_CLIENT_SECRET,
      `${c.env.APP_URL}/auth/github/callback`,
    );

    const { id: userId } = await upsertUser(c.env.DB, "github", profile);
    const token = await createSessionToken(userId, profile, c.env.JWT_SECRET, c.env.DB);
    const cookie = serializeSessionCookie(token, c.env.APP_URL);

    let redirect = "/dashboard";
    if (state) {
      try { redirect = decodeURIComponent(state); } catch {}
    }

    return new Response(null, {
      status: 302,
      headers: { Location: redirect, "Set-Cookie": cookie },
    });
  } catch (err) {
    console.error("GitHub OAuth error:", err);
    return c.redirect("/login");
  }
});

authRoutes.get("/logout", (c) => {
  deleteCookie(c, "session", {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
  });
  return c.redirect("/");
});

async function upsertUser(
  db: D1Database,
  provider: string,
  profile: { id: string; email: string; name: string; avatar_url: string | null },
): Promise<{ id: string }> {
  const existing = await db
    .prepare("SELECT user_id FROM user_identities WHERE provider = ? AND provider_id = ?")
    .bind(provider, profile.id)
    .first<{ user_id: string }>();

  if (existing) {
    await db
      .prepare("UPDATE users SET name = ?, avatar_url = ? WHERE id = ?")
      .bind(profile.name, profile.avatar_url, existing.user_id)
      .run();
    return { id: existing.user_id };
  }

  const userId = crypto.randomUUID();
  const identityId = crypto.randomUUID();

  await db
    .prepare("INSERT INTO users (id, email, name, avatar_url) VALUES (?, ?, ?, ?)")
    .bind(userId, profile.email, profile.name, profile.avatar_url)
    .run();

  await db
    .prepare("INSERT INTO user_identities (id, user_id, provider, provider_id) VALUES (?, ?, ?, ?)")
    .bind(identityId, userId, provider, profile.id)
    .run();

  return { id: userId };
}

async function createSessionToken(
  userId: string,
  profile: { email: string; name: string; avatar_url: string | null },
  jwtSecret: string,
  db: D1Database,
): Promise<string> {
  const token = await signToken(
    { sub: userId, email: profile.email, name: profile.name, avatar_url: profile.avatar_url },
    jwtSecret,
    "7d",
  );

  const tokenHash = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await db
    .prepare("INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)")
    .bind(crypto.randomUUID(), userId, tokenHash, expiresAt.toISOString())
    .run();

  return token;
}

function serializeSessionCookie(token: string, appUrl: string): string {
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const secure = appUrl.startsWith("https");
  return `session=${token}; Path=/; HttpOnly${secure ? "; Secure" : ""}; SameSite=Lax; Expires=${expires.toUTCString()}`;
}
