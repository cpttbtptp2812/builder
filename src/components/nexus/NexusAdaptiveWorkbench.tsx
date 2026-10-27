import React, { useState, useEffect, useRef } from "react";
import {
  Terminal as TerminalIcon,
  Cpu,
  Layers,
  Sparkles,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Check,
  ChevronRight,
  Send,
  Zap,
  Clock,
  FileText,
  Download,
  Flame,
  ArrowRight,
  Database,
  ExternalLink,
  Sliders,
  Eye,
  RefreshCw
} from "lucide-react";

// ─── 核心类型定义 ─────────────────────────────────────────────────────────────

export interface StepItem {
  id: string;
  index: number;
  title: string;
  description: string;
  status: "pending" | "running" | "waiting_approval" | "success" | "failed";
  command?: string;
  durationMs?: number;
  isHighRisk?: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  thinking?: string;
  approvalTicket?: {
    ticketId: string;
    stepId: string;
    command: string;
    riskLevel: "HIGH" | "CRITICAL";
    reason: string;
    diffPreview: string;
    expiresIn: number;
  };
}

// ─── 预设的三大个人真实接地气场景 ─────────────────────────────────────────────

const PRESET_SCENARIOS = [
  {
    id: "repo_fix",
    icon: Flame,
    tag: "代码试跑与自愈",
    title: "克隆报错的 Node.js 仓库并修复单测",
    prompt: "帮我把出报错的开源 Node.js 仓库拉下来，安装依赖跑单测，找出报错根因并把修复代码改好。",
    hasHighRisk: true,
    steps: [
      {
        id: "step_1",
        index: 0,
        title: "沙箱内 Git 克隆与依赖安装",
        description: "在轻量 Alpine 隔离容器内克隆代码库并执行 npm install",
        status: "pending" as const,
        command: "git clone https://github.com/demo/repo-demo.git && cd repo-demo && npm install --silent",
        durationMs: 820
      },
      {
        id: "step_2",
        index: 1,
        title: "运行单元测试并捕获报错调用栈",
        description: "执行 npm test 捕获并解析 AST 语法与异常断言栈",
        status: "pending" as const,
        command: "npm test -- --reporter=spec",
        durationMs: 1450
      },
      {
        id: "step_3",
        index: 2,
        title: "自主生成补丁代码并实施热修复",
        description: "分析 TypeError 根因，修改 ./src/dbClient.ts 的空指针兼容逻辑",
        status: "pending" as const,
        command: "sed -i 's/this.conn.query/this.conn?.query ?? null/g' ./src/dbClient.ts && npm test",
        durationMs: 980
      },
      {
        id: "step_4",
        index: 3,
        title: "强推代码到远程仓库 (触发 AST 拦截)",
        description: "尝试执行带破坏性的 git push --force 远程覆盖操作",
        status: "pending" as const,
        command: "git push origin main --force",
        isHighRisk: true,
        durationMs: 400
      }
    ],
    terminalLogs: [
      "\u001b[36m[DOCKER]\u001b[0m Allocating warm container: sbx-alpine-worker-01 (Mem: 512MB, CPU: 1.0)",
      "\u001b[32m[SANDBOX]\u001b[0m Workspace bound: /tmp/nexus_workspace/repo-demo -> /workspace",
      "$ git clone https://github.com/demo/repo-demo.git /workspace/repo-demo",
      "Cloning into '/workspace/repo-demo'...",
      "remote: Enumerating objects: 42, done.",
      "remote: Total 42 (delta 18), reused 39 (delta 15)",
      "Unpacking objects: 100% (42/42), done.",
      "$ cd /workspace/repo-demo && npm install --silent",
      "\u001b[32m[OK]\u001b[0m added 84 packages in 1.42s",
      "\u001b[33m[STEP 2: RUNNING TEST SUITE]\u001b[0m",
      "$ npm test -- --reporter=spec",
      "  DB Connection Pool",
      "    ✔ should initialize credentials securely",
      "    \u001b[31m✖ should fallback gracefully on empty connection string\u001b[0m",
      "      TypeError: Cannot read properties of undefined (reading 'query')",
      "        at DbPool.query (/workspace/repo-demo/src/dbClient.ts:48:19)",
      "        at Context.<anonymous> (test/db.spec.ts:24:14)",
      "\u001b[31m[FAILED]\u001b[0m 1 of 8 tests failed. Exit code: 1",
      "\u001b[35m[REFLECTOR]\u001b[0m Triggering auto-fix generator for dbClient.ts:48",
      "$ sed -i 's/this.conn.query/this.conn?.query ?? null/g' ./src/dbClient.ts",
      "$ npm test",
      "  DB Connection Pool",
      "    ✔ should initialize credentials securely",
      "    \u001b[32m✔ should fallback gracefully on empty connection string\u001b[0m (18ms)",
      "\u001b[32m[SUCCESS]\u001b[0m 8 of 8 tests passed! Unit tests 100% GREEN.",
      "\u001b[31m[GUARDRAIL INTERCEPT]\u001b[0m AST Parser detected High-Risk verb: 'git push --force'",
      "\u001b[31m[BLOCKED]\u001b[0m Operation suspended. Waiting for developer manual approval..."
    ],
    report: `### 🎯 开源项目单测自愈交付报告

- **目标仓库**: \`demo/repo-demo (Node.js / TypeScript)\`
- **执行环境**: Alpine Linux 3.20 (Docker 隔离沙箱, 内存限制: 512MB)
- **单测状态**: \`8 / 8 全部通过 (100% Green)\`

#### 🐛 根因分析 (Root Cause)
在 \`src/dbClient.ts\` 第 48 行中，未对连接池空状态做空值安全调用，当读取异常环境配置时直接抛出：
\`TypeError: Cannot read properties of undefined (reading 'query')\`

#### 🛠️ 修复补丁 (Patch Diff)
\`\`\`diff
- return this.conn.query(sql);
+ return this.conn?.query(sql) ?? null;
\`\`\`

#### 🛡️ 安全合规留存
- 自动检测并成功拦截了未受保护的 \`git push --force\` 越权命令。
- 修复补丁已在沙箱隔离区暂存，单测回归全绿。`
  },
  {
    id: "data_harvest",
    icon: Database,
    tag: "数据清洗抓取",
    title: "自主抓取开源 AI 项目 Star 榜并生成分析",
    prompt: "帮我自动编写脚本抓取最近 7 天热门开源 AI Agent 项目，清洗生成增长榜与分析图表。",
    hasHighRisk: false,
    steps: [
      {
        id: "step_1",
        index: 0,
        title: "生成并校验数据抓取 Python 脚本",
        description: "在沙箱内构建带速率限制与重试机制的解析器",
        status: "pending" as const,
        command: "cat << 'EOF' > /workspace/harvest.py\nimport json, sys\nprint('Harvesting GitHub API trends...')\nEOF",
        durationMs: 450
      },
      {
        id: "step_2",
        index: 1,
        title: "执行数据抓取与 Schema 标准化",
        description: "抓取 10 个热门 Agent 仓库的 Star 增量与 License",
        status: "pending" as const,
        command: "python3 /workspace/harvest.py",
        durationMs: 1200
      },
      {
        id: "step_3",
        index: 2,
        title: "生成数据透视指标与最终报告",
        description: "聚合数据生成结构化 Markdown 表格与核心结论",
        status: "pending" as const,
        command: "python3 -c 'print(\"Aggregation completed. 10 repos indexed.\")'",
        durationMs: 650
      }
    ],
    terminalLogs: [
      "\u001b[36m[SANDBOX]\u001b[0m Spawning python3 runtime in isolated container...",
      "$ cat << 'EOF' > /workspace/harvest.py",
      "$ python3 /workspace/harvest.py",
      "[INFO] Querying GitHub Trending API (Topic: 'ai-agent', Sort: 'stars')...",
      "\u001b[32m[200 OK]\u001b[0m Fetched 10 repositories metadata in 840ms",
      "  - open-claw/openclaw: +4,210 stars this week (License: MIT)",
      "  - agent-kernel/runtime: +2,890 stars this week (License: Apache-2.0)",
      "  - autonomous/desktop: +1,750 stars this week (License: MIT)",
      "$ python3 /workspace/transform.py --format=markdown",
      "\u001b[32m[SUCCESS]\u001b[0m Exported structured data to /workspace/output.md"
    ],
    report: `### 📈 本周开源 AI Agent 热门增长榜报告

| 排名 | 项目名 | 本周新增 Stars | 核心方向 | 授权协议 |
| :--- | :--- | :--- | :--- | :--- |
| **Top 1** | \`open-claw/openclaw\` | **+4,210** | 个人电脑自动化与端侧控制 | MIT |
| **Top 2** | \`nexus-agent/runtime\` | **+2,890** | 隔离沙箱与 AST 护栏智能体内核 | Apache-2.0 |
| **Top 3** | \`devin-lite/workspace\` | **+1,750** | 双平面代码自主重构工作台 | MIT |

#### 💡 核心洞察 (Insights)
1. **沙箱安全与特权隔离** 成为 2025/2026 年自主智能体最大的增长关注点（增幅超 320%）；
2. 开发者极度青睐具备 **“物理沙箱隔离 + 开发者确认审批”** 的个人 Agent，纯黑盒聊天助手关注度持续走低。`
  },
  {
    id: "env_clean",
    icon: ShieldAlert,
    tag: "环境体检与清理",
    title: "安全排查废弃缓存并清理无效进程",
    prompt: "帮我排查当前开发环境中占满磁盘的大体积废弃缓存，以及占用关键端口的僵尸进程。",
    hasHighRisk: true,
    steps: [
      {
        id: "step_1",
        index: 0,
        title: "只读扫描端口占用与僵尸进程",
        description: "探测当前系统处于 LISTEN 状态的冲突服务与 PID",
        status: "pending" as const,
        command: "ps aux | grep -E 'node|python' | awk '{print $2, $11}'",
        durationMs: 380
      },
      {
        id: "step_2",
        index: 1,
        title: "分析 npm / pip 缓存体积与废弃包",
        description: "定位大于 1GB 的无引用构建残余文件",
        status: "pending" as const,
        command: "du -sh ~/.cache/ ~/.npm 2>/dev/null",
        durationMs: 720
      },
      {
        id: "step_3",
        index: 2,
        title: "强力递归清除系统缓存 (触发 AST 拦截)",
        description: "尝试执行破坏性全局文件删除命令",
        status: "pending" as const,
        command: "rm -rf ~/.cache/* && kill -9 29401",
        isHighRisk: true,
        durationMs: 350
      }
    ],
    terminalLogs: [
      "$ ps aux | grep -E 'node|python'",
      "29401 /usr/local/bin/node /zombie/worker.js (CPU: 0.1%, Port: 8080 collision)",
      "$ du -sh ~/.cache/ ~/.npm 2>/dev/null",
      "1.8G    ~/.cache/",
      "940M    ~/.npm",
      "\u001b[31m[GUARDRAIL ALERT]\u001b[0m AST Parser detected: 'rm -rf ~/.cache/*' & 'kill -9'",
      "\u001b[31m[BLOCKED]\u001b[0m Destructive system clean command intercepted. Awaiting authorization..."
    ],
    report: `### 🛡️ 个人环境健康体检报告

- **检测发现**:
  - 发现 1 个占用 8080 端口的历史孤儿进程 (PID: \`29401\`)
  - 发现 \`2.74 GB\` 的无引用旧构建废弃缓存
- **安全处置**:
  - 高危破坏性清空指令被安全护栏成功拦截；
  - 经人工授权后，安全释放 2.74GB 磁盘空间，恢复端口监听。`
  }
];

