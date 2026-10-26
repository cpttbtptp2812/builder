import { useCallback, useMemo, useRef, useState } from "react";
import { downloadText } from "../../../lib/importedSkills";
import { requirementsForSkill } from "../../../lib/productSkillInputs";
import { type ProductDataSlot } from "../../../lib/productDataStore";
import { getSessionId } from "../../../lib/sessionId";
import {
  apiContinueProductRun,
  apiFetchDeskTemplate,
  apiRerunProductRun,
} from "../../../lib/productRun/client";
import { PRODUCT_FILE_ACCEPT, uploadProductSlotFile } from "../../../lib/uploadProductFile";
import type { ProductRunImportPart, ProductRunView } from "../../../lib/productRun/types";
import { ProductRunInsights } from "../../platform/ProductRunInsights";
import { loadLlmConfig } from "../../../lib/llmConfig";
import { LocalModelBox } from "../../ownagent/LocalModelBox";

function importPartsForRun(run: ProductRunView): ProductRunImportPart[] {
  const fromRun = run.parts.filter((p): p is ProductRunImportPart => p.kind === "import");
  if (fromRun.length) return fromRun;
  const sessionId = getSessionId();
  return requirementsForSkill(run.skillId).map((req) => ({
    kind: "import" as const,
    sessionId,
    processId: run.processId,
    slot: req.slot,
    label: req.label,
    hint: req.hint,
    templateCsv: req.templateCsv,
    filename: req.filename,
    ready: false,
  }));
}

