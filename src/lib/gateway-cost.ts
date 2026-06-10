export async function recordCost(
  db: D1Database,
  userId: string,
  configId: string,
  costCents: number,
): Promise<void> {
  if (costCents <= 0) return;
  const today = new Date().toISOString().slice(0, 10);
  await db.prepare(
    `INSERT INTO daily_usage (user_id, provider_config_id, date, cost_cents)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, provider_config_id, date)
     DO UPDATE SET cost_cents = cost_cents + ?`,
  ).bind(userId, configId, today, costCents, costCents).run();
}
