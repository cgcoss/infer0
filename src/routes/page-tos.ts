import { Hono } from "hono";
import type { Env } from "../types";
import { TosView } from "../views/tos";
import { getSessionUser } from "../middleware/session";

export const tosRoutes = new Hono<{ Bindings: Env }>();

tosRoutes.get("/tos", async (c) => {
  const user = await getSessionUser(c);
  return c.html(TosView({ user: user ?? undefined }));
});
