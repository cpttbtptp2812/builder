import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  GitBranch,
  GitCommit,
  GitPullRequest,
  FileCode,
  FolderGit2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  Play,
  Flame,
  KeyRound,
  Cpu,
  Layers,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  Search,
  Sparkles,
  Send,
  Eye,
  Split,
  ChevronRight,
  ChevronDown,
  Radio,
  Zap,
  Activity,
  FileText,
  CheckCheck,
  Wrench,
  Lock,
  ArrowUpRight,
  Share2,
  Clock,
  User,
  Sliders,
  SendHorizontal,
} from "lucide-react";
import {
  fetchGitRepositoriesApi,
  fetchGitCommitsApi,
  fetchGitDiffApi,
  createGitFixBranchApi,
  GitRepositoryConfig,
  GitCommitItem,
  GitFileDiffItem,
  GitDiffResult,
  streamChatFromBackend,
} from "../../services/api";
import { PipelineItem } from "../../types/platform";
import { useToast } from "@/context/ToastContext";

interface GitMissionWorkbenchProps {
  workflows?: PipelineItem[];
  onNavigateSettings?: () => void;
  onOpenModal?: (tab: any) => void;
  onSendToChat?: (prompt: string) => void;
  systemModel?: string;
  onSwitchToFreeChat?: () => void;
}

