import { Hono } from "hono";
import type { Env } from "./types";
import { homeRoutes } from "./routes/page-home";
import { docsRoutes } from "./routes/page-docs";
import { authRoutes } from "./routes/page-auth";
import { providerRoutes } from "./routes/api-providers";
import { inferenceRoutes } from "./routes/api-inference";
import { authorizedAppRoutes } from "./routes/api-authorized-apps";
import { userinfoRoutes } from "./routes/api-userinfo";
import { oauthRoutes } from "./routes/oauth";
import { providerPageRoutes } from "./routes/page-providers";
import { servicePageRoutes } from "./routes/page-services";

const app = new Hono<{ Bindings: Env }>();

// Security headers
app.use("*", async (c, next) => {
  await next();
  c.res.headers.set("X-Content-Type-Options", "nosniff");
  c.res.headers.set("X-Frame-Options", "DENY");
  c.res.headers.set("X-XSS-Protection", "0");
  c.res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  c.res.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' https: data:; font-src 'self' data:;",
  );
});

// Rate limiting (simple in-memory per-IP)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
app.use("*", async (c, next) => {
  const ip = c.req.header("CF-Connecting-IP") ?? "unknown";
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (entry && now < entry.resetAt) {
    entry.count++;
    if (entry.count > 100) {
      return c.text("Too Many Requests", { status: 429 });
    }
  } else {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
  }

  await next();
});

// Global error handler
app.onError((err, c) => {
  console.error("Unhandled error:", err);
  const accept = c.req.header("Accept") ?? "";
  const message = err instanceof Error ? err.message : "Internal server error";
  if (accept.includes("text/html")) {
    return c.html(`<!DOCTYPE html><html><body><p>Error: ${message}</p></body></html>`, 500 as any);
  }
  return c.json(
    { error: { message, code: "internal_error" } },
    500 as any,
  );
});

// 404 handler
app.notFound((c) => {
  const accept = c.req.header("Accept") ?? "";
  if (accept.includes("text/html")) {
    return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>404 — infer0</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#0a0a0b;--text:#fafafa;--text-muted:#a1a1aa;--accent:#6366f1}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:var(--bg);color:var(--text);line-height:1.6;min-height:100vh;display:flex;align-items:center;justify-content:center}
.container{text-align:center;padding:48px 24px}
h1{font-size:5rem;font-weight:800;color:var(--accent);letter-spacing:-0.03em;line-height:1}
p{color:var(--text-muted);margin:16px 0 24px;font-size:1.125rem}
a{display:inline-block;background:var(--accent);color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:0.9375rem}
a:hover{background:#818cf8}
</style>
</head>
<body>
<div class="container">
  <h1>404</h1>
  <p>This page doesn't exist.</p>
  <a href="/">Go home</a>
</div>
</body>
</html>`, 404 as any);
  }
  return c.json(
    { error: { message: "Not found", code: "not_found" } },
    404 as any,
  );
});

app.route("/", homeRoutes);
app.route("/", docsRoutes);
app.route("/", authRoutes);
app.route("/", providerRoutes);
app.route("/", inferenceRoutes);
app.route("/", authorizedAppRoutes);
app.route("/", oauthRoutes);
app.route("/", providerPageRoutes);
app.route("/", servicePageRoutes);
app.route("/", userinfoRoutes);

export default app;
