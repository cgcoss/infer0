import { Hono } from "hono";
import type { Env } from "../types";
import { OG_IMAGE_PNG_BASE64 } from "./og-image-png";

export const ogImageRoutes = new Hono<{ Bindings: Env }>();

const PNG_BUF = Uint8Array.from(atob(OG_IMAGE_PNG_BASE64), (c) => c.charCodeAt(0));

ogImageRoutes.get("/og-image", (c) => {
  return c.body(PNG_BUF, 200, {
    "Content-Type": "image/png",
    "Cache-Control": "public, max-age=86400, s-maxage=86400",
  });
});


