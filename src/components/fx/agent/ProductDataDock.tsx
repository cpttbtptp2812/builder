import { useCallback, useEffect, useState } from "react";
import { downloadText } from "../../../lib/importedSkills";
import {
  datasetRowCount,
  decodeUploadCsvText,
  parseCsvText,
  saveProductDataset,
  type ProductDataSlot,
} from "../../../lib/productDataStore";
import { missingDataForSkill, type SkillDataRequirement } from "../../../lib/productSkillInputs";

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

  useEffect(() => {
    sessionStorage.setItem("ownagent-product-continue-query", gate.query);
  }, [gate.query, gate.skillId]);

  useEffect(() => {
    const onData = () => setRev((n) => n + 1);
    window.addEventListener("ownagent:product-data", onData);
    return () => window.removeEventListener("ownagent:product-data", onData);
  }, []);

  const onFile = useCallback(async (req: SkillDataRequirement, file: File) => {
    const text = decodeUploadCsvText(await file.arrayBuffer());
    const parsed = parseCsvText(text, file.name.replace(/\.[^.]+$/, ""), req.slot);
    if ("error" in parsed) {
      window.alert(parsed.error);
      return;
    }
    saveProductDataset(parsed);
    setRev((n) => n + 1);
  }, []);

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
                      disabled={disabled}
                      onClick={() =>
                        downloadText(req.filename, `\uFEFF${req.templateCsv}`, "text/csv;charset=utf-8")
                      }
                    >
                      下载模板
                    </button>
                    <label className="oa-product-data-gate-btn primary">
                      导入 CSV
                      <input
                        type="file"
                        accept=".csv,.txt,text/csv"
                        disabled={disabled}
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
        disabled={disabled || !canContinue}
        onClick={() => onContinue(gate.query, gate.skillId)}
      >
        继续执行
      </button>
    </div>
  );
}
