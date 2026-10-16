import { useCallback, useEffect, useState } from "react";
import { downloadText } from "../../../lib/importedSkills";
import {
  datasetRowCount,
  saveProductDataset,
  parseCsvText,
  type ProductDataSlot,
} from "../../../lib/productDataStore";
import { apiFetchDeskTemplate } from "../../../lib/productRun/client";
import { missingDataForSkill, type SkillDataRequirement } from "../../../lib/productSkillInputs";
import { PRODUCT_FILE_ACCEPT, uploadProductSlotFile } from "../../../lib/uploadProductFile";

function slotReady(slot: ProductDataSlot): boolean {
  return datasetRowCount(slot) > 0;
}

/** 本条回复里：缺什么才出现什么导入（不提前、不进设置） */
export function ProductDataGateInline({
  gate,
  disabled,
  onContinue,
}: {
  gate: NonNullable<import("../../../lib/ownagentSessions").OwnChatMessage["productDataGate"]>;
  disabled?: boolean;
  onContinue: (query: string, skillId: string) => void;
}) {
  const [rev, setRev] = useState(0);
  const [fileBusy, setFileBusy] = useState(false);

  useEffect(() => {
    sessionStorage.setItem("ownagent-product-continue-query", gate.query);
  }, [gate.query, gate.skillId]);

  useEffect(() => {
    const onData = () => setRev((n) => n + 1);
    window.addEventListener("ownagent:product-data", onData);
    return () => window.removeEventListener("ownagent:product-data", onData);
  }, []);

  const onFile = useCallback(
    async (req: SkillDataRequirement, file: File) => {
      setFileBusy(true);
      try {
        const up = await uploadProductSlotFile({
          sessionId: gate.sessionId,
          slot: req.slot,
          file,
        });
        if (!up.ok) {
          window.alert(up.error ?? "导入失败");
          return;
        }
        if (up.schemaOk === false || !up.rows) {
          window.alert(up.error ?? (up.schemaIssues ?? []).join("；") ?? "表头或数据未通过校验");
          return;
        }
        if (up.csv) {
          const parsed = parseCsvText(up.csv, up.title ?? file.name.replace(/\.[^.]+$/, ""), req.slot);
          if (!("error" in parsed)) saveProductDataset(parsed);
        }
        setRev((n) => n + 1);
      } finally {
        setFileBusy(false);
      }
    },
    [gate.sessionId],
  );

  void rev;

  const stillMissing = missingDataForSkill(gate.skillId);
  const canContinue = stillMissing.length === 0;

  return (
    <div className="oa-product-data-gate-min">
      <ul className="oa-product-data-gate-list">
        {gate.missing.map((req) => {
          const ok = slotReady(req.slot);
          return (
            <li key={req.slot}>
              <div className="oa-product-data-gate-item">
                <span className="oa-product-data-gate-label">
                  {req.label}
                  {ok ? <em className="is-ok">已就绪</em> : null}
                </span>
                {!ok ? (
                  <div className="oa-product-data-gate-actions">
                    <button
                      type="button"
                      className="oa-product-data-gate-btn"
                      disabled={disabled || fileBusy}
                      onClick={() =>
                        void (async () => {
                          const t = await apiFetchDeskTemplate(gate.skillId, req.slot);
                          const csv = t.ok && t.csv ? t.csv : req.templateCsv;
                          const name = t.ok && t.filename ? t.filename : req.filename;
                          downloadText(name, `\uFEFF${csv}`, "text/csv;charset=utf-8");
                        })()
                      }
                    >
                      下载模板
                    </button>
                    <label className="oa-product-data-gate-btn primary">
                      导入文件
                      <input
                        type="file"
                        accept={PRODUCT_FILE_ACCEPT}
                        disabled={disabled || fileBusy}
                        hidden
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.target.value = "";
                          if (f) void onFile(req, f);
                        }}
                      />
                    </label>
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        className="oa-product-data-gate-retry"
        disabled={disabled || !canContinue || fileBusy}
        onClick={() => onContinue(gate.query, gate.skillId)}
      >
        继续执行
      </button>
    </div>
  );
}
