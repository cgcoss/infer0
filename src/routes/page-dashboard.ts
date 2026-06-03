import { Hono } from "hono";
import type { Env } from "../types";
import { requireAuth } from "../middleware/session";
import { DashboardView } from "../views/dashboard";

export const dashboardRoutes = new Hono<{ Bindings: Env }>();

dashboardRoutes.get("/dashboard", requireAuth, async (c) => {
  const user = c.get("user");

  const [providersResult, appsResult] = await Promise.all([
    c.env.DB.prepare(
      "SELECT * FROM provider_configs WHERE user_id = ? ORDER BY created_at DESC",
    ).bind(user.id).all(),
    c.env.DB.prepare(
      "SELECT * FROM authorized_apps WHERE user_id = ? ORDER BY created_at DESC",
    ).bind(user.id).all(),
  ]);

  return c.html(DashboardView({
    user,
    providers: providersResult.results as any[],
    authorizedApps: appsResult.results as any[],
  }));
});
