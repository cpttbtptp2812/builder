import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  appendSessionTurn,
  buildMemoryContextBlock,
  clearSessionTurns,
  deleteMemory,
  getMemorySnapshot,
  seedDefaultMemoriesIfEmpty,
  upsertMemory,
  type MemoryEntry,
} from "../../lib/agentMemory";
import {
  ROUTER_EVAL_CASES,
  runRouterEval,
  runSkillBenchmark,
  routerEvalSummary,
  type RouterEvalRow,
  type ToolMetrics,
} from "../../lib/evalHarness";
import {
  getAgentMeta,
  runMultiAgentPipeline,
  type MultiAgentStep,
} from "../../lib/multiAgentRuntime";
import { buildRagCorpus, retrieveRag, type RagHit, type RagRetrieveResult } from "../../lib/ragEngine";
import { AgentArchitectureDiagram } from "./AgentArchitectureDiagram";

type Scene = "tour" | "rag" | "multi-agent" | "eval";

const DEMO_QUERY = "iMean 架构设计和 PostMessage 调度";

const SCENES: { id: Scene; step: string; title: string; subtitle: string }[] = [
  { id: "tour", step: "开始", title: "30 秒看懂", subtitle: "一键跑通 RAG → Multi-Agent → Eval" },
  { id: "rag", step: "①", title: "知识检索 RAG", subtitle: "问题拆成 chunk，按相关度召回" },
  { id: "multi-agent", step: "②", title: "多 Agent 协作", subtitle: "Planner 定计划 → Executor 调工具 → Reviewer 出答案" },
  { id: "eval", step: "③", title: "质量评估 Eval", subtitle: "Skill 路由对不对、工具链快不快" },
];

function ScoreBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  return (
    <div className="platform-score-bar" aria-label={`相关度 ${pct}%`}>
      <i style={{ width: `${pct}%` }} />
      <span>{pct}%</span>
    </div>
  );
}

function RagHitCard({ hit }: { hit: RagHit }) {
  return (
    <article className="platform-hit-card">
      <header>
        <span className="platform-hit-rank">Top {hit.rank}</span>
        <strong>{hit.projectName}</strong>
        <em>{hit.section === "architecture" ? "架构" : hit.section === "narrative" ? "详情" : hit.section}</em>
      </header>
      <ScoreBar score={hit.score} />
      <p>{hit.text}</p>
      {hit.matchedTerms.length > 0 && (
        <footer>命中词：{hit.matchedTerms.slice(0, 6).join(" · ")}</footer>
      )}
    </article>
  );
}

function MultiAgentTimeline({ steps, running }: { steps: MultiAgentStep[]; running: boolean }) {
  const roles = ["planner", "executor", "reviewer"] as const;
  const activeIdx = steps.length;

  return (
    <div className="platform-ma-timeline">
      {roles.map((role, i) => {
        const meta = getAgentMeta(role);
        const step = steps.find((s) => s.agentId === role);
        const state = running && activeIdx === i ? "active" : step ? "done" : "idle";
        return (
          <div
            key={role}
            className={`platform-ma-node platform-ma-node--${state}`}
            style={{ "--ma-color": meta.color } as CSSProperties}
          >
            <div className="platform-ma-node-head">
              <span>{String(i + 1).padStart(2, "0")}</span>
              <strong>{meta.label === "Planner" ? "规划" : meta.label === "Executor" ? "执行" : "汇总"}</strong>
              {step && <em>{step.ms}ms</em>}
            </div>
            <p className="platform-ma-node-desc">
              {role === "planner" && "读记忆 + 定检索/探活计划"}
              {role === "executor" && "knowledge_search · 可选 http_probe"}
              {role === "reviewer" && "带引用编号合成答复"}
            </p>
            {step?.toolCalls && step.toolCalls.length > 0 && (
              <ul className="platform-ma-node-tools">
                {step.toolCalls.map((tc, j) => (
                  <li key={j} className={tc.ok ? "ok" : "fail"}>
                    {tc.tool} · {tc.preview ?? `${tc.ms}ms`}
                  </li>
                ))}
              </ul>
            )}
            {step && <pre className="platform-ma-node-body">{step.content.slice(0, 220)}{step.content.length > 220 ? "…" : ""}</pre>}
            {i < roles.length - 1 && <div className="platform-ma-node-arrow" aria-hidden>→</div>}
          </div>
        );
      })}
    </div>
  );
}

