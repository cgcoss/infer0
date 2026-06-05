import type { Env } from "../types";
import type { Protocol } from "./normalize";

type ProviderInfo = { provider: string; model: string; apiKey: string };
import { scrubProviderError } from "./scrub";
import {
  anthropicToOpenAIJSON,
  openAIToAnthropicJSON,
  anthropicToResponsesJSON,
  openAIToResponsesJSON,
  anthropicSSEToOpenAI,
  openaiSSEToAnthropic,
  anthropicSSEToResponses,
  openaiSSEToResponses,
} from "./translate-response";

const CF_API_BASE = "https://api.cloudflare.com/client/v4/accounts";

export function buildUrl(env: Env): string {
  return `${CF_API_BASE}/${env.ACCOUNT_ID}/ai/run`;
}

export function buildHeaders(env: Env, provider: ProviderInfo): Record<string, string> {
  const headers: Record<string, string> = {
    "cf-aig-authorization": `Bearer ${env.CF_API_TOKEN}`,
    "cf-aig-gateway-id": "default",
    "Content-Type": "application/json",
  };
  if (provider.provider === "anthropic") {
    headers["x-api-key"] = provider.apiKey;
  } else {
    headers["Authorization"] = `Bearer ${provider.apiKey}`;
  }
  return headers;
}

export function buildBody(
  provider: ProviderInfo,
  developerBody: Record<string, unknown>,
): object {
  const { messages, stream, model: _clientModel, ...rest } = developerBody;
  return {
    model: `${provider.provider}/${provider.model}`,
    input: {
      messages,
      stream: stream ?? false,
      ...rest,
    },
  };
}

const SSE_MODEL_PATTERN = /"model"\s*:\s*"[^"]*"/g;

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

function appendDone(stream: ReadableStream): ReadableStream {
  const encoder = new TextEncoder();
  return stream.pipeThrough(
    new TransformStream({
      flush(controller) {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      },
    }),
  );
}

function patchModelInSSE(stream: ReadableStream, requestModel: string): ReadableStream {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  return stream.pipeThrough(
    new TransformStream({
      transform(chunk, controller) {
        const text = decoder.decode(chunk, { stream: true });
        const replaced = text.replace(SSE_MODEL_PATTERN, `"model":"${requestModel}"`);
        if (replaced) controller.enqueue(encoder.encode(replaced));
      },
    }),
  );
}

function needsTranslation(
  protocol: Protocol,
  providerType: string,
): boolean {
  if (protocol === "responses") return true;
  return (
    (protocol === "openai" && providerType === "anthropic") ||
    (protocol === "anthropic" && providerType !== "anthropic")
  );
}

export async function execute(
  env: Env,
  provider: ProviderInfo,
  developerBody: Record<string, unknown>,
  requestModel: string | null,
  protocol: Protocol,
): Promise<Response> {
  const gwRes = (env as any).TEST_MODE === "true"
    ? await callProviderDirectly(provider, developerBody)
    : await fetch(buildUrl(env), {
        method: "POST",
        headers: buildHeaders(env, provider),
        body: JSON.stringify(buildBody(provider, developerBody)),
      });

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

  const translate = needsTranslation(protocol, provider.provider);

  if (isStream) {
    let stream = gwRes.body!;

    if (translate) {
      if (protocol === "responses") {
        if (provider.provider === "anthropic") {
          stream = anthropicSSEToResponses(stream);
        } else {
          stream = openaiSSEToResponses(stream);
        }
      } else if (protocol === "openai" && provider.provider === "anthropic") {
        stream = anthropicSSEToOpenAI(stream);
      } else if (protocol === "anthropic" && provider.provider !== "anthropic") {
        stream = openaiSSEToAnthropic(stream);
      }
    } else {
      stream = appendDone(stream);
    }

    if (requestModel) {
      stream = patchModelInSSE(stream, requestModel);
    }

    return new Response(stream, {
      status: gwRes.status,
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        "connection": "keep-alive",
      },
    });
  }

  let data = (await gwRes.json()) as Record<string, unknown>;

  if (translate) {
    if (protocol === "responses") {
      if (provider.provider === "anthropic") {
        data = anthropicToResponsesJSON(data, requestModel);
      } else {
        data = openAIToResponsesJSON(data, requestModel);
      }
    } else if (protocol === "openai" && provider.provider === "anthropic") {
      data = anthropicToOpenAIJSON(data, requestModel);
    } else if (protocol === "anthropic" && provider.provider !== "anthropic") {
      data = openAIToAnthropicJSON(data);
    }
  } else if (requestModel) {
    data.model = requestModel;
  }

  return new Response(JSON.stringify(data), {
    status: gwRes.status,
    headers: { "content-type": "application/json" },
  });
}
