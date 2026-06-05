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

function inverseFinishReason(reason: string | undefined | null): string {
  if (reason === "stop") return "end_turn";
  if (reason === "length") return "max_tokens";
  return reason ?? "end_turn";
}

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

export function openAIToAnthropicJSON(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const oai = data as Record<string, unknown>;
  const choices = (oai.choices as Array<Record<string, unknown>>) ?? [];
  const choice0 = choices[0] ?? {};
  const message = (choice0.message as Record<string, unknown>) ?? {};
  const usage = (oai.usage as Record<string, unknown>) ?? {};
  const text = (message.content as string) ?? "";

  return {
    id: oai.id ?? `msg_${crypto.randomUUID()}`,
    type: "message",
    role: (message.role as string) ?? "assistant",
    content: [{ type: "text", text }],
    model: oai.model,
    stop_reason: inverseFinishReason(choice0.finish_reason as string | undefined | null),
    stop_sequence: null,
    usage: {
      input_tokens: (usage.prompt_tokens as number) ?? 0,
      output_tokens: (usage.completion_tokens as number) ?? 0,
    },
  };
}

function finishReasonFromSSE(reason: string | undefined | null): string {
  return finishReason(reason ?? "");
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
                          finish_reason: finishReasonFromSSE(delta.stop_reason),
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
        if (buffer.trim()) {
          // try to process remaining buffer
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      },
    }),
  );
}

// OpenAI SSE → Anthropic SSE TransformStream
export function anthropicToResponsesJSON(
  data: Record<string, unknown>,
  requestModel: string | null,
): Record<string, unknown> {
  const anth = data as unknown as AnthropicResponse;
  const text = (anth.content ?? []).map((c) => c.text).join("");
  const id = anth.id ?? `resp_${crypto.randomUUID()}`;
  const messageId = `msg_${id}`;

  return {
    id,
    object: "response",
    created: Math.floor(Date.now() / 1000),
    model: requestModel ?? anth.model,
    output: [
      {
        type: "message",
        id: messageId,
        role: anth.role,
        content: [{ type: "output_text", text, annotations: [] }],
      },
    ],
    usage: {
      input_tokens: anth.usage?.input_tokens ?? 0,
      output_tokens: anth.usage?.output_tokens ?? 0,
      total_tokens:
        (anth.usage?.input_tokens ?? 0) + (anth.usage?.output_tokens ?? 0),
    },
  };
}

export function openAIToResponsesJSON(
  data: Record<string, unknown>,
  requestModel: string | null,
): Record<string, unknown> {
  const oai = data as Record<string, unknown>;
  const choices = (oai.choices as Array<Record<string, unknown>>) ?? [];
  const choice0 = choices[0] ?? {};
  const message = (choice0.message as Record<string, unknown>) ?? {};
  const usage = (oai.usage as Record<string, unknown>) ?? {};
  const text = (message.content as string) ?? "";
  const id = (oai.id as string) ?? `resp_${crypto.randomUUID()}`;
  const messageId = `msg_${id}`;

  return {
    id,
    object: "response",
    created: Math.floor(Date.now() / 1000),
    model: requestModel ?? oai.model,
    output: [
      {
        type: "message",
        id: messageId,
        role: (message.role as string) ?? "assistant",
        content: [{ type: "output_text", text, annotations: [] }],
      },
    ],
    usage: {
      input_tokens: (usage.prompt_tokens as number) ?? 0,
      output_tokens: (usage.completion_tokens as number) ?? 0,
      total_tokens:
        ((usage.prompt_tokens as number) ?? 0) + ((usage.completion_tokens as number) ?? 0),
    },
  };
}

