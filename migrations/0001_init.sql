CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  avatar_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE user_identities (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(provider, provider_id)
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE provider_configs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  api_key_encrypted TEXT NOT NULL,
  key_version TEXT NOT NULL DEFAULT 'v1',
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  is_active INTEGER NOT NULL DEFAULT 1,
  last_used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE authorized_apps (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  oauth_app_id TEXT NOT NULL,
  app_prefix TEXT NOT NULL DEFAULT '',
  developer_name TEXT NOT NULL DEFAULT '',
  provider_config_id TEXT,
  last_used_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (oauth_app_id) REFERENCES oauth_apps(id),
  FOREIGN KEY (provider_config_id) REFERENCES provider_configs(id),
  UNIQUE(user_id, oauth_app_id)
);

CREATE TABLE oauth_apps (
  id TEXT PRIMARY KEY,
  developer_id TEXT NOT NULL,
  name TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  client_secret TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (developer_id) REFERENCES users(id)
);

CREATE TABLE oauth_authorizations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  oauth_app_id TEXT NOT NULL,
  provider_config_id TEXT,
  authorization_code TEXT,
  code_expires_at TEXT,
  access_token_hash TEXT,
  refresh_token_hash TEXT,
  access_token_expires_at TEXT,
  refresh_token_expires_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (oauth_app_id) REFERENCES oauth_apps(id),
  FOREIGN KEY (provider_config_id) REFERENCES provider_configs(id)
);