function MaterialGatePanel({
  run,
  imports,
  busy,
  fileBusy,
  primaryLabel,
  onPrimary,
  primaryDisabled,
  onPickFile,
  dock,
}: {
  run: ProductRunView;
  imports: ProductRunImportPart[];
  busy: boolean;
  fileBusy: boolean;
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled: boolean;
  onPickFile: (part: ProductRunImportPart, file: File) => void;
  dock?: boolean;
}) {
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const downloadTemplate = (part: ProductRunImportPart) => {
    void (async () => {
      const t = await apiFetchDeskTemplate(run.skillId, part.slot as ProductDataSlot);
      const csv = t.ok && t.csv ? t.csv : part.templateCsv;
      const name = t.ok && t.filename ? t.filename : part.filename;
      downloadText(name, `\uFEFF${csv}`, "text/csv;charset=utf-8");
    })();
  };

  const readyCount = imports.filter((p) => p.ready).length;
  const allReady = imports.length > 0 && readyCount === imports.length;
  const hasError = imports.some((p) => Boolean(p.schemaIssues?.length));

  // 当材料已核验就绪时，收敛为单行精致排版，不霸占大面积卡片
  if (allReady && !hasError) {
    const firstPart = imports[0];
    return (
      <div className="oa-gate-deck-compact-row" role="region" aria-label="前置数据已就绪">
        <div className="oa-gate-compact-left">
          <span className="oa-gate-compact-icon">✓</span>
          <div className="oa-gate-compact-text">
            <strong>前置数据材料已就绪</strong>
            <span className="oa-gate-compact-sub">
              {firstPart?.label || "报销核算明细"} · {firstPart?.rowCount ?? 8} 行结构校验通过
            </span>
          </div>
        </div>
        <div className="oa-gate-compact-right">
          <button
            type="button"
            className="oa-gate-compact-cta-btn"
            disabled={busy || primaryDisabled}
            onClick={onPrimary}
            title="启动 Agent 智能流水线调度"
          >
            {busy ? (
              <>
                <span className="oa-gate-cta-spinner" />
                <span>正在执行…</span>
              </>
            ) : (
              <>
                <span>启动 Agent 调度执行</span>
                <span className="oa-gate-compact-arrow">➔</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`oa-gate-deck${dock ? " is-docked" : ""}`} role="region" aria-label="材料装载与调度确认">
      {/* 科技感控制台顶栏 */}
      <div className="oa-gate-deck-header">
        <div className="oa-gate-deck-title">
          <div className="oa-gate-deck-icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 1.5L2 4v4.5c0 3.8 2.6 7.4 6 8.5 3.4-1.1 6-4.7 6-8.5V4L8 1.5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M5.5 8l1.8 1.8 3.2-3.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="oa-gate-deck-headings">
            <div className="oa-gate-deck-label-row">
              <strong className="oa-gate-deck-label">材料装载与前置核对</strong>
              <span className="oa-gate-deck-sys-tag">GATEWAY // DISPATCH READY</span>
            </div>
            <span className="oa-gate-deck-sub">
              {busy
                ? "正在调度执行流水线，实时验证与生成文书…"
                : allReady
                  ? "数据结构核验通过 · 准备就绪"
                  : hasError
                    ? "部分材料存在格式或列名异常，请核对"
                    : "请上传或装载流水线执行所需的标准表格"}
            </span>
          </div>
        </div>
        <div className={`oa-gate-deck-badge ${busy ? "is-running" : allReady ? "is-ready" : hasError ? "is-error" : "is-pending"}`}>
          <span className="oa-gate-pulse-dot" />
          <span>{busy ? "调度执行中…" : allReady ? `就绪 (${readyCount}/${imports.length})` : hasError ? "异常待改" : `待核对 (${readyCount}/${imports.length})`}</span>
        </div>
      </div>

      {/* 槽位卡片阵列 */}
      <div className="oa-gate-deck-slots">
        {imports.map((part, idx) => (
          <div className={`oa-gate-slot-card ${part.ready ? "is-ready" : part.schemaIssues?.length ? "is-bad" : "is-pending"}`} key={part.slot}>
            <div className="oa-gate-slot-left">
              <span className="oa-gate-slot-index">SLOT 0{idx + 1}</span>
              <div className="oa-gate-slot-info">
                <strong className="oa-gate-slot-name">{part.label}</strong>
                {part.ready ? (
                  <span className="oa-gate-slot-pill is-ok">
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                      <path d="M3.5 8.5l3 3 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <em className="oa-gate-pill-text">
                      已导入
                      {part.materialTitle &&
                      part.materialTitle !== part.slot &&
                      part.materialTitle !== "expense-ledger" &&
                      part.materialTitle !== part.label
                        ? ` · ${part.materialTitle}`
                        : ""}
                      {part.rowCount != null ? ` · ${part.rowCount} 行` : ""}
                    </em>
                  </span>
                ) : part.schemaIssues?.length ? (
                  <span className="oa-gate-slot-pill is-bad" title={part.schemaIssues.join("；")}>
                    ⚠️ {part.schemaIssues.join("；")}
                  </span>
                ) : (
                  <span className="oa-gate-slot-pill is-hint">{part.hint || "等待导入数据"}</span>
                )}
              </div>
            </div>

            <div className="oa-gate-slot-actions">
              <button
                type="button"
                className="oa-gate-slot-btn oa-gate-slot-btn--subtle"
                disabled={fileBusy}
                onClick={() => downloadTemplate(part)}
                title="下载标准 CSV 模板"
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                  <path d="M8 2v8m0 0l-2.5-2.5M8 10l2.5-2.5M3 13h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>下载模板</span>
              </button>
              <button
                type="button"
                className="oa-gate-slot-btn oa-gate-slot-btn--action"
                disabled={fileBusy}
                onClick={() => fileRefs.current[part.slot]?.click()}
                title={part.ready ? "更换当前文件" : "导入本地文件"}
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                  <path d="M2.5 8a5.5 5.5 0 1 1 1.6 3.9L2.5 13.5v-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>{part.ready ? "换一份文件" : "导入文件"}</span>
              </button>
            </div>

            <input
              ref={(el) => {
                fileRefs.current[part.slot] = el;
              }}
              type="file"
              accept={PRODUCT_FILE_ACCEPT}
              disabled={fileBusy}
              hidden
              aria-hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) onPickFile(part, f);
              }}
            />
          </div>
        ))}
      </div>

      {/* 科技感底栏控制条 */}
      <div className="oa-gate-deck-footer">
        <div className="oa-gate-deck-hint">
          <span className="oa-gate-hint-spark">{busy ? "⏳" : "⚡"}</span>
          <span>
            {busy
              ? "流水线正在调度执行，实时计算与生成文书…"
              : allReady
                ? "前置核验通过 · 准备就绪"
                : "请先上传必需材料文件"}
          </span>
        </div>
        <button
          type="button"
          className={`oa-gate-cta-btn${primaryDisabled ? " is-disabled" : ""}${busy ? " is-busy" : ""}`}
          disabled={busy || primaryDisabled}
          onClick={onPrimary}
        >
          {busy ? (
            <>
              <span className="oa-gate-cta-spinner" />
              <span>正在调度并生成结果…</span>
            </>
          ) : (
            <>
              <span className="oa-gate-cta-glow" />
              <span className="oa-gate-cta-text">{primaryLabel}</span>
              <svg className="oa-gate-cta-arrow" width="13" height="13" viewBox="0 0 16 16" fill="none">
                <path d="M3 8h10m0 0L9 4m4 4L9 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export function ProductRunParts({
  run,
  disabled,
  layout,
  onRunUpdated,
}: {
  run: ProductRunView;
  disabled?: boolean;
  layout?: "dock";
  onRunUpdated: (next: {
    content: string;
    run: ProductRunView;
    paper?: import("../../../lib/workPaper").WorkPaper | null;
    runtime: "server" | "local";
  }) => void;
}) {
  const [busy, setBusy] = useState(false);
  const imports = useMemo(() => importPartsForRun(run), [run]);
  const fileBusy = busy;
  const runLocked = Boolean(disabled && run.status === "running");

  const onFile = useCallback(
    async (part: ProductRunImportPart, file: File) => {
      setBusy(true);
      try {
        const up = await uploadProductSlotFile({
          sessionId: part.sessionId,
          slot: part.slot as ProductDataSlot,
          file,
        });
        if (!up.ok) {
          window.alert(up.error ?? "导入失败");
          return;
        }
        if (up.schemaOk === false || !up.rows) {
          window.alert(
            up.error ??
              ((up.schemaIssues ?? []).join("；") || "无法识别表头或没有有效数据行，请换文件或调整列名后再导入"),
          );
          const nextParts = run.parts.some((p) => p.kind === "import")
            ? run.parts.map((p) =>
                p.kind === "import" && p.slot === part.slot
                  ? { ...p, ready: false, schemaIssues: up.schemaIssues ?? ["导入未通过"] }
                  : p,
              )
            : [
                ...run.parts.filter((p) => p.kind !== "import"),
                ...imports.map((p) =>
                  p.slot === part.slot
                    ? { ...p, ready: false, schemaIssues: up.schemaIssues ?? ["导入未通过"] }
                    : p,
                ),
              ];
          onRunUpdated({ content: "", run: { ...run, parts: nextParts }, runtime: "server" });
          return;
        }
        const title = up.title ?? file.name.replace(/\.[^.]+$/, "");
        const mergedImports = imports.map((p) =>
          p.slot === part.slot
            ? {
                ...p,
                ready: true,
                materialTitle: title,
                rowCount: up.rows,
                schemaIssues: undefined,
              }
            : p,
        );
        const nextParts = [
          ...mergedImports,
          ...run.parts.filter((p) => p.kind !== "import" && p.kind !== "finish"),
        ];
        onRunUpdated({
          content: "",
          run: { ...run, status: run.status === "finish" ? "finish" : run.status, parts: nextParts },
          runtime: "server",
        });
      } finally {
        setBusy(false);
      }
    },
    [onRunUpdated, run, imports],
  );

  const canContinue =
    imports.length > 0 && imports.every((p) => p.ready && !(p.schemaIssues?.length));

  const executeStream = useCallback(
    async (action: "continue" | "rerun") => {
      const sessionId = imports[0]?.sessionId || getSessionId();
      if (!sessionId) return;
      setBusy(true);
      let live: ProductRunView = {
        ...run,
        status: "running",
        parts: [...imports],
      };
      // Immediately notify parent so the UI shows active running state without delay
      onRunUpdated({ content: "", run: live, runtime: "server" });

      const stream = action === "continue" ? apiContinueProductRun : apiRerunProductRun;
      try {
        const { loadLlmConfig, isLlmConfigured, toProductLlmConfig } = await import("../../../lib/llmConfig");
        const llmCfg = loadLlmConfig();
        const llmConfig = isLlmConfigured(llmCfg) ? toProductLlmConfig(llmCfg) : undefined;
        const res = await stream(
          run.processId,
          sessionId,
          {
            onRunning: () => {
              live = { ...live, status: "running" };
              onRunUpdated({ content: "", run: live, runtime: "server" });
            },
            onStep: (part) => {
              live = {
                ...live,
                status: "running",
                parts: [...live.parts.filter((p) => p.kind !== "process" && p.kind !== "finish"), part],
              };
              onRunUpdated({ content: "", run: live, runtime: "server" });
            },
            onFinish: (fin) => {
              live = {
                processId: fin.processId,
                status: "finish",
                skillId: fin.skillId,
                query: fin.query,
                parts: fin.parts,
              };
            },
          },
          undefined,
          llmConfig,
        );
        if (!res.ok) {
          const errMsg = res.error || "办理服务未连接（端口 8787 未启动）";
          onRunUpdated({
            content: "",
            run: {
              ...run,
              status: run.status === "finish" ? "finish" : "waiting_import",
              parts: [
                ...run.parts.filter((p) => p.kind !== "finish"),
                { kind: "finish", processId: run.processId, summary: `⚠️ 办理中断：${errMsg}` },
              ],
            },
            runtime: "server",
          });
          return;
        }
        const finishSummary =
          res.status === "finish"
            ? res.parts.find((p) => p.kind === "finish")?.summary || res.message
            : res.message;
        onRunUpdated({
          content: finishSummary,
          run:
            live.status === "finish"
              ? live
              : {
                  processId: res.processId,
                  status: res.status,
                  skillId: res.skillId,
                  query: res.query,
                  parts: res.parts,
                },
          paper: res.status === "finish" ? res.paper ?? null : null,
          runtime: "server",
        });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "连接失败";
        onRunUpdated({
          content: "",
          run: {
            ...run,
            status: run.status === "finish" ? "finish" : "waiting_import",
            parts: [
              ...run.parts.filter((p) => p.kind !== "finish"),
              { kind: "finish", processId: run.processId, summary: `⚠️ 异常中断：${errMsg}` },
            ],
          },
          runtime: "server",
        });
      } finally {
        setBusy(false);
      }
    },
    [imports, onRunUpdated, run],
  );

  return (
    <div className="oa-product-run-parts">
      {run.status === "running" && imports.length === 0 ? (
        <div className="oa-product-run-wait" aria-live="polite">
          <span className="oa-wait-dot" />
          <span>正在办理…</span>
        </div>
      ) : null}
      {(run.status === "waiting_import" || run.status === "running" || run.status === "finish") && imports.length > 0 ? (
        <MaterialGatePanel
          run={run}
          imports={imports}
          busy={busy || run.status === "running"}
          fileBusy={fileBusy || busy || run.status === "running"}
          primaryLabel={run.status === "finish" ? "重新办理" : "继续执行"}
          primaryDisabled={runLocked || !canContinue || busy || run.status === "running"}
          onPrimary={() => void executeStream(run.status === "finish" ? "rerun" : "continue")}
          onPickFile={(part, file) => void onFile(part, file)}
          dock={layout === "dock"}
        />
      ) : null}
      {run.status === "finish" && !busy && loadLlmConfig().enabled && loadLlmConfig().preset === "webllm" ? (
        <LocalModelBox summary={run.parts.find((p) => p.kind === "finish")?.summary} />
      ) : null}
      {layout !== "dock" && run.status === "finish" && !busy ? (
        <ProductRunInsights
          sessionId={imports[0]?.sessionId ?? getSessionId()}
          processId={run.processId}
          skillId={run.skillId}
          version={run.parts.find((p) => p.kind === "finish")?.summary ?? ""}
        />
      ) : null}
    </div>
  );
}
