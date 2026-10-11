/**
 * 影像识表办事程序 — 区块契约、必填字段守卫、置信度取舍、QA 队列、多表交付。
 */

import { imagePolicyFromArgs, type ImagePolicy } from "./imageEngine";
import { ProductDataMissingError, type ProductDataSlot } from "./productDataStore";
import { tableFromEmbedded, type WorkGrid } from "./sheetEngine";
import { workbenchSheetTable } from "./workbenchDataset";

export type ImageProgramPolicy = ImagePolicy & {
  requireColumns: string[];
  minBlocks: number;
  /** 必填字段名（映射列「字段」） */
  requiredFields: string[];
  /** 弃用必填字段时 failFast */
  blockOnRequiredReject: boolean;
};

export type RegionRow = { block: string; box: string; text: string; confidence: number; field: string; accept: boolean };

export type ImageProgramState = {
  policy: ImageProgramPolicy;
  regions: RegionRow[];
  schemaOk: boolean;
  schemaIssues: string[];
  blocksOk: boolean;
  missingRequired: string[];
  blocked: boolean;
  summary: string;
  fieldGrid: WorkGrid;
  acceptedGrid: WorkGrid;
  rejectedGrid: WorkGrid;
  qaGrid: WorkGrid;
};

function parseConfidence(raw: unknown): number {
  const n = Number(String(raw ?? "").replace(/%/g, ""));
  if (!Number.isFinite(n)) return 0;
  return n > 1 ? n / 100 : n;
}

function regionsFromTable(table: import("./sheetEngine").SheetTable): Omit<RegionRow, "accept">[] {
  const col = (names: string[]) => table.columns.find((c) => names.some((n) => c.name.includes(n)))?.name;
  const blockK = col(["区块", "block"]) ?? table.columns[0]?.name ?? "区块";
  const boxK = col(["坐标", "box"]) ?? "坐标";
  const textK = col(["识别", "文字", "text", "ocr"]) ?? "识别文字";
  const confK = col(["置信", "confidence"]) ?? "置信度";
  const fieldK = col(["字段", "field"]) ?? "字段";
  return table.rows.map((row, i) => ({
    block: String(row[blockK] ?? `区块${i + 1}`),
    box: String(row[boxK] ?? ""),
    text: String(row[textK] ?? ""),
    confidence: parseConfidence(row[confK]),
    field: String(row[fieldK] ?? ""),
  }));
}

function resolveRegions(productWorkbench: boolean, query: string, sessionId?: string): Omit<RegionRow, "accept">[] {
  const slot: ProductDataSlot = "voucher-ocr-blocks";
  if (productWorkbench) {
    const fromSlot = workbenchSheetTable(sessionId, slot);
    if (fromSlot?.rows.length) return regionsFromTable(fromSlot);
    const embedded = tableFromEmbedded(query);
    if (embedded?.rows.length) return regionsFromTable(embedded);
    throw new ProductDataMissingError(slot, "请先导入凭证识别区块表后再执行影像识表。");
  }
  const embedded = tableFromEmbedded(query);
  if (embedded?.rows.length) return regionsFromTable(embedded);
  throw new ProductDataMissingError("voucher-ocr-blocks", "请先导入凭证识别区块表，或在问句中附上 CSV。");
}

export function imageProgramPolicyFromArgs(args: Record<string, unknown> | undefined): ImageProgramPolicy {
  const base = imagePolicyFromArgs(args);
  const requireRaw = args?.requireColumns;
  const requireColumns = Array.isArray(requireRaw)
    ? requireRaw.map(String)
    : typeof requireRaw === "string"
      ? requireRaw.split(/[,，、]/).map((s) => s.trim()).filter(Boolean)
      : ["区块", "识别文字", "置信度", "字段"];
  const fieldsRaw = args?.requiredFields;
  const requiredFields = Array.isArray(fieldsRaw)
    ? fieldsRaw.map(String)
    : typeof fieldsRaw === "string"
      ? fieldsRaw.split(/[,，、]/).map((s) => s.trim()).filter(Boolean)
      : ["借款人", "本次借款金额"];
  const minBlocks = Number(args?.minBlocks ?? 1);
  return {
    ...base,
    requireColumns,
    requiredFields,
    minBlocks: Number.isFinite(minBlocks) ? minBlocks : 1,
    blockOnRequiredReject: args?.blockOnRequiredReject !== false,
  };
}

