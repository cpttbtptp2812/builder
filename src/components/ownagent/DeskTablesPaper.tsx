import { useState } from "react";
import type { TablesPaper } from "../../lib/deskProgramKit";
import { gridToCsv } from "../../lib/productDataStore";
import type { ProductDataSlot } from "../../lib/productDataStore";
import { requirementsForSkill } from "../../lib/productSkillInputs";
import "../../styles/desk-tables-paper.css";

const PAGE = 200;

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function DeskTablesPaper({
  paper,
  embeddedInDrawer,
  onReplaceMaterial,
  onSealDeliverable,
  deliverySealed,
}: {
  paper: TablesPaper;
  /** 右侧抽屉内：标题已在抽屉头展示，正文只保留摘要与明细 */
  embeddedInDrawer?: boolean;
  onReplaceMaterial?: (slot: ProductDataSlot, csv: string, title: string) => void | Promise<void>;
  onSealDeliverable?: () => void | Promise<void>;
  deliverySealed?: boolean;
}) {
  const [active, setActive] = useState(paper.tables[0]?.id ?? "");
  const [shown, setShown] = useState(PAGE);
  const [busySlot, setBusySlot] = useState<ProductDataSlot | null>(null);
  const [replacedName, setReplacedName] = useState<Partial<Record<ProductDataSlot, string>>>({});
  const table = paper.tables.find((t) => t.id === active) ?? paper.tables[0];
  const requirements = requirementsForSkill(paper.skillId);

  return (
    <div className={`oa-paper dtp${embeddedInDrawer ? " dtp--drawer" : ""}`}>
      <header className="dtp-head">
        <div className="dtp-head-row">
          <span className="dtp-tag">{paper.tag}</span>
          {!embeddedInDrawer ? <h3>{paper.title}</h3> : null}
        </div>
        {paper.subtitle ? <p className="dtp-summary">{paper.subtitle}</p> : null}
      </header>

      {paper.metrics.length ? (
        <ul className="dtp-metrics" aria-label="关键指标">
          {paper.metrics.map((m) => (
            <li key={m.label} className={m.tone ? `is-${m.tone}` : undefined}>
              <b>{m.value}</b>
              <span>{m.label}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {paper.notes.length ? (
        <div className="dtp-notes" role="note">
          <ul>
            {paper.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {paper.tables.length ? (
        <>
          <div className="dtp-tabs-wrap">
            <div className="dtp-tabs" role="tablist" aria-label="交付表格">
              {paper.tables.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={t.id === table?.id}
                  className={t.id === table?.id ? "is-on" : undefined}
                  onClick={() => {
                    setActive(t.id);
                    setShown(PAGE);
                  }}
                >
                  <span className="dtp-tab-label">{t.name}</span>
                  <span className="dtp-tab-count">{t.grid.rows.length}</span>
                </button>
              ))}
            </div>
          </div>
          {table ? (
            <section className="dtp-table">
              <div className="dtp-table-bar">
                <span className="dtp-table-title">
                  {table.name}
                  <small>{table.grid.rows.length} 行</small>
                </span>
                <div className="dtp-table-actions">
                  <button
                    type="button"
                    className="dtp-btn"
                    onClick={() => downloadCsv(table.filename, gridToCsv(table.grid.columns, table.grid.rows))}
                  >
                    下载这张表
                  </button>
                  {paper.tables.length > 1 ? (
                    <button
                      type="button"
                      className="dtp-btn dtp-btn--primary"
                      onClick={() => {
                        for (const t of paper.tables) downloadCsv(t.filename, gridToCsv(t.grid.columns, t.grid.rows));
                      }}
                    >
                      全部下载（{paper.tables.length} 张）
                    </button>
                  ) : null}
                </div>
              </div>
              {table.grid.rows.length ? (
                <div className="dtp-scroll">
                  <table>
                    <thead>
                      <tr>
                        {table.grid.columns.map((c) => (
                          <th key={c}>{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {table.grid.rows.slice(0, shown).map((row, i) => (
                        <tr key={i}>
                          {table.grid.columns.map((c, j) => (
                            <td key={c}>{row[j] ?? ""}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="dtp-empty">这张表没有内容。</p>
              )}
              {table.grid.rows.length > shown ? (
                <button type="button" className="dtp-more" onClick={() => setShown((n) => n + PAGE)}>
                  再显示 {Math.min(PAGE, table.grid.rows.length - shown)} 行（共 {table.grid.rows.length} 行）
                </button>
              ) : null}
            </section>
          ) : null}
        </>
      ) : (
        <p className="dtp-empty">这个版本的技能没有交付表格步骤。</p>
      )}

      {onReplaceMaterial && requirements.length ? (
        <section className="dtp-revise">
          <h4>修正材料后重新办理</h4>
          <p>在原系统修正 CSV，再替换对应材料。系统会写回本次办理并重新执行全部步骤。</p>
          <div className="dtp-revise-actions">
            {requirements.map((req) => (
              <span key={req.slot} className="dtp-revise-slot">
                <label className="dtp-revise-file">
                  {busySlot === req.slot ? "正在重新办理…" : `替换${req.label}`}
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    disabled={Boolean(busySlot)}
                    onChange={async (event) => {
                      const file = event.currentTarget.files?.[0];
                      event.currentTarget.value = "";
                      if (!file) return;
                      const name = file.name.replace(/\.[^.]+$/, "");
                      setBusySlot(req.slot);
                      try {
                        await onReplaceMaterial(req.slot, await file.text(), file.name);
                        setReplacedName((prev) => ({ ...prev, [req.slot]: name }));
                      } finally {
                        setBusySlot(null);
                      }
                    }}
                  />
                </label>
                {replacedName[req.slot] ? <em>{replacedName[req.slot]}</em> : null}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {onSealDeliverable ? (
        <section className="dtp-seal">
          <h4>人工复核</h4>
          <p>{deliverySealed ? "本次结果已复核并归档。" : "确认表格内容无误后办结归档；归档不再修改计算结果。"}</p>
          <button type="button" disabled={deliverySealed} onClick={() => void onSealDeliverable()}>
            {deliverySealed ? "已办结归档" : "复核通过并办结归档"}
          </button>
        </section>
      ) : null}
    </div>
  );
}
