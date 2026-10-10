/** 影像识别：把借款凭证扫描件切成区块，按置信度决定字段采不采用。 */

import type { WorkGrid } from "./sheetEngine";

export type ImagePolicy = { minConfidence: number };

export type ImagePhase = { id: string; label: string; detail: string };

export type ImageExecution = {
  policy: ImagePolicy;
  phases: ImagePhase[];
  summary: string;
  markdown: string;
  grid: WorkGrid;
};

const DEFAULT_POLICY: ImagePolicy = { minConfidence: 0.7 };

const REGIONS: { block: string; box: string; text: string; confidence: number; field: string }[] = [
  { block: "标题", box: "12,8,420,46", text: "借款凭证", confidence: 0.98, field: "文种" },
  { block: "借款人", box: "40,70,280,98", text: "星图智造", confidence: 0.93, field: "借款人" },
  { block: "金额", box: "40,110,260,142", text: "300,000", confidence: 0.91, field: "本次借款金额" },
  { block: "期限", box: "280,110,420,142", text: "24个月", confidence: 0.74, field: "借款期限" },
  { block: "账号", box: "40,160,360,196", text: "6222 **** **** 1234", confidence: 0.88, field: "放款账户" },
  { block: "印章", box: "300,210,460,340", text: "印文模糊", confidence: 0.42, field: "甲方盖章" },
];

export function imagePolicyFromArgs(args: Record<string, unknown> | undefined): ImagePolicy {
  const minConfidence = Number(args?.minConfidence ?? DEFAULT_POLICY.minConfidence);
  return { minConfidence: Number.isFinite(minConfidence) ? minConfidence : DEFAULT_POLICY.minConfidence };
}

export function imagePolicyFromSteps(steps: { tool: string; args?: Record<string, unknown> }[]): ImagePolicy | null {
  const mine = steps.filter((step) => step.tool.startsWith("__image_"));
  if (!mine.length) return null;
  return mine.reduce((policy, step) => ({ ...policy, ...imagePolicyFromArgs(step.args) }), { ...DEFAULT_POLICY });
}

export function executeImage(policy: ImagePolicy = DEFAULT_POLICY): ImageExecution {
  const rows = REGIONS.map((region) => {
    const accept = region.confidence >= policy.minConfidence;
    return { ...region, accept };
  });
  const dropped = rows.filter((row) => !row.accept);
  const grid: WorkGrid = {
    columns: ["区块", "坐标", "识别文字", "置信度", "字段", "采用"],
    rows: rows.map((row) => [
      row.block,
      row.box,
      row.text,
      row.confidence.toFixed(2),
      row.field,
      row.accept ? "采用" : "弃用",
    ]),
  };
  const summary = dropped.length
    ? `6 个区块里 ${rows.length - dropped.length} 个采用。弃用 ${dropped.map((row) => `${row.block} ${row.confidence.toFixed(2)}`).join("、")}，低于 ${policy.minConfidence.toFixed(2)}。`
    : `6 个区块全部采用，置信度线 ${policy.minConfidence.toFixed(2)}。`;
  const phases: ImagePhase[] = [
    { id: "crop", label: "切块", detail: "凭证扫成 6 块：标题、借款人、金额、期限、账号、印章。" },
    { id: "ocr", label: "识别", detail: rows.map((row) => `${row.block} ${row.text} ${row.confidence.toFixed(2)}`).join("；") + "。" },
    { id: "accept", label: "取舍", detail: `置信度低于 ${policy.minConfidence.toFixed(2)} 的不写入字段。` },
    { id: "report", label: "字段表", detail: summary },
  ];
  const markdown = `结论：${summary}`;
  return { policy, phases, summary, markdown, grid };
}

const PHASE_INDEX: Record<string, number> = {
  __image_crop__: 0,
  __image_ocr__: 1,
  __image_accept__: 2,
  __image_report__: 3,
};

export function runImageTool(name: string, args: Record<string, unknown>): { content: unknown } | null {
  const index = PHASE_INDEX[name];
  if (index == null) return null;
  const ran = executeImage(imagePolicyFromArgs(args));
  const phase = ran.phases[index]!;
  return {
    content: {
      markdown: name === "__image_report__" ? ran.markdown : phase.detail,
      detail: phase.detail,
      summary: ran.summary,
      dashboard: { image: { phase: phase.id, summary: ran.summary } },
      meta: { skill: "image-desk" },
    },
  };
}
