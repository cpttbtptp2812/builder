import { useMemo, useState } from "react";
import type { WorkPaper } from "../../lib/workPaper";

type LedgerPaper = Extract<WorkPaper, { kind: "ledger" }>;

function rowTone(judge: string): "ok" | "warn" | "bad" {
  if (judge.startsWith("拦截")) return "bad";
  if (judge.startsWith("警告")) return "warn";
  return "ok";
}

function parseNum(raw: string): number | null {
  const n = Number.parseFloat(raw.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function money(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function localJudge(gross: number, invoice: number | null, tolerance: number, missing: "block" | "pass"): string {
  if (invoice == null) return missing === "block" ? "拦截 缺票" : "警告 缺票";
  const gap = Math.abs(gross - invoice);
  if (gap > tolerance) return `拦截 差额 ${money(gap)}`;
  return "通过";
}

export function LedgerTableDesk({
  paper,
  interactive,
  onAsk,
}: {
  paper: LedgerPaper;
  interactive?: boolean;
  onAsk?: (text: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<string>("全部");
  const [onlyBad, setOnlyBad] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [invoiceOverrides, setInvoiceOverrides] = useState<Record<number, string>>({});
  const [handled, setHandled] = useState<Set<number>>(() => new Set());

  const depts = useMemo(() => ["全部", ...paper.deptTotals.map((d) => d.dept)], [paper.deptTotals]);

  const rows = useMemo(() => {
    return paper.grid.rows.map((cells, index) => {
      const [dept, person, amount, tax, booked, invoiceRaw, , judgeRaw] = cells;
      const gross = parseNum(amount ?? "") ?? 0;
      const override = invoiceOverrides[index];
      const invoiceDisplay = override ?? invoiceRaw ?? "";
      const invoiceNum = invoiceDisplay === "空" || !invoiceDisplay ? null : parseNum(invoiceDisplay);
      const gap =
        invoiceNum == null ? "—" : money(Math.abs(gross - invoiceNum));
      const judge =
        override != null
          ? localJudge(gross, invoiceNum, paper.recipe.tolerance, paper.recipe.missing)
          : judgeRaw ?? "通过";
      return {
        index,
        dept: dept ?? "",
        person: person ?? "",
        amount: amount ?? "",
        tax: tax ?? "",
        booked: booked ?? "",
        invoice: invoiceDisplay === "" ? "空" : invoiceDisplay,
        gap,
        judge,
        tone: rowTone(judge),
      };
    });
  }, [paper.grid.rows, paper.recipe, invoiceOverrides]);

  const filtered = rows.filter((row) => {
    if (onlyBad && row.tone === "ok") return false;
    if (deptFilter !== "全部" && row.dept !== deptFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return (
        row.person.toLowerCase().includes(q) ||
        row.dept.toLowerCase().includes(q) ||
        row.judge.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const openCount = rows.filter((r) => r.tone !== "ok" && !handled.has(r.index)).length;
  const taxLabel = paper.recipe.tax === "exclude" ? "不含税入账" : "含税入账";
  const missingLabel = paper.recipe.missing === "pass" ? "缺票警告" : "缺票拦截";

  const selectedRow = selected != null ? rows.find((r) => r.index === selected) : null;

  function ask(text: string) {
    onAsk?.(text);
  }

  return (
    <div className="oa-paper oa-paper-ledger-desk">
      <header className="oa-paper-title">
        <h3>报销对账工作台</h3>
        <p>{paper.title}</p>
      </header>

      <div className="oa-ledger-meta">
        <span>{taxLabel}</span>
        <span>容差 {paper.recipe.tolerance}</span>
        <span>{missingLabel}</span>
        <span>按 {paper.recipe.groupBy} 汇总</span>
        {openCount > 0 ? <span className="is-bad">{openCount} 行待处理</span> : <span className="is-ok">全部通过</span>}
      </div>

      <div className="oa-ledger-totals">
        {paper.deptTotals.map((item) => (
          <button
            key={item.dept}
            type="button"
            className={deptFilter === item.dept ? "is-on" : ""}
            onClick={() => setDeptFilter(deptFilter === item.dept ? "全部" : item.dept)}
          >
            <em>{item.dept}</em>
            <b>{item.amount}</b>
          </button>
        ))}
      </div>

      <div className="oa-ledger-toolbar">
        <input
          type="search"
          placeholder="搜申请人、部门、判定…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          disabled={!interactive}
        />
        <button
          type="button"
          className={onlyBad ? "is-on" : ""}
          onClick={() => setOnlyBad((v) => !v)}
        >
          仅异常
        </button>
        {interactive && onAsk ? (
          <>
            <button type="button" onClick={() => ask("这张报销表改成按不含税入账再汇总")}>
              改不含税
            </button>
            <button type="button" onClick={() => ask("缺票先警告别拦截，容差调到500再对一遍")}>
              优化规则
            </button>
          </>
        ) : null}
      </div>

      <div className="oa-ledger-table-wrap">
        <table className="oa-ledger-table">
          <thead>
            <tr>
              {paper.grid.columns.map((col) => (
                <th key={col}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr
                key={row.index}
                className={[
                  `is-${row.tone}`,
                  selected === row.index ? "is-selected" : "",
                  handled.has(row.index) ? "is-handled" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => setSelected(row.index)}
              >
                <td>{row.dept}</td>
                <td>{row.person}</td>
                <td className="num">{row.amount}</td>
                <td className="num">{row.tax}</td>
                <td className="num">{row.booked}</td>
                <td className="num oa-ledger-invoice">
                  {interactive && row.tone !== "ok" && selected === row.index ? (
                    <input
                      value={row.invoice === "空" ? "" : row.invoice}
                      placeholder="补发票额"
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) =>
                        setInvoiceOverrides((prev) => ({ ...prev, [row.index]: e.target.value }))
                      }
                    />
                  ) : (
                    row.invoice
                  )}
                </td>
                <td className="num">{row.gap}</td>
                <td>
                  <span className={`oa-ledger-pill is-${row.tone}`}>{row.judge}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <footer className="oa-ledger-table-foot">
          显示 {filtered.length} / {rows.length} 行
        </footer>
      </div>

      {selectedRow && interactive ? (
        <div className="oa-ledger-inspector">
          <strong>
            {selectedRow.person} · {selectedRow.dept}
          </strong>
          <p>{selectedRow.judge}</p>
          <div className="oa-ledger-inspector-actions">
            {selectedRow.tone !== "ok" && onAsk ? (
              <button
                type="button"
                onClick={() =>
                  ask(
                    `${selectedRow.person}这条报销，发票额按${selectedRow.amount}补齐后再对账`,
                  )
                }
              >
                在对话里补票重算
              </button>
            ) : null}
            {onAsk ? (
              <button type="button" onClick={() => ask(`只看${selectedRow.dept}部门报销对账结果`)}>
                让助手只看本部门
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setHandled((prev) => new Set(prev).add(selectedRow.index));
              }}
            >
              标为已处理
            </button>
          </div>
        </div>
      ) : null}

    </div>
  );
}
