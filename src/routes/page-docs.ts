import { Hono } from "hono";
import type { Env } from "../types";
import { DocsView } from "../views/docs";
import { getSessionUser } from "../middleware/session";

export const docsRoutes = new Hono<{ Bindings: Env }>();

docsRoutes.get("/docs", async (c) => {
  const user = await getSessionUser(c);
  return c.html(DocsView({ user: user ?? undefined }));
});
