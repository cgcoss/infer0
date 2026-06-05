# infer0

BYO-inference routing platform. End users bring their own OpenAI/Anthropic API keys and authorize developer apps via OAuth.

## Architecture

```
OpenAI SDK → /v1/chat/completions ─┐
Anthropic SDK → /v1/messages ──────┤── handleInference → execute → provider API
Responses SDK → /v1/responses ─────┘
```

Supports any SDK with any upstream provider — responses are automatically translated between formats (JSON + SSE streaming).

**Translation matrix:**

| Request protocol | OpenAI provider | Anthropic provider |
|---|---|---|
| OpenAI Chat | passthrough | Anthropic → OpenAI |
| Anthropic Messages | OpenAI → Anthropic | passthrough |
| OpenAI Responses | OpenAI → Responses | Anthropic → Responses |

## Stack

- **Runtime:** Cloudflare Workers
- **Database:** D1 (SQLite)
- **Auth:** OAuth 2.0 (Google, GitHub) + OAuth access tokens for developer apps
- **Encryption:** AES-GCM with key rotation (`ENCRYPTION_KEY`, `ENCRYPTION_KEY_PREVIOUS`)
- **Framework:** Hono

## Required secrets (`wrangler secret put`)

```
CF_API_TOKEN            # Cloudflare API token (AI Gateway)
ENCRYPTION_KEY          # AES-GCM key for provider API keys
```

## Configuration (`wrangler.jsonc` vars)

| Variable | Description |
|---|---|
| `ACCOUNT_ID` | Cloudflare account ID |
| `APP_URL` | App URL (e.g. `https://infer0.com`) |
| `AI_GATEWAY_URL` | Cloudflare AI Gateway base URL |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GITHUB_CLIENT_ID` | GitHub OAuth client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth client secret |
| `JWT_SECRET` | Secret for signing JWTs |

## Local development

```bash
npm install
npm run db:migrate            # Apply D1 migrations
npm run dev                   # Start wrangler dev
```

Requires `.env` with `OPENAI_API_KEY` and/or `ANTHROPIC_API_KEY` for integration tests, and `.dev.vars` with the secrets listed above.

### Integration tests

Integration tests use real provider API keys via `TEST_MODE=true` (bypasses Cloudflare AI Gateway, calls providers directly). The test script temporarily adds `TEST_MODE=true` to `.dev.vars` during the run.

```bash
npm test
```

Requires `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` in `.env`. Tests all 6 SDK × provider combinations in streaming and non-streaming modes.

## Database

```bash
npm run db:migrate   # Apply pending migrations
npm run db:list      # List migration status
```

## Deploy

```bash
npm run deploy
```