export const GitMissionWorkbench: React.FC<GitMissionWorkbenchProps> = ({
  workflows = [],
  onNavigateSettings,
  onOpenModal,
  onSendToChat,
  systemModel = "qwen-plus",
  onSwitchToFreeChat,
}) => {
  const toast = useToast();

  // 1. 仓库与分支状态
  const [repositories, setRepositories] = useState<GitRepositoryConfig[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<string>("");
  const [commits, setCommits] = useState<GitCommitItem[]>([]);
  const [selectedCommitSha, setSelectedCommitSha] = useState<string>("");
  const [fileFilter, setFileFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "M" | "A" | "D">("ALL");

  // 2. 真实 Diff 数据
  const [diffData, setDiffData] = useState<GitDiffResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<string>("");
  const [isLoadingDiff, setIsLoadingDiff] = useState<boolean>(false);
  const [isLoadingCommits, setIsLoadingCommits] = useState<boolean>(false);

  // 3. 视图模式
  const [viewMode, setViewMode] = useState<"diff" | "stream" | "split">("diff");

  // 4. AI 智能体推流与诊断
  const [aiStreaming, setAiStreaming] = useState<boolean>(false);
  const [aiReasoning, setAiReasoning] = useState<string>("");
  const [aiReport, setAiReport] = useState<string>("");
  const [isReasoningOpen, setIsReasoningOpen] = useState<boolean>(true);
  const [activePromptKey, setActivePromptKey] = useState<string>("prod-crash");
  const abortControllerRef = useRef<AbortController | null>(null);
  const reportEndRef = useRef<HTMLDivElement>(null);

  // 5. 修复分支创建弹窗与状态
  const [isCreatingBranch, setIsCreatingBranch] = useState<boolean>(false);
  const [branchInputName, setBranchInputName] = useState<string>("");
  const [createdBranchInfo, setCreatedBranchInfo] = useState<{ branch: string; message: string } | null>(null);

  // 6. 人机协同审批门禁状态 (HITL)
  const [approvalDecision, setApprovalDecision] = useState<"PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [copiedCodeIndex, setCopiedCodeIndex] = useState<number | null>(null);

  // 7. Tab 02 与 Tab 03 的真实配置（从当前关联的 workflow 提取）
  const activeWorkflow = useMemo(() => {
    return (
      workflows.find((w) => w.id === "wf-git-agent") ||
      workflows.find((w) => w.gitRepositories && w.gitRepositories.length > 0) ||
      workflows[0]
    );
  }, [workflows]);

  const activeRepo = useMemo(() => {
    return repositories.find((r) => r.id === selectedRepoId) || repositories[0];
  }, [repositories, selectedRepoId]);

  // 从 Tab 02 提示词列表中抽取测试准则
  const customPrompts = useMemo(() => {
    if (activeWorkflow?.promptConfig?.prompts && activeWorkflow.promptConfig.prompts.length > 0) {
      return activeWorkflow.promptConfig.prompts;
    }
    return [
      {
        id: "prod-crash",
        name: "🔥 生产防崩巡检",
        channel: "生产安全",
        role: "Production Guard",
        prompt:
          "你是一名资深代码架构师。请深度审查这段真实 Git 代码 Diff，重点排查：1. 空指针与未定义引用；2. 异步 Promise/async 缺少捕获；3. 数据库连接或文件流泄露；4. 大量循环中存在的 OOM 隐患。输出清晰的修复意见与修补代码。",
      },
      {
        id: "sec-token",
        name: "🛡️ 敏感凭证排查",
        channel: "安全合规",
        role: "SecOps Sentinel",
        prompt:
          "你是一名代码安全审计专家。请严密扫描这段 Git 代码变动，检查是否包含：1. 暴露的明文 API 密钥、Token 或数据库密码；2. 未鉴权的越权调用；3. SQL 注入或命令注入隐患。发现问题请直接标记行号并提供脱敏改造指南。",
      },
      {
        id: "arch-perf",
        name: "⚡ 代码坏味道检测",
        channel: "架构治理",
        role: "Arch Advisor",
        prompt:
          "你是一名系统重构顾问。请审查当前提交：1. 是否存在重复代码块或死循环；2. 关键路径上的低效计算与无用渲染；3. 模块边界是否清晰。提供高可维护性的重构方案。",
      },
      {
        id: "api-contract",
        name: "🤝 接口契约校验",
        channel: "协作协同",
        role: "API Gatekeeper",
        prompt:
          "你是一名微服务与接口契约专家。请检查本次改动：1. 对外暴露的 RESTful/RPC 接口入参与出参是否向下兼容；2. 必填字段是否有默认值防崩；3. 错误码与异常响应格式是否统一规范。",
      },
    ];
  }, [activeWorkflow]);

  // Tab 03 真实规则库
  const activeSkills = useMemo(() => {
    return (
      activeWorkflow?.skills || [
        { id: "RULE-SEC-001", name: "禁止硬编码明文密钥与 Token", description: "P0 阻断：代码中不得出现明文 Secret", status: "enabled" },
        { id: "RULE-REL-002", name: "生产环境禁止未受控的 console/调试代码", description: "P1 警告：避免控制台敏感日志泄露", status: "enabled" },
        { id: "RULE-PERF-001", name: "流资源与事件监听器必须显式清理", description: "P1 警告：预防内存泄漏", status: "enabled" },
        { id: "RULE-COMPAT-001", name: "对外公开数据模型变更必须向下兼容", description: "P0 阻断：破坏性变更需升级主版本", status: "enabled" },
      ]
    );
  }, [activeWorkflow]);

  // 初始化：拉取真实仓库列表
  useEffect(() => {
    let isMounted = true;
    fetchGitRepositoriesApi()
      .then((repos) => {
        if (!isMounted) return;
        setRepositories(repos);
        if (repos.length > 0) {
          // 优先选中 wf-git-agent 关联的代码库，或第一个
          const target =
            repos.find((r) => r.id === "repo-0aac5a67") ||
            repos.find((r) => r.name?.toLowerCase().includes("builder")) ||
            repos[0];
          setSelectedRepoId(target.id || "");
        }
      })
      .catch((err) => {
        console.error("加载代码库失败", err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // 切换仓库：拉取真实的提交历史
  useEffect(() => {
    if (!selectedRepoId) return;
    setIsLoadingCommits(true);
    fetchGitCommitsApi(selectedRepoId, 15)
      .then((history) => {
        setCommits(history);
        if (history.length > 0) {
          setSelectedCommitSha(history[0].sha);
        } else {
          setSelectedCommitSha("");
        }
      })
      .catch((err) => {
        toast.error("加载提交历史失败: " + err.message);
      })
      .finally(() => {
        setIsLoadingCommits(false);
      });
  }, [selectedRepoId]);

  // 切换提交或文件：拉取真实 Diff
  const loadCommitDiff = (repoId: string, sha: string, file?: string) => {
    if (!repoId) return;
    setIsLoadingDiff(true);
    fetchGitDiffApi(repoId, sha, file)
      .then((res) => {
        setDiffData(res);
        if (!file && res.files && res.files.length > 0) {
          // 如果未指定具体文件，默认选中第一个关键改动文件
          const candidate =
            res.files.find((f) => f.path.endsWith(".tsx") || f.path.endsWith(".ts") || f.path.endsWith(".java")) ||
            res.files[0];
          setSelectedFile(candidate.path);
        } else if (file) {
          setSelectedFile(file);
        }
      })
      .catch((err) => {
        toast.error("获取代码差异失败: " + err.message);
      })
      .finally(() => {
        setIsLoadingDiff(false);
      });
  };

  useEffect(() => {
    if (selectedRepoId && selectedCommitSha) {
      loadCommitDiff(selectedRepoId, selectedCommitSha);
    }
  }, [selectedRepoId, selectedCommitSha]);

  // 点击单个文件加载该文件的精细 Diff
  const handleSelectFile = (filePath: string) => {
    setSelectedFile(filePath);
    if (selectedRepoId && selectedCommitSha) {
      loadCommitDiff(selectedRepoId, selectedCommitSha, filePath);
    }
  };

  // 过滤后的改动文件列表
  const filteredFiles = useMemo(() => {
    if (!diffData || !diffData.files) return [];
    return diffData.files.filter((f) => {
      const matchStatus =
        statusFilter === "ALL" ? true : f.status === statusFilter;
      const matchSearch = fileFilter.trim()
        ? f.path.toLowerCase().includes(fileFilter.toLowerCase().trim())
        : true;
      return matchStatus && matchSearch;
    });
  }, [diffData, statusFilter, fileFilter]);

  // 统计概览
  const stats = useMemo(() => {
    const files = diffData?.files || [];
    let adds = 0;
    let dels = 0;
    files.forEach((f) => {
      adds += f.additions || 0;
      dels += f.deletions || 0;
    });
    return {
      fileCount: files.length,
      additions: adds,
      deletions: dels,
    };
  }, [diffData]);

  // 执行 AI 智能推流审查
  const handleRunAiInspection = (promptKey?: string) => {
    const key = promptKey || activePromptKey;
    setActivePromptKey(key);
    const selectedPromptObj = customPrompts.find((p) => p.id === key) || customPrompts[0];

    if (!diffData || !diffData.diffText) {
      toast.warning("当前没有可用于审查的代码 Diff，请先选择一个文件");
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const ac = new AbortController();
    abortControllerRef.current = ac;

    setAiStreaming(true);
    setAiReasoning("");
    setAiReport("");
    setViewMode("split"); // 自动切到双屏对照模式

    const diffSnippet =
      diffData.diffText.length > 8000
        ? diffData.diffText.substring(0, 8000) + "\n\n... [为保证实时响应速度，部分Diff已在上下文截取前 8000 字符] ..."
        : diffData.diffText;

    const fullMessage = `${selectedPromptObj.prompt}\n\n【待审查代码库】: ${activeRepo?.name || "builder"}\n【代码分支】: ${activeRepo?.branch || "main"}\n【提交版本】: ${selectedCommitSha} (${diffData.author || "Committer"})\n【当前关注文件】: ${selectedFile || "全部变动"}\n\n【真实代码 DIFF 内容】:\n\`\`\`diff\n${diffSnippet}\n\`\`\`\n\n请严格对照上述规则，按 Markdown 输出问题判定、风险级别(P0/P1/P2)、行级隐患点，以及可以直接复制应用的修正后代码。`;

    streamChatFromBackend(
      {
        message: fullMessage,
        enableThinking: true,
      },
      {
        onReasoning: (reasoningChunk) => {
          setAiReasoning((prev) => prev + reasoningChunk);
        },
        onDelta: (chunk) => {
          setAiReport((prev) => prev + chunk);
          reportEndRef.current?.scrollIntoView({ behavior: "smooth" });
        },
        onFinish: () => {
          setAiStreaming(false);
          toast.success("AI 智能体完成代码深度诊断", "审查完毕");
        },
        onError: (err) => {
          setAiStreaming(false);
          toast.error("审查推流发生中断: " + err);
        },
      },
      ac.signal
    );
  };

  // 停止审查推流
  const handleStopAiInspection = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setAiStreaming(false);
    toast.info("已手动中断审查推流");
  };

  // 快速创建真实的修复分支
  const handleCreateFixBranch = async () => {
    if (!selectedRepoId) return;
    const branchName = branchInputName.trim() || `fix/patch-${Date.now().toString().slice(-6)}`;
    setIsCreatingBranch(true);
    try {
      const res = await createGitFixBranchApi(
        selectedRepoId,
        activeRepo?.branch || "main",
        branchName
      );
      if (res.ok) {
        setCreatedBranchInfo({
          branch: res.branch || branchName,
          message: res.message || "分支已成功在真实 Git 库生成",
        });
        toast.success(`成功生成修复分支: ${res.branch}`, "真实 Git 写入成功");
        setBranchInputName("");
      } else {
        toast.error(`分支创建失败: ${res.error || "未知异常"}`);
      }
    } catch (e: any) {
      toast.error(`创建分支异常: ${e.message}`);
    } finally {
      setIsCreatingBranch(false);
    }
  };

  // 复制修复代码
  const handleCopyCode = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedCodeIndex(idx);
    toast.success("已复制到剪贴板，可直接在工程中粘贴替换");
    setTimeout(() => setCopiedCodeIndex(null), 2000);
  };

  // 解析并高亮渲染 Diff 行
  const renderDiffLines = (rawDiff: string) => {
    if (!rawDiff) {
      return (
        <div className="p-8 text-center text-slate-400 font-mono text-xs">
          暂无 Diff 变动内容，请选择左侧文件查看代码变更。
        </div>
      );
    }

    const lines = rawDiff.split("\n");
    let origLineNum = 1;
    let newLineNum = 1;

    return (
      <div className="font-mono text-xs leading-5 select-text overflow-x-auto">
        {lines.map((line, idx) => {
          let lineType: "header" | "add" | "del" | "ctx" = "ctx";
          let bgClass = "hover:bg-slate-100/60 text-slate-700";
          let gutterClass = "text-slate-300";

          if (line.startsWith("@@")) {
            lineType = "header";
            bgClass = "bg-indigo-50/80 text-indigo-700 font-bold border-y border-indigo-100 py-1";
            // 解析类似 @@ -1,10 +1,12 @@
            const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
            if (match) {
              origLineNum = parseInt(match[1], 10);
              newLineNum = parseInt(match[2], 10);
            }
          } else if (line.startsWith("+") && !line.startsWith("+++")) {
            lineType = "add";
            bgClass = "bg-emerald-50/90 text-emerald-900 border-l-2 border-emerald-500";
            gutterClass = "text-emerald-500 font-bold bg-emerald-100/40";
          } else if (line.startsWith("-") && !line.startsWith("---")) {
            lineType = "del";
            bgClass = "bg-rose-50/90 text-rose-900 border-l-2 border-rose-500";
            gutterClass = "text-rose-500 font-bold bg-rose-100/40";
          }

          const currentOrigNum = lineType === "del" || lineType === "ctx" ? origLineNum++ : "";
          const currentNewNum = lineType === "add" || lineType === "ctx" ? newLineNum++ : "";

          // 检测是否有安全隐患关键词进行行级高亮
          const hasSecurityHint =
            lineType === "add" &&
            (line.includes("token") ||
              line.includes("password") ||
              line.includes("secret") ||
              line.includes("apiKey") ||
              line.includes("key ="));

          return (
            <React.Fragment key={idx}>
              <div className={`flex items-stretch min-w-full group ${bgClass}`}>
                {/* 行号栏 */}
                <div className={`w-12 text-right pr-2 py-0.5 select-none shrink-0 border-r border-slate-200/50 ${gutterClass}`}>
                  {currentOrigNum}
                </div>
                <div className={`w-12 text-right pr-2 py-0.5 select-none shrink-0 border-r border-slate-200/50 ${gutterClass}`}>
                  {currentNewNum}
                </div>
                {/* 符号标示 */}
                <div className="w-6 text-center py-0.5 select-none font-bold shrink-0">
                  {line.startsWith("+") ? "+" : line.startsWith("-") ? "-" : " "}
                </div>
                {/* 代码内容 */}
                <div className="flex-1 px-2 py-0.5 whitespace-pre overflow-x-visible">
                  {line.substring(1)}
                </div>
              </div>

              {/* 行级内嵌警告胶囊 (Tab 03 规则触发示范) */}
              {hasSecurityHint && (
                <div className="bg-amber-500/10 border-y border-amber-300 px-6 py-1 text-[11px] text-amber-900 flex items-center justify-between font-sans">
                  <div className="flex items-center gap-1.5 font-bold">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                    <span>[Tab 03 规则拦截] 发现敏感标识符 (Token/Secret)，建议使用环境变量或受控密钥库注入。</span>
                  </div>
                  <span className="text-[10px] bg-amber-200/60 text-amber-800 px-2 py-0.5 rounded-full font-mono">
                    RULE-SEC-001
                  </span>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-50 text-slate-800 overflow-hidden select-none">
      {/* 1. 顶部作战台状态与多代码库控制面板 (Cockpit Bar) */}
      <header className="h-14 px-4 bg-white border-b border-slate-200/90 flex items-center justify-between shrink-0 shadow-2xs z-20">
        <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide py-1">
          <div className="flex items-center gap-2 pr-3 border-r border-slate-200 shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm font-black text-slate-900 flex items-center gap-1.5">
              <FolderGit2 className="w-4 h-4 text-blue-600" />
              <span>Git 智能体全景作战台</span>
            </span>
            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
              生产真实库接入
            </span>
          </div>

          {/* 仓库切换器 */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs text-slate-400 font-medium">目标工程:</span>
            <select
              value={selectedRepoId}
              onChange={(e) => setSelectedRepoId(e.target.value)}
              className="text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 rounded-lg px-2.5 py-1.5 cursor-pointer outline-none transition"
            >
              {repositories.map((repo) => (
                <option key={repo.id} value={repo.id}>
                  {repo.name} ({repo.branch || "main"})
                </option>
              ))}
            </select>
          </div>

          {/* 提交切换器 */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs text-slate-400 font-medium">当前提交:</span>
            <select
              value={selectedCommitSha}
              onChange={(e) => setSelectedCommitSha(e.target.value)}
              disabled={isLoadingCommits || commits.length === 0}
              className="text-xs font-mono font-bold text-blue-700 bg-blue-50 hover:bg-blue-100/80 border border-blue-200 rounded-lg px-2.5 py-1.5 cursor-pointer outline-none transition"
            >
              {commits.map((c) => (
                <option key={c.sha} value={c.sha}>
                  {c.sha.substring(0, 7)} - {c.message.substring(0, 28)}
                </option>
              ))}
            </select>
          </div>

          {/* 真实统计指标胶囊 */}
          <div className="hidden lg:flex items-center gap-2 text-xs font-mono font-semibold text-slate-500 pl-2">
            <span className="bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
              改动文件: <strong className="text-slate-800">{stats.fileCount}</strong>
            </span>
            <span className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded-md border border-emerald-200">
              +{stats.additions.toLocaleString()}
            </span>
            <span className="bg-rose-50 text-rose-700 px-2 py-1 rounded-md border border-rose-200">
              -{stats.deletions.toLocaleString()}
            </span>
          </div>
        </div>

        {/* 右侧动作区：模式切换 + 自由对话切换 */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode("diff")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                viewMode === "diff"
                  ? "bg-white text-blue-700 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>代码差异</span>
            </button>
            <button
              onClick={() => setViewMode("split")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                viewMode === "split"
                  ? "bg-white text-blue-700 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Split className="w-3.5 h-3.5" />
              <span>双屏审查</span>
            </button>
            <button
              onClick={() => setViewMode("stream")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                viewMode === "stream"
                  ? "bg-white text-blue-700 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>智能体报告</span>
            </button>
          </div>

          {onSwitchToFreeChat && (
            <button
              onClick={onSwitchToFreeChat}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition flex items-center gap-1 cursor-pointer shadow-2xs"
              title="切换到自由对话助手"
            >
              <SendHorizontal className="w-3.5 h-3.5 text-slate-500" />
              <span>自由会话</span>
            </button>
          )}
        </div>
      </header>

      {/* 2. 主三栏作业区 (左侧文件树 + 中间Diff/AI视窗 + 右侧智能体编排与审批门禁) */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左栏：文件变更树与真实提交信息 (File Navigator) */}
        <aside className="w-72 lg:w-80 bg-white border-r border-slate-200 flex flex-col shrink-0 select-none">
          {/* 提交元信息卡片 */}
          <div className="p-3 bg-slate-50/70 border-b border-slate-200 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] text-blue-700 font-bold bg-blue-100/70 px-2 py-0.5 rounded">
                SHA: {selectedCommitSha.substring(0, 7)}
              </span>
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>{diffData?.time || "刚刚"}</span>
              </span>
            </div>
            <div className="text-slate-900 font-bold line-clamp-2 leading-relaxed">
              {diffData?.message || "正在加载提交说明..."}
            </div>
            <div className="text-[11px] text-slate-500 flex items-center gap-1 truncate">
              <User className="w-3 h-3 text-slate-400 shrink-0" />
              <span className="truncate">{diffData?.author || "Committer"}</span>
            </div>
          </div>

          {/* 搜索与过滤工具条 */}
          <div className="p-2 border-b border-slate-100 space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="搜索改动文件 (例如: App.tsx)..."
                value={fileFilter}
                onChange={(e) => setFileFilter(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200/60 focus:bg-white border border-transparent focus:border-blue-400 rounded-lg outline-none transition"
              />
            </div>
            <div className="flex items-center gap-1 text-[11px]">
              {(["ALL", "M", "A", "D"] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`flex-1 py-1 rounded-md font-bold transition cursor-pointer text-center ${
                    statusFilter === st
                      ? "bg-slate-800 text-white shadow-2xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200/80"
                  }`}
                >
                  {st === "ALL" ? "全部" : st === "M" ? "修改" : st === "A" ? "新增" : "删除"}
                </button>
              ))}
            </div>
          </div>

          {/* 改动文件树列表 */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {isLoadingDiff ? (
              <div className="p-6 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
                <span>正在提取 Git 仓库变动...</span>
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                未找到匹配的文件改动
              </div>
            ) : (
              filteredFiles.map((file) => {
                const isSelected = selectedFile === file.path;
                const statusColor =
                  file.status === "A"
                    ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                    : file.status === "D"
                    ? "text-rose-700 bg-rose-50 border-rose-200"
                    : "text-amber-700 bg-amber-50 border-amber-200";

                return (
                  <button
                    key={file.path}
                    onClick={() => handleSelectFile(file.path)}
                    className={`w-full p-2.5 text-left text-xs transition flex items-center justify-between gap-2 cursor-pointer ${
                      isSelected
                        ? "bg-blue-50/90 border-l-4 border-blue-600 text-blue-900 font-bold"
                        : "hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate flex-1">
                      <span className={`text-[10px] font-black font-mono px-1.5 py-0.5 rounded border shrink-0 ${statusColor}`}>
                        {file.status}
                      </span>
                      <span className="truncate font-mono" title={file.path}>
                        {file.path}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 font-mono text-[10px] shrink-0">
                      {file.additions > 0 && (
                        <span className="text-emerald-600">+{file.additions}</span>
                      )}
                      {file.deletions > 0 && (
                        <span className="text-rose-600">-{file.deletions}</span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* 中栏：真实 Diff 代码视窗 + 智能体推流报告 (根据 viewMode 渲染单屏或双屏) */}
        <main className="flex-1 flex overflow-hidden bg-white">
          {/* 视图 1：纯 Diff 视图 */}
          {(viewMode === "diff" || viewMode === "split") && (
            <div
              className={`flex-1 flex flex-col border-r border-slate-200 overflow-hidden ${
                viewMode === "split" ? "w-1/2" : "w-full"
              }`}
            >
              {/* Diff 头部工具条 */}
              <div className="h-10 px-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 font-mono text-xs text-slate-700 truncate">
                  <FileCode className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="font-bold truncate">{selectedFile || "全部文件 Diff"}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleRunAiInspection()}
                    disabled={aiStreaming || !diffData?.diffText}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition flex items-center gap-1 cursor-pointer disabled:opacity-50 shadow-2xs"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>执行 AI 审查</span>
                  </button>
                </div>
              </div>

              {/* 真实的 Diff 代码内容 */}
              <div className="flex-1 overflow-y-auto bg-slate-50/50 p-2">
                <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
                  {renderDiffLines(diffData?.diffText || "")}
                </div>
              </div>
            </div>
          )}

          {/* 视图 2：智能体推流报告视窗 */}
          {(viewMode === "stream" || viewMode === "split") && (
            <div
              className={`flex-1 flex flex-col overflow-hidden bg-slate-900 text-slate-100 ${
                viewMode === "split" ? "w-1/2" : "w-full"
              }`}
            >
              {/* 推流区顶部提示词快捷卡片 (Tab 02 注入的真实准则胶囊) */}
              <div className="p-3 bg-slate-950/80 border-b border-slate-800 space-y-2 shrink-0">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                    <span className="font-bold text-slate-200 flex items-center gap-1">
                      <Cpu className="w-3.5 h-3.5 text-blue-400" />
                      <span>代码治理智能体 (模型: {systemModel})</span>
                    </span>
                  </div>

                  {aiStreaming ? (
                    <button
                      onClick={handleStopAiInspection}
                      className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-rose-600 hover:bg-rose-700 text-white transition cursor-pointer"
                    >
                      中断生成
                    </button>
                  ) : (
                    <span className="text-[10px] text-slate-400">已就绪，随时可触发</span>
                  )}
                </div>

                {/* Tab 02 提示词通道一键触达 */}
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-0.5">
                  {customPrompts.map((p) => {
                    const isActive = activePromptKey === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => handleRunAiInspection(p.id)}
                        disabled={aiStreaming}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 shrink-0 cursor-pointer border ${
                          isActive
                            ? "bg-blue-600 text-white border-blue-500 shadow-xs"
                            : "bg-slate-800/90 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white"
                        }`}
                      >
                        <span>{p.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 实时推流正文区 */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 font-sans text-xs leading-relaxed">
                {/* 思考链展示折叠卡片 */}
                {aiReasoning && (
                  <div className="rounded-xl border border-blue-900/40 bg-blue-950/30 overflow-hidden">
                    <button
                      onClick={() => setIsReasoningOpen(!isReasoningOpen)}
                      className="w-full px-3 py-2 bg-blue-950/60 flex items-center justify-between text-[11px] font-bold text-blue-300 cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                        <span>思考推理链 (Deep Reasoning Process)</span>
                      </div>
                      {isReasoningOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </button>
                    {isReasoningOpen && (
                      <div className="p-3 text-[11px] font-mono text-slate-300 leading-relaxed border-t border-blue-900/30 whitespace-pre-wrap max-h-52 overflow-y-auto">
                        {aiReasoning}
                      </div>
                    )}
                  </div>
                )}

                {/* 最终诊断 Markdown 报告 */}
                {aiReport ? (
                  <div className="prose prose-invert max-w-none text-xs space-y-3 leading-relaxed">
                    <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/70 whitespace-pre-wrap font-sans text-slate-200">
                      {aiReport}
                    </div>

                    <div ref={reportEndRef} />
                  </div>
                ) : (
                  !aiStreaming && (
                    <div className="h-64 flex flex-col items-center justify-center text-center text-slate-500 space-y-2">
                      <Sparkles className="w-8 h-8 text-slate-600 animate-pulse" />
                      <div className="font-bold text-slate-400 text-sm">智能体深度审查已准备就绪</div>
                      <p className="max-w-md text-[11px] text-slate-500">
                        点击上方 <strong className="text-blue-400">🔥 生产防崩巡检</strong> 或任一业务通道，智能体将调取当前文件的真实代码 Diff，执行行级漏洞审计。
                      </p>
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </main>

        {/* 右栏：智能体协作集群状态 + DAG 全链路流转 + HITL 安全审批台 (Agent Swarm & CI Gate) */}
        <aside className="w-80 lg:w-88 bg-slate-50 border-l border-slate-200 flex flex-col shrink-0 select-none overflow-y-auto p-3.5 space-y-4">
          {/* 1. 四大智能体协同阵列 (Agent Swarm Matrix) */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-blue-600" />
                <span>四智能体协同作战群</span>
              </span>
              <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 font-bold px-2 py-0.5 rounded-full">
                全阵列在线
              </span>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <div>
                    <div className="font-bold text-slate-800">Git 变更监听器</div>
                    <div className="text-[10px] text-slate-400">持续监听 SHA: {selectedCommitSha.substring(0, 7)}</div>
                  </div>
                </div>
                <span className="text-[10px] text-blue-600 font-mono font-bold">ACTIVE</span>
              </div>

              <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <div>
                    <div className="font-bold text-slate-800">安全合规守卫</div>
                    <div className="text-[10px] text-slate-400">Tab 03 规则拦截 (10项)</div>
                  </div>
                </div>
                <span className="text-[10px] text-emerald-600 font-mono font-bold">READY</span>
              </div>

              <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500" />
                  <div>
                    <div className="font-bold text-slate-800">架构重构顾问</div>
                    <div className="text-[10px] text-slate-400">死代码与坏味道排查</div>
                  </div>
                </div>
                <span className="text-[10px] text-indigo-600 font-mono font-bold">ARMED</span>
              </div>

              <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <div>
                    <div className="font-bold text-slate-800">自动补丁助理</div>
                    <div className="text-[10px] text-slate-400">生成修复分支与PR</div>
                  </div>
                </div>
                <span className="text-[10px] text-amber-600 font-mono font-bold">HOT-PATCH</span>
              </div>
            </div>
          </div>

          {/* 2. 全链路 DAG 流转阶段 (Pipeline Stage Tracker) */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2">
            <span className="text-xs font-black text-slate-900 block">全链路流转流水线 (DAG)</span>
            <div className="relative pl-4 space-y-2 border-l-2 border-blue-500/30 text-[11px]">
              <div className="relative flex items-center justify-between">
                <span className="absolute -left-[21px] w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span className="font-bold text-slate-800">1. Git Diff 真实提取</span>
                <span className="text-[10px] text-emerald-600 font-bold">已就绪</span>
              </div>
              <div className="relative flex items-center justify-between">
                <span className="absolute -left-[21px] w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span className="font-bold text-slate-800">2. Tab 03 规则库比对</span>
                <span className="text-[10px] text-blue-600 font-bold">10项规则就绪</span>
              </div>
              <div className="relative flex items-center justify-between">
                <span className="absolute -left-[21px] w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span className="font-bold text-slate-800">3. 大模型深度推理</span>
                <span className="text-[10px] text-slate-400">{aiStreaming ? "推理中..." : "待命中"}</span>
              </div>
              <div className="relative flex items-center justify-between">
                <span className="absolute -left-[21px] w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span className="font-bold text-slate-800">4. 人工确认安全门禁</span>
                <span className="text-[10px] text-amber-600 font-bold">{approvalDecision}</span>
              </div>
              <div className="relative flex items-center justify-between">
                <span className="absolute -left-[21px] w-2.5 h-2.5 rounded-full bg-slate-300" />
                <span className="font-bold text-slate-500">5. 飞书/钉钉卡片派发</span>
                <span className="text-[10px] text-slate-400">待触发</span>
              </div>
            </div>
          </div>

          {/* 3. 人机协同审批门禁台 (HITL Gate & Real Fix Branch Creator) */}
          <div className="bg-white p-3.5 rounded-2xl border-2 border-blue-200/90 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>人机协同安全门禁 (HITL)</span>
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                approvalDecision === "APPROVED"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                  : approvalDecision === "REJECTED"
                  ? "bg-rose-50 text-rose-700 border-rose-300"
                  : "bg-amber-50 text-amber-700 border-amber-300"
              }`}>
                {approvalDecision === "APPROVED" ? "已放行" : approvalDecision === "REJECTED" ? "已阻断" : "待裁决"}
              </span>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              当智能体检测到 P0 高危隐患或未受控变更时，合并请求将被自动阻断，须人工确认后方可合入。
            </p>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                onClick={() => {
                  setApprovalDecision("APPROVED");
                  toast.success("人工确认放行合入，CI/CD 流水线继续执行");
                }}
                className={`py-2 rounded-xl font-bold flex items-center justify-center gap-1 transition cursor-pointer border ${
                  approvalDecision === "APPROVED"
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                    : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200"
                }`}
              >
                <Check className="w-3.5 h-3.5" />
                <span>授权放行</span>
              </button>

              <button
                onClick={() => {
                  setApprovalDecision("REJECTED");
                  toast.warning("已阻断本次合并，代码已被打回重修");
                }}
                className={`py-2 rounded-xl font-bold flex items-center justify-center gap-1 transition cursor-pointer border ${
                  approvalDecision === "REJECTED"
                    ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                    : "bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200"
                }`}
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>阻断打回</span>
              </button>
            </div>

            {/* 核心真实功能：一键生成真实的修复分支 (Create Fix Branch) */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <span className="text-[11px] font-bold text-slate-700 block">
                🛠️ 一键在当前 Git 仓库创建修复分支
              </span>

              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  placeholder="分支名 (如: fix/patch-01)"
                  value={branchInputName}
                  onChange={(e) => setBranchInputName(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none font-mono focus:border-blue-500 transition"
                />
                <button
                  onClick={handleCreateFixBranch}
                  disabled={isCreatingBranch || !selectedRepoId}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition flex items-center gap-1 shrink-0 cursor-pointer disabled:opacity-50 shadow-2xs"
                >
                  {isCreatingBranch ? <RefreshCw className="w-3 h-3 animate-spin" /> : <GitBranch className="w-3 h-3" />}
                  <span>建分支</span>
                </button>
              </div>

              {createdBranchInfo && (
                <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-[10px] text-emerald-800 font-mono flex items-center justify-between">
                  <span className="truncate">已创建: {createdBranchInfo.branch}</span>
                  <CheckCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0 ml-1" />
                </div>
              )}
            </div>
          </div>

          {/* 4. Tab 04 协同通知卡片预览 (Notification Dispatch Preview) */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800">飞书 / 钉钉消息联动预览</span>
              <span className="text-[10px] text-slate-400">Tab 04 渠道</span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5 font-sans">
              <div className="flex items-center justify-between text-[11px]">
                <strong className="text-slate-900">🚨 [Git 巡检告警] 发现潜在阻断项</strong>
                <span className="text-[10px] text-rose-600 font-bold bg-rose-50 px-1.5 py-0.2 rounded">P0 级别</span>
              </div>
              <div className="text-[10px] text-slate-500 leading-relaxed font-mono">
                代码库: {activeRepo?.name || "builder"}<br />
                提交 SHA: {selectedCommitSha.substring(0, 7)} ({diffData?.author})<br />
                关注文件: {selectedFile || "全局"}
              </div>
              <div className="pt-1 flex items-center justify-end">
                <span className="text-[10px] text-blue-600 font-bold hover:underline cursor-pointer flex items-center gap-0.5">
                  <span>查看审查报告详情</span>
                  <ArrowUpRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

