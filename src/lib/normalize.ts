export type NormalizedRequest = {
  model: string | null;
  messages: { role: string; content: string }[];
  stream: boolean;
};

export type SourceEndpoint = "chat" | "messages" | "responses";

export function normalizeRequest(body: Record<string, unknown>, source: SourceEndpoint): NormalizedRequest {
  const stream = body.stream === true;
  const model = (body.model as string) ?? null;

  let messages: { role: string; content: string }[];

  switch (source) {
    case "chat":
    case "messages":
      messages = asMessages(body.messages);
      break;
    case "responses":
      messages = normalizeInput(body.input);
      break;
    default:
      messages = [];
  }

  return { model, messages, stream };
}

function normalizeInput(input: unknown): { role: string; content: string }[] {
  if (typeof input === "string") {
    return [{ role: "user", content: input }];
  }
  if (Array.isArray(input)) {
    return input.map((m: any) => ({
      role: m.role ?? "user",
      content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
    }));
  }
  return [];
}

function asMessages(messages: unknown): { role: string; content: string }[] {
  if (!Array.isArray(messages)) return [];
  return messages.map((m: any) => ({
    role: m.role ?? "user",
    content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
  }));
}
