/** Skill 步骤变量写入规则 — Semcompiler def-use 与运行时 storeStepResult 共用 */

export const BUILTIN_SLOTS = ["query", "probeUrl"] as const;

/** 某 step 执行后写入 ctx.vars 的键（含 stepId 与工具别名） */
export function stepVarWrites(stepId: string, tool: string): string[] {
  const keys = new Set<string>([stepId]);
  if (tool === "http_probe") keys.add("probeResult");
  if (tool === "browser_snapshot") keys.add("snapshotResult");
  if (tool === "workflow_run") keys.add("workflowResult");
  if (tool === "__perf_metrics__") keys.add("perfResult");
  if (tool === "knowledge_search") keys.add("searchResult");
  return [...keys];
}

export function applyStepVarWrites(
  vars: Record<string, unknown>,
  stepId: string,
  tool: string,
  result: unknown,
): void {
  for (const key of stepVarWrites(stepId, tool)) {
    vars[key] = result;
  }
}
