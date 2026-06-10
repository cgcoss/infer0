import { Hono } from "hono";
import type { Env } from "../types";
import { recordCost } from "../lib/gateway-cost";

export const otelRoutes = new Hono<{ Bindings: Env }>();

type OTelValue = {
  stringValue?: string;
  intValue?: string | number;
  doubleValue?: number;
  boolValue?: boolean;
};

type OTelAttribute = {
  key: string;
  value: OTelValue;
};

type OTelSpan = {
  traceId?: string;
  spanId?: string;
  name?: string;
  attributes?: OTelAttribute[];
};

type OTelScopeSpan = {
  scope?: Record<string, unknown>;
  spans?: OTelSpan[];
};

type OTelResourceSpan = {
  resource?: { attributes?: OTelAttribute[] };
  scopeSpans?: OTelScopeSpan[];
};

type OTelPayload = {
  resourceSpans?: OTelResourceSpan[];
};

function attrValue(attrs: OTelAttribute[] | undefined, key: string): string | number | undefined {
  if (!attrs) return undefined;
  for (const a of attrs) {
    if (a.key === key) {
      const v = a.value;
      if (v.stringValue !== undefined) return v.stringValue;
      if (v.intValue !== undefined) return typeof v.intValue === "number" ? v.intValue : parseInt(v.intValue, 10);
      if (v.doubleValue !== undefined) return v.doubleValue;
      return undefined;
    }
  }
  return undefined;
}

otelRoutes.post("/otel/v1/traces", async (c) => {
  const auth = c.req.header("Authorization");
  const expected = `Bearer ${c.env.OTEL_AUTH_TOKEN}`;
  if (!auth || auth !== expected) {
    return c.json({ error: "unauthorized" }, 401);
  }

  const body: OTelPayload = await c.req.json();
  if (!body.resourceSpans) return c.json({ ok: true });

  const promises: Promise<void>[] = [];

  for (const rs of body.resourceSpans) {
    if (!rs.scopeSpans) continue;
    for (const ss of rs.scopeSpans) {
      if (!ss.spans) continue;
      for (const span of ss.spans) {
        const attrs = span.attributes;
        if (!attrs) continue;

        const cost = attrValue(attrs, "gen_ai.usage.cost");
        const userId = attrValue(attrs, "user_id");
        const configId = attrValue(attrs, "provider_config_id");
        const authId = attrValue(attrs, "oauth_authorization_id");

        if (cost !== undefined && userId && configId) {
          const costCents = Number(((cost as number) * 100).toFixed(4));
          if (costCents > 0) {
            promises.push(recordCost(c.env.DB, userId as string, configId as string, costCents, authId as string | undefined));
          }
        }
      }
    }
  }

  if (promises.length > 0) {
    c.executionCtx.waitUntil(Promise.all(promises));
  }

  return c.json({ ok: true, recorded: promises.length });
});