function validateSchema(table: import("./sheetEngine").SheetTable | null, requireColumns: string[]): string[] {
  if (!table?.rows.length) return ["没有区块数据"];
  const names = table.columns.map((c) => c.name);
  const issues: string[] = [];
  for (const need of requireColumns) {
    if (!names.some((n) => n.includes(need) || need.includes(n))) issues.push(`缺列「${need}」`);
  }
  return issues;
}

export function buildImageProgramState(
  query: string,
  policy: ImageProgramPolicy,
  productWorkbench: boolean,
  sessionId?: string,
): ImageProgramState {
  let table: import("./sheetEngine").SheetTable | null = null;
  if (productWorkbench) {
    table = workbenchSheetTable(sessionId, "voucher-ocr-blocks") ?? tableFromEmbedded(query);
  } else {
    table = tableFromEmbedded(query);
  }
  const schemaIssues = validateSchema(table, policy.requireColumns);
  const schemaOk = schemaIssues.length === 0;
  const raw = schemaOk ? resolveRegions(productWorkbench, query, sessionId) : [];
  const regions: RegionRow[] = raw.map((r) => ({
    ...r,
    accept: r.confidence >= policy.minConfidence,
  }));
  const blocksOk = regions.length >= policy.minBlocks;
  const acceptedFields = new Set(regions.filter((r) => r.accept).map((r) => r.field));
  const missingRequired = policy.requiredFields.filter(
    (f) => !acceptedFields.has(f) && !regions.some((r) => r.field.includes(f) && r.accept),
  );
  const blocked =
    !schemaOk || !blocksOk || (policy.blockOnRequiredReject && missingRequired.length > 0);
  const dropped = regions.filter((r) => !r.accept);
  const n = regions.length;
  const summary = !schemaOk
    ? schemaIssues.join("；")
    : !blocksOk
      ? `区块数 ${n} 低于最少 ${policy.minBlocks}。`
      : missingRequired.length && policy.blockOnRequiredReject
        ? `必填字段未采用：${missingRequired.join("、")}。`
        : dropped.length
          ? `${n} 区块中 ${n - dropped.length} 个采用；弃用 ${dropped.map((d) => d.block).join("、")}。`
          : `${n} 个区块全部采用，线 ${policy.minConfidence.toFixed(2)}。`;

  const fieldGrid: WorkGrid = {
    columns: ["区块", "坐标", "识别文字", "置信度", "字段", "采用"],
    rows: regions.map((row) => [
      row.block,
      row.box,
      row.text,
      row.confidence.toFixed(2),
      row.field,
      row.accept ? "采用" : "弃用",
    ]),
  };
  const acceptedGrid: WorkGrid = {
    columns: ["字段", "值", "置信度"],
    rows: regions.filter((r) => r.accept).map((r) => [r.field || r.block, r.text, r.confidence.toFixed(2)]),
  };
  const rejectedGrid: WorkGrid = {
    columns: ["区块", "字段", "文字", "置信度", "原因"],
    rows: regions
      .filter((r) => !r.accept)
      .map((r) => [r.block, r.field, r.text, r.confidence.toFixed(2), `低于 ${policy.minConfidence.toFixed(2)}`]),
  };
  const qaGrid: WorkGrid = {
    columns: ["类型", "项", "说明"],
    rows: [
      ...missingRequired.map((f) => ["必填", f, "未通过置信度线"] as string[]),
      ...dropped.filter((d) => d.field).map((d) => ["低置信", d.field, d.text] as string[]),
    ],
  };

  return {
    policy,
    regions,
    schemaOk,
    schemaIssues,
    blocksOk,
    missingRequired,
    blocked,
    summary,
    fieldGrid,
    acceptedGrid,
    rejectedGrid,
    qaGrid,
  };
}

type ImagePhaseId =
  | "intake"
  | "validate_schema"
  | "validate_blocks"
  | "crop"
  | "ocr"
  | "histogram"
  | "accept"
  | "required_guard"
  | "deliver_fields"
  | "deliver_accepted"
  | "deliver_rejected"
  | "deliver_qa"
  | "report";

