# infer0 — Phase 1 Plan

## Vision

infer0 is an inference routing service (like Auth0, but for AI inference). Developers integrate infer0 instead of directly choosing an AI provider. End users bring their own pre-configured inference provider (e.g., their own Claude or OpenAI account). Developers make inference calls to infer0 which routes to each user's configured provider.

## Architecture

All services run on Cloudflare Workers with D1 for storage.

### Phase 1 — Single Worker Monolith

A single Hono-based Cloudflare Worker serving both server-rendered HTML pages and a JSON API.

### Pages (server-rendered HTML via Hono)

| Route | Audience | Description |
|---|---|---|
| `GET /` | Both | Marketing homepage: dual-audience hero, supported providers, how it works |
| `GET /docs` | Developers | Quickstart, API reference, code examples (curl, Python, Node.js) |
| `GET /login` | Both | Login page with "Sign in with Google" / "Sign in with GitHub" buttons |
| `GET /auth/google/login` | Both | Redirect to Google OAuth consent screen |
| `GET /auth/google/callback` | Both | Handle Google OAuth callback, set session |
| `GET /auth/github/login` | Both | Redirect to GitHub OAuth consent screen |
| `GET /auth/github/callback` | Both | Handle GitHub OAuth callback, set session |
| `GET /logout` | Both | Clear session → redirect to `/` |
| `GET /dashboard` | Both | Provider config list + form (users), API keys (developers) |

### API Routes (JSON)

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/v1/providers` | JWT | Store provider + encrypted API key |
| `GET` | `/v1/providers` | JWT | List user's providers |
| `PUT` | `/v1/providers/:id` | JWT | Update provider config |
| `DELETE` | `/v1/providers/:id` | JWT | Remove provider |
| `POST` | `/v1/chat/completions` | JWT + Dev Key | OpenAI-compatible inference proxy to AI Gateway |
| `POST` | `/v1/messages` | JWT + Dev Key | Anthropic-compatible inference proxy |

### Data Model (D1)

```sql
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
  provider TEXT NOT NULL,         -- 'google' | 'github'
  provider_id TEXT NOT NULL,      -- user's ID from the provider
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
  provider TEXT NOT NULL,       -- 'openai' | 'anthropic' | 'google' etc.
  model TEXT NOT NULL DEFAULT '',
  api_key_encrypted TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### Technology Stack

| Component | Choice | Why |
|---|---|---|
| Runtime | Cloudflare Workers | Edge-native, zero ops |
| Web framework | Hono | Lightweight, great Workers DX, first-class `html` helper |
| Database | D1 | Serverless SQLite, native Workers binding |
| Sessions | Cookie-based (HttpOnly) | Simple for browser, JWT for API |
| JWTs | `jose` | Zero-dependency Web Crypto JWT lib |
| OAuth | Google + GitHub | Handled via Workers fetch to provider token endpoints |
| API key encryption | AES-256-GCM | Web Crypto native, nonce-based |
| AI routing | Cloudflare AI Gateway REST API | `api.cloudflare.com/client/v4/accounts/{id}/ai/v1/chat/completions` |
| Views | Hono `html` tagged template literals | Zero build step, no JS framework |

### Project Structure

```
infer0/
├── docs/
│   ├── phase-1-summary.md
│   └── phase-1-summary.html
├── src/
│   ├── index.ts                 # Hono app, global middleware, static route registration
│   ├── routes/
│   │   ├── page-home.ts         # GET /
│   │   ├── page-docs.ts         # GET /docs
│   │   ├── page-auth.ts         # GET /login, /auth/:provider/login, /auth/:provider/callback, /logout
│   │   ├── page-dashboard.ts    # GET /dashboard
│   │   ├── api-providers.ts     # CRUD /v1/providers/*
│   │   └── api-inference.ts     # POST /v1/chat/completions, /v1/messages
│   ├── lib/
│   │   ├── auth.ts              # JWT sign/verify (jose)
│   │   ├── oauth.ts             # OAuth token exchange + user info (Google, GitHub)
│   │   └── crypto.ts            # AES-256-GCM encrypt/decrypt API keys
│   ├── middleware/
│   │   └── session.ts           # Cookie session validation middleware
│   ├── views/
│   │   ├── layout.ts            # HTML shell (head, nav, footer)
│   │   ├── home.ts              # Homepage template
│   │   ├── docs.ts              # Docs template
│   │   ├── login.ts             # Login page template (OAuth buttons)
│   │   └── dashboard.ts         # Dashboard template (provider list + form)
│   └── types.ts                 # Env bindings, shared types
├── migrations/
│   └── 0001_init.sql
├── wrangler.jsonc
├── package.json
└── tsconfig.json
```

