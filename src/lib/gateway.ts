import type { Env } from "../types";
import { scrubProviderError } from "./scrub";
import {
  anthropicToOpenAIJSON,
  anthropicSSEToOpenAI,
  googleToOpenAIJSON,
  googleSSEToOpenAI,
} from "./translate-response";

type ProviderInfo = { provider: string; model: string; apiKey: string };
type GatewayMeta = { userId?: string; providerConfigId?: string; oauthAuthorizationId?: string };

const GATEWAY_BASE = "https://gateway.ai.cloudflare.com/v1";

function gatewayMetaHeaders(env: Env, meta: GatewayMeta): Record<string, string> {
  const headers: Record<string, string> = {
    "cf-aig-authorization": `Bearer ${env.CF_API_TOKEN}`,
  };
  if (meta.userId || meta.providerConfigId || meta.oauthAuthorizationId) {
    const md: Record<string, string> = {};
    if (meta.userId) md.user_id = meta.userId;
    if (meta.providerConfigId) md.provider_config_id = meta.providerConfigId;
    if (meta.oauthAuthorizationId) md.oauth_authorization_id = meta.oauthAuthorizationId;
    headers["cf-aig-metadata"] = JSON.stringify(md);
  }
  return headers;
}

function gatewayBase(env: Env): string {
  return `${GATEWAY_BASE}/${env.ACCOUNT_ID}/${env.GATEWAY_ID ?? "default"}`;
}

async function callProviderViaGateway(
  env: Env,
  provider: ProviderInfo,
  developerBody: Record<string, unknown>,
  meta: GatewayMeta,
): Promise<Response> {
  const { messages, stream, model: _clientModel, ...rest } = developerBody;
  const isStream = stream === true;

  if (provider.provider === "anthropic") {
    const body: Record<string, unknown> = {
      model: provider.model,
      messages,
      max_tokens: (rest.max_tokens as number) ?? 1024,
      stream: isStream,
    };
    if (rest.system) body.system = rest.system;

    return fetch(`${gatewayBase(env)}/anthropic/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": provider.apiKey,
        "anthropic-version": "2023-06-01",
        ...gatewayMetaHeaders(env, meta),
      },
      body: JSON.stringify(body),
    });
  }

  if (provider.provider === "google-ai-studio") {
    const msgs = (messages as Array<{ role: string; content: string }>) ?? [];
    const contents = msgs.map((m) => ({
      role: m.role === "assistant" ? "model" : m.role,
      parts: [{ text: m.content }],
    }));
    const body: Record<string, unknown> = { contents };
    if (rest.system) body.systemInstruction = { parts: [{ text: rest.system as string }] };

    const endpoint = isStream ? "streamGenerateContent?alt=sse" : "generateContent";
    return fetch(`${gatewayBase(env)}/google-ai-studio/v1/models/${provider.model}:${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": provider.apiKey,
        ...gatewayMetaHeaders(env, meta),
      },
      body: JSON.stringify(body),
    });
  }

  const body: Record<string, unknown> = {
    model: provider.model,
    messages,
    stream: isStream,
  };

  if (rest.system) {
    (body.messages as any[]).unshift({ role: "system", content: rest.system });
  }

  for (const [key, value] of Object.entries(rest)) {
    if (!["system", "max_output_tokens", "instructions", "max_tokens"].includes(key)) {
      body[key] = value;
    }
  }

  return fetch(`${gatewayBase(env)}/openai/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${provider.apiKey}`,
      ...gatewayMetaHeaders(env, meta),
    },
    body: JSON.stringify(body),
  });
}

async function callProviderDirectly(
  provider: ProviderInfo,
  developerBody: Record<string, unknown>,
): Promise<Response> {
  const { messages, stream, model: _clientModel, ...rest } = developerBody;

  if (provider.provider === "anthropic") {
    const body: Record<string, unknown> = {
      model: provider.model,
      messages,
      max_tokens: (rest.max_tokens as number) ?? 1024,
      stream: stream ?? false,
    };
    if (rest.system) body.system = rest.system;

    return fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": provider.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });
  }

  if (provider.provider === "google-ai-studio") {
    const msgs = (messages as Array<{ role: string; content: string }>) ?? [];
    const contents = msgs.map((m) => ({
      role: m.role === "assistant" ? "model" : m.role,
      parts: [{ text: m.content }],
    }));
    const isStream = stream === true;
    const body: Record<string, unknown> = { contents };
    if (rest.system) body.systemInstruction = { parts: [{ text: rest.system as string }] };

    const endpoint = isStream ? "streamGenerateContent?alt=sse" : "generateContent";
    return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${provider.model}:${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": provider.apiKey,
      },
      body: JSON.stringify(body),
    });
  }

  const body: Record<string, unknown> = {
    model: provider.model,
    messages,
    stream: stream ?? false,
  };

  if (rest.system) {
    (body.messages as any[]).unshift({ role: "system", content: rest.system });
  }

  for (const [key, value] of Object.entries(rest)) {
    if (!["system", "max_output_tokens", "instructions", "max_tokens"].includes(key)) {
      body[key] = value;
    }
  }

  return fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${provider.apiKey}`,
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
  const useGateway = (env as any).GATEWAY_ENABLED === "true" && (env as any).TEST_MODE !== "true";
  const meta: GatewayMeta = {};
  if (userId) meta.userId = userId;
  if (providerConfigId) meta.providerConfigId = providerConfigId;
  if (oauthAuthorizationId) meta.oauthAuthorizationId = oauthAuthorizationId;
  const gwRes = useGateway
    ? await callProviderViaGateway(env, provider, developerBody, meta)
    : await callProviderDirectly(provider, developerBody);

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

  const needsTranslate = provider.provider !== "openai";

  if (isStream) {
    let stream = gwRes.body!;

    if (needsTranslate) {
      if (provider.provider === "anthropic") {
        stream = anthropicSSEToOpenAI(stream);
      } else if (provider.provider === "google-ai-studio") {
        stream = googleSSEToOpenAI(stream);
      }
    }

    const streamHeaders: Record<string, string> = {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      "connection": "keep-alive",
    };
    return new Response(stream, { status: gwRes.status, headers: streamHeaders });
  }

  let data = await gwRes.json() as Record<string, unknown>;

  if (needsTranslate) {
    if (provider.provider === "anthropic") {
      data = anthropicToOpenAIJSON(data, requestModel);
    } else if (provider.provider === "google-ai-studio") {
      data = googleToOpenAIJSON(data, requestModel);
    }
  } else if (requestModel) {
    data.model = requestModel;
  }

  return new Response(JSON.stringify(data), { status: gwRes.status, headers: { "content-type": "application/json" } });
}
