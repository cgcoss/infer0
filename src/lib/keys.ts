const KEY_PREFIX = "infer0_";
const KEY_BYTES = 32;

export function generateApiKey(): { plaintext: string; prefix: string; hash: string } {
  const rand = crypto.getRandomValues(new Uint8Array(KEY_BYTES));
  const hex = Array.from(rand)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const plaintext = `${KEY_PREFIX}${hex}`;
  const prefix = plaintext.slice(0, 12);
  return { plaintext, prefix, hash: "" };
}

export async function hashKey(key: string): Promise<string> {
  const bytes = new TextEncoder().encode(key);
  const hashBytes = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hashBytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
