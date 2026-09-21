import { useMemo, useState, type CSSProperties } from "react";
import type { ChatArtifact, ArtifactTable } from "../../../lib/chatArtifacts";
import { analyzeSemanticSheet, type SheetAnalysis } from "../../../lib/semanticSheet";

/** 结构化结果 — 表格为主（调用细节在旁侧流程图） */
export function ArtifactPanel({ artifacts }: { artifacts: ChatArtifact[] }) {
  const visible = artifacts.filter((a) => a.kind !== "trace");
  if (!visible.length) return null;
  return (
    <div className="ua-artifacts">
      {visible.map((a) => {
        if (a.kind === "metric") return <ArtifactMetricView key={a.id} metric={a} />;
        if (a.kind === "table" && (a.surface === "sheet" || a.id.startsWith("ai-"))) {
          return <SemanticSheet key={a.id} table={a} />;
        }
        if (a.kind === "table") return <ReadonlyGrid key={a.id} table={a} />;
        return null;
      })}
    </div>
  );
}

function ArtifactMetricView({ metric }: { metric: Extract<ChatArtifact, { kind: "metric" }> }) {
  return (
    <div className="ua-art-metric">
      <header>{metric.title}</header>
      <div className="ua-art-metric-grid">
        {metric.items.map((it) => (
          <div key={it.label} className={`ua-art-metric-cell ${it.tone ?? ""}`}>
            <em>{it.label}</em>
            <strong>{it.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReadonlyGrid({ table }: { table: ArtifactTable }) {
  return (
    <div className="ua-sheet ua-sheet-ro">
      <header className="ua-sheet-head compact">
        <div className="ua-sheet-title">
          <strong>{table.title}</strong>
          {table.insight && <em>{table.insight}</em>}
        </div>
      </header>
      <div className="ua-art-scroll">
        <table className="ua-sheet-grid">
          <thead>
            <tr>
              {table.columns.map((c) => (
                <th key={c} scope="col">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} className={cellClass(cell)}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function csvEscape(cell: string) {
  if (/[",\n]/.test(cell)) return `"${cell.replace(/"/g, '""')}"`;
  return cell;
}

function sheetToCsv(columns: string[], rows: string[][]) {
  return [columns, ...rows].map((r) => r.map((c) => csvEscape(c ?? "")).join(",")).join("\n");
}

function SemanticSheet({ table }: { table: ArtifactTable }) {
  const baseline = table.rows;
  const [rows, setRows] = useState(() => baseline.map((r) => [...r]));
  const [order, setOrder] = useState<number[]>(() => baseline.map((_, i) => i));
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [asc, setAsc] = useState(true);
  const [analysis, setAnalysis] = useState<SheetAnalysis | null>(null);
  const [active, setActive] = useState<{ r: number; c: number } | null>(null);
  const [diffOn, setDiffOn] = useState(false);
  const [filter, setFilter] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const editCount = useMemo(() => {
    let n = 0;
    rows.forEach((row, r) => {
      row.forEach((cell, c) => {
        if ((baseline[r]?.[c] ?? "") !== cell) n += 1;
      });
    });
    return n + Math.max(0, rows.length - baseline.length);
  }, [rows, baseline]);

  const live = useMemo(() => analyzeSemanticSheet(table.columns, rows, baseline), [table.columns, rows, baseline]);
  const blockCount = live.findings.filter((f) => f.level === "block").length;
  const warnCount = live.findings.filter((f) => f.level === "warn").length;

  const visibleOrder = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return order;
    return order.filter((ri) => (rows[ri] ?? []).some((cell) => cell.toLowerCase().includes(q)));
  }, [order, rows, filter]);

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1600);
  }

  function toggleSort(col: number) {
    const nextAsc = sortCol === col ? !asc : true;
    setSortCol(col);
    setAsc(nextAsc);
    const next = [...order].sort((ia, ib) => {
      const cmp = (rows[ia]?.[col] ?? "").localeCompare(rows[ib]?.[col] ?? "", "zh", { numeric: true });
      return nextAsc ? cmp : -cmp;
    });
    setOrder(next);
  }

  function addRow() {
    const blank = table.columns.map(() => "");
    setRows((prev) => [...prev, blank]);
    setOrder((prev) => [...prev, rows.length]);
    setAnalysis(null);
  }

  function removeRow(ri: number) {
    if (rows.length <= 1) {
      flash("至少保留一行");
      return;
    }
    setRows((prev) => prev.filter((_, i) => i !== ri));
    setOrder((prev) => prev.filter((i) => i !== ri).map((i) => (i > ri ? i - 1 : i)));
    setActive(null);
    setAnalysis(null);
  }

  function reset() {
    setRows(baseline.map((r) => [...r]));
    setOrder(baseline.map((_, i) => i));
    setAnalysis(null);
    setSortCol(null);
    setFilter("");
    flash("已还原到原稿");
  }

  function runCheck() {
    setAnalysis(live);
  }

  async function copyTable() {
    const text = [table.columns.join("\t"), ...visibleOrder.map((ri) => (rows[ri] ?? []).join("\t"))].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      flash("已复制到剪贴板");
    } catch {
      flash("复制失败，请手动选择");
    }
  }

  function exportCsv() {
    const body = sheetToCsv(
      table.columns,
      visibleOrder.map((ri) => rows[ri] ?? table.columns.map(() => "")),
    );
    const blob = new Blob(["\uFEFF" + body], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${table.title.replace(/[\\/:*?"<>|]/g, "_").slice(0, 40) || "table"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    flash("已导出 CSV");
  }

  const hot = new Set(
    (analysis?.findings ?? [])
      .filter((f) => f.level !== "info")
      .flatMap((f) => f.cells.map((c) => `${c.r}:${c.c}`)),
  );

  const statusLine =
    analysis?.summary ??
    (blockCount
      ? `${blockCount} 处阻断 · 点「校验」查看`
      : warnCount
        ? `${warnCount} 处需注意`
        : table.insight ?? "点单元格直接改 · 可复制 / 导出");

  return (
    <div className={`ua-sheet${analysis ? " analyzed" : ""}${diffOn ? " diffing" : ""}`}>
      <header className="ua-sheet-head">
        <div className="ua-sheet-meta">
          <div className="ua-sheet-title">
            <strong>{table.title}</strong>
            <em>{statusLine}</em>
          </div>
          <span className={`ua-sheet-status${blockCount ? " bad" : warnCount ? " warn" : ""}`}>
            {blockCount ? "有冲突" : warnCount ? "需确认" : "可引用"}
          </span>
        </div>
        <div className="ua-sheet-actions" role="toolbar" aria-label="表格操作">
          <label className="ua-sheet-filter">
            <span className="sr-only">筛选</span>
            <input
              type="search"
              value={filter}
              placeholder="筛选…"
              onChange={(e) => setFilter(e.target.value)}
            />
          </label>
          {editCount > 0 && <span className="ua-sheet-dirty">{editCount} 修订</span>}
          <button
            type="button"
            className={diffOn ? "on" : ""}
            aria-pressed={diffOn}
            onClick={() => setDiffOn((v) => !v)}
            title="对照原稿与修订"
          >
            对照
          </button>
          <button type="button" onClick={addRow}>
            加行
          </button>
          <button type="button" onClick={reset} disabled={editCount === 0}>
            还原
          </button>
          <button type="button" onClick={() => void copyTable()}>
            复制
          </button>
          <button type="button" onClick={exportCsv}>
            导出 CSV
          </button>
          <button type="button" className="primary" onClick={runCheck}>
            校验
          </button>
        </div>
      </header>

      {diffOn && editCount === 0 && (
        <p className="ua-sheet-diff-hint">对照已打开：改任意单元格后，会显示「原稿 → 修订」。</p>
      )}
      {diffOn && editCount > 0 && (
        <p className="ua-sheet-diff-hint on">{editCount} 处修订 · 红删绿增</p>
      )}
      {toast && <p className="ua-sheet-toast">{toast}</p>}

      <div className="ua-art-scroll">
        <table className="ua-sheet-grid">
          <colgroup>
            {table.columns.map((c) => (
              <col key={c} />
            ))}
            <col style={{ width: "2.5rem" }} />
          </colgroup>
          <thead>
            <tr>
              {table.columns.map((c, i) => (
                <th key={c} scope="col">
                  <button type="button" className="ua-th-sort" onClick={() => toggleSort(i)}>
                    <span>{c}</span>
                    {sortCol === i ? <i aria-hidden>{asc ? "↑" : "↓"}</i> : null}
                  </button>
                </th>
              ))}
              <th scope="col" className="ua-th-row-act">
                <span className="sr-only">行操作</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleOrder.length === 0 ? (
              <tr>
                <td colSpan={table.columns.length + 1} className="ua-sheet-empty-filter">
                  没有匹配「{filter}」的行
                </td>
              </tr>
            ) : (
              visibleOrder.map((ri) => {
                const row = rows[ri];
                if (!row) return null;
                return (
                  <tr key={ri}>
                    {row.map((cell, ci) => {
                      const base = baseline[ri]?.[ci] ?? "";
                      const dirty = base !== cell;
                      const risk = analysis?.risk[ri]?.[ci] ?? live.risk[ri]?.[ci] ?? 0;
                      const flagged = hot.has(`${ri}:${ci}`);
                      const editing = active?.r === ri && active?.c === ci;
                      return (
                        <td
                          key={ci}
                          className={`${cellClass(cell)}${dirty ? " dirty" : ""}${flagged ? " hot" : ""}`}
                          style={
                            risk > 0.35
                              ? ({ ["--risk" as string]: String(Math.min(0.28, risk * 0.28)) } as CSSProperties)
                              : undefined
                          }
                          onClick={() => !editing && setActive({ r: ri, c: ci })}
                        >
                          {editing ? (
                            <input
                              autoFocus
                              className="ua-cell-input"
                              value={cell}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                const value = e.target.value;
                                setRows((prev) =>
                                  prev.map((rowX, r) =>
                                    r === ri ? rowX.map((item, c) => (c === ci ? value : item)) : rowX,
                                  ),
                                );
                                setAnalysis(null);
                              }}
                              onBlur={() => setActive(null)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === "Escape") (e.target as HTMLInputElement).blur();
                              }}
                            />
                          ) : diffOn && dirty ? (
                            <span className="ua-diff-cell">
                              <del>{base || "∅"}</del>
                              <ins>{cell || "—"}</ins>
                            </span>
                          ) : (
                            cell || "—"
                          )}
                        </td>
                      );
                    })}
                    <td className="ua-row-act">
                      <button type="button" title="删除本行" onClick={() => removeRow(ri)}>
                        删
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {analysis && (
        <ul className="ua-sheet-findings">
          {analysis.findings.map((f) => (
            <li key={f.title + f.detail} className={f.level}>
              <strong>{f.title}</strong>
              <span>{f.detail}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function cellClass(cell: string) {
  if (cell === "PASS" || cell === "现行" || cell === "是 · 仅现行" || cell === "是") return "ok";
  if (cell === "FAIL" || cell === "废止" || cell === "否 · 须 HITL" || cell === "否 · 拒答") return "bad";
  if (cell === "mutate" || cell === "abstain") return "warn";
  return "";
}
