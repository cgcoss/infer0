export type Endpoint = "chat" | "messages" | "responses";

function newId(prefix: string): string {
  return prefix + crypto.randomUUID().slice(0, 12);
}

function finishReasonMap(reason: string | null, endpoint: Endpoint): string | null {
  if (endpoint === "messages") {
    if (reason === "stop") return "end_turn";
    if (reason === "length") return "max_tokens";
    if (reason === "content_filter") return "content_filter";
    return null;
  }
  return reason;
}

export function translateResponse(
  endpoint: Endpoint,
  chatResponse: Record<string, unknown>,
  requestModel: string | null,
): Record<string, unknown> {
  if (endpoint === "chat") return chatResponse;

  const choice = (chatResponse.choices as any[])?.[0];
  const content = choice?.message?.content ?? "";
  const finish = choice?.finish_reason as string | null;
  const model = requestModel ?? (chatResponse.model as string);
  const usage = chatResponse.usage as Record<string, number> | undefined;

  if (endpoint === "messages") {
    return {
      id: newId("msg_"),
      type: "message",
      role: "assistant",
      content: [{ type: "text", text: content }],
      model,
      stop_reason: finishReasonMap(finish, "messages"),
      stop_sequence: null,
      usage: {
        input_tokens: usage?.prompt_tokens ?? 0,
        output_tokens: usage?.completion_tokens ?? 0,
      },
    };
  }

  if (endpoint === "responses") {
    return {
      id: newId("resp_"),
      object: "response",
      model,
      output: [
        {
          type: "message",
          id: newId("msg_"),
          role: "assistant",
          content: [{ type: "output_text", text: content }],
        },
      ],
      usage: {
        input_tokens: usage?.prompt_tokens ?? 0,
        output_tokens: usage?.completion_tokens ?? 0,
        total_tokens: usage?.total_tokens ?? 0,
      },
    };
  }

  return chatResponse;
}

export function translateStream(
  endpoint: Endpoint,
  gwStream: ReadableStream,
  useModel: string | null,
): ReadableStream {
  if (endpoint === "chat") return gwStream;

  const decoder = new TextDecoder();
  let buf = "";
  let id = "";
  let model = "";
  let acc = "";
  let started = false;
  let finished = false;

  function encode(json: unknown): Uint8Array {
    return new TextEncoder().encode(`data: ${JSON.stringify(json)}\n\n`);
  }
  function encodeEvent(event: string, json: unknown): Uint8Array {
    return new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(json)}\n\n`);
  }

  const reader = gwStream.getReader();

  return new ReadableStream({
    async pull(controller) {
      while (true) {
        if (finished) { controller.close(); return; }

        const { done, value } = await reader.read();
        if (done) {
          if (!finished) {
            // Stream ended without a finish chunk — emit terminal
            if (endpoint === "messages") {
              controller.enqueue(encodeEvent("message_stop", { type: "message_stop" }));
            } else if (endpoint === "responses") {
              controller.enqueue(encodeEvent("response.done", {
                type: "response.done",
                response: {
                  id: "resp_" + id, object: "response", model: useModel || model,
                  output: [{ id: "msg_" + id, type: "message", role: "assistant", content: [{ type: "output_text", text: acc }] }],
                  usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
                },
              }));
            }
          }
          controller.close();
          return;
        }

        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (raw === "[DONE]") { finished = true; continue; }

          let chunk: any;
          try { chunk = JSON.parse(raw); } catch { continue; }

          if (chunk.id) id = chunk.id;
          if (chunk.model) model = chunk.model;
          const delta = chunk.choices?.[0]?.delta;

          if (delta?.role && !started) {
            started = true;
            if (endpoint === "messages") {
              controller.enqueue(encodeEvent("message_start", {
                type: "message_start",
                message: {
                  id: newId("msg_"), type: "message", role: "assistant", content: [],
                  model: useModel || model, stop_reason: null, stop_sequence: null,
                  usage: { input_tokens: 0, output_tokens: 0 },
                },
              }));
              controller.enqueue(encodeEvent("content_block_start", {
                type: "content_block_start", index: 0,
                content_block: { type: "text", text: "" },
              }));
            } else if (endpoint === "responses") {
              controller.enqueue(encodeEvent("response.created", {
                type: "response.created",
                response: { id: newId("resp_"), object: "response", model: useModel || model, output: [], usage: null },
              }));
              controller.enqueue(encodeEvent("response.in_progress", {
                type: "response.in_progress",
                response: { id: newId("resp_"), object: "response", model: useModel || model, status: "in_progress" },
              }));
              controller.enqueue(encodeEvent("response.output_item.added", {
                type: "response.output_item.added",
                item: { id: newId("msg_"), type: "message", role: "assistant", content: [] },
              }));
              controller.enqueue(encodeEvent("response.content_part.added", {
                type: "response.content_part.added", index: 0, part: { type: "text" },
              }));
            }
          }

          if (delta?.content) {
            acc += delta.content;
            if (endpoint === "messages") {
              controller.enqueue(encodeEvent("content_block_delta", {
                type: "content_block_delta", index: 0,
                delta: { type: "text_delta", text: delta.content },
              }));
            } else if (endpoint === "responses") {
              controller.enqueue(encodeEvent("response.output_text.delta", {
                type: "response.output_text.delta", delta: delta.content,
                item_id: "msg_" + id, output_index: 0, content_index: 0,
              }));
            }
          }

          const finish = chunk.choices?.[0]?.finish_reason;
          if (finish && started) {
            finished = true;
            const u = chunk.usage || {};
            if (endpoint === "messages") {
              controller.enqueue(encodeEvent("content_block_stop", { type: "content_block_stop", index: 0 }));
              controller.enqueue(encodeEvent("message_delta", {
                type: "message_delta",
                delta: { stop_reason: finishReasonMap(finish, "messages"), stop_sequence: null },
                usage: { output_tokens: u.completion_tokens || 0 },
              }));
              controller.enqueue(encodeEvent("message_stop", { type: "message_stop" }));
            } else if (endpoint === "responses") {
              const itemId = "msg_" + id;
              controller.enqueue(encodeEvent("response.output_text.done", {
                type: "response.output_text.done", text: acc,
                item_id: itemId, output_index: 0, content_index: 0,
              }));
              controller.enqueue(encodeEvent("response.output_item.done", {
                type: "response.output_item.done",
                item: { id: itemId, type: "message", role: "assistant", content: [{ type: "text", text: acc }] },
              }));
              controller.enqueue(encodeEvent("response.done", {
                type: "response.done",
                response: {
                  id: newId("resp_"), object: "response", model: useModel || model,
                  output: [{ id: itemId, type: "message", role: "assistant", content: [{ type: "output_text", text: acc }] }],
                  usage: {
                    input_tokens: u.prompt_tokens || 0,
                    output_tokens: u.completion_tokens || 0,
                    total_tokens: u.total_tokens || 0,
                  },
                },
              }));
            }
            controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
          }
        }

        // Yield control back to signal we've processed some data
        // The stream continues in subsequent pull() calls
        return;
      }
    },
    cancel() {
      reader.cancel();
    },
  });
}
