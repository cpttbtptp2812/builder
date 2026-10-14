/** 把一次真实办理的步骤分成取证、执行、审阅。驳回只来自这一单里失败或被拦住的步骤。 */

import type { RunNodeView } from "./runReducer";

export type ReviewRole = "取证" | "执行" | "审阅";

export type ReviewReject = { index: number; stepId: string; name: string; reason: string };

const READ = /parse|intake|load|read|validate|scan|crop|ocr/i;
const REVIEW = /report|deliver|brief|guard|verify|reconcile|accept/i;

export function reviewRole(tool: string): ReviewRole {
  if (READ.test(tool)) return "取证";
  if (REVIEW.test(tool)) return "审阅";
  return "执行";
}

export function reviewRun(nodes: RunNodeView[]): { lanes: Record<ReviewRole, RunNodeView[]>; rejects: ReviewReject[] } {
  const lanes: Record<ReviewRole, RunNodeView[]> = { 取证: [], 执行: [], 审阅: [] };
  const rejects: ReviewReject[] = [];
  for (const node of nodes) {
    lanes[reviewRole(node.tool)].push(node);
    if (node.status === "failed") {
      rejects.push({ index: node.index, stepId: node.stepId, name: node.name, reason: node.label || "这一步没有跑成" });
    } else if (node.status === "completed") {
      const stopped = stoppedReason(node.result);
      if (stopped) rejects.push({ index: node.index, stepId: node.stepId, name: node.name, reason: stopped });
    }
  }
  return { lanes, rejects };
}

function stoppedReason(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const body = result as { code?: string; detail?: string; stopped?: boolean };
  if (body.stopped || (typeof body.code === "string" && /GUARD|BLOCK/i.test(body.code))) {
    return body.detail?.trim() || "这一步把单子拦住了";
  }
  return null;
}
