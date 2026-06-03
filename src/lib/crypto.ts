export async function hashKey(key: string): Promise<string> {
  const bytes = new TextEncoder().encode(key);
  const hashBytes = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hashBytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const CURRENT_KEY_VERSION = "v1";

const ALGORITHM = "AES-GCM";
const KEY_USAGE: string[] = ["encrypt", "decrypt"];

function keyFromSecret(secret: string): Promise<CryptoKey> {
  const raw = new TextEncoder().encode(secret.padEnd(32, "x").slice(0, 32));
  return crypto.subtle.importKey("raw", raw, ALGORITHM, false, KEY_USAGE);
}

export async function encrypt(
  plaintext: string,
  secret: string,
): Promise<string> {
  const key = await keyFromSecret(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoded,
  );
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  let result = "";
  for (const b of combined) {
    result += String.fromCharCode(b);
  }
  return btoa(result);
}

export async function decrypt(
  encoded: string,
  secret: string,
): Promise<string> {
  const key = await keyFromSecret(secret);
  const combined = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const plaintext = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    ciphertext,
  );
  return new TextDecoder().decode(plaintext);
}
