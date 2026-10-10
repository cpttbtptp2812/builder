import { useState, type ReactNode } from "react";
import type { PaperIssue, PaperTone, WorkPaper } from "../../lib/workPaper";
import { paperBrief } from "../../lib/workPaper";
import { LedgerTableDesk } from "./LedgerTableDesk";

const LEVEL: Record<PaperTone, string> = {
  bad: "严重",
  warn: "警告",
  hint: "提示",
  ok: "已修正",
};

export function Issues({
  issues,
  interactive,
  onFix,
}: {
  issues: PaperIssue[];
  interactive?: boolean;
  onFix?: () => void;
}) {
  const [fixed, setFixed] = useState(false);
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  const open = fixed ? issues.filter((issue) => issue.level === "bad") : issues;
  const done = fixed ? issues.filter((issue) => issue.level !== "bad") : [];
  return (
    <section className="oa-paper-issues">
      <header>
        <i className={open.length ? "is-bad" : "is-ok"} />
        <strong>{open.length ? `发现 ${open.length} 个问题需要处理` : "问题已处理"}</strong>
      </header>
      {open.map((issue, index) => (
        <article key={`${issue.title}-${index}`} className={`oa-paper-issue is-${issue.level}`}>
          <div>
            <b>{LEVEL[issue.level]}</b>
            <span>{issue.title}</span>
          </div>
          <p>当前值：{issue.current}</p>
          <p>应为：{issue.expected}</p>
        </article>
      ))}
      {done.map((issue, index) => (
        <article key={`done-${index}`} className="oa-paper-issue is-ok">
          <div>
            <b>已修正</b>
            <span>{issue.title}</span>
          </div>
          <p>已改成：{issue.expected}</p>
        </article>
      ))}
      {interactive && issues.length > 0 && (
        <div className="oa-paper-issue-actions">
          {!fixed && (
            <button type="button" onClick={() => { setFixed(true); onFix?.(); }}>一键修正</button>
          )}
          <button type="button" className="is-ghost" onClick={() => setHidden(true)}>忽略问题</button>
        </div>
      )}
      {fixed && <p className="oa-paper-hint">请核对合同里仍标红的字段，金额需要人工确认。</p>}
    </section>
  );
}

function Mark({ value, tone }: { value: string; tone: PaperTone }) {
  return <mark className={`oa-paper-mark is-${tone}`}>{value}</mark>;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="oa-paper-sec">
      <h4><i />{title}</h4>
      {children}
    </section>
  );
}

function Kv({ rows }: { rows: { label: string; value: string; tone?: PaperTone; ok?: boolean }[] }) {
  return (
    <div className="oa-paper-kv">
      {rows.map((row) => (
        <div key={row.label} className={row.tone ? `is-${row.tone}` : ""}>
          <span>{row.label}</span>
          <b>{row.value}{row.ok ? " ✓" : ""}</b>
        </div>
      ))}
    </div>
  );
}

function ContractView({ paper, interactive }: { paper: Extract<WorkPaper, { kind: "contract" }>; interactive?: boolean }) {
  const [tab, setTab] = useState<"contract" | "voucher" | "plan">("contract");
  const [fixed, setFixed] = useState(false);
  const show = (field: { value: string; expected: string; fill: string; tone: PaperTone }) => {
    if (!fixed || field.tone === "bad") return field;
    return { ...field, value: field.fill || field.expected, tone: "ok" as const };
  };
  const amount = show(paper.amount);
  const term = show(paper.term);
  const rate = show(paper.rate);
  const repay = show(paper.repay);
  return (
    <div className="oa-paper">
      <div className="oa-paper-tabs">
        <button type="button" className={tab === "contract" ? "is-on" : ""} onClick={() => setTab("contract")}>借款合同</button>
        <button type="button" className={tab === "voucher" ? "is-on" : ""} onClick={() => setTab("voucher")}>借款凭证</button>
        <button type="button" className={tab === "plan" ? "is-on" : ""} onClick={() => setTab("plan")}>用途承诺函</button>
      </div>
      <div className="oa-paper-stage">
        {tab === "contract" && (
          <article className="oa-paper-sheet">
            <h3>{paper.title}</h3>
            <p className="oa-paper-no">合同编号：{paper.no}</p>
            <p>贷款人（甲方）：{paper.lender}</p>
            <p>借款人（乙方）：<Mark value={paper.borrower} tone="ok" /></p>
            <p className="oa-paper-lead">根据《中华人民共和国民法典》及相关法律法规，甲乙双方就借款事宜达成如下协议：</p>
            <h4>第一条 借款金额与期限</h4>
            <p>1.2 本次借款金额：<Mark value={amount.value} tone={amount.tone} />（应为 {paper.amount.expected}）</p>
            <p>1.3 借款期限：<Mark value={term.value} tone={term.tone} />，自实际放款之日起算。</p>
            <h4>第二条 贷款利率</h4>
            <p>2.1 年化利率为 <Mark value={rate.value} tone={rate.tone} />，对照 {paper.rate.expected}。</p>
            <h4>第三条 还款方式</h4>
            <p>3.1 乙方采用 <Mark value={repay.value} tone={repay.tone} /> 方式还款。</p>
            <div className="oa-paper-sign">
              <span>甲方（盖章）</span>
              <span>乙方（签字）</span>
            </div>
          </article>
        )}
        {tab === "voucher" && (
          <article className="oa-paper-sheet">
            <h3>借款凭证</h3>
            <p className="oa-paper-no">凭证编号：PZ-{paper.no}</p>
            <Kv rows={paper.voucher} />
          </article>
        )}
        {tab === "plan" && (
          <article className="oa-paper-sheet">
            <h3>贷款用途承诺函</h3>
            <p className="oa-paper-no">{paper.borrower}</p>
            <Kv rows={paper.plan} />
          </article>
        )}
      </div>
      <Issues issues={paper.issues} interactive={interactive} onFix={() => setFixed(true)} />
    </div>
  );
}

