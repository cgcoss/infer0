import { Hono } from "hono";
import type { Env } from "../types";
import { QuickstartView } from "../views/quickstart";
import { getSessionUser } from "../middleware/session";

export const quickstartRoutes = new Hono<{ Bindings: Env }>();

quickstartRoutes.get("/quickstart", async (c) => {
  const user = await getSessionUser(c);
  return c.html(QuickstartView({ user: user ?? undefined }));
});
