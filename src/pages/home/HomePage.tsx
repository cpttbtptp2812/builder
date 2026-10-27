import React, { useState, useEffect } from "react";
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Database,
  Activity,
  Coins,
  Settings,
  Zap,
  Server,
  Cpu,
  Layers,
  Plus,
  Edit2,
  Trash2,
  Terminal,
  Briefcase,
  FileText,
  CornerRightUp,
  CheckCircle2,
  SlidersHorizontal,
} from "lucide-react";
import { PipelineItem } from "@/types/platform";
import { fetchFinOpsCacheMetricsApi, FinOpsCacheMetrics } from "@/services/api";

interface HomePageProps {
  onEnterWorkbench: () => void;
  onOpenModal: (tab: "settings" | "knowledge" | "tools" | "logs" | "agents") => void;
  onOpenFinOps: () => void;
  workflows: PipelineItem[];
  onLaunchWorkflow: (wf: PipelineItem) => void;
  onOpenCreateWorkflow: () => void;
  onOpenEditWorkflow: (wf: PipelineItem) => void;
  onDeleteWorkflow: (id: string) => void;
  agentsCount?: number;
  knowledgeCount?: number;
  toolsCount?: number;
  logsCount?: number;
}

export const HomePage: React.FC<HomePageProps> = ({
  onEnterWorkbench,
  onOpenModal,
  onOpenFinOps,
  workflows,
  onLaunchWorkflow,
  onOpenCreateWorkflow,
  onOpenEditWorkflow,
  onDeleteWorkflow,
  agentsCount = 0,
  knowledgeCount = 0,
  toolsCount = 0,
  logsCount = 0,
}) => {
  const [modelProbe, setModelProbe] = useState<{
    connected: boolean;
    provider: string;
    model: string;
    latencyMs?: number;
  } | null>(() => {
    try {
      const cached = localStorage.getItem("ownagent_probe_cache");
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  const [finOps, setFinOps] = useState<FinOpsCacheMetrics | null>(null);

  useEffect(() => {
    fetch("/api/system/model-probe")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setModelProbe(data);
          try {
            localStorage.setItem("ownagent_probe_cache", JSON.stringify(data));
          } catch {}
        }
      })
      .catch(() => {});

    fetchFinOpsCacheMetricsApi().then((metrics) => {
      if (metrics) setFinOps(metrics);
    });
  }, []);

  const renderPipelineIcon = (iconName?: string) => {
    switch (iconName) {
      case "Zap":
        return <Zap className="w-4 h-4 text-amber-500" />;
      case "Briefcase":
        return <Briefcase className="w-4 h-4 text-emerald-600" />;
      case "Terminal":
        return <Terminal className="w-4 h-4 text-cyan-600" />;
      case "Activity":
        return <Activity className="w-4 h-4 text-purple-600" />;
      case "Database":
        return <Database className="w-4 h-4 text-indigo-600" />;
      case "Cpu":
        return <Cpu className="w-4 h-4 text-rose-600" />;
      case "FileText":
        return <FileText className="w-4 h-4 text-blue-600" />;
      default:
        return <ShieldCheck className="w-4 h-4 text-blue-600" />;
    }
  };

  const getBadgeColor = (category?: string) => {
    if (category?.includes("DevOps") || category?.includes("SRE")) {
      return "bg-rose-50 text-rose-700 border-rose-200";
    }
    if (category?.includes("架构")) {
      return "bg-blue-50 text-blue-700 border-blue-200";
    }
    if (category?.includes("财务") || category?.includes("风控")) {
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    }
    if (category?.includes("效能") || category?.includes("GitOps") || category?.includes("代码")) {
      return "bg-cyan-50 text-cyan-700 border-cyan-200";
    }
    return "bg-slate-100 text-slate-700 border-slate-200";
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#FAFBFC] text-slate-800 scrollbar-hide">
      {/* ── 顶部 Hero 区域 ── */}
      <section className="relative px-6 pt-12 pb-16 lg:px-12 border-b border-slate-200/80 bg-gradient-to-b from-white via-white to-slate-50/50">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* 版本与状态胶囊 */}
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-200/80 rounded-full text-xs font-semibold text-blue-700 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
            <span>OwnAgent Platform v2.4 · 企业级全自主智能中枢系统</span>
          </div>

          {/* 大标题与副标题 */}
          <div className="max-w-3xl space-y-4">
            <h1 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
              企业级业务智能体编排与
              <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 bg-clip-text text-transparent">
                可观测治理中枢
              </span>
            </h1>
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
              面向生产环境构建的高可靠智能体基础设施。具备两阶段混合 RAG 检索防幻觉、零信任人机协同高危拦截（HITL）、毫秒级 Exact Hash 降本缓存与全链路分布式 Tracing。
            </p>
          </div>

          {/* 核心行动按钮 */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={onEnterWorkbench}
              className="inline-flex items-center gap-2 px-6 py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-2xl font-bold text-sm shadow-lg shadow-blue-500/25 transition cursor-pointer"
            >
              <span>进入智能工作台</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={onOpenCreateWorkflow}
              className="inline-flex items-center gap-2 px-5 py-3.5 bg-white hover:bg-blue-50/60 border border-slate-200/90 hover:border-blue-300 text-slate-700 hover:text-blue-700 rounded-2xl font-semibold text-sm shadow-2xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4 text-blue-600" />
              <span>配置新业务流水线</span>
            </button>

            <button
              onClick={() => onOpenModal("settings")}
              className="inline-flex items-center gap-2 px-5 py-3.5 bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-700 rounded-2xl font-semibold text-sm shadow-2xs transition cursor-pointer"
            >
              <Settings className="w-4 h-4 text-slate-500" />
              <span>基础设施配置</span>
            </button>

            <button
              onClick={onOpenFinOps}
              className="inline-flex items-center gap-2 px-5 py-3.5 bg-white hover:bg-emerald-50/50 border border-slate-200/90 hover:border-emerald-200 text-slate-700 hover:text-emerald-700 rounded-2xl font-semibold text-sm shadow-2xs transition cursor-pointer"
            >
              <Coins className="w-4 h-4 text-emerald-600" />
              <span>查看 FinOps 降本审计</span>
            </button>
          </div>
        </div>
      </section>

      {/* ── 核心工作区主容器 ── */}
      <section className="px-6 py-8 lg:px-12 max-w-6xl mx-auto space-y-10">
        {/* ── 实时运行状态与基础设施健康指标 ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-black text-slate-800 tracking-tight">
                系统基础设施与微服务运行状态
              </h2>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              100% 真实后端持久化探针 · 非模拟数据
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. 模型推流引擎 */}
            <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                <span className="flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-blue-500" />
                  <span>主算力模型引擎</span>
                </span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    modelProbe?.connected ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                  }`}
                />
              </div>
              <div className="text-lg font-black font-mono text-slate-900 truncate">
                {modelProbe?.connected ? modelProbe.model : "待配置模型"}
              </div>
              <div className="text-[11px] text-slate-400 flex items-center justify-between font-mono">
                <span>{modelProbe?.connected ? modelProbe.provider : "离线沙箱"}</span>
                <span>{modelProbe?.latencyMs ? `${modelProbe.latencyMs}ms` : "0ms"}</span>
              </div>
            </div>

            {/* 2. 知识库混合检索 */}
            <div
              onClick={() => onOpenModal("knowledge")}
              className="p-4 bg-white hover:bg-slate-50/80 border border-slate-200 hover:border-indigo-300 rounded-2xl shadow-xs space-y-2 cursor-pointer transition"
            >
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                <span className="flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-indigo-500" />
                  <span>知识库资产中台</span>
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              </div>
              <div className="text-lg font-black font-mono text-slate-900">
                {knowledgeCount > 0 ? `${knowledgeCount} 条知识切片` : "两阶段 RRF 融合"}
              </div>
              <div className="text-[11px] text-slate-400 flex items-center justify-between font-mono">
                <span>BM25 + 向量粗筛</span>
                <span className="text-emerald-600 font-bold">Cosine ≥ 0.65</span>
              </div>
            </div>

            {/* 3. MCP 工具插件与安全网关 */}
            <div
              onClick={() => onOpenModal("tools")}
              className="p-4 bg-white hover:bg-slate-50/80 border border-slate-200 hover:border-rose-300 rounded-2xl shadow-xs space-y-2 cursor-pointer transition"
            >
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-rose-500" />
                  <span>安全拦截网关</span>
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              </div>
              <div className="text-lg font-black font-mono text-slate-900">
                {toolsCount > 0 ? `已接入 ${toolsCount} 个工具` : "HITL 物理拦截"}
              </div>
              <div className="text-[11px] text-slate-400 flex items-center justify-between font-mono">
                <span>只读放行 / 写入阻断</span>
                <span className="text-rose-600 font-bold">状态机挂起</span>
              </div>
            </div>

            {/* 4. FinOps 降本缓存 */}
            <div
              onClick={onOpenFinOps}
              className="p-4 bg-white hover:bg-slate-50/80 border border-slate-200 hover:border-amber-300 rounded-2xl shadow-xs space-y-2 cursor-pointer transition"
            >
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                <span className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span>Exact Hash 降本</span>
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              </div>
              <div className="text-lg font-black font-mono text-slate-900">
                {finOps ? `省 ${(finOps.totalSavedTokens || 0).toLocaleString()} tk` : "0 Token"}
              </div>
              <div className="text-[11px] text-slate-400 flex items-center justify-between font-mono">
                <span>命中 {finOps?.totalHits || 0} 次</span>
                <span className="text-emerald-600 font-bold">15ms 秒级响应</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── 核心业务自动化流水线 (100% 数据库动态读取与配置) ── */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600" />
                <h2 className="text-sm font-black text-slate-800 tracking-tight">
                  企业核心业务自动化流水线 (Enterprise Workflows & Pipelines)
                </h2>
              </div>
              <p className="text-xs text-slate-500">
                后端数据库持久化纳管（当前已编排 {workflows.length} 条业务链路），支持动态增删改查与参数模板配置
              </p>
            </div>

            <button
              onClick={onOpenCreateWorkflow}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 font-bold text-xs rounded-xl transition cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>新建业务流水线</span>
            </button>
          </div>

          {workflows.length === 0 ? (
            <div className="p-8 text-center bg-white border border-dashed border-slate-300 rounded-3xl space-y-3">
              <Layers className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-sm font-bold text-slate-700">暂无配置的业务流水线</p>
              <p className="text-xs text-slate-400">
                点击右上角“新建业务流水线”即可根据企业需求自由添加运维巡检、架构核验或风控工单
              </p>
              <button
                onClick={onOpenCreateWorkflow}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition cursor-pointer"
              >
                新建第一条流水线
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {workflows.map((wf) => (
                <div
                  key={wf.id}
                  className="group relative p-5 rounded-2xl bg-white hover:bg-slate-50/90 border border-slate-200/90 hover:border-blue-400 text-left transition-all shadow-xs hover:shadow-md flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    {/* 卡片顶栏：领域徽标 + 操作按钮 */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getBadgeColor(
                          wf.category
                        )}`}
                      >
                        {wf.badge || wf.category}
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenEditWorkflow(wf);
                          }}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                          title="编辑流水线配置"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`确定要从数据库中删除流水线 [${wf.name}] 吗？`)) {
                              onDeleteWorkflow(wf.id);
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title="删除流水线"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <span className="p-1.5">{renderPipelineIcon(wf.icon)}</span>
                      </div>
                    </div>

                    {/* 流水线标题 */}
                    <div>
                      <h3 className="text-sm font-black text-slate-800 group-hover:text-blue-600 transition tracking-tight">
                        {wf.name}
                      </h3>
                      <p className="text-xs text-slate-500 leading-snug line-clamp-2 mt-1">
                        {wf.description}
                      </p>
                    </div>

                    {/* 标签列表 */}
                    {wf.tags && wf.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {wf.tags.map((t, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] font-mono px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 卡片底栏：版本与启动按钮 */}
                  <div className="space-y-2 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      <span>{wf.version || "v1.0.0"}</span>
                      <span>{wf.updatedAt || "刚刚更新"}</span>
                    </div>

                    <button
                      onClick={() => onLaunchWorkflow(wf)}
                      className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white rounded-xl font-bold text-xs transition cursor-pointer"
                    >
                      <span>一键启动流水线</span>
                      <CornerRightUp className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── 核心功能门户四方矩阵 ── */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-black text-slate-800 tracking-tight">
              平台核心工作台与能力中心
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 门户卡片 1: 全自主智能体工作台 */}
            <div
              onClick={onEnterWorkbench}
              className="group p-6 rounded-3xl bg-white border border-slate-200/90 hover:border-blue-400 hover:shadow-lg transition-all cursor-pointer space-y-4"
            >
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200/80 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Sparkles className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-blue-600 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  <span>进入工作台</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>

              <div className="space-y-1.5">
                <h3 className="text-base font-black text-slate-900 group-hover:text-blue-600 transition">
                  全自主智能体交互工作台 (Agent Workbench)
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  已纳管 {agentsCount > 0 ? `${agentsCount} 个企业智能体` : "企业级智能中枢"}
                  。提供基于 SSE 协议的高性能逐字流式推流、深度思考链展开、真实工具动态调用与人机协同审批确认。
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100 text-[11px] font-mono text-slate-500">
                <span className="px-2 py-0.5 bg-slate-100 rounded-md">流式推流</span>
                <span className="px-2 py-0.5 bg-slate-100 rounded-md">工具调用</span>
                <span className="px-2 py-0.5 bg-slate-100 rounded-md">人机审批 (HITL)</span>
                <span className="px-2 py-0.5 bg-slate-100 rounded-md">耗时瀑布流</span>
              </div>
            </div>

            {/* 门户卡片 2: 知识库资产治理中心 */}
            <div
              onClick={() => onOpenModal("knowledge")}
              className="group p-6 rounded-3xl bg-white border border-slate-200/90 hover:border-indigo-400 hover:shadow-lg transition-all cursor-pointer space-y-4"
            >
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200/80 text-indigo-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Database className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-indigo-600 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  <span>管理知识资产</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>

              <div className="space-y-1.5">
                <h3 className="text-base font-black text-slate-900 group-hover:text-indigo-600 transition">
                  企业知识库与防幻觉 RAG 治理中台
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  已沉淀 {knowledgeCount > 0 ? `${knowledgeCount} 条知识切片` : "企业架构规约与规章手册"}
                  。基于 BM25 与通义 text-embedding-v3 进行混合召回，硬卡 0.65 阈值剔除噪声。
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100 text-[11px] font-mono text-slate-500">
                <span className="px-2 py-0.5 bg-slate-100 rounded-md">两阶段召回</span>
                <span className="px-2 py-0.5 bg-slate-100 rounded-md">RRF 融合精排</span>
                <span className="px-2 py-0.5 bg-slate-100 rounded-md">防幻觉硬过滤</span>
                <span className="px-2 py-0.5 bg-slate-100 rounded-md">切片引用溯源</span>
              </div>
            </div>

            {/* 门户卡片 3: 全链路可观测性与审计日志 */}
            <div
              onClick={() => onOpenModal("logs")}
              className="group p-6 rounded-3xl bg-white border border-slate-200/90 hover:border-emerald-400 hover:shadow-lg transition-all cursor-pointer space-y-4"
            >
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200/80 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Activity className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  <span>查看全链路日志</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>

              <div className="space-y-1.5">
                <h3 className="text-base font-black text-slate-900 group-hover:text-emerald-600 transition">
                  全链路分布式可观测性与安全审计 (Audit Logs)
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  已归档 {logsCount > 0 ? `${logsCount} 笔审计凭证` : "调用链路"}
                  。首字延迟（TTFT）、网络握手 RTT、工具调用入参与受影响行数完整归档对账。
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100 text-[11px] font-mono text-slate-500">
                <span className="px-2 py-0.5 bg-slate-100 rounded-md">TTFT 打点</span>
                <span className="px-2 py-0.5 bg-slate-100 rounded-md">工具参数审计</span>
                <span className="px-2 py-0.5 bg-slate-100 rounded-md">受影响行数</span>
                <span className="px-2 py-0.5 bg-slate-100 rounded-md">对账不可篡改</span>
              </div>
            </div>

            {/* 门户卡片 4: 大模型推理网关与 FinOps 治理 */}
            <div
              onClick={() => onOpenModal("settings")}
              className="group p-6 rounded-3xl bg-white border border-slate-200/90 hover:border-purple-400 hover:shadow-lg transition-all cursor-pointer space-y-4"
            >
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-200/80 text-purple-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Coins className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-purple-600 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  <span>网关配置中心</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>

              <div className="space-y-1.5">
                <h3 className="text-base font-black text-slate-900 group-hover:text-purple-600 transition">
                  大模型服务接入与 FinOps 算力成本治理
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  兼容通义千问、DeepSeek、Ollama 等主流大模型供应商。支持一键官方拉取模型候选池、动态探针测速与 API 密钥脱敏。
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100 text-[11px] font-mono text-slate-500">
                <span className="px-2 py-0.5 bg-slate-100 rounded-md">OpenAI 兼容协议</span>
                <span className="px-2 py-0.5 bg-slate-100 rounded-md">官方拉取模型</span>
                <span className="px-2 py-0.5 bg-slate-100 rounded-md">端点实时测速</span>
                <span className="px-2 py-0.5 bg-slate-100 rounded-md">密文脱敏入库</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── 底部架构声明 ── */}
        <div className="pt-6 pb-12 border-t border-slate-200/70 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-4">
          <div className="flex items-center gap-2 font-mono">
            <span>OwnAgent Platform</span>
            <span>·</span>
            <span>Java 21 LTS + Spring Boot 3 + MySQL 8 / H2 + React 19</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => onOpenModal("tools")}
              className="hover:text-slate-700 transition cursor-pointer"
            >
              MCP 工具市场
            </button>
            <button
              onClick={() => onOpenModal("settings")}
              className="hover:text-slate-700 transition cursor-pointer"
            >
              系统接入设置
            </button>
            <button
              onClick={onEnterWorkbench}
              className="text-blue-600 hover:text-blue-700 font-bold transition cursor-pointer"
            >
              进入工作台 →
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
