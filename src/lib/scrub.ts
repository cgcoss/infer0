const API_KEY_PATTERNS = [
  /sk-[a-zA-Z0-9]{20,}/g,
  /sk-ant-[a-zA-Z0-9]{20,}/g,
  /Bearer\s+[a-zA-Z0-9._-]{20,}/gi,
];

export function scrubProviderError(body: string): string {
  let clean = body;
  for (const pattern of API_KEY_PATTERNS) {
    clean = clean.replace(pattern, "[REDACTED]");
  }
  return clean;
}
