import type { OAuthProfile } from "../types";

interface TokenResponse {
  access_token: string;
  token_type: string;
  scope?: string;
}

export async function exchangeGoogleCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<OAuthProfile> {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    throw new Error("Failed to exchange Google auth code");
  }

  const tokenData = (await tokenRes.json()) as TokenResponse;

  const profileRes = await fetch(
    "https://www.googleapis.com/oauth2/v2/userinfo",
    {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    },
  );

  if (!profileRes.ok) {
    throw new Error("Failed to fetch Google profile");
  }

  const profile = (await profileRes.json()) as {
    id: string;
    email: string;
    name: string;
    picture?: string;
  };
  return {
    id: profile.id,
    email: profile.email,
    name: profile.name ?? profile.email,
    avatar_url: profile.picture ?? null,
  };
}

export async function exchangeGitHubCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<OAuthProfile> {
  const tokenRes = await fetch(
    "https://github.com/login/oauth/access_token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }),
    },
  );

  if (!tokenRes.ok) {
    throw new Error("Failed to exchange GitHub auth code");
  }

  const tokenData = (await tokenRes.json()) as TokenResponse;

  if (!tokenData.access_token) {
    throw new Error("No access_token in GitHub response");
  }

  const ghHeaders = {
    Authorization: `Bearer ${tokenData.access_token}`,
    "User-Agent": "infer0/1.0",
  };

  const profileRes = await fetch("https://api.github.com/user", { headers: ghHeaders });

  if (!profileRes.ok) {
    const body = await profileRes.text().catch(() => "");
    throw new Error(`Failed to fetch GitHub profile: ${profileRes.status} ${body}`);
  }

  const profile = (await profileRes.json()) as {
    id: number;
    login: string;
    name: string | null;
    avatar_url: string | null;
  };
  const emailsRes = await fetch("https://api.github.com/user/emails", { headers: ghHeaders });
  const emails = (await emailsRes.json()) as Array<{
    email: string;
    primary: boolean;
  }>;
  const primaryEmail = emails.find((e) => e.primary)?.email ?? emails[0]?.email;

  return {
    id: String(profile.id),
    email: primaryEmail,
    name: profile.name ?? profile.login,
    avatar_url: profile.avatar_url ?? null,
  };
}
