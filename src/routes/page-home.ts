import { Hono } from "hono";
import type { Env } from "../types";
import { HomeView } from "../views/home";
import { getSessionUser } from "../middleware/session";

export const homeRoutes = new Hono<{ Bindings: Env }>();

homeRoutes.get("/", async (c) => {
  const user = await getSessionUser(c);
  return c.html(HomeView({ user: user ?? undefined }));
});