function CreditView({ paper }: { paper: Extract<WorkPaper, { kind: "credit" }> }) {
  return (
    <div className="oa-paper oa-paper-report">
      <header className="oa-paper-title">
        <h3>{paper.title}</h3>
        <p>NO. {paper.no}</p>
      </header>
      <div className="oa-paper-band">
        <strong>{paper.verdict}</strong>
        <p>{paper.note}</p>
        <div>
          {paper.metrics.map((item) => (
            <span key={item.label}>
              <em>{item.label}</em>
              <b>{item.value}</b>
            </span>
          ))}
        </div>
      </div>
      <Section title="测算参数">
        <Kv rows={paper.rows} />
      </Section>
      <Section title="授信额度测算过程">
        <div className="oa-paper-formulas">
          {paper.formulas.map((item) => (
            <div key={item.name}>
              <b>{item.name}</b>
              <p>公式：{item.formula}</p>
              <code>{item.expr}</code>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function LedgerView({
  paper,
  interactive,
  onAsk,
}: {
  paper: Extract<WorkPaper, { kind: "ledger" }>;
  interactive?: boolean;
  onAsk?: (text: string) => void;
}) {
  return (
    <>
      <LedgerTableDesk paper={paper} interactive={interactive} onAsk={onAsk} />
      <Issues issues={paper.issues} interactive={interactive} />
    </>
  );
}

function FlowView({ paper }: { paper: Extract<WorkPaper, { kind: "flow" }> }) {
  return (
    <div className="oa-paper oa-paper-report">
      <header className="oa-paper-title">
        <h3>{paper.title}</h3>
        <p>{paper.halt}</p>
      </header>
      <ol className="oa-paper-steps">
        {paper.steps.map((step) => (
          <li key={step.label} className={`is-${step.state}`}>
            <b>{step.label}</b>
            <span>{step.detail}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function VoucherView({ paper, interactive }: { paper: Extract<WorkPaper, { kind: "voucher" }>; interactive?: boolean }) {
  return (
    <div className="oa-paper">
      <div className="oa-paper-stage">
        <article className="oa-paper-sheet">
          <h3>{paper.title}</h3>
          <p className="oa-paper-no">凭证编号：{paper.no}</p>
          <p>借款人：{paper.borrower}</p>
          <div className="oa-paper-fields">
            {paper.fields.map((field) => (
              <p key={field.label}>
                {field.label}：<Mark value={field.value} tone={field.tone} />
                <em>{field.note}</em>
              </p>
            ))}
          </div>
        </article>
      </div>
      <Issues issues={paper.issues} interactive={interactive} />
    </div>
  );
}

function ChecklistView({ paper }: { paper: Extract<WorkPaper, { kind: "checklist" }> }) {
  return (
    <div className="oa-paper oa-paper-report">
      <header className="oa-paper-title">
        <h3>{paper.title}</h3>
        <p>{paper.verdict}</p>
      </header>
      <ul className="oa-paper-checks">
        {paper.items.map((item) => (
          <li key={item.label} className={`is-${item.tone}`}>
            <b>{item.tone === "ok" ? "✓" : "!"}</b>
            <span>{item.label}</span>
            <em>{item.detail}</em>
          </li>
        ))}
      </ul>
    </div>
  );
}

function OccupancyView({ paper }: { paper: Extract<WorkPaper, { kind: "occupancy" }> }) {
  return (
    <div className="oa-paper oa-paper-report">
      <header className="oa-paper-title">
        <h3>额度核查完成</h3>
        <p>{paper.note}</p>
      </header>
      <Section title={paper.title}>
        <Kv rows={paper.rows} />
        <p className="oa-paper-pass">{paper.verdict}</p>
      </Section>
    </div>
  );
}

function CollateralView({ paper, interactive }: { paper: Extract<WorkPaper, { kind: "collateral" }>; interactive?: boolean }) {
  return (
    <div className="oa-paper oa-paper-report">
      <header className="oa-paper-title">
        <h3>{paper.title}</h3>
        <p>{paper.note}</p>
      </header>
      <div className="oa-paper-counts">
        {paper.counts.map((item) => (
          <span key={item.label} className={`is-${item.tone}`}>
            <em>{item.label}</em>
            <b>{item.value}</b>
          </span>
        ))}
      </div>
      <ul className="oa-paper-drops">
        {paper.rows.map((row) => (
          <li key={row.name} className={`is-${row.tone}`}>
            <div>
              <strong>{row.name}</strong>
              <span>{row.type}</span>
              <em>{row.reason}</em>
            </div>
            <div>
              <s>{row.from}</s>
              <b>{row.to}</b>
              <i>{row.drop}</i>
            </div>
          </li>
        ))}
      </ul>
      <Issues issues={paper.issues} interactive={interactive} />
    </div>
  );
}

/** 对话里只放摘要，完整文书进右侧抽屉 */
function DisbursementView({ paper }: { paper: Extract<WorkPaper, { kind: "disbursement" }> }) {
  return (
    <div className="oa-paper oa-paper-report oa-paper-disburse">
      <header className="oa-paper-title">
        <h3>{paper.title}</h3>
        <p>{paper.company} · {paper.product}</p>
      </header>
      <div className="oa-disburse-hero">
        <div>
          <em>放款金额</em>
          <strong>{paper.amount}</strong>
        </div>
        <div>
          <em>风控分</em>
          <strong className="is-score">{paper.riskScore}</strong>
        </div>
      </div>
      <p className="oa-paper-pass">{paper.verdict}</p>
      <Section title="到账账户">
        <Kv rows={[{ label: "账户", value: paper.account }]} />
      </Section>
      <Section title="放款前核查">
        <ul className="oa-paper-checks">
          {paper.checks.map((item) => (
            <li key={item.label} className={item.ok ? "is-ok" : "is-bad"}>
              <b>{item.ok ? "✓" : "!"}</b>
              <span>{item.label}</span>
              <em>{item.detail}</em>
            </li>
          ))}
        </ul>
      </Section>
      <Section title="还款计划（前 6 期）">
        <div className="oa-disburse-table-wrap">
          <table className="oa-disburse-table">
            <thead>
              <tr>
                <th>期次</th>
                <th>计划金额</th>
                <th>还款日</th>
                <th>本金</th>
                <th>利息</th>
              </tr>
            </thead>
            <tbody>
              {paper.planRows.map((row) => (
                <tr key={row.term}>
                  <td>{row.term}</td>
                  <td>{row.amount}</td>
                  <td>{row.date}</td>
                  <td>{row.principal}</td>
                  <td>{row.interest}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="oa-disburse-foot">显示前 6 期，共 36 期 · 可在核心下载 Excel</p>
      </Section>
    </div>
  );
}

export function WorkPaperCard({
  paper,
  active,
  onOpen,
}: {
  paper: WorkPaper;
  active?: boolean;
  onOpen: () => void;
}) {
  const brief = paperBrief(paper);
  return (
    <button type="button" className={active ? "oa-paper-card is-open" : "oa-paper-card"} onClick={onOpen}>
      <span className="oa-paper-card-tag">{brief.tag}</span>
      <strong>{brief.title}</strong>
      <p>{brief.subtitle}</p>
      {brief.issues > 0 ? <em>{brief.issues} 项待处理</em> : <em className="is-ok">可在右侧查看完整明细</em>}
      <span className="oa-paper-card-go">{active ? "正在查看" : "右侧打开"}</span>
    </button>
  );
}

export function WorkPaperView({
  paper,
  interactive = true,
  onAsk,
}: {
  paper: WorkPaper;
  interactive?: boolean;
  onAsk?: (text: string) => void;
}) {
  if (paper.kind === "contract") return <ContractView paper={paper} interactive={interactive} />;
  if (paper.kind === "credit") return <CreditView paper={paper} />;
  if (paper.kind === "ledger") return <LedgerView paper={paper} interactive={interactive} onAsk={onAsk} />;
  if (paper.kind === "flow") return <FlowView paper={paper} />;
  if (paper.kind === "checklist") return <ChecklistView paper={paper} />;
  if (paper.kind === "occupancy") return <OccupancyView paper={paper} />;
  if (paper.kind === "collateral") return <CollateralView paper={paper} interactive={interactive} />;
  if (paper.kind === "disbursement") return <DisbursementView paper={paper} />;
  return <VoucherView paper={paper} interactive={interactive} />;
}