export function anthropicSSEToResponses(
  upstreamStream: ReadableStream,
): ReadableStream {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  let responseId = "";
  let model = "";
  let messageId = "";
  let fullText = "";
  let usageOutput = 0;
  let created = 0;
  let hasContentBlock = false;
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

          if (currentEvent === "ping") {
            currentEvent = "";
            currentData = "";
            continue;
          }

          if (!currentEvent || !currentData) continue;

          try {
            const parsed = JSON.parse(currentData);

            if (currentEvent === "message_start") {
              const msg = parsed.message ?? {};
              responseId = msg.id ?? `resp_${crypto.randomUUID()}`;
              model = msg.model ?? "";
              messageId = `msg_${responseId}`;
              created = Math.floor(Date.now() / 1000);
              fullText = "";
              hasContentBlock = false;
              usageOutput = 0;

              const base = {
                id: responseId,
                object: "response",
                created,
                model,
                output: [] as any[],
                usage: null,
              };

              controller.enqueue(
                encoder.encode(
                  `event: response.created\ndata: ${JSON.stringify({ type: "response.created", response: base })}\n\n`,
                ),
              );
              controller.enqueue(
                encoder.encode(
                  `event: response.in_progress\ndata: ${JSON.stringify({ type: "response.in_progress", response: base })}\n\n`,
                ),
              );
            } else if (currentEvent === "content_block_start") {
              if (!hasContentBlock) {
                controller.enqueue(
                  encoder.encode(
                    `event: response.output_item.added\ndata: ${JSON.stringify({
                      type: "response.output_item.added",
                      output_index: 0,
                      item: { type: "message", id: messageId, role: "assistant", content: [] },
                    })}\n\n`,
                  ),
                );
                controller.enqueue(
                  encoder.encode(
                    `event: response.content_part.added\ndata: ${JSON.stringify({
                      type: "response.content_part.added",
                      output_index: 0,
                      content_index: 0,
                      part: { type: "text", text: "" },
                    })}\n\n`,
                  ),
                );
                hasContentBlock = true;
              }
            } else if (currentEvent === "content_block_delta") {
              const delta = parsed.delta ?? {};
              if (delta.type === "text_delta" && delta.text) {
                fullText += delta.text;
                controller.enqueue(
                  encoder.encode(
                    `event: response.output_text.delta\ndata: ${JSON.stringify({
                      type: "response.output_text.delta",
                      output_index: 0,
                      content_index: 0,
                      delta: delta.text,
                    })}\n\n`,
                  ),
                );
              }
            } else if (currentEvent === "content_block_stop") {
              if (hasContentBlock) {
                controller.enqueue(
                  encoder.encode(
                    `event: response.output_text.done\ndata: ${JSON.stringify({
                      type: "response.output_text.done",
                      output_index: 0,
                      content_index: 0,
                      text: fullText,
                    })}\n\n`,
                  ),
                );
                controller.enqueue(
                  encoder.encode(
                    `event: response.output_item.done\ndata: ${JSON.stringify({
                      type: "response.output_item.done",
                      output_index: 0,
                      item: {
                        type: "message",
                        id: messageId,
                        role: "assistant",
                        content: [
                          { type: "output_text", text: fullText, annotations: [] },
                        ],
                      },
                    })}\n\n`,
                  ),
                );
              }
            } else if (currentEvent === "message_delta") {
              const usage = parsed.usage ?? {};
              usageOutput = usage.output_tokens ?? 0;
            } else if (currentEvent === "message_stop") {
              const finalResponse = {
                id: responseId,
                object: "response",
                created,
                model,
                output: [
                  {
                    type: "message",
                    id: messageId,
                    role: "assistant",
                    content: [{ type: "output_text", text: fullText, annotations: [] }],
                  },
                ],
                usage: {
                  input_tokens: 0,
                  output_tokens: usageOutput,
                  total_tokens: usageOutput,
                },
              };
              controller.enqueue(
                encoder.encode(
                  `event: response.completed\ndata: ${JSON.stringify({ type: "response.completed", response: finalResponse })}\n\n`,
                ),
              );
            }
          } catch {
            // ignore parse errors
          }

          currentEvent = "";
          currentData = "";
        }
      },
      flush(controller) {
        controller.enqueue(encoder.encode("event: done\ndata: [DONE]\n\n"));
      },
    }),
  );
}

