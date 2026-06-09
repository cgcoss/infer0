export function extractRequestModel(body: Record<string, unknown>): string | null {
  return (body.model as string) ?? null;
}
