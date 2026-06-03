import { Hono } from "hono";
import type { Env } from "../types";
import { FaqView } from "../views/faq";
import { getSessionUser } from "../middleware/session";

export const faqRoutes = new Hono<{ Bindings: Env }>();

faqRoutes.get("/faq", async (c) => {
  const user = await getSessionUser(c);
  return c.html(FaqView({ user: user ?? undefined }));
});