export function openaiSSEToResponses(
  upstreamStream: ReadableStream,
): ReadableStream {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  let responseId = `resp_${crypto.randomUUID()}`;
  let model = "";
  let messageId = `msg_${crypto.randomUUID()}`;
  let created = Math.floor(Date.now() / 1000);
  let fullText = "";
  let hasStarted = false;
  let isComplete = false;
  let completionTokens = 0;
  let buffer = "";

  return upstreamStream.pipeThrough(
    new TransformStream({
      transform(chunk, controller) {
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          const payload = trimmed.slice(6).trim();
          if (payload === "[DONE]") continue;

          try {
            const parsed = JSON.parse(payload);
            const choices = (parsed.choices as Array<Record<string, unknown>>) ?? [];
            const choice0 = choices[0] ?? {};
            const delta = (choice0.delta as Record<string, unknown>) ?? {};
            const content = (delta.content as string) ?? "";
            const role = delta.role as string | undefined;
            const finish = choice0.finish_reason as string | null | undefined;
            const usage = parsed.usage as Record<string, unknown> | undefined;

            if (usage?.completion_tokens) {
              completionTokens = usage.completion_tokens as number;
            }

            if (!hasStarted) {
              created = Math.floor(Date.now() / 1000);
              const base = {
                id: responseId,
                object: "response",
                created,
                model,
                output: [] as any[],
                usage: null,
              };

              controller.enqueue(
                encoder.encode(
                  `event: response.created\ndata: ${JSON.stringify({ type: "response.created", response: base })}\n\n`,
                ),
              );
              controller.enqueue(
                encoder.encode(
                  `event: response.in_progress\ndata: ${JSON.stringify({ type: "response.in_progress", response: base })}\n\n`,
                ),
              );
              controller.enqueue(
                encoder.encode(
                  `event: response.output_item.added\ndata: ${JSON.stringify({
                    type: "response.output_item.added",
                    output_index: 0,
                    item: { type: "message", id: messageId, role: role ?? "assistant", content: [] },
                  })}\n\n`,
                ),
              );
              controller.enqueue(
                encoder.encode(
                  `event: response.content_part.added\ndata: ${JSON.stringify({
                    type: "response.content_part.added",
                    output_index: 0,
                    content_index: 0,
                    part: { type: "text", text: "" },
                  })}\n\n`,
                ),
              );
              hasStarted = true;
            }

            if (content) {
              fullText += content;
              controller.enqueue(
                encoder.encode(
                  `event: response.output_text.delta\ndata: ${JSON.stringify({
                    type: "response.output_text.delta",
                    output_index: 0,
                    content_index: 0,
                    delta: content,
                  })}\n\n`,
                ),
              );
            }

            if (finish && !isComplete) {
              isComplete = true;
              controller.enqueue(
                encoder.encode(
                  `event: response.output_text.done\ndata: ${JSON.stringify({
                    type: "response.output_text.done",
                    output_index: 0,
                    content_index: 0,
                    text: fullText,
                  })}\n\n`,
                ),
              );
              controller.enqueue(
                encoder.encode(
                  `event: response.output_item.done\ndata: ${JSON.stringify({
                    type: "response.output_item.done",
                    output_index: 0,
                    item: {
                      type: "message",
                      id: messageId,
                      role: "assistant",
                      content: [{ type: "output_text", text: fullText, annotations: [] }],
                    },
                  })}\n\n`,
                ),
              );

              const finalResponse = {
                id: responseId,
                object: "response",
                created,
                model,
                output: [
                  {
                    type: "message",
                    id: messageId,
                    role: "assistant",
                    content: [{ type: "output_text", text: fullText, annotations: [] }],
                  },
                ],
                usage: {
                  input_tokens: 0,
                  output_tokens: completionTokens,
                  total_tokens: completionTokens,
                },
              };
              controller.enqueue(
                encoder.encode(
                  `event: response.completed\ndata: ${JSON.stringify({ type: "response.completed", response: finalResponse })}\n\n`,
                ),
              );
            }
          } catch {
            // ignore parse errors
          }
        }
      },
      flush(controller) {
        if (!hasStarted) {
          controller.enqueue(
            encoder.encode(
              `event: response.created\ndata: ${JSON.stringify({
                type: "response.created",
                response: { id: responseId, object: "response", created, model: "", output: [], usage: null },
              })}\n\n`,
            ),
          );
          controller.enqueue(
            encoder.encode(
              `event: response.completed\ndata: ${JSON.stringify({
                type: "response.completed",
                response: { id: responseId, object: "response", created, model: "", output: [], usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 } },
              })}\n\n`,
            ),
          );
        }
        controller.enqueue(encoder.encode("event: done\ndata: [DONE]\n\n"));
      },
    }),
  );
}