### AI Gateway Flow

```
Developer App                     infer0 Worker                  Cloudflare AI Gateway      Provider
      │                               │                               │                        │
      │ POST /v1/chat/completions      │                               │                        │
      │ Authorization: Bearer <JWT>    │                               │                        │
      │ x-api-key: <dev_key>           │                               │                        │
      │ ──────────────────────────────>│                               │                        │
      │                               │ 1. Validate JWT + dev key     │                        │
      │                               │ 2. Lookup user's provider     │                        │
      │                               │ 3. Decrypt provider API key   │                        │
      │                               │                               │                        │
      │                               │ POST /ai/v1/chat/completions   │                        │
      │                               │ Authorization: Bearer <key>   │                        │
      │                               │ model: openai/gpt-4           │                        │
      │                               │ ─────────────────────────────>│ ─────────────────────>│
      │                               │ <─────────────────────────────│ <─────────────────────│
      │ <──────────────────────────────│                               │                        │
```

### CI/CD (Workers Builds)

Cloudflare Workers Builds connects the GitHub repo directly:

| Branch | Command | Result |
|---|---|---|
| `main` | `npx wrangler deploy` | Live at `infer0.<user>.workers.dev` |
| `dev` / feature branches | `npx wrangler versions upload` | Preview URL `<hash>-infer0.<user>.workers.dev` |

- **Production trigger**: `main` branch → `wrangler deploy` → live deployment
- **Preview trigger**: All other branches → `wrangler versions upload` → preview URL
- **PR integration**: Preview URLs auto-generated, visible in PR comments
- **Secrets**: Managed per-environment in Cloudflare dashboard
- **Future**: Migrate to GitHub Actions when monolith splits into multiple Workers

### Implementation Order (7 Steps)

| Step | What It Produces | Files |
|---|---|---|---|
| 1 | Scaffold project: `wrangler.jsonc`, `package.json`, `tsconfig.json`, types, D1 migration | 5 |
| 2 | `layout.ts`, `home.ts`, `docs.ts` views + `/` and `/docs` routes | 5 |
| 3 | Auth: `login.ts` view, OAuth routes (Google + GitHub redirect/callback), session middleware, `oauth.ts` lib, `auth.ts` JWT lib | 7 |
| 4 | Dashboard: `dashboard.ts` view + `GET /dashboard` with provider list | 3 |
| 5 | Provider API: `api-providers.ts` + crypto lib (CRUD + encryption) | 3 |
| 6 | Inference API: `api-inference.ts` + AI Gateway client | 3 |
| 7 | Polish: error handling, flash messages, rate limiting, security headers | 2 |

### Security

- Provider API keys encrypted at rest in D1 using AES-256-GCM
- JWT signing key stored as Cloudflare Worker secret
- Authentication delegated to Google/GitHub OAuth — no password storage
- Session cookies: HttpOnly, Secure, SameSite=Strict
- All secrets via `wrangler secret put`, never in source

### Future Phases (Post-V1)

- Email magic link / passwordless login (for users without Google/GitHub)
- "Sign in with infer0" universal login for developer apps (OAuth provider)
- Split monolith into service-bound Workers (auth, inference, providers)
- React SPA admin dashboard (Workers Assets)
- Usage tracking, rate limits, billing integration
- D1 read replication for global performance
