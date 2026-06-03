import { SignJWT, jwtVerify, type JWTPayload } from "jose";

export interface SessionPayload extends JWTPayload {
  sub: string;
  email?: string;
}

function getSecret(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signToken(
  payload: SessionPayload,
  secret: string,
  expiresIn = "7d",
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getSecret(secret));
}

export async function verifyToken(
  token: string,
  secret: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(secret));
    return payload as SessionPayload;
  } catch {
    return null;
  }
}
