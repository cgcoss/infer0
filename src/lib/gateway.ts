import type { Env } from "../types";
import { scrubProviderError } from "./scrub";

type ProviderInfo = { provider: string; model: string; apiKey: string };
type GatewayMeta = { userId?: string; providerConfigId?: string; oauthAuthorizationId?: string };

const GATEWAY_BASE = "https://gateway.ai.cloudflare.com/v1";


function gatewayMetaHeaders(env: Env, meta: GatewayMeta): Record<string, string> {
  const md: Record<string, string> = {};
  if (meta.userId) md.user_id = meta.userId;
  if (meta.providerConfigId) md.provider_config_id = meta.providerConfigId;
  if (meta.oauthAuthorizationId) md.oauth_authorization_id = meta.oauthAuthorizationId;
  return {
    "cf-aig-authorization": `Bearer ${env.CF_API_TOKEN}`,
    "cf-aig-metadata": JSON.stringify(md),
  };
}

function gatewayBase(env: Env): string {
  return `${GATEWAY_BASE}/${env.ACCOUNT_ID}/${env.GATEWAY_ID ?? "default"}`;
}

async function callProvider(
  env: Env,
  provider: ProviderInfo,
  developerBody: Record<string, unknown>,
  meta: GatewayMeta,
): Promise<Response> {
  const isStream = developerBody.stream === true;
  const body = {
    model: `${provider.provider}/${provider.model}`,
    messages: developerBody.messages,
    stream: isStream,
  };

  return fetch(`${gatewayBase(env)}/compat/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${provider.apiKey}`,
      ...gatewayMetaHeaders(env, meta),
    },
    body: JSON.stringify(body),
  });
}

export async function execute(
  env: Env,
  provider: ProviderInfo,
  developerBody: Record<string, unknown>,
  requestModel: string | null,
  userId?: string,
  providerConfigId?: string,
  oauthAuthorizationId?: string,
): Promise<Response> {
  const meta: GatewayMeta = {};
  if (userId) meta.userId = userId;
  if (providerConfigId) meta.providerConfigId = providerConfigId;
  if (oauthAuthorizationId) meta.oauthAuthorizationId = oauthAuthorizationId;
  const gwRes = await callProvider(env, provider, developerBody, meta);

  if (!gwRes.ok) {
    const err = scrubProviderError(await gwRes.text());
    return new Response(
      JSON.stringify({
        error: { message: `Provider error: ${err}`, code: "provider_error" },
      }),
      {
        status: gwRes.status,
        headers: { "content-type": "application/json" },
      },
    );
  }

  const isStream =
    developerBody.stream === true ||
    (gwRes.headers.get("content-type") ?? "").includes("event-stream");

  if (isStream) {
    return new Response(gwRes.body, {
      status: gwRes.status,
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        "connection": "keep-alive",
      },
    });
  }

  const data = await gwRes.json() as Record<string, unknown>;
  if (requestModel && !data.model) {
    data.model = requestModel;
  }
  return new Response(JSON.stringify(data), { status: gwRes.status, headers: { "content-type": "application/json" } });
}
