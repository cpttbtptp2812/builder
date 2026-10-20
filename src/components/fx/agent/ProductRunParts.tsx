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
  dock = false,
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

  if (dock) {
    return (
      <div className="oa-reply-foot">
        {imports.map((part) => (
          <div className="oa-reply-file" key={part.slot}>
            <span>
              <strong>{part.label}</strong>
              {part.ready ? (
                <em>
                  {part.materialTitle ? `${part.materialTitle}` : "已导入"}
                  {part.rowCount != null ? ` · ${part.rowCount} 行` : ""}
                </em>
              ) : part.schemaIssues?.length ? (
                <em className="is-bad">{part.schemaIssues.join("；")}</em>
              ) : (
                <em>{part.hint}</em>
              )}
            </span>
            <button type="button" disabled={fileBusy} onClick={() => downloadTemplate(part)}>
              下载模板
            </button>
            <button type="button" disabled={fileBusy} onClick={() => fileRefs.current[part.slot]?.click()}>
              {part.ready ? "换一份文件" : "导入文件"}
            </button>
            {imports.length === 1 ? (
              <button type="button" className="is-go" disabled={busy || primaryDisabled} onClick={onPrimary}>
                {primaryLabel}
              </button>
            ) : null}
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
        {imports.length > 1 ? (
          <div className="oa-reply-file">
            <span />
            <button type="button" className="is-go" disabled={busy || primaryDisabled} onClick={onPrimary}>
              {primaryLabel}
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="oa-product-data-gate-min">
      <p className="oa-product-data-gate-lead">
        {run.status === "finish"
          ? "要换材料请点「换一份文件」，再点「重新办理」。"
          : "导入后仍可「换一份文件」，确认无误再点「继续执行」。"}
      </p>
      <ul className="oa-product-data-gate-list">
        {imports.map((part) => (
          <li key={part.slot}>
            <div className="oa-product-data-gate-item">
              <span className="oa-product-data-gate-label">
                {part.label}
                {part.ready ? (
                  <em className="is-ok">
                    已导入
                    {part.materialTitle ? ` · ${part.materialTitle}` : ""}
                    {part.rowCount != null ? ` · ${part.rowCount} 行` : ""}
                  </em>
                ) : part.schemaIssues?.length ? (
                  <em className="is-bad">{part.schemaIssues.join("；")}</em>
                ) : (
                  <em className="is-muted">{part.hint}</em>
                )}
              </span>
              <div className="oa-product-data-gate-actions">
                <button
                  type="button"
                  className="oa-product-data-gate-btn"
                  disabled={fileBusy}
                  onClick={() => downloadTemplate(part)}
                >
                  下载模板
                </button>
                <button
                  type="button"
                  className="oa-product-data-gate-btn primary"
                  disabled={fileBusy}
                  onClick={() => fileRefs.current[part.slot]?.click()}
                >
                  {part.ready ? "换一份文件" : "导入文件"}
                </button>
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
            </div>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="oa-product-data-gate-retry"
        disabled={busy || primaryDisabled}
        onClick={onPrimary}
      >
        {primaryLabel}
      </button>
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
      const sessionId = imports[0]?.sessionId;
      if (!sessionId) return;
      setBusy(true);
      let live: ProductRunView = {
        ...run,
        status: "running",
        parts: [...imports],
      };
      const stream = action === "continue" ? apiContinueProductRun : apiRerunProductRun;
      try {
        const { loadLlmConfig, isLlmConfigured, toProductLlmConfig } = await import("../../../lib/llmConfig");
        const llmCfg = loadLlmConfig();
        const llmConfig = isLlmConfigured(llmCfg) ? toProductLlmConfig(llmCfg) : undefined;
        const res = await stream(
          run.processId,
          sessionId,
          {
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
          window.alert(res.error);
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
      } finally {
        setBusy(false);
      }
    },
    [imports, onRunUpdated, run],
  );

  return (
    <div className="oa-product-run-parts">
      {run.status === "running" ? (
        <p className="oa-product-run-wait" aria-live="polite">
          正在办理… 步骤见右侧「办理进度」。
        </p>
      ) : null}
      {(run.status === "waiting_import" || run.status === "finish") && imports.length > 0 ? (
        <MaterialGatePanel
          run={run}
          imports={imports}
          busy={busy}
          fileBusy={fileBusy}
          primaryLabel={run.status === "finish" ? "重新办理" : "继续执行"}
          primaryDisabled={runLocked || !canContinue}
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
