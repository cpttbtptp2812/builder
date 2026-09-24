import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { runPolicyEvalAsync, runRouterEvalAsync, runSkillBenchmarkAsync } from "../../lib/backendBridge";
import {
  getRouterEvalCases,
  routerEvalSummary,
  type RouterEvalRow,
} from "../../lib/evalHarness";
import { policyEvalSummary, runPolicyEval } from "../../lib/policyDesk";
import {
  buildKnowledgeEvalCases,
  knowledgeEvalSummary,
  runKnowledgeEval,
  type KnowledgeEvalRow,
} from "../../lib/knowledgeEval";
import { gapDraftFromEval } from "../../lib/knowledgeGapWizard";
import { runTraceEval, traceEvalSummary, type TraceEvalRow } from "../../lib/provingGround";
import { OaBadge, OaBtn, OaEmpty, OaPage, OaStack, OaStatGrid } from "../ownagent/OaUi";

type Props = {
  compact?: boolean;
};

/** 回答质检 — 批量测试 AI 是否答对 */
export function EvalLabPanel({ compact = false }: Props) {
  const [evalRows, setEvalRows] = useState<RouterEvalRow[]>([]);
  const [policyRows, setPolicyRows] = useState<ReturnType<typeof runPolicyEval>>([]);
  const [knowledgeRows, setKnowledgeRows] = useState<KnowledgeEvalRow[]>([]);
  const [traceRows, setTraceRows] = useState<TraceEvalRow[]>([]);
  const [running, setRunning] = useState(false);

  const routerCaseCount = getRouterEvalCases().length;
  const knowledgeCaseCount = buildKnowledgeEvalCases().length;
  const summary = useMemo(() => routerEvalSummary(evalRows), [evalRows]);
  const fails = useMemo(() => evalRows.filter((r) => !r.pass), [evalRows]);
  const policySummary = useMemo(() => policyEvalSummary(policyRows), [policyRows]);
  const knowledgeSummary = useMemo(() => knowledgeEvalSummary(knowledgeRows), [knowledgeRows]);
  const knowledgeFails = useMemo(() => knowledgeRows.filter((r) => !r.pass), [knowledgeRows]);
  const traceSummary = useMemo(() => traceEvalSummary(traceRows), [traceRows]);
  const traceFails = useMemo(() => traceRows.filter((r) => !r.pass), [traceRows]);

  const runAll = useCallback(async () => {
    setRunning(true);
    try {
      const [routerRes, policyRes] = await Promise.all([runRouterEvalAsync(), runPolicyEvalAsync()]);
      setEvalRows(routerRes.rows);
      setPolicyRows(policyRes.rows);
      setKnowledgeRows(runKnowledgeEval());
      setTraceRows(await runTraceEval());
    } finally {
      setRunning(false);
    }
  }, []);

  useEffect(() => {
    if (!compact) void runAll();
  }, [compact, runAll]);

  if (compact) {
    return (
      <div className="eval-lab eval-lab--compact">
        <OaStatGrid
          items={[
            {
              label: "准确率",
              value: evalRows.length ? `${summary.accuracy}%` : "—",
              hint: `${summary.pass}/${summary.total}`,
            },
          ]}
        />
        <OaBtn onClick={() => void runAll()} disabled={running}>
          {running ? "检测中…" : "重新检测"}
        </OaBtn>
        <p className="eval-lab-more">
          <Link to="/work/ownagent?tab=product&view=eval">打开完整质检 →</Link>
        </p>
      </div>
    );
  }

  return (
    <OaPage
      title="回答质检"
      desc={`路由 ${routerCaseCount} 条 + 资料库 ${knowledgeCaseCount} 条 golden set + Proving Ground trace mock，批量检测路由、RAG 与 Skill 工具链骨架。`}
    >
      <OaStatGrid
        items={[
          {
            label: "回答准确率",
            value: evalRows.length ? `${summary.accuracy}%` : "—",
            hint: `${summary.pass}/${summary.total} 通过`,
            tone: summary.accuracy >= 80 ? "ok" : evalRows.length ? "warn" : undefined,
          },
          {
            label: "失败样本",
            value: fails.length,
            hint: fails.length ? "建议补充资料" : "全部通过",
            tone: fails.length ? "warn" : evalRows.length ? "ok" : undefined,
          },
          {
            label: "规则自检",
            value: policyRows.length ? `${policySummary.pass}/${policySummary.total}` : "—",
            hint: "回答规则",
            tone: policySummary.pass === policySummary.total && policyRows.length ? "ok" : undefined,
          },
          {
            label: "资料库命中",
            value: knowledgeRows.length ? `${knowledgeSummary.accuracy}%` : "—",
            hint: `${knowledgeSummary.pass}/${knowledgeSummary.total} 条问句能检索到对应条目`,
            tone: knowledgeSummary.accuracy >= 80 ? "ok" : knowledgeRows.length ? "warn" : undefined,
          },
          {
            label: "Trace 证明",
            value: traceRows.length ? `${traceSummary.accuracy}%` : "—",
            hint: `${traceSummary.pass}/${traceSummary.total} Skill mock 骨架`,
            tone: traceSummary.accuracy === 100 && traceRows.length ? "ok" : traceRows.length ? "warn" : undefined,
          },
        ]}
      />

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <OaBtn onClick={() => void runAll()} disabled={running}>
          {running ? "检测中…" : "开始检测"}
        </OaBtn>
      </div>

      {evalRows.length === 0 && !running ? (
        <OaEmpty>点击「开始检测」运行批量测试</OaEmpty>
      ) : null}

      {traceFails.length > 0 ? (
        <OaStack>
          <h2 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 600 }}>Proving Ground · Trace 未通过</h2>
          <ul className="oa-list">
            {traceFails.map((row) => (
              <li key={row.id} className="oa-list-item">
                <div>
                  <strong style={{ fontSize: "0.8125rem" }}>{row.skillId} · {row.id}</strong>
                  <p>{row.detail}</p>
                </div>
                <OaBadge tone="danger">骨架失败</OaBadge>
              </li>
            ))}
          </ul>
        </OaStack>
      ) : traceRows.length > 0 ? (
        <OaEmpty>Proving Ground trace mock 全部通过</OaEmpty>
      ) : null}

      {knowledgeFails.length > 0 ? (
        <OaStack>
          <h2 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 600 }}>资料库检索未命中</h2>
          <ul className="oa-list">
            {knowledgeFails.map((row) => (
              <li key={row.id} className="oa-list-item">
                <div>
                  <strong style={{ fontSize: "0.8125rem" }}>{row.query}</strong>
                  <p>{row.detail}</p>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <OaBtn
                    variant="ghost"
                    onClick={() => {
                      gapDraftFromEval(row.query, row.docTitle, row.detail);
                      window.dispatchEvent(
                        new CustomEvent("ownagent:go", { detail: { view: "rag" } }),
                      );
                    }}
                  >
                    补到资料库
                  </OaBtn>
                  <OaBadge tone="danger">未命中</OaBadge>
                </div>
              </li>
            ))}
          </ul>
        </OaStack>
      ) : knowledgeRows.length > 0 ? (
        <OaEmpty>资料库 {knowledgeCaseCount} 条 golden set 全部命中</OaEmpty>
      ) : null}

      {fails.length > 0 ? (
        <OaStack>
          <h2 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 600 }}>路由需要关注的问题</h2>
          <ul className="oa-list">
            {fails.map((row) => (
              <li key={row.id} className="oa-list-item">
                <div>
                  <strong style={{ fontSize: "0.8125rem" }}>{row.query}</strong>
                  {row.note ? <p>{row.note}</p> : null}
                </div>
                <OaBadge tone="danger">未通过</OaBadge>
              </li>
            ))}
          </ul>
        </OaStack>
      ) : evalRows.length > 0 ? (
        <OaEmpty>全部 {routerCaseCount} 条测试通过</OaEmpty>
      ) : null}

      <details className="oa-details" style={{ marginTop: "1rem" }}>
        <summary>查看全部测试明细</summary>
        <div className="oa-details-body">
          <ul className="oa-list">
            {evalRows.map((row) => (
              <li key={row.id} className="oa-list-item">
                <strong style={{ fontSize: "0.8125rem" }}>{row.query}</strong>
                <OaBadge tone={row.pass ? "ok" : "danger"}>{row.pass ? "通过" : "未通过"}</OaBadge>
              </li>
            ))}
          </ul>
        </div>
      </details>
    </OaPage>
  );
}
