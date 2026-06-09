type AnthropicContent = { type: string; text: string };
type AnthropicResponse = {
  id: string;
  type: string;
  role: string;
  content: AnthropicContent[];
  model: string;
  stop_reason: string;
  stop_sequence: string | null;
  usage: { input_tokens: number; output_tokens: number };
};

function finishReason(stopReason: string): string {
  if (stopReason === "end_turn" || stopReason === "stop") return "stop";
  if (stopReason === "max_tokens" || stopReason === "length") return "length";
  return stopReason;
}

// Anthropic JSON → OpenAI JSON
export function anthropicToOpenAIJSON(
  data: Record<string, unknown>,
  requestModel: string | null,
): Record<string, unknown> {
  const anth = data as unknown as AnthropicResponse;
  const text = (anth.content ?? []).map((c) => c.text).join("");
  return {
    id: anth.id,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: requestModel ?? anth.model,
    choices: [
      {
        index: 0,
        message: {
          role: anth.role,
          content: text,
        },
        finish_reason: finishReason(anth.stop_reason),
      },
    ],
    usage: {
      prompt_tokens: anth.usage?.input_tokens ?? 0,
      completion_tokens: anth.usage?.output_tokens ?? 0,
      total_tokens: (anth.usage?.input_tokens ?? 0) + (anth.usage?.output_tokens ?? 0),
    },
  };
}

// Anthropic SSE → OpenAI SSE TransformStream
export function anthropicSSEToOpenAI(
  upstreamStream: ReadableStream,
): ReadableStream {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  let id = "";
  let model = "";
  let buffer = "";

  return upstreamStream.pipeThrough(
    new TransformStream({
      transform(chunk, controller) {
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        let currentEvent = "";
        let currentData = "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            currentData = line.slice(6).trim();
          }

          if (currentEvent && currentData) {
            if (currentEvent === "message_start") {
              try {
                const parsed = JSON.parse(currentData);
                const msg = parsed.message ?? {};
                id = msg.id ?? id;
                model = msg.model ?? model;
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      id,
                      object: "chat.completion.chunk",
                      created: Math.floor(Date.now() / 1000),
                      model,
                      choices: [
                        {
                          index: 0,
                          delta: { role: "assistant" },
                          finish_reason: null,
                        },
                      ],
                    })}\n\n`,
                  ),
                );
              } catch {
                // ignore parse errors
              }
            } else if (currentEvent === "content_block_delta") {
              try {
                const parsed = JSON.parse(currentData);
                const delta = parsed.delta ?? {};
                if (delta.type === "text_delta" && delta.text) {
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        id,
                        object: "chat.completion.chunk",
                        created: Math.floor(Date.now() / 1000),
                        model,
                        choices: [
                          {
                            index: 0,
                            delta: { content: delta.text },
                            finish_reason: null,
                          },
                        ],
                      })}\n\n`,
                    ),
                  );
                }
              } catch {
                // ignore
              }
            } else if (currentEvent === "message_delta") {
              try {
                const parsed = JSON.parse(currentData);
                const delta = parsed.delta ?? {};
                const usage = parsed.usage ?? {};
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      id,
                      object: "chat.completion.chunk",
                      created: Math.floor(Date.now() / 1000),
                      model,
                      choices: [
                        {
                          index: 0,
                          delta: {},
                          finish_reason: finishReason(delta.stop_reason ?? ""),
                        },
                      ],
                      usage: {
                        prompt_tokens: 0,
                        completion_tokens: usage.output_tokens ?? 0,
                        total_tokens: usage.output_tokens ?? 0,
                      },
                    })}\n\n`,
                  ),
                );
              } catch {
                // ignore
              }
            }

            currentEvent = "";
            currentData = "";
          }
        }
      },

      flush(controller) {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      },
    }),
  );
}

type GoogleResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
};

// Google JSON → OpenAI JSON
export function googleToOpenAIJSON(
  data: Record<string, unknown>,
  requestModel: string | null,
): Record<string, unknown> {
  const g = data as unknown as GoogleResponse;
  const text = g.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  const finish = g.candidates?.[0]?.finishReason ?? "STOP";
  const usage = g.usageMetadata ?? {};
  return {
    id: `chatcmpl-${crypto.randomUUID()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: requestModel ?? "",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: text },
        finish_reason: finish === "STOP" ? "stop" : finish?.toLowerCase() ?? "stop",
      },
    ],
    usage: {
      prompt_tokens: usage.promptTokenCount ?? 0,
      completion_tokens: usage.candidatesTokenCount ?? 0,
      total_tokens: (usage.promptTokenCount ?? 0) + (usage.candidatesTokenCount ?? 0),
    },
  };
}

function extractGoogleText(parsed: Record<string, unknown>): string | undefined {
  const candidates = parsed.candidates as Array<Record<string, unknown>> | undefined;
  return candidates?.[0]?.content &&
    typeof candidates[0].content === "object"
    ? ((candidates[0].content as Record<string, unknown>).parts as Array<Record<string, unknown>> | undefined)
        ?.map((p) => p.text as string)
        .filter(Boolean)
        .join("") || undefined
    : undefined;
}

function extractGoogleFinishReason(parsed: Record<string, unknown>): string | null {
  const candidates = parsed.candidates as Array<Record<string, unknown>> | undefined;
  return (candidates?.[0]?.finishReason as string) ?? null;
}

function extractGoogleUsage(parsed: Record<string, unknown>): { output?: number; input?: number } {
  const meta = parsed.usageMetadata as Record<string, unknown> | undefined;
  return {
    output: (meta?.candidatesTokenCount as number) ?? 0,
    input: (meta?.promptTokenCount as number) ?? 0,
  };
}

// Google SSE → OpenAI SSE TransformStream
export function googleSSEToOpenAI(
  upstreamStream: ReadableStream,
): ReadableStream {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let id = `chatcmpl-${crypto.randomUUID()}`;
  let model = "";
  let buffer = "";

  return upstreamStream.pipeThrough(
    new TransformStream({
      transform(chunk, controller) {
        buffer += decoder.decode(chunk, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const block of parts) {
          const lines = block.split("\n").filter((l) => l.startsWith("data: "));
          for (const line of lines) {
            const payload = line.slice(6).trim();
            if (!payload || payload === "[DONE]") continue;
            try {
              const parsed = JSON.parse(payload);
              const text = extractGoogleText(parsed);
              const finish = extractGoogleFinishReason(parsed);
              if (text) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      id,
                      object: "chat.completion.chunk",
                      created: Math.floor(Date.now() / 1000),
                      model,
                      choices: [{ index: 0, delta: { content: text }, finish_reason: null }],
                    })}\n\n`,
                  ),
                );
              }
              if (finish) {
                const usage = extractGoogleUsage(parsed);
                const i = usage.input || 0;
                const o = usage.output || 0;
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      id,
                      object: "chat.completion.chunk",
                      created: Math.floor(Date.now() / 1000),
                      model,
                      choices: [{ index: 0, delta: {}, finish_reason: finish === "STOP" ? "stop" : finish.toLowerCase() }],
                      usage: { prompt_tokens: i, completion_tokens: o, total_tokens: i + o },
                    })}\n\n`,
                  ),
                );
              }
            } catch { /* ignore */ }
          }
        }
      },
      flush(controller) {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      },
    }),
  );
}
