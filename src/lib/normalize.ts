export type Protocol = "openai" | "anthropic" | "responses";

export function getProtocol(pathname: string): Protocol {
  if (pathname === "/v1/messages") return "anthropic";
  if (pathname === "/v1/responses") return "responses";
  return "openai";
}

export function extractMessages(body: Record<string, unknown>): Array<{ role: string; content: string }> {
  return (body.messages as Array<{ role: string; content: string }>) ?? [];
}

export function extractStream(body: Record<string, unknown>): boolean {
  return body.stream === true;
}

export function extractRequestModel(body: Record<string, unknown>): string | null {
  return (body.model as string) ?? null;
}

export function normalizeResponsesBody(body: Record<string, unknown>, providerType: string): void {
  const input = body.input;
  if (typeof input === "string") {
    body.messages = [{ role: "user", content: input }];
  } else if (Array.isArray(input)) {
    body.messages = input
      .filter((item: any) => item.type === "message")
      .map((item: any) => ({ role: item.role, content: item.content ?? "" }));
  }

  if (body.instructions) {
    if (providerType === "anthropic") {
      body.system = body.instructions;
    } else {
      const msgs = (body.messages as Array<any>) ?? [];
      msgs.unshift({ role: "system", content: body.instructions as string });
      body.messages = msgs;
    }
  }

  if (body.max_output_tokens) {
    body.max_tokens = body.max_output_tokens;
  }

  if (body.previous_response_id) {
    body.previous_response_id = body.previous_response_id;
  }

  delete body.input;
  delete body.instructions;
  delete body.max_output_tokens;
}
