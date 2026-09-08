import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { seedDefaultMemoriesIfEmpty, type MemoryEntry } from "../../lib/agentMemory";
import {
  deleteMemoryAsync,
  retrieveRagAsync,
  runMultiAgentAsync,
  saveMemoryAsync,
  syncMemoryFromServer,
} from "../../lib/backendBridge";
import { getAgentMeta, type MultiAgentStep } from "../../lib/multiAgentRuntime";
import { buildRagCorpus, type RagHit, type RagRetrieveResult } from "../../lib/ragEngine";
import { AgentArchitectureDiagram } from "./AgentArchitectureDiagram";
import { EvalLabPanel } from "./EvalLabPanel";
import { AgentFlowDiagram, PLATFORM_TOUR_NODES, platformNodeToScene } from "./AgentFlowDiagram";

type Scene = "tour" | "rag" | "multi-agent" | "eval";

const DEMO_QUERY = "iMean 架构设计和 PostMessage 调度";

const SCENES: { id: Scene; step: string; title: string; subtitle: string }[] = [
  { id: "tour", step: "开始", title: "快速了解", subtitle: "RAG → Multi-Agent（评测见 Eval Lab）" },
  { id: "rag", step: "①", title: "知识检索 RAG", subtitle: "问题拆成 chunk，按相关度召回" },
  { id: "multi-agent", step: "②", title: "多 Agent 协作", subtitle: "Planner 定计划 → Executor 调工具 → Reviewer 出答案" },
  { id: "eval", step: "→", title: "路由测试", subtitle: "Skill Router 回归" },
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
  const panelRef = useRef<HTMLDivElement>(null);
  const [scene, setScene] = useState<Scene>("tour");

  const [ragQuery, setRagQuery] = useState(DEMO_QUERY);
  const [ragResult, setRagResult] = useState<RagRetrieveResult | null>(null);

  const [maQuery, setMaQuery] = useState(DEMO_QUERY);
  const [maSteps, setMaSteps] = useState<MultiAgentStep[]>([]);
  const [maAnswer, setMaAnswer] = useState("");
  const [maRunning, setMaRunning] = useState(false);

  const [runtimeTag, setRuntimeTag] = useState<"server" | "local">("local");

  const [tourRunning, setTourRunning] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [memPreview, setMemPreview] = useState("");

  const corpusStats = useMemo(() => {
    const chunks = buildRagCorpus();
    return { chunks: chunks.length, projects: new Set(chunks.map((c) => c.projectId)).size };
  }, []);

  const runRag = useCallback(async (q: string) => {
    const result = await retrieveRagAsync(q, 3);
    setRagResult(result);
    setRagQuery(q);
    setRuntimeTag(result.runtime);
    return result;
  }, []);

  const refreshMemory = useCallback(async () => {
    const snap = await syncMemoryFromServer();
    setMemories(snap.longTerm);
    setMemPreview(snap.preview);
    setRuntimeTag(snap.runtime);
  }, []);

  const runMultiAgent = useCallback(
    async (q: string) => {
      setMaRunning(true);
      setMaSteps([]);
      setMaAnswer("");
      setMaQuery(q);

      try {
        const result = await runMultiAgentAsync(q, (step) => {
          setMaSteps((prev) => [...prev, step]);
        });
        if (result) {
          setMaAnswer(result.answer);
          setRuntimeTag(result.runtime);
        }
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
    setScene("eval");
    setTourStep(4);
    setTourRunning(false);
  }, [runRag, runMultiAgent]);

  useEffect(() => {
    void runRag(DEMO_QUERY);
    void seedDefaultMemoriesIfEmpty().then(refreshMemory);
  }, [runRag, refreshMemory]);

  const topHit = ragResult?.hits[0];

  const diagramActive = tourRunning || tourStep > 0
    ? PLATFORM_TOUR_NODES[tourStep]?.active ?? null
    : scene === "rag"
      ? "rag"
      : scene === "multi-agent"
        ? "multi-agent"
        : scene === "eval"
          ? "eval"
          : "query";

  const diagramVisited = tourRunning || tourStep > 0
    ? PLATFORM_TOUR_NODES[tourStep]?.visited ?? []
    : [
        ...(ragResult ? ["query", "corpus", "rag"] : []),
        ...(maSteps.length ? ["multi-agent", "planner", "executor", "reviewer"] : []),
        ...(scene === "eval" ? ["eval"] : []),
        ...(maAnswer ? ["answer"] : []),
      ];

  const diagramFlowEdge = tourRunning || tourStep > 0 ? PLATFORM_TOUR_NODES[tourStep]?.edge ?? null : null;

  function selectFlowNode(nodeId: string) {
    const next = platformNodeToScene(nodeId);
    if (next) {
      setScene(next);
      requestAnimationFrame(() => panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
    }
  }

  return (
    <div className="platform-lab platform-lab--guided">
      <AgentFlowDiagram
        variant="platform"
        activeId={diagramActive}
        visitedIds={diagramVisited}
        flowEdge={diagramFlowEdge}
        onSelect={selectFlowNode}
      />

      {/* Hero — 这页在干嘛 */}
      <header className="platform-hero">
        <div className="platform-hero-copy">
          <p className="platform-hero-eyebrow">Agent 平台层 · 可在线验证</p>
          <h3>RAG · Multi-Agent</h3>
          <p>
            先看上方<strong>模型图</strong>理解数据怎么走。质量评测请用{" "}
            <a href="#/work/dev-debug?tab=platform">开发调试</a>。
          </p>
        </div>
        <button type="button" className="platform-hero-cta" onClick={() => void runFullTour()} disabled={tourRunning || maRunning}>
          {tourRunning ? `演示中… 第 ${tourStep}/2 步` : "▶ 跑 RAG + Multi-Agent"}
        </button>
        <span className="platform-runtime-tag">{runtimeTag === "server" ? "SQLite 服务端" : "浏览器离线"}</span>
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
      <div ref={panelRef}>
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
                <li>路由测试 → <a href="#/work/dev-debug?tab=eval">开发调试 · 路由</a></li>
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
          <EvalLabPanel compact />
        </div>
      )}

      </div>

      {/* 高级附录 — 默认收起 */}
      <footer className="platform-advanced">
        <button type="button" className="platform-advanced-toggle" onClick={() => setShowAdvanced((v) => !v)}>
          {showAdvanced ? "▾ 收起技术附录" : "▸ 技术附录：Memory · 架构对照"}
        </button>
        {showAdvanced && (
          <div className="platform-advanced-body">
            <section className="platform-advanced-section">
              <h5>Memory · 上下文工程</h5>
              <p className="platform-advanced-lead">长期记忆存 SQLite（服务端）或 IndexedDB（离线）；Multi-Agent Planner 会读取。</p>
              <ul className="platform-mem-list compact">
                {memories.map((m) => (
                  <li key={m.key}>
                    <strong>{m.key}</strong> — {m.value}
                    <button type="button" onClick={() => void deleteMemoryAsync(m.key).then(refreshMemory)}>删</button>
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
                  await saveMemoryAsync(k, v);
                  e.currentTarget.reset();
                  refreshMemory();
                }}
              >
                <input name="key" placeholder="键，如 preferred_stack" />
                <input name="value" placeholder="值" />
                <button type="submit">写入记忆</button>
              </form>
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
