export type Env = Cloudflare.Env & {
  TEST_MODE?: string;
  GATEWAY_ID?: string;
};

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface UserIdentity {
  id: string;
  user_id: string;
  provider: "google" | "github";
  provider_id: string;
  created_at: string;
}

export interface Session {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  created_at: string;
}

export interface ProviderConfig {
  id: string;
  user_id: string;
  provider: string;
  model: string;
  name: string;
  api_key_encrypted: string;
  key_version: string;
  is_default: number;
  daily_spend_limit_cents: number | null;
  paused_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthorizedApp {
  id: string;
  user_id: string;
  oauth_app_id: string;
  app_prefix: string;
  developer_name: string;
  provider_config_id: string | null;
  last_used_at: string;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
}

export interface OAuthApp {
  id: string;
  developer_id: string;
  name: string;
  redirect_uri: string;
  client_secret: string;
  created_at: string;
}

export interface OAuthAuthorization {
  id: string;
  user_id: string;
  oauth_app_id: string;
  provider_config_id: string | null;
  daily_spend_limit_cents: number | null;
  authorization_code: string | null;
  code_expires_at: string | null;
  access_token_hash: string | null;
  refresh_token_hash: string | null;
  refresh_token_previous_hash: string | null;
  access_token_expires_at: string | null;
  refresh_token_expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface OAuthProfile {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
}

export interface APIError {
  error: {
    message: string;
    code: string;
  };
}