export default function NexusAdaptiveWorkbench() {
  // ─── 状态管理 ─────────────────────────────────────────────────────────────
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>("repo_fix");
  const [activeTab, setActiveTab] = useState<"topology" | "terminal" | "timetravel" | "report">("topology");
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [currentStepIdx, setCurrentStepIdx] = useState<number>(0);
  const [inputPrompt, setInputPrompt] = useState<string>(PRESET_SCENARIOS[0].prompt);

  // 双平面对话流与步骤
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [steps, setSteps] = useState<StepItem[]>(PRESET_SCENARIOS[0].steps);
  const [terminalLines, setTerminalLines] = useState<string[]>([]);
  const [finalReport, setFinalReport] = useState<string>("");

  // 审批单与挂起状态
  const [activeTicket, setActiveTicket] = useState<ChatMessage["approvalTicket"] | null>(null);
  const [isSuspended, setIsSuspended] = useState<boolean>(false);
  const [ticketCountdown, setTicketCountdown] = useState<number>(1795);

  // Telemetry 遥测指标
  const [ttftMs, setTtftMs] = useState<number>(142);
  const [cacheHit, setCacheHit] = useState<boolean>(false);
  const [tokenCount, setTokenCount] = useState<number>(3420);
  const [costUsd, setCostUsd] = useState<number>(0.0051);

  // 时间旅行快照
  const [timeTravelStep, setTimeTravelStep] = useState<number>(0);

  const terminalEndRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // 自动滚动
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [terminalLines]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 倒计时计时器
  useEffect(() => {
    if (!isSuspended || !activeTicket) return;
    const interval = setInterval(() => {
      setTicketCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [isSuspended, activeTicket]);

  // 切换预设场景
  const handleSelectScenario = (id: string) => {
    const sc = PRESET_SCENARIOS.find((s) => s.id === id);
    if (!sc) return;
    setSelectedScenarioId(id);
    setInputPrompt(sc.prompt);
    setSteps(sc.steps);
    setMessages([]);
    setTerminalLines([]);
    setFinalReport("");
    setActiveTicket(null);
    setIsSuspended(false);
    setIsRunning(false);
    setCurrentStepIdx(0);
    setActiveTab("topology");
    setCacheHit(false);
  };

  // ─── 执行主流程 (模拟真实状态机与双平面自适应演变) ───────────────────────────
  const handleStartRun = () => {
    if (isRunning) return;
    const currentScenario = PRESET_SCENARIOS.find((s) => s.id === selectedScenarioId)!;

    setIsRunning(true);
    setIsSuspended(false);
    setActiveTicket(null);
    setCurrentStepIdx(0);
    setFinalReport("");
    setTerminalLines([]);
    setTimeTravelStep(0);

    // 第一次 MISS，如果再次跑则 HIT
    if (messages.length > 0) {
      setCacheHit(true);
    } else {
      setCacheHit(false);
    }

    // 1. 发送用户消息
    const userMsg: ChatMessage = {
      id: "msg_" + Date.now(),
      role: "user",
      content: inputPrompt,
      timestamp: new Date().toLocaleTimeString()
    };

    setMessages([userMsg]);
    setSteps(currentScenario.steps.map((st) => ({ ...st, status: "pending" })));

    // 右侧活动画布自动自适应聚焦到【拓扑图】
    setActiveTab("topology");

    // 2. Agent 思考中并回复
    setTimeout(() => {
      const assistantMsg: ChatMessage = {
        id: "msg_" + (Date.now() + 1),
        role: "assistant",
        content: `已接收任务意图。已自动激活轻量 Alpine 隔离沙箱并生成 ${currentScenario.steps.length} 步执行拓扑。右侧已实时同步呈现。`,
        thinking: "正在比对历史相似任务 SOP... 正在生成安全的隔离工作区 /tmp/nexus_workspace...",
        timestamp: new Date().toLocaleTimeString()
      };
      setMessages((prev) => [...prev, assistantMsg]);

      // 推进 Step 1
      runStepPipeline(0, currentScenario);
    }, 600);
  };

  // 运行具体步骤
  const runStepPipeline = (stepIdx: number, scenario: typeof PRESET_SCENARIOS[0]) => {
    if (stepIdx >= scenario.steps.length) {
      // 全部完成，收敛
      finishRun(scenario);
      return;
    }

    const currentStep = scenario.steps[stepIdx];
    setCurrentStepIdx(stepIdx);
    setTimeTravelStep(stepIdx);

    // 更新当前步骤状态为 running
    setSteps((prev) =>
      prev.map((s, idx) => (idx === stepIdx ? { ...s, status: "running" } : s))
    );

    // 右侧自适应平滑切换到【PTY 终端】
    setActiveTab("terminal");

    // 如果该步骤是高危操作（Step 4 / Step 3）
    if (currentStep.isHighRisk) {
      setTimeout(() => {
        // 标记为 waiting_approval
        setSteps((prev) =>
          prev.map((s, idx) => (idx === stepIdx ? { ...s, status: "waiting_approval" } : s))
        );

        // 终端打出告警
        setTerminalLines((prev) => [
          ...prev,
          `\u001b[31m[AST GUARDRAIL INTERCEPT]\u001b[0m High-Risk command intercepted: '${currentStep.command}'`,
          "\u001b[31m[SUSPENDED]\u001b[0m Worker thread released. Awaiting developer approval ticket..."
        ]);

        // 左侧对话流就地升起红牌审批卡片
        const ticketData: ChatMessage["approvalTicket"] = {
          ticketId: "tkt_" + Math.random().toString(36).substring(2, 8),
          stepId: currentStep.id,
          command: currentStep.command || "git push origin main --force",
          riskLevel: "CRITICAL",
          reason: "检测到可能引发代码丢失或环境破坏的强推/全局删除操作，已被 AST 语法分析引擎物理阻断。",
          diffPreview: "- status: safe_sandbox\n+ remote_target: origin/main (OVERWRITE)\n+ destructive_flag: --force",
          expiresIn: 1800
        };

        setActiveTicket(ticketData);
        setIsSuspended(true);

        const approvalMsg: ChatMessage = {
          id: "msg_approval_" + Date.now(),
          role: "assistant",
          content: "⚠️ **安全护栏触发！** 检测到即将执行高危指令，系统已物理挂起并释放执行线程。请审批是否授权放行：",
          timestamp: new Date().toLocaleTimeString(),
          approvalTicket: ticketData
        };
        setMessages((prev) => [...prev, approvalMsg]);
      }, 800);
      return;
    }

    // 正常安全步骤：逐行输出终端日志
    let logSliceStart = stepIdx * 5;
    let logSliceEnd = logSliceStart + 6;
    let newLogs = scenario.terminalLogs.slice(logSliceStart, logSliceEnd);

    let delay = 0;
    newLogs.forEach((line) => {
      delay += 120;
      setTimeout(() => {
        setTerminalLines((prev) => [...prev, line]);
      }, delay);
    });

    setTimeout(() => {
      // 标记完成
      setSteps((prev) =>
        prev.map((s, idx) => (idx === stepIdx ? { ...s, status: "success" } : s))
      );
      // 下一步
      runStepPipeline(stepIdx + 1, scenario);
    }, delay + 400);
  };

  // 用户点击批准审批
  const handleApproveTicket = () => {
    if (!activeTicket) return;
    setIsSuspended(false);
    const scenario = PRESET_SCENARIOS.find((s) => s.id === selectedScenarioId)!;

    // 终端打出放行日志
    setTerminalLines((prev) => [
      ...prev,
      `\u001b[32m[APPROVAL VERIFIED]\u001b[0m Ticket ${activeTicket.ticketId} authorized by developer. Resuming state machine...`,
      `$ ${activeTicket.command}`,
      "\u001b[32m[SUCCESS]\u001b[0m Action committed safely. Exit code: 0."
    ]);

    // 更新步骤为成功
    setSteps((prev) =>
      prev.map((s, idx) => (idx === currentStepIdx ? { ...s, status: "success" } : s))
    );

    setActiveTicket(null);

    // 发送审批通过消息
    setMessages((prev) => [
      ...prev,
      {
        id: "msg_approved_" + Date.now(),
        role: "system",
        content: `⚡ 审批单 **${activeTicket.ticketId}** 已由开发者手动批准，状态机恢复执行并完成闭环。`,
        timestamp: new Date().toLocaleTimeString()
      }
    ]);

    // 收尾
    setTimeout(() => {
      finishRun(scenario);
    }, 600);
  };

  // 用户点击拒绝审批
  const handleRejectTicket = () => {
    if (!activeTicket) return;
    setIsSuspended(false);
    const scenario = PRESET_SCENARIOS.find((s) => s.id === selectedScenarioId)!;

    // 终端打出拒绝日志
    setTerminalLines((prev) => [
      ...prev,
      `\u001b[33m[REJECTED]\u001b[0m Ticket ${activeTicket.ticketId} rejected by developer. Aborting dangerous action...`,
      "\u001b[35m[GRACEFUL EXIT]\u001b[0m State machine skipped dangerous command and proceeded to report generation."
    ]);

    // 更新步骤为 skipped
    setSteps((prev) =>
      prev.map((s, idx) => (idx === currentStepIdx ? { ...s, status: "skipped" as any } : s))
    );

    setActiveTicket(null);

    setMessages((prev) => [
      ...prev,
      {
        id: "msg_rejected_" + Date.now(),
        role: "system",
        content: `❌ 高危指令已由开发者拒绝执行。系统已优雅跳过破坏性改动，正在生成最终安全归因总结。`,
        timestamp: new Date().toLocaleTimeString()
      }
    ]);

    setTimeout(() => {
      finishRun(scenario);
    }, 600);
  };

  // 全任务完成结算
  const finishRun = (scenario: typeof PRESET_SCENARIOS[0]) => {
    setIsRunning(false);
    setFinalReport(scenario.report);
    // 右侧活动画布自动平滑切换到【最终交付报告】
    setActiveTab("report");

    setMessages((prev) => [
      ...prev,
      {
        id: "msg_done_" + Date.now(),
        role: "assistant",
        content: "🎉 **任务全流程闭环执行完毕！** 右侧活动画布已自动渲染出结构化交付报告与修复结果。你可以点击上方 Tab 查看完整沙箱终端日志或拖动滑块查看历史快照。",
        timestamp: new Date().toLocaleTimeString()
      }
    ]);
  };

  // 时间旅行快照回放
  const handleTimeTravel = (stepIdx: number) => {
    setTimeTravelStep(stepIdx);
    setActiveTab("terminal");
    const scenario = PRESET_SCENARIOS.find((s) => s.id === selectedScenarioId)!;
    const historicalLogs = scenario.terminalLogs.slice(0, (stepIdx + 1) * 6);
    setTerminalLines([
      `\u001b[35m[TIME-TRAVEL SNAPSHOT]\u001b[0m Showing historical state at Step ${stepIdx + 1}: ${scenario.steps[stepIdx]?.title}`,
      "--------------------------------------------------",
      ...historicalLogs
    ]);
  };

  return (
    <div className="flex flex-col h-screen w-full bg-[#0B0F17] text-gray-200 font-sans overflow-hidden select-none">
      {/* ─── 顶部飞行仪表盘 (Telemetry Bar) ─────────────────────────────────── */}
      <header className="h-14 border-b border-gray-800/80 bg-[#0E131F]/90 backdrop-blur px-5 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Cpu className="w-4 h-4 text-white" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-wide text-white">NexusClaw</span>
              <span className="text-[10px] bg-cyan-950/80 text-cyan-400 border border-cyan-800/50 px-1.5 py-0.5 rounded font-mono font-medium">
                v4.0.0 Autonomous
              </span>
            </div>
            <span className="text-[11px] text-gray-400">个人安全自治智能体运行时 · 物理沙箱隔离</span>
          </div>
        </div>

        {/* 遥测数据芯片组 */}
        <div className="flex items-center gap-4 text-xs font-mono">
          {/* TTFT */}
          <div className="flex items-center gap-1.5 bg-gray-900/80 border border-gray-800 px-2.5 py-1 rounded-md text-gray-300">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-gray-500">TTFT:</span>
            <span className="text-cyan-300 font-semibold">{ttftMs}ms</span>
          </div>

          {/* Cache 状态 */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-all ${
              cacheHit
                ? "bg-emerald-950/40 border-emerald-500/50 text-emerald-300 shadow-sm shadow-emerald-500/20"
                : "bg-gray-900/80 border-gray-800 text-gray-400"
            }`}
          >
            <Zap className={`w-3.5 h-3.5 ${cacheHit ? "text-emerald-400 fill-emerald-400" : "text-gray-500"}`} />
            <span className="text-gray-500">Cache:</span>
            <span className={cacheHit ? "text-emerald-300 font-bold" : "text-gray-400"}>
              {cacheHit ? "HIT 🟢 (0ms Plan)" : "MISS"}
            </span>
          </div>

          {/* 容器隔离状态 */}
          <div className="flex items-center gap-1.5 bg-gray-900/80 border border-gray-800 px-2.5 py-1 rounded-md text-gray-300">
            <ShieldAlert className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-gray-500">Sandbox:</span>
            <span className="text-blue-300">Alpine-cgroups 🟢</span>
          </div>

          {/* Token & Cost */}
          <div className="hidden lg:flex items-center gap-2 bg-gray-900/80 border border-gray-800 px-2.5 py-1 rounded-md text-gray-300">
            <span className="text-gray-500">Tokens:</span>
            <span className="text-yellow-400 font-medium">{tokenCount}</span>
            <span className="text-gray-600">|</span>
            <span className="text-gray-500">Cost:</span>
            <span className="text-emerald-400 font-medium">${costUsd}</span>
          </div>
        </div>
      </header>

      {/* ─── 主体工作台 (双平面动静解耦布局) ─────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* ◀ 左侧控制平面 (Control Plane: 伴随式自然对话 + 决策挂起) ───────────── */}
        <section className="w-full lg:w-[480px] xl:w-[520px] flex flex-col border-r border-gray-800/80 bg-[#0C101A] shrink-0">
          {/* 场景快速选择栏 */}
          <div className="p-3 border-b border-gray-800/60 bg-[#0E1422]/60 flex flex-col gap-2 shrink-0">
            <div className="flex items-center justify-between text-xs text-gray-400 px-1">
              <span className="flex items-center gap-1.5 font-medium">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> 真实自主场景体验
              </span>
              <span className="text-[10px] text-gray-500">点击即刻载入</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {PRESET_SCENARIOS.map((sc) => {
                const isSelected = selectedScenarioId === sc.id;
                const IconComponent = sc.icon;
                return (
                  <button
                    key={sc.id}
                    onClick={() => handleSelectScenario(sc.id)}
                    className={`flex flex-col items-start p-2 rounded-lg border text-left transition-all ${
                      isSelected
                        ? "bg-cyan-950/40 border-cyan-500/60 shadow-sm shadow-cyan-500/10 text-white"
                        : "bg-gray-900/50 border-gray-800 hover:border-gray-700 text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <IconComponent
                        className={`w-3.5 h-3.5 ${isSelected ? "text-cyan-400" : "text-gray-500"}`}
                      />
                      <span className="text-[10px] font-semibold">{sc.tag}</span>
                    </div>
                    <span className="text-[11px] line-clamp-1 leading-tight font-medium">
                      {sc.title}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 消息滚动区 (包含对话气泡、思维链、AST 红牌卡片) */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-500 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center text-cyan-400">
                  <Cpu className="w-6 h-6 animate-pulse" />
                </div>
                <h4 className="text-sm font-semibold text-gray-300">NexusClaw 自治运行时已就绪</h4>
                <p className="text-xs max-w-xs text-gray-400 leading-relaxed">
                  你可以直接输入任务，或在上方的 3 个场景中选择一个。Agent 将在右侧沙箱中自主执行、实时捕获终端并在遇到高危动作时向你请示。
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                const isUser = msg.role === "user";
                const isSystem = msg.role === "system";

                if (isSystem) {
                  return (
                    <div
                      key={msg.id}
                      className="p-2.5 rounded-lg bg-gray-900/80 border border-gray-800 text-xs text-gray-400 flex items-center gap-2"
                    >
                      <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span>{msg.content}</span>
                    </div>
                  );
                }

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col space-y-2 ${isUser ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`max-w-[90%] rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-sm ${
                        isUser
                          ? "bg-cyan-600 text-white rounded-br-sm"
                          : "bg-gray-900/90 border border-gray-800 text-gray-200 rounded-bl-sm"
                      }`}
                    >
                      {/* 思维链折叠提示 */}
                      {msg.thinking && (
                        <div className="mb-2 p-2 rounded bg-black/40 border border-cyan-900/30 text-[11px] text-cyan-300 flex items-start gap-1.5 font-mono">
                          <Cpu className="w-3.5 h-3.5 mt-0.5 shrink-0 text-cyan-400 animate-spin" />
                          <span>{msg.thinking}</span>
                        </div>
                      )}
                      <div>{msg.content}</div>

                      {/* 🌟 核心：就地原位升起的 AST 高危拦截红牌审批卡片 ───────────── */}
                      {msg.approvalTicket && (
                        <div className="mt-3 p-3.5 rounded-xl bg-red-950/30 border-2 border-red-500/70 shadow-lg shadow-red-950/50 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-red-400 font-bold text-xs">
                              <ShieldAlert className="w-4 h-4 animate-bounce" />
                              <span>AST 拦截到高危破坏性动作 [CRITICAL]</span>
                            </div>
                            <span className="text-[10px] font-mono bg-red-900/60 text-red-200 px-1.5 py-0.5 rounded border border-red-700/60">
                              倒计时: {ticketCountdown}s
                            </span>
                          </div>

                          <div className="bg-black/60 rounded p-2 border border-red-900/40 font-mono text-[11px] text-red-300 break-all">
                            $ {msg.approvalTicket.command}
                          </div>

                          <p className="text-[11px] text-gray-300 leading-normal">
                            {msg.approvalTicket.reason}
                          </p>

                          {/* 变更 Diff 预览 */}
                          {msg.approvalTicket.diffPreview && (
                            <div className="p-2 rounded bg-black/50 border border-gray-800 font-mono text-[10px] text-gray-300 space-y-0.5">
                              <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">
                                安全 Diff 变更预览:
                              </div>
                              <pre className="text-gray-300 whitespace-pre-wrap">
                                {msg.approvalTicket.diffPreview}
                              </pre>
                            </div>
                          )}

                          {/* 审批动作按钮 */}
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              onClick={handleRejectTicket}
                              className="flex-1 py-1.5 px-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium text-xs transition-colors flex items-center justify-center gap-1.5"
                            >
                              <span>❌ 拒绝执行</span>
                            </button>
                            <button
                              onClick={handleApproveTicket}
                              className="flex-1 py-1.5 px-3 rounded-lg bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-bold text-xs shadow-md shadow-red-600/30 transition-all flex items-center justify-center gap-1.5"
                            >
                              <span>⚡ 授权批准并唤醒</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-600 px-1">{msg.timestamp}</span>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>

          {/* 自由输入交互框 (永不死锁，随时可打字) */}
          <div className="p-3 border-t border-gray-800/80 bg-[#0E131F]/90">
            <div className="relative flex items-center">
              <input
                type="text"
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleStartRun()}
                disabled={isRunning && !isSuspended}
                placeholder="输入你的自主开发指令或排障要求..."
                className="w-full bg-gray-900/90 border border-gray-800 focus:border-cyan-500/80 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 outline-none pr-20 transition-all"
              />
              <button
                onClick={handleStartRun}
                disabled={isRunning}
                className={`absolute right-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                  isRunning
                    ? "bg-gray-800 text-gray-500 cursor-not-allowed"
                    : "bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-600/30"
                }`}
              >
                {isRunning ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>执行中</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>下发</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </section>

        {/* ▶ 右侧自适应活动画布 (Active Workspace: 随需自动演变) ─────────────── */}
        <main className="flex-1 flex flex-col bg-[#070A10] overflow-hidden">
          {/* 画布顶部导航视窗标签 */}
          <nav className="h-11 border-b border-gray-800/80 bg-[#0A0E17] px-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveTab("topology")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
                  activeTab === "topology"
                    ? "bg-cyan-950/60 text-cyan-300 border border-cyan-800/50 shadow-sm"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>动态 DAG 拓扑</span>
                <span className="text-[10px] bg-gray-800/60 px-1 rounded text-gray-400 font-mono">
                  {steps.filter((s) => s.status === "success").length}/{steps.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab("terminal")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
                  activeTab === "terminal"
                    ? "bg-cyan-950/60 text-cyan-300 border border-cyan-800/50 shadow-sm"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                <TerminalIcon className="w-3.5 h-3.5" />
                <span>Linux PTY 终端</span>
                {isRunning && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />}
              </button>

              <button
                onClick={() => setActiveTab("timetravel")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
                  activeTab === "timetravel"
                    ? "bg-cyan-950/60 text-cyan-300 border border-cyan-800/50 shadow-sm"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>时间旅行快照</span>
              </button>

              <button
                onClick={() => setActiveTab("report")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
                  activeTab === "report"
                    ? "bg-cyan-950/60 text-cyan-300 border border-cyan-800/50 shadow-sm"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>交付归因报告</span>
                {finalReport && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
              <span>Docker: sbx-alpine-sec</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            </div>
          </nav>

          {/* 画布主内容切换区 */}
          <div className="flex-1 overflow-hidden relative">
            {/* 1. 动态 DAG 拓扑图视窗 */}
            {activeTab === "topology" && (
              <div className="h-full overflow-y-auto p-6 flex flex-col justify-center max-w-2xl mx-auto space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-cyan-400" />
                    <span>DAG 状态拓扑执行链路</span>
                  </h3>
                  <span className="text-xs text-gray-500 font-mono">
                    Session: ses_88a9f02c · StateGraph v3
                  </span>
                </div>

                <div className="space-y-3 relative">
                  {/* 连接线背景 */}
                  <div className="absolute left-[19px] top-6 bottom-6 w-0.5 bg-gray-800/80 -z-0" />

                  {steps.map((st, idx) => {
                    const isSuccess = st.status === "success";
                    const isRunningStep = st.status === "running";
                    const isWaiting = st.status === "waiting_approval";
                    const isPending = st.status === "pending";

                    return (
                      <div
                        key={st.id}
                        className={`relative z-10 flex items-start gap-4 p-4 rounded-xl border transition-all ${
                          isRunningStep
                            ? "bg-cyan-950/30 border-cyan-500 shadow-lg shadow-cyan-500/10"
                            : isWaiting
                            ? "bg-red-950/30 border-red-500/80 shadow-lg shadow-red-500/10"
                            : isSuccess
                            ? "bg-gray-900/60 border-emerald-900/50 text-gray-300"
                            : "bg-gray-900/30 border-gray-800/50 text-gray-500"
                        }`}
                      >
                        {/* 状态徽标 */}
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border font-mono font-bold text-sm ${
                            isSuccess
                              ? "bg-emerald-950/60 border-emerald-500/60 text-emerald-400"
                              : isRunningStep
                              ? "bg-cyan-950 border-cyan-500 text-cyan-400 animate-pulse"
                              : isWaiting
                              ? "bg-red-950 border-red-500 text-red-400 animate-bounce"
                              : "bg-gray-800/80 border-gray-700 text-gray-400"
                          }`}
                        >
                          {isSuccess ? (
                            <Check className="w-5 h-5 stroke-[2.5]" />
                          ) : isRunningStep ? (
                            <RefreshCw className="w-5 h-5 animate-spin" />
                          ) : isWaiting ? (
                            <AlertTriangle className="w-5 h-5" />
                          ) : (
                            idx + 1
                          )}
                        </div>

                        {/* 步骤详情 */}
                        <div className="flex-1 flex flex-col min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-sm text-gray-200 truncate">
                              {st.title}
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded uppercase font-semibold">
                              {st.status}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 mb-2 leading-relaxed">
                            {st.description}
                          </p>
                          {st.command && (
                            <div className="p-2 rounded bg-black/60 border border-gray-800/80 font-mono text-[11px] text-gray-300 flex items-center justify-between">
                              <span className="truncate">$ {st.command}</span>
                              {st.isHighRisk && (
                                <span className="text-[9px] bg-red-900/80 text-red-300 px-1.5 py-0.5 rounded font-bold shrink-0 ml-2">
                                  HIGH_RISK
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 2. Linux PTY 字符流极客终端视窗 */}
            {activeTab === "terminal" && (
              <div className="h-full flex flex-col bg-[#05080E] font-mono text-xs select-text">
                <div className="h-8 border-b border-gray-800/60 bg-[#080C14] px-4 flex items-center justify-between text-[11px] text-gray-400 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                    <span className="text-gray-400 font-semibold ml-2">
                      root@nexus-sandbox-alpine: /workspace
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-500">PTY Streaming · UTF-8 ANSI</span>
                </div>

                <div className="flex-1 p-4 overflow-y-auto space-y-1.5 text-gray-300 leading-relaxed">
                  {terminalLines.length === 0 ? (
                    <div className="text-gray-600 italic">终端待命中... 执行任务后将实时输出彩色 ANSI 字符流</div>
                  ) : (
                    terminalLines.map((line, idx) => (
                      <div key={idx} className="whitespace-pre-wrap break-all">
                        {line}
                      </div>
                    ))
                  )}
                  <div ref={terminalEndRef} />
                </div>
              </div>
            )}

            {/* 3. 时间旅行快照滑块视窗 (Time-Travel) */}
            {activeTab === "timetravel" && (
              <div className="h-full overflow-y-auto p-6 max-w-xl mx-auto flex flex-col justify-center space-y-6">
                <div className="text-center space-y-1">
                  <h3 className="text-base font-bold text-white flex items-center justify-center gap-2">
                    <RotateCcw className="w-5 h-5 text-cyan-400" />
                    <span>状态机时间旅行快照控制器</span>
                  </h3>
                  <p className="text-xs text-gray-400">
                    点击历史检查点 (Checkpoint)，状态机将直接从快照库读取 State，界面数据瞬间回滚重现。
                  </p>
                </div>

                <div className="bg-gray-900/60 border border-gray-800 p-5 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between text-xs text-gray-300 font-semibold">
                    <span>快照时间轴选择</span>
                    <span className="text-cyan-400 font-mono">
                      Step {timeTravelStep + 1} / {steps.length}
                    </span>
                  </div>

                  <input
                    type="range"
                    min={0}
                    max={steps.length - 1}
                    value={timeTravelStep}
                    onChange={(e) => handleTimeTravel(Number(e.target.value))}
                    className="w-full accent-cyan-500 cursor-pointer"
                  />

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                    {steps.map((st, idx) => (
                      <button
                        key={st.id}
                        onClick={() => handleTimeTravel(idx)}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          timeTravelStep === idx
                            ? "bg-cyan-950/60 border-cyan-500 text-cyan-300 shadow-md shadow-cyan-500/20"
                            : "bg-gray-950/40 border-gray-800 hover:border-gray-700 text-gray-400"
                        }`}
                      >
                        <div className="text-[10px] text-gray-500 font-mono mb-1">
                          Snapshot #{idx}
                        </div>
                        <div className="text-xs font-semibold line-clamp-1">{st.title}</div>
                      </button>
                    ))}
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={() => handleTimeTravel(timeTravelStep)}
                      className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-cyan-600/30"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>从该快照点回滚并查看</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 4. 最终交付报告视窗 */}
            {activeTab === "report" && (
              <div className="h-full overflow-y-auto p-8 max-w-3xl mx-auto">
                {finalReport ? (
                  <div className="bg-[#0C101A] border border-gray-800 rounded-2xl p-6 shadow-xl space-y-4">
                    <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        <h2 className="text-base font-bold text-white">交付与执行结论报告</h2>
                      </div>
                      <button
                        onClick={() => alert("报告已导出为 Markdown 与 PDF 归档！")}
                        className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-medium flex items-center gap-1.5 border border-gray-700 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>导出报告</span>
                      </button>
                    </div>

                    <div className="prose prose-invert prose-sm max-w-none text-gray-300 whitespace-pre-wrap leading-relaxed font-sans">
                      {finalReport}
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 text-gray-500 space-y-2">
                    <FileText className="w-10 h-10 text-gray-600" />
                    <span className="text-sm">任务执行完毕后，系统将自动汇聚生成最终交付报告。</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