export function openaiSSEToAnthropic(
  upstreamStream: ReadableStream,
): ReadableStream {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  let id = crypto.randomUUID();
  let model = "";
  let contentAccumulated = false;
  let usageOutput = 0;
  let buffer = "";

  return upstreamStream.pipeThrough(
    new TransformStream({
      transform(chunk, controller) {
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          const payload = trimmed.slice(6).trim();
          if (payload === "[DONE]") continue;

          try {
            const parsed = JSON.parse(payload);
            const choices = parsed.choices ?? [];
            const choice0 = choices[0] ?? {};
            const delta = choice0.delta ?? {};
            const finish = choice0.finish_reason;

            if (!contentAccumulated) {
              id = parsed.id ?? id;
              model = parsed.model ?? model;

              controller.enqueue(
                encoder.encode(
                  `event: message_start\ndata: ${JSON.stringify({
                    type: "message_start",
                    message: {
                      id: `msg_${id}`,
                      type: "message",
                      role: "assistant",
                      content: [],
                      model,
                      stop_reason: null,
                      stop_sequence: null,
                      usage: { input_tokens: 0, output_tokens: 0 },
                    },
                  })}\n\n`,
                ),
              );

              controller.enqueue(
                encoder.encode(
                  `event: content_block_start\ndata: ${JSON.stringify({
                    type: "content_block_start",
                    index: 0,
                    content_block: { type: "text", text: "" },
                  })}\n\n`,
                ),
              );

              contentAccumulated = true;
            }

            const text = delta.content ?? "";
            if (text) {
              controller.enqueue(
                encoder.encode(
                  `event: content_block_delta\ndata: ${JSON.stringify({
                    type: "content_block_delta",
                    index: 0,
                    delta: { type: "text_delta", text },
                  })}\n\n`,
                ),
              );
            }

            if (parsed.usage?.completion_tokens) {
              usageOutput = parsed.usage.completion_tokens;
            }

            if (finish) {
              controller.enqueue(
                encoder.encode(
                  `event: content_block_stop\ndata: ${JSON.stringify({
                    type: "content_block_stop",
                    index: 0,
                  })}\n\n`,
                ),
              );

              controller.enqueue(
                encoder.encode(
                  `event: message_delta\ndata: ${JSON.stringify({
                    type: "message_delta",
                    delta: {
                      stop_reason: inverseFinishReason(finish),
                      stop_sequence: null,
                    },
                    usage: { output_tokens: usageOutput },
                  })}\n\n`,
                ),
              );

              controller.enqueue(
                encoder.encode(
                  `event: message_stop\ndata: ${JSON.stringify({
                    type: "message_stop",
                  })}\n\n`,
                ),
              );
            }
          } catch {
            // ignore parse errors
          }
        }
      },

      flush(controller) {
        if (!contentAccumulated) {
          controller.enqueue(
            encoder.encode(
              `event: message_start\ndata: ${JSON.stringify({
                type: "message_start",
                message: {
                  id: `msg_${id}`,
                  type: "message",
                  role: "assistant",
                  content: [],
                  model,
                  stop_reason: null,
                  stop_sequence: null,
                  usage: { input_tokens: 0, output_tokens: 0 },
                },
              })}\n\n`,
            ),
          );
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      },
    }),
  );
}
