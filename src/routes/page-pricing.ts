import { Hono } from "hono";
import type { Env } from "../types";
import { PricingView } from "../views/pricing";
import { getSessionUser } from "../middleware/session";

export const pricingRoutes = new Hono<{ Bindings: Env }>();

pricingRoutes.get("/pricing", async (c) => {
  const user = await getSessionUser(c);
  return c.html(PricingView({ user: user ?? undefined }));
});
