import { useCallback, useMemo, useState } from "react";
import { downloadText } from "../../../lib/importedSkills";
import type { ProductDataSlot } from "../../../lib/productDataStore";
import { apiContinueProductRun, apiUploadProductDataset } from "../../../lib/productRun/client";
import type { ProductRunImportPart, ProductRunView } from "../../../lib/productRun/types";

export function ProductRunParts({
  run,
  disabled,
  onRunUpdated,
}: {
  run: ProductRunView;
  disabled?: boolean;
  onRunUpdated: (next: {
    content: string;
    run: ProductRunView;
    paper?: import("../../../lib/workPaper").WorkPaper | null;
    runtime: "server" | "local";
  }) => void;
}) {
  const [busy, setBusy] = useState(false);
  const imports = useMemo(() => run.parts.filter((p): p is ProductRunImportPart => p.kind === "import"), [run.parts]);

  const onFile = useCallback(
    async (part: ProductRunImportPart, file: File) => {
      const csv = await file.text();
      setBusy(true);
      try {
        const up = await apiUploadProductDataset({
          sessionId: part.sessionId,
          slot: part.slot as ProductDataSlot,
          csv,
          title: file.name.replace(/\.[^.]+$/, ""),
        });
        if (!up.ok) {
          window.alert(up.error ?? "导入失败");
          return;
        }
        const nextParts = run.parts.map((p) =>
          p.kind === "import" && p.slot === part.slot ? { ...p, ready: true } : p,
        );
        onRunUpdated({
          content: "",
          run: { ...run, parts: nextParts },
          runtime: "server",
        });
      } finally {
        setBusy(false);
      }
    },
    [onRunUpdated, run],
  );

  const canContinue =
    run.status === "waiting_import" &&
    imports.length > 0 &&
    imports.every((p) => p.ready);

  async function continueRun() {
    const sessionId = imports[0]?.sessionId;
    if (!sessionId) return;
    setBusy(true);
    let live: ProductRunView = { ...run, status: "running", parts: run.parts.filter((p) => p.kind === "import") };
    try {
      const res = await apiContinueProductRun(run.processId, sessionId, {
        onStep: (part) => {
          live = {
            ...live,
            status: "running",
            parts: [...live.parts.filter((p) => p.kind !== "finish"), part],
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
      });
      if (!res.ok) {
        window.alert(res.error);
        return;
      }
      onRunUpdated({
        content: res.message,
        run: live.status === "finish" ? live : {
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
  }

  if (run.status === "finish") {
    const steps = run.parts.filter((p) => p.kind === "process");
    if (!steps.length) return null;
    return (
      <ul className="oa-product-run-steps">
        {steps.map((s, i) => (
          <li key={`${s.label}-${i}`} className={s.ok ? "ok" : "bad"}>
            <strong>{s.label}</strong>
            <span>{s.detail}</span>
          </li>
        ))}
      </ul>
    );
  }

  if (run.status === "running") {
    const steps = run.parts.filter((p) => p.kind === "process");
    return (
      <div className="oa-product-run-running">
        {steps.length ? (
          <ul className="oa-product-run-steps">
            {steps.map((s, i) => (
              <li key={`${s.label}-${i}`} className={s.ok ? "ok" : "bad"}>
                <strong>{s.label}</strong>
                <span>{s.detail}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="oa-product-run-wait">服务端执行中…</p>
        )}
      </div>
    );
  }

  return (
    <div className="oa-product-data-gate-min">
      <ul className="oa-product-data-gate-list">
        {imports.map((part) => (
          <li key={part.slot}>
            <div className="oa-product-data-gate-item">
              <span className="oa-product-data-gate-label">
                {part.label}
                {part.ready ? <em className="is-ok">已就绪</em> : null}
              </span>
              {!part.ready ? (
                <div className="oa-product-data-gate-actions">
                  <button
                    type="button"
                    className="oa-product-data-gate-btn"
                    disabled={disabled || busy}
                    onClick={() => downloadText(part.filename, part.templateCsv, "text/csv;charset=utf-8")}
                  >
                    下载模板
                  </button>
                  <label className="oa-product-data-gate-btn primary">
                    导入 CSV
                    <input
                      type="file"
                      accept=".csv,.txt,text/csv"
                      disabled={disabled || busy}
                      hidden
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (f) void onFile(part, f);
                      }}
                    />
                  </label>
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="oa-product-data-gate-retry"
        disabled={disabled || busy || !canContinue}
        onClick={() => void continueRun()}
      >
        继续执行
      </button>
    </div>
  );
}
