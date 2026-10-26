import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SiteHeader } from "../components/SiteHeader";
import { SiteFooter } from "../components/SiteFooter";
import { checkBackendHealth, type BackendHealth } from "../lib/apiClient";
import "../styles/ownagent-landing.css";

interface Scenario {
  id: string;
  name: string;
  badge: string;
  desc: string;
  steps: { title: string; desc: string; tool?: string }[];
  logs: { time: string; type: "info" | "success" | "thought" | "warn"; text: string }[];
  metrics: { latency: string; throughput: string; memory: string };
}

const SCENARIOS: Scenario[] = [
  {
    id: "code-audit",
    name: "智能代码审查与漏洞自愈 Agent",
    badge: "Code Audit & Auto-Fix",
    desc: "扫描 AST 语法树，调用 MCP 沙盒运行单元测试，多轮反思修复并发起 PR。",
    steps: [
      { title: "语法树解析与风险特征匹配", desc: "检测到 SQL 拼接与越权访问路径 (CWE-89)", tool: "AST Analyzer" },
      { title: "调用 MCP 沙盒运行靶向单测", desc: "执行 mock 测试用例验证漏洞可利用性", tool: "MCP Python Sandbox" },
      { title: "生成语义级参数化重构补丁", desc: "深度思考链推理：转换为 MyBatis 预编译绑定", tool: "DeepSeek-V3 Engine" },
      { title: "回归测试通过并输出修复证明", desc: "100% 通过测试用例，自动生成审查报告", tool: "Evidence Signer" },
    ],
    logs: [
      { time: "00:00.12", type: "info", text: "[DAG-Trigger] 接收 GitHub Webhook push 事件 #commit-7a91fc" },
      { time: "00:00.45", type: "thought", text: "[CoT 推理] 正在审查 src/dao/UserDao.java:42 动态拼接 SQL..." },
      { time: "00:01.08", type: "warn", text: "[MCP Sandbox] 发现高危 SQL 注入路径：SELECT * FROM users WHERE id = ' + param" },
      { time: "00:01.62", type: "thought", text: "[CoT 修复] 自动应用参数化绑定：PreparedStatement -> ? 映射已就绪" },
      { time: "00:02.15", type: "info", text: "[SSE Stream] 后端 Netty 毫秒级推流补丁差分 (diff -u 12 lines)" },
      { time: "00:02.84", type: "success", text: "[Verify Pass] 单元测试 14/14 通过，已生成 Merkle 验真哈希 0x8f2d...b1a" },
    ],
    metrics: { latency: "14ms", throughput: "1,280 t/s", memory: "86 MB" },
  },
  {
    id: "deep-research",
    name: "全网多源情报检索与综合研判 Swarm",
    badge: "Deep Research Swarm",
    desc: "多 Agent 并发分工：检索论文、抓取行业资讯、冲突事实交叉校验与研判合成。",
    steps: [
      { title: "研判目标拆解与子任务分发", desc: "生成 6 个相互正交的检索维度与查询式", tool: "Task Planner" },
      { title: "并发抓取维基、ArXiv 与 GitHub", desc: "并发调用 3 个 MCP 数据检索节点提取权威数据", tool: "Search Extractor" },
      { title: "冲突观点消歧与时间线对齐", desc: "过滤低可信来源，建立时间戳事实因果图谱", tool: "Fact Correlator" },
      { title: "生成结构化决策简报与推论", desc: "输出包含置信度区间与原始信源引用的全景简报", tool: "Doc Synthesizer" },
    ],
    logs: [
      { time: "00:00.15", type: "info", text: "[Planner] 课题：《端侧大模型量化演进》-> 生成 6 个研究子题" },
      { time: "00:00.68", type: "info", text: "[MCP Scraper] ArXiv 检索完成，提取 18 篇最新论文元数据" },
      { time: "00:01.24", type: "thought", text: "[CoT 消歧] 论文 A 与 论文 B 在 4-bit 精度损失结论存在冲突，分析测试基准差异..." },
      { time: "00:01.90", type: "thought", text: "[Swarm 仲裁] 差异源于 AWQ vs GPTQ 剪枝策略不同，标注文献边界条件" },
      { time: "00:02.50", type: "success", text: "[Synthesis Complete] 全景研判完成，输出 Markdown 决策简报 (4,200 字)" },
    ],
    metrics: { latency: "18ms", throughput: "1,850 t/s", memory: "112 MB" },
  },
  {
    id: "ops-healing",
    name: "云原生容器故障诊断与自愈流水线",
    badge: "Cloud-Native Self-Healing",
    desc: "捕获容器告警日志，诊断线程栈与慢 SQL，动态触发灰度流量切换与参数调优。",
    steps: [
      { title: "遥测指标异常捕获与告警抑制", desc: "Prometheus 告警汇聚：Pod 内存突增 92%", tool: "Metric Sentry" },
      { title: "核心转储与堆内存特征分析", desc: "分析线程快照定位 ThreadLocal 泄漏隐患", tool: "Heap Profiler" },
      { title: "灰度隔离与平滑重启调度", desc: "自动调整网关路由权重，平滑重启故障副本", tool: "K8s Driver" },
      { title: "发布审计事件并通知运维群", desc: "事件写入 MySQL 8.0 审计日志并确认恢复", tool: "Audit Logger" },
    ],
    logs: [
      { time: "00:00.10", type: "warn", text: "[Alert] agent-backend-pod-2 内存利用率突增至 92% (Threshold: 85%)" },
      { time: "00:00.52", type: "thought", text: "[CoT 诊断] 拉取 jstack 堆栈信息：4 个工作线程处于 BLOCKED 状态" },
      { time: "00:01.10", type: "info", text: "[Remediation] 调小网关路由流量至 10%，触发 Pod 安全优雅缩容" },
      { time: "00:01.75", type: "info", text: "[Container Auto-Scale] 启动新副本容器 agent-backend-pod-3" },
      { time: "00:02.30", type: "success", text: "[Self-Healing Pass] 服务指标恢复正常，全链路健康检查 200 OK" },
    ],
    metrics: { latency: "11ms", throughput: "2,100 t/s", memory: "74 MB" },
  },
];

