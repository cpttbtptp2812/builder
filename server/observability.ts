type ProductRunOutcome = "finish" | "guard" | "error" | "cancelled";

const startedAt = Date.now();
const recentProductRunMs: number[] = [];
const MAX_DURATION_SAMPLES = 2_000;
const metrics = {
  productRuns: 0,
  productRunFinish: 0,
  productRunGuard: 0,
  productRunError: 0,
  productRunCancelled: 0,
  productRunTotalMs: 0,
  llmErrors: 0,
};

export function recordProductRun(outcome: ProductRunOutcome, ms = 0): void {
  const duration = Math.max(0, ms);
  metrics.productRuns += 1;
  metrics.productRunTotalMs += duration;
  recentProductRunMs.push(duration);
  if (recentProductRunMs.length > MAX_DURATION_SAMPLES) recentProductRunMs.shift();
  if (outcome === "finish") metrics.productRunFinish += 1;
  else if (outcome === "guard") metrics.productRunGuard += 1;
  else if (outcome === "error") metrics.productRunError += 1;
  else metrics.productRunCancelled += 1;
}

export function recordLlmError(): void {
  metrics.llmErrors += 1;
}

export function metricsSnapshot() {
  const sorted = [...recentProductRunMs].sort((a, b) => a - b);
  const p95Index = sorted.length ? Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1) : -1;
  return {
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    ...metrics,
    productRunAverageMs: metrics.productRuns ? Math.round(metrics.productRunTotalMs / metrics.productRuns) : 0,
    productRunP95Ms: p95Index >= 0 ? sorted[p95Index] : 0,
    productRunDurationSampleSize: sorted.length,
  };
}

const SECRET_KEYS = /key|password|authorization|token|csv|rows|body|raw/i;

export function safeLog(event: string, fields: Record<string, unknown> = {}): void {
  const safe = Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, SECRET_KEYS.test(key) ? "[redacted]" : value]),
  );
  console.log(JSON.stringify({ at: new Date().toISOString(), event, ...safe }));
}

