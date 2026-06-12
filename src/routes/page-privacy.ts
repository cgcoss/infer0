import { Hono } from "hono";
import type { Env } from "../types";
import { PrivacyView } from "../views/privacy";
import { getSessionUser } from "../middleware/session";

export const privacyRoutes = new Hono<{ Bindings: Env }>();

privacyRoutes.get("/privacy", async (c) => {
  const user = await getSessionUser(c);
  return c.html(PrivacyView({ user: user ?? undefined }));
});