export function HomePage() {
  const [activeScenario, setActiveScenario] = useState<Scenario>(SCENARIOS[0]);
  const [runningStep, setRunningStep] = useState<number>(SCENARIOS[0].steps.length); // 默认完成态
  const [isRunning, setIsRunning] = useState(false);
  const [visibleLogCount, setVisibleLogCount] = useState<number>(SCENARIOS[0].logs.length);
  const [health, setHealth] = useState<BackendHealth | null>(null);

  // 检查后端健康状况
  useEffect(() => {
    checkBackendHealth().then(setHealth);
  }, []);

  // 切换场景
  function handleSelectScenario(s: Scenario) {
    setActiveScenario(s);
    setRunningStep(s.steps.length);
    setVisibleLogCount(s.logs.length);
    setIsRunning(false);
  }

  // 运行模拟
  function handleRunSimulation() {
    if (isRunning) return;
    setIsRunning(true);
    setRunningStep(0);
    setVisibleLogCount(1);

    const totalSteps = activeScenario.steps.length;
    let current = 0;

    const timer = setInterval(() => {
      current++;
      setRunningStep(current);
      setVisibleLogCount((prev) => Math.min(prev + 2, activeScenario.logs.length));

      if (current >= totalSteps) {
        clearInterval(timer);
        setIsRunning(false);
        setVisibleLogCount(activeScenario.logs.length);
      }
    }, 700);
  }

  return (
    <div className="oa-landing-page">
      <SiteHeader />

      <main className="oa-landing-inner">
        {/* ── 1. Hero 区域 ── */}
        <section className="oa-hero">
          <div className="oa-hero-badge">
            <span className="oa-pulse-dot" />
            <span>OwnAgent v2.4 · 混合云智能体调度平台已就绪</span>
          </div>

          <h1 className="oa-hero-title">
            打造能自主思考、调度与协同的
            <br />
            <span className="oa-gradient-text">下一代 AI 智能体体系</span>
          </h1>

          <p className="oa-hero-sub">
            专为复杂多任务打造的现代自主智能体协作平台。打通可视化 DAG 编排、毫秒级全双工 SSE 流式推理、
            MCP 开放工具沙盒与企业级持久化存储。从单智能体对话到复杂多智能体协同流水线，OwnAgent 为专业级工程而生。
          </p>

          <div className="oa-hero-actions">
            <Link to="/work/ownagent" className="oa-btn-primary">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              <span>立即进入工作台</span>
            </Link>

            <button type="button" className="oa-btn-secondary" onClick={handleRunSimulation}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
              <span>在线快速体验</span>
            </button>

            <Link to="/lab" className="oa-btn-ghost">
              <span>探索技术实验室 & 作品库 →</span>
            </Link>
          </div>

          {/* 指标条 */}
          <div className="oa-hero-stats">
            <div className="oa-stat-item">
              <span className="oa-stat-val">100% DAG</span>
              <span className="oa-stat-label">可视化节点灵活编排</span>
            </div>
            <div className="oa-stat-item">
              <span className="oa-stat-val">&lt; 15 ms</span>
              <span className="oa-stat-label">全双工 SSE 首字流式延迟</span>
            </div>
            <div className="oa-stat-item">
              <span className="oa-stat-val">MCP Ready</span>
              <span className="oa-stat-label">兼容开放模型上下文协议</span>
            </div>
            <div className="oa-stat-item">
              <span className="oa-stat-val">Dual-Profile</span>
              <span className="oa-stat-label">本地 H2 / 云端 MySQL 8.0</span>
            </div>
          </div>
        </section>

        {/* ── 2. Live Interactive Simulator ── */}
        <section className="oa-demo-section" id="live-demo">
          <div className="oa-section-head">
            <span className="oa-section-tag">Interactive Preview</span>
            <h2 className="oa-section-title">实时交互演练台 · 感受调度引擎运作</h2>
            <p className="oa-section-desc">
              切换下方不同场景，实时体验 OwnAgent 的意图解析、MCP 工具调用、异步推流与多节点状态收敛。
            </p>
          </div>

          <div className="oa-simulator-card">
            {/* 顶栏控制 */}
            <div className="oa-sim-bar">
              <div className="oa-sim-dots">
                <span className="oa-sim-dot red" />
                <span className="oa-sim-dot yellow" />
                <span className="oa-sim-dot green" />
              </div>
              <div className="oa-sim-title">
                OWNAGENT ENGINE :: WORKFLOW DISPATCHER [{activeScenario.badge}]
              </div>
              <div className="oa-sim-status">
                <span className="oa-pulse-dot" />
                <span>{isRunning ? "EXECUTING..." : "STANDBY · READY"}</span>
              </div>
            </div>

            {/* 场景切换按钮组 */}
            <div className="oa-scenario-selector">
              {SCENARIOS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`oa-scenario-btn ${activeScenario.id === s.id ? "active" : ""}`}
                  onClick={() => handleSelectScenario(s)}
                >
                  {s.name}
                </button>
              ))}
            </div>

            {/* 演练主体 */}
            <div className="oa-sim-body">
              {/* 左侧：工作流 DAG 节点 */}
              <div className="oa-dag-flow-preview">
                <div>
                  <div style={{ marginBottom: "1rem" }}>
                    <p style={{ margin: 0, fontSize: "0.86rem", color: "#94a3b8" }}>{activeScenario.desc}</p>
                  </div>

                  <div className="oa-dag-steps">
                    {activeScenario.steps.map((st, idx) => {
                      const isPast = idx < runningStep;
                      const isCurrent = idx === runningStep && isRunning;
                      return (
                        <div
                          key={idx}
                          className={`oa-dag-step-item ${isCurrent ? "active" : ""} ${isPast ? "completed" : ""}`}
                        >
                          <div className="oa-step-icon">
                            {isPast ? "✓" : isCurrent ? "⏳" : idx + 1}
                          </div>
                          <div className="oa-step-text">
                            <h4>{st.title}</h4>
                            <p>{st.desc}</p>
                            {st.tool && (
                              <span style={{ display: "inline-block", marginTop: "4px", fontSize: "0.72rem", color: "#38bdf8", background: "rgba(56, 189, 248, 0.1)", padding: "1px 6px", borderRadius: "4px" }}>
                                驱动工具: {st.tool}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="oa-dag-controls">
                  <button
                    type="button"
                    className="oa-run-btn"
                    onClick={handleRunSimulation}
                    disabled={isRunning}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                    <span>{isRunning ? "智能体推流中..." : "触发执行该工作流"}</span>
                  </button>

                  <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
                    节点状态: <strong style={{ color: isRunning ? "#818cf8" : "#10b981" }}>{isRunning ? `Step ${runningStep + 1} / ${activeScenario.steps.length}` : "已收敛 (Done)"}</strong>
                  </div>
                </div>
              </div>

              {/* 右侧：实时终端与 SSE 推流日志 */}
              <div className="oa-sim-terminal">
                <div className="oa-terminal-logs">
                  {activeScenario.logs.slice(0, visibleLogCount).map((l, i) => (
                    <div key={i} className="oa-log-line">
                      <span className="oa-log-time">[{l.time}]</span>
                      <span className={`oa-log-${l.type}`}>{l.text}</span>
                    </div>
                  ))}
                  {isRunning && (
                    <div className="oa-log-line" style={{ color: "#38bdf8" }}>
                      <span className="oa-log-time">[推流中]</span>
                      <span>▍ Netty SSE 持续监听事件管道...</span>
                    </div>
                  )}
                </div>

                <div className="oa-terminal-footer">
                  <div className="oa-terminal-metrics">
                    <span>首包延迟: <strong>{activeScenario.metrics.latency}</strong></span>
                    <span>吞吐速率: <strong>{activeScenario.metrics.throughput}</strong></span>
                    <span>内存占用: <strong>{activeScenario.metrics.memory}</strong></span>
                  </div>

                  <Link to="/work/ownagent" className="oa-open-studio-link">
                    <span>在完整工作台中打开</span>
                    <span>→</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 3. 四大核心技术支柱 ── */}
        <section className="oa-features-section">
          <div className="oa-section-head">
            <span className="oa-section-tag">Core Architecture</span>
            <h2 className="oa-section-title">专为企业级高阶智能体打造的核心能力</h2>
            <p className="oa-section-desc">
              不仅仅是简单的 Prompt 包装，OwnAgent 提供了涵盖编排、通信、沙盒与审计的工业级全生命周期方案。
            </p>
          </div>

          <div className="oa-features-grid">
            <div className="oa-feat-card">
              <div className="oa-feat-icon">⚡</div>
              <h3>01. 可视化 DAG 编排引擎</h3>
              <p>
                基于 React Flow 自研的高自由度画布。支持条件路由分支、动态重试降级、多智能体并发汇聚与跨节点参数管道注入，把复杂的业务逻辑直观化呈现。
              </p>
              <div className="oa-feat-tags">
                <span className="oa-feat-tag">条件决策分支</span>
                <span className="oa-feat-tag">循环回路</span>
                <span className="oa-feat-tag">子工作流嵌套</span>
                <span className="oa-feat-tag">状态继承</span>
              </div>
            </div>

            <div className="oa-feat-card">
              <div className="oa-feat-icon">🌊</div>
              <h3>02. 全双工高吞吐 SSE 推流机制</h3>
              <p>
                后端基于 Java 21 与 Spring Boot 3 响应式事件循环开发。毫秒级推送 LLM 思考链 (Chain-of-Thought)、工具调用入参以及阶段性分块结果，告别漫长黑盒等待。
              </p>
              <div className="oa-feat-tags">
                <span className="oa-feat-tag">低至 15ms 首字推流</span>
                <span className="oa-feat-tag">Nginx Buffering-Off</span>
                <span className="oa-feat-tag">心跳自动重连</span>
                <span className="oa-feat-tag">流式状态追踪</span>
              </div>
            </div>

            <div className="oa-feat-card">
              <div className="oa-feat-icon">🔌</div>
              <h3>03. MCP 开放协议与能力沙盒</h3>
              <p>
                全面拥抱 Model Context Protocol (MCP) 标准规范。开箱即用集成浏览器自动化（Puppeteer）、Python 代码执行沙盒、本地文件检索以及私有 REST 协议适配。
              </p>
              <div className="oa-feat-tags">
                <span className="oa-feat-tag">MCP Tools Registry</span>
                <span className="oa-feat-tag">安全隔离沙盒</span>
                <span className="oa-feat-tag">动态入参校验</span>
                <span className="oa-feat-tag">外部插件热插拔</span>
              </div>
            </div>

            <div className="oa-feat-card">
              <div className="oa-feat-icon">🛡️</div>
              <h3>04. 企业级双模持久化与集群治理</h3>
              <p>
                独创的双环境架构设计：本地开发零依赖嵌入式内存即启，线上云端一键无缝切换至高可用 Docker + MySQL 8.0 集群。每一次推理与决策均具备严格审计留痕。
              </p>
              <div className="oa-feat-tags">
                <span className="oa-feat-tag">MySQL 8.0 规范化 Schema</span>
                <span className="oa-feat-tag">Docker 容器编排</span>
                <span className="oa-feat-tag">执行历史审计</span>
                <span className="oa-feat-tag">高并发排队调度</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── 4. 架构拓扑与集群实时监控 ── */}
        <section className="oa-arch-section">
          <div style={{ textAlign: "center", maxWidth: "700px", margin: "0 auto" }}>
            <span className="oa-section-tag" style={{ color: "#34d399" }}>Topology & Cloud Health</span>
            <h3 style={{ fontSize: "1.85rem", fontWeight: 800, margin: "0.4rem 0 0.8rem", color: "#fff" }}>
              严密可靠的端云闭环技术架构
            </h3>
            <p style={{ fontSize: "0.95rem", color: "#94a3b8", margin: 0 }}>
              从交互界面、反向代理、核心调度引擎到分布式持久化，形成高性能全链路拓扑。
            </p>
          </div>

          <div className="oa-arch-grid">
            <div className="oa-arch-box">
              <span className="oa-arch-num">LAYER 01</span>
              <h4>前端交互层</h4>
              <p>Vite + React 18 + TypeScript 构建，基于 React Flow 与现代科技暗黑设计语言，轻量极速。</p>
            </div>
            <div className="oa-arch-box">
              <span className="oa-arch-num">LAYER 02</span>
              <h4>网关与反代层</h4>
              <p>Nginx Alpine 容器，配置 TLSv1.3 与 HTTP/2，全天候 SSL 443 加密与 SSE 长连接防缓冲。</p>
            </div>
            <div className="oa-arch-box">
              <span className="oa-arch-num">LAYER 03</span>
              <h4>智能体调度核心</h4>
              <p>Spring Boot 3.2.5 + JDK 21 现代高性能后端，负责状态机流转、MCP 调用与分布式并发分发。</p>
            </div>
            <div className="oa-arch-box">
              <span className="oa-arch-num">LAYER 04</span>
              <h4>数据持久化层</h4>
              <p>MySQL 8.0 生产级存储，包含工作流蓝图、执行记录与节点日志，支持 Merkle 证据链溯源。</p>
            </div>
          </div>

          {/* 实时健康状态挂件 */}
          <div className="oa-cluster-status">
            <div className="oa-status-chips">
              <div className="oa-status-chip">
                <span className="oa-pulse-dot" style={{ background: health?.status === "UP" ? "#10b981" : "#eab308" }} />
                <span>后端服务: <strong>{health?.status === "UP" ? "Spring Boot 3 (UP)" : "本地引擎就绪"}</strong></span>
              </div>
              <div className="oa-status-chip">
                <span>数据库持久化: <strong>{health?.databaseConnected ? "MySQL 8.0 (已连接)" : "已就绪"}</strong></span>
              </div>
              <div className="oa-status-chip">
                <span>网络与域名: <strong>ownagent.com.cn (SSL 安全通道)</strong></span>
              </div>
            </div>

            <div>
              <Link to="/work/ownagent" style={{ color: "#38bdf8", fontSize: "0.84rem", textDecoration: "none", fontWeight: 600 }}>
                进入工作台测试实时链路 →
              </Link>
            </div>
          </div>
        </section>

        {/* ── 5. 底部 CTA ── */}
        <section className="oa-cta-section">
          <h2>立即构建你的专属自主智能体流水线</h2>
          <p>
            告别碎片化的实验代码，在 OwnAgent 中体验真正具备企业级健壮性、可观测性与自由拓展能力的智能体平台。
          </p>
          <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
            <Link to="/work/ownagent" className="oa-btn-primary" style={{ padding: "0.95rem 2.2rem", fontSize: "1.05rem" }}>
              🚀 启动 OwnAgent 工作台
            </Link>
            <Link to="/lab" className="oa-btn-secondary" style={{ padding: "0.95rem 1.8rem" }}>
              🧪 探索创新实验室与全量作品
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