export function AgentPlatformLab() {
  const [scene, setScene] = useState<Scene>("tour");

  const [ragQuery, setRagQuery] = useState(DEMO_QUERY);
  const [ragResult, setRagResult] = useState<RagRetrieveResult | null>(null);

  const [maQuery, setMaQuery] = useState(DEMO_QUERY);
  const [maSteps, setMaSteps] = useState<MultiAgentStep[]>([]);
  const [maAnswer, setMaAnswer] = useState("");
  const [maRunning, setMaRunning] = useState(false);

  const [evalRows, setEvalRows] = useState<RouterEvalRow[]>(() => runRouterEval());
  const [toolMetrics, setToolMetrics] = useState<ToolMetrics | null>(null);

  const [tourRunning, setTourRunning] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [memPreview, setMemPreview] = useState("");

  const corpusStats = useMemo(() => {
    const chunks = buildRagCorpus();
    return { chunks: chunks.length, projects: new Set(chunks.map((c) => c.projectId)).size };
  }, []);

  const evalSummary = useMemo(() => routerEvalSummary(evalRows), [evalRows]);

  const runRag = useCallback((q: string) => {
    const result = retrieveRag(q, 3);
    setRagResult(result);
    setRagQuery(q);
    return result;
  }, []);

  const refreshMemory = useCallback(async () => {
    const snap = await getMemorySnapshot();
    setMemories(snap.longTerm);
    setMemPreview(await buildMemoryContextBlock());
  }, []);

  const runMultiAgent = useCallback(
    async (q: string) => {
      setMaRunning(true);
      setMaSteps([]);
      setMaAnswer("");
      setMaQuery(q);
      appendSessionTurn("user", q);

      try {
        const result = await runMultiAgentPipeline(q, (step) => {
          setMaSteps((prev) => [...prev, step]);
        });
        setMaAnswer(result.answer);
        appendSessionTurn("assistant", result.answer.slice(0, 300));
        return result;
      } finally {
        setMaRunning(false);
        refreshMemory();
      }
    },
    [refreshMemory],
  );

  const runFullTour = useCallback(async () => {
    setTourRunning(true);
    setTourStep(1);
    setScene("tour");

    runRag(DEMO_QUERY);
    await new Promise((r) => setTimeout(r, 900));

    setTourStep(2);
    setScene("multi-agent");
    await runMultiAgent(DEMO_QUERY);
    await new Promise((r) => setTimeout(r, 600));

    setTourStep(3);
    setEvalRows(runRouterEval());
    setScene("eval");
    try {
      const { metrics } = await runSkillBenchmark();
      setToolMetrics(metrics);
    } catch {
      /* benchmark optional */
    }

    setTourStep(4);
    setTourRunning(false);
  }, [runRag, runMultiAgent]);

  useEffect(() => {
    runRag(DEMO_QUERY);
    seedDefaultMemoriesIfEmpty().then(refreshMemory);
  }, [runRag, refreshMemory]);

  const topHit = ragResult?.hits[0];

  return (
    <div className="platform-lab platform-lab--guided">
      {/* Hero — 这页在干嘛 */}
      <header className="platform-hero">
        <div className="platform-hero-copy">
          <p className="platform-hero-eyebrow">架构师 JD 对齐 · 可在线验证</p>
          <h3>Agent 平台能力演示</h3>
          <p>
            不是 PPT：输入一个问题，看<strong>知识怎么被召回</strong>、<strong>三个 Agent 怎么分工</strong>、<strong>路由和工具链指标是否达标</strong>。
          </p>
        </div>
        <button type="button" className="platform-hero-cta" onClick={runFullTour} disabled={tourRunning || maRunning}>
          {tourRunning ? `演示中… 第 ${tourStep}/3 步` : "▶ 一键跑完整演示（约 30 秒）"}
        </button>
      </header>

      {/* 三步导航 */}
      <nav className="platform-scene-nav" aria-label="演示步骤">
        {SCENES.filter((s) => s.id !== "tour").map((s) => (
          <button
            key={s.id}
            type="button"
            className={`platform-scene-btn ${scene === s.id ? "active" : ""} ${tourStep >= (s.id === "rag" ? 1 : s.id === "multi-agent" ? 2 : 3) && tourStep < 4 ? "visited" : ""}`}
            onClick={() => setScene(s.id)}
          >
            <span className="platform-scene-step">{s.step}</span>
            <span className="platform-scene-title">{s.title}</span>
            <span className="platform-scene-sub">{s.subtitle}</span>
          </button>
        ))}
      </nav>

      {/* Scene: Tour / default landing */}
      {scene === "tour" && (
        <div className="platform-tour-panel">
          <div className="platform-split">
            <div className="platform-split-input">
              <label>演示问题（可改）</label>
              <input value={ragQuery} onChange={(e) => setRagQuery(e.target.value)} />
              <div className="platform-split-actions">
                <button type="button" onClick={() => { runRag(ragQuery); setScene("rag"); }}>只看 RAG</button>
                <button type="button" onClick={() => runFullTour()} disabled={tourRunning}>完整演示</button>
              </div>
              <p className="platform-split-hint">语料库 {corpusStats.chunks} 段 · 来自简历项目知识</p>
            </div>
            <div className="platform-split-result">
              <p className="platform-result-label">你会看到什么</p>
              <ol className="platform-tour-checklist">
                <li className={ragResult ? "done" : ""}>RAG 召回 Top3 chunk + 相关度条</li>
                <li className={maSteps.length >= 3 ? "done" : ""}>Planner / Executor / Reviewer 依次亮起</li>
                <li className={evalSummary.pass > 0 ? "done" : ""}>Router 准确率 + 工具 P50/P99</li>
              </ol>
              {topHit && (
                <div className="platform-tour-preview">
                  <span>当前最佳命中</span>
                  <strong>{topHit.projectName}</strong>
                  <ScoreBar score={topHit.score} />
                  <p>{topHit.text.slice(0, 120)}…</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Scene: RAG */}
      {scene === "rag" && (
        <div className="platform-scene-panel">
          <div className="platform-scene-intro">
            <strong>这一步在证明：</strong>
            问「iMean 架构」不会瞎编 — 系统从知识库拆好的 chunk 里按分数召回，并标出来源。
          </div>
          <div className="platform-split">
            <div className="platform-split-input">
              <label>你的问题</label>
              <input
                value={ragQuery}
                onChange={(e) => setRagQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runRag(ragQuery)}
              />
              <button type="button" className="platform-primary-btn" onClick={() => runRag(ragQuery)}>
                检索
              </button>
              <div className="platform-chips">
                {["SkillForge 怎么路由", "ReplaySDK 定位策略", "Agent 流恢复"].map((q) => (
                  <button key={q} type="button" onClick={() => runRag(q)}>{q}</button>
                ))}
              </div>
            </div>
            <div className="platform-split-result">
              {ragResult ? (
                <>
                  <div className="platform-result-stats">
                    <span>{ragResult.latencyMs}ms</span>
                    <span>{ragResult.hits.length} 条命中</span>
                    {ragResult.directProjectId && <span>直匹配 {ragResult.directProjectId}</span>}
                  </div>
                  <div className="platform-hit-list">
                    {ragResult.hits.map((h) => (
                      <RagHitCard key={h.chunkId} hit={h} />
                    ))}
                  </div>
                  {ragResult.hits.length === 0 && (
                    <p className="platform-empty">没命中 — 换项目名试试，如 iMean、SkillForge</p>
                  )}
                </>
              ) : (
                <p className="platform-empty">点「检索」看结果</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Scene: Multi-Agent */}
      {scene === "multi-agent" && (
        <div className="platform-scene-panel">
          <div className="platform-scene-intro">
            <strong>这一步在证明：</strong>
            不是单 Agent 硬答 — 先规划、再调 MCP 工具、最后带引用汇总。
          </div>
          <div className="platform-split platform-split--stack">
            <div className="platform-split-input platform-split-input--row">
              <input
                value={maQuery}
                onChange={(e) => setMaQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !maRunning && runMultiAgent(maQuery)}
                placeholder="例如：介绍一下 SkillForge 的 MCP 流水线"
                disabled={maRunning}
              />
              <button type="button" className="platform-primary-btn" onClick={() => runMultiAgent(maQuery)} disabled={maRunning}>
                {maRunning ? "运行中…" : "运行三 Agent"}
              </button>
            </div>
            <MultiAgentTimeline steps={maSteps} running={maRunning} />
            {maAnswer && !maRunning && (
              <div className="platform-final-answer">
                <h5>最终答复（Reviewer 输出）</h5>
                <pre>{maAnswer}</pre>
              </div>
            )}
            {!maSteps.length && !maRunning && (
              <p className="platform-empty platform-empty--center">点「运行三 Agent」— 三个角色会依次亮起</p>
            )}
          </div>
        </div>
      )}

      {/* Scene: Eval */}
      {scene === "eval" && (
        <div className="platform-scene-panel">
          <div className="platform-scene-intro">
            <strong>这一步在证明：</strong>
            Skill 路由可量化回归；工具链 latency 有 P50/P99，不是「感觉挺快」。
          </div>
          <div className="platform-eval-cards">
            <div className={`platform-eval-card ${evalSummary.accuracy >= 80 ? "ok" : "warn"}`}>
              <span>Router 准确率</span>
              <strong>{evalSummary.accuracy}%</strong>
              <em>{evalSummary.pass}/{evalSummary.total} 通过</em>
            </div>
            <div className="platform-eval-card">
              <span>平均路由分</span>
              <strong>{evalSummary.avgScore}</strong>
              <em>explainDiscovery 打分</em>
            </div>
            {toolMetrics && (
              <>
                <div className="platform-eval-card ok">
                  <span>工具成功率</span>
                  <strong>{toolMetrics.successRate}%</strong>
                  <em>{toolMetrics.totalCalls} 次调用</em>
                </div>
                <div className="platform-eval-card">
                  <span>延迟 P50 / P99</span>
                  <strong>{toolMetrics.p50Ms} / {toolMetrics.p99Ms}</strong>
                  <em>ms · Skill Benchmark</em>
                </div>
              </>
            )}
          </div>
          <div className="platform-split-actions platform-split-actions--center">
            <button type="button" onClick={() => setEvalRows(runRouterEval())}>↻ 重跑 Router 测试</button>
            <button type="button" className="platform-primary-btn" onClick={async () => {
              const { metrics } = await runSkillBenchmark();
              setToolMetrics(metrics);
            }}>跑 Skill 压测</button>
          </div>
          <details className="platform-details">
            <summary>展开 {ROUTER_EVAL_CASES.length} 条用例明细</summary>
            <table className="platform-eval-table">
              <thead>
                <tr><th>输入</th><th>期望 Skill</th><th>实际</th><th>结果</th></tr>
              </thead>
              <tbody>
                {evalRows.map((row) => (
                  <tr key={row.id} className={row.pass ? "pass" : "fail"}>
                    <td>{row.query}</td>
                    <td><code>{row.expectedSkillId}</code></td>
                    <td><code>{row.predictedSkillId ?? "—"}</code></td>
                    <td>{row.pass ? "✓" : "✗"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </div>
      )}

      {/* 高级附录 — 默认收起 */}
      <footer className="platform-advanced">
        <button type="button" className="platform-advanced-toggle" onClick={() => setShowAdvanced((v) => !v)}>
          {showAdvanced ? "▾ 收起技术附录" : "▸ 技术附录：Memory · 架构对照"}
        </button>
        {showAdvanced && (
          <div className="platform-advanced-body">
            <section className="platform-advanced-section">
              <h5>Memory · 上下文工程</h5>
              <p className="platform-advanced-lead">长期记忆存 IndexedDB，Multi-Agent Planner 会读取；跑完演示后 Session 轮次会增加。</p>
              <ul className="platform-mem-list compact">
                {memories.map((m) => (
                  <li key={m.key}>
                    <strong>{m.key}</strong> — {m.value}
                    <button type="button" onClick={() => deleteMemory(m.key).then(refreshMemory)}>删</button>
                  </li>
                ))}
              </ul>
              <form
                className="platform-mem-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const k = String(fd.get("key") ?? "").trim();
                  const v = String(fd.get("value") ?? "").trim();
                  if (!k || !v) return;
                  await upsertMemory(k, v);
                  e.currentTarget.reset();
                  refreshMemory();
                }}
              >
                <input name="key" placeholder="键，如 preferred_stack" />
                <input name="value" placeholder="值" />
                <button type="submit">写入 IDB</button>
              </form>
              <button type="button" className="platform-link-btn" onClick={() => { clearSessionTurns(); refreshMemory(); }}>清空 Session</button>
              <pre className="platform-mem-preview">{memPreview}</pre>
            </section>
            <section className="platform-advanced-section">
              <h5>架构对照</h5>
              <AgentArchitectureDiagram showCompare />
            </section>
          </div>
        )}
      </footer>
    </div>
  );
}