function phasePayload(state: ImageProgramState, phase: ImagePhaseId): {
  detail: string;
  grid?: WorkGrid;
  guardFailed?: boolean;
  markdown?: string;
} {
  const p = state.policy;
  const n = state.regions.length;
  switch (phase) {
    case "intake":
      return { detail: `读入凭证区块表，共 ${n} 条。` };
    case "validate_schema":
      return {
        detail: state.schemaOk ? `契约 ${p.requireColumns.join("、")} 通过。` : state.schemaIssues.join("；"),
        guardFailed: !state.schemaOk,
      };
    case "validate_blocks":
      return {
        detail: state.blocksOk ? `区块数 ${n} ≥ ${p.minBlocks}。` : `仅 ${n} 块，低于 ${p.minBlocks}。`,
        guardFailed: !state.blocksOk,
      };
    case "crop":
      return { detail: n ? `结构：${state.regions.map((r) => r.block).join("、")}。` : "无区块。" };
    case "ocr":
      return {
        detail: state.regions.map((r) => `${r.block} ${r.text} ${r.confidence.toFixed(2)}`).join("；") + (n ? "。" : ""),
      };
    case "histogram": {
      const low = state.regions.filter((r) => r.confidence < p.minConfidence).length;
      const mid = state.regions.filter((r) => r.confidence >= p.minConfidence && r.confidence < 0.9).length;
      const high = state.regions.filter((r) => r.confidence >= 0.9).length;
      return { detail: `置信分布：高 ${high} · 中 ${mid} · 低 ${low}（线 ${p.minConfidence.toFixed(2)}）。` };
    }
    case "accept":
      return { detail: `线 ${p.minConfidence.toFixed(2)}：${state.regions.filter((r) => r.accept).length}/${n} 采用。` };
    case "required_guard":
      return {
        detail: state.missingRequired.length
          ? `必填 ${p.requiredFields.join("、")} 中缺：${state.missingRequired.join("、")}。`
          : "必填字段均已采用。",
        guardFailed: state.missingRequired.length > 0 && p.blockOnRequiredReject,
      };
    case "deliver_fields":
      return { detail: "交付：全量字段表。", grid: state.fieldGrid };
    case "deliver_accepted":
      return { detail: "交付：采用字段。", grid: state.acceptedGrid };
    case "deliver_rejected":
      return { detail: "交付：弃用清单。", grid: state.rejectedGrid };
    case "deliver_qa":
      return { detail: "交付：待人工复核队列。", grid: state.qaGrid };
    case "report":
      return { detail: state.summary, markdown: `结论：${state.summary}`, grid: state.fieldGrid };
    default:
      return { detail: state.summary };
  }
}

const TOOL_PHASE: Record<string, ImagePhaseId> = {
  __image_intake__: "intake",
  __image_validate_schema__: "validate_schema",
  __image_validate_blocks__: "validate_blocks",
  __image_crop__: "crop",
  __image_ocr__: "ocr",
  __image_histogram__: "histogram",
  __image_accept__: "accept",
  __image_required_guard__: "required_guard",
  __image_deliver_fields__: "deliver_fields",
  __image_deliver_accepted__: "deliver_accepted",
  __image_deliver_rejected__: "deliver_rejected",
  __image_deliver_qa__: "deliver_qa",
  __image_report__: "report",
};

export function runImageTool(name: string, args: Record<string, unknown>): { content: unknown; isError?: boolean } | null {
  const phaseId = TOOL_PHASE[name];
  if (!phaseId) return null;
  const productWorkbench = args.__productWorkbench === true;
  const failFast = args.failFast === true || args.guard === "fail";
  try {
    const policy = imageProgramPolicyFromArgs(args);
    const state = buildImageProgramState(
      String(args.query ?? ""),
      policy,
      productWorkbench,
      typeof args.__sessionId === "string" ? args.__sessionId : undefined,
    );
    const payload = phasePayload(state, phaseId);
    if (payload.guardFailed && failFast) {
      return {
        content: { error: payload.detail, code: "IMAGE_GUARD", detail: payload.detail, meta: { skill: "image-desk" } },
        isError: true,
      };
    }
    const isReport = name === "__image_report__";
    return {
      content: {
        markdown: isReport ? payload.markdown ?? payload.detail : payload.detail,
        detail: payload.detail,
        summary: state.summary,
        blocked: state.blocked,
        dashboard: { image: { phase: phaseId, summary: state.summary, blocks: state.regions.length } },
        meta: { skill: "image-desk", phase: phaseId },
        grid: payload.grid ?? (isReport ? state.fieldGrid : undefined),
        grids: {
          fields: state.fieldGrid,
          accepted: state.acceptedGrid,
          rejected: state.rejectedGrid,
          qa: state.qaGrid,
        },
      },
    };
  } catch (err) {
    if (err instanceof ProductDataMissingError) {
      return { content: { error: err.message, code: "PRODUCT_DATA_MISSING", slot: err.slot }, isError: true };
    }
    if (err instanceof Error) {
      return { content: { error: err.message }, isError: true };
    }
    throw err;
  }
}
