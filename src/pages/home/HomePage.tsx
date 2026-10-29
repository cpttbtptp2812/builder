import React from "react";
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Cpu,
  Layers,
  Database,
  Wrench,
  Activity,
  FileCheck2,
  CheckCircle2,
  Terminal,
  Zap,
  Play,
  MessageSquare,
  ChevronRight,
  FileText,
  Bot,
  Settings,
  BookOpen,
  ArrowUpRight,
} from "lucide-react";
import { PipelineItem } from "../../types/platform";

interface HomePageProps {
  onEnterWorkbench: () => void;
  onEnterWorkbenchWithPrompt?: (prompt: string, autoSend?: boolean) => void;
  onLaunchWorkflow?: (workflow: PipelineItem) => void;
  onOpenModal: (tab: "settings" | "knowledge" | "tools" | "logs" | "agents" | "workflows") => void;
  workflows?: PipelineItem[];
}

export const HomePage: React.FC<HomePageProps> = ({
  onEnterWorkbench,
  onEnterWorkbenchWithPrompt,
  onOpenModal,
  workflows = [],
}) => {
  return (
    <div className="flex-1 overflow-y-auto bg-[#F8FAFC] text-slate-800 scrollbar-hide">
      {/* 顶部 Hero 区域 */}
      <section className="relative px-6 pt-10 pb-12 lg:px-12 border-b border-slate-200/80 bg-gradient-to-b from-white via-white to-slate-50/70">
        <div className="max-w-6xl mx-auto space-y-5 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-200/80 rounded-full text-xs font-semibold text-blue-700 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
            <span>OwnAgent 企业级智能体编排与全链路可观测平台</span>
          </div>

          <div className="max-w-4xl space-y-3">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight">
              打通大模型与企业核心业务
              <br />
              <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 bg-clip-text text-transparent">
                规则合规校验 · 高危操作人工复核 · 实时全链路观测
              </span>
            </h1>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-3xl">
              结合领域知识库检索、业务合规规约校验、受控外部系统调用与全流程操作审计。支持对话左侧实时执行步骤流与右侧毫秒级 APM 瀑布流观测面板。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2 justify-center sm:justify-start">
            <button
              onClick={onEnterWorkbench}
              className="inline-flex items-center gap-2 px-6 py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-2xl font-bold text-sm shadow-lg shadow-blue-500/25 transition cursor-pointer"
            >
              <span>进入智能工作台 (左右协同)</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => onOpenModal("workflows")}
              className="inline-flex items-center gap-2 px-5 py-3.5 bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-700 hover:text-blue-700 rounded-2xl font-bold text-sm shadow-2xs transition cursor-pointer"
            >
              <Layers className="w-4 h-4 text-blue-600" />
              <span>流水线编排中心</span>
            </button>
          </div>
        </div>
      </section>

      {/* 主体功能卡片区域 */}
      <div className="max-w-6xl mx-auto px-6 py-8 lg:px-12 space-y-10">
        {/* 核心平台导航 */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">
                平台核心功能矩阵
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                支持点击直达各功能模块，体验端到端业务闭环
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* 卡片 1: 智能工作台 */}
            <div
              onClick={onEnterWorkbench}
              className="group p-5 rounded-2xl bg-white hover:bg-blue-50/30 border border-slate-200/90 hover:border-blue-400 shadow-2xs hover:shadow-md transition cursor-pointer flex flex-col justify-between space-y-3"
            >
              <div className="space-y-2.5">
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center font-bold group-hover:scale-105 transition">
                  <Sparkles className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-black text-slate-900 group-hover:text-blue-600 transition flex items-center justify-between">
                  <span>智能工作台</span>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition" />
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  对话式业务交互与指令驱动。左侧实时展示 AI 推理与业务执行步骤，右侧实时联动 APM 毫秒级瀑布流抽屉。
                </p>
              </div>
              <span className="text-[11px] font-bold text-blue-600 group-hover:translate-x-1 transition inline-flex items-center gap-1 pt-1">
                进入工作台 <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>

            {/* 卡片 2: 流水线编排 */}
            <div
              onClick={() => onOpenModal("workflows")}
              className="group p-5 rounded-2xl bg-white hover:bg-indigo-50/30 border border-slate-200/90 hover:border-indigo-400 shadow-2xs hover:shadow-md transition cursor-pointer flex flex-col justify-between space-y-3"
            >
              <div className="space-y-2.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-bold group-hover:scale-105 transition">
                  <Layers className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-black text-slate-900 group-hover:text-indigo-600 transition flex items-center justify-between">
                  <span>流水线编排</span>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition" />
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  可视化业务流程拓扑设计。支持参数解析、业务规则合规校验、人工复核闸口与审计存证节点。
                </p>
              </div>
              <span className="text-[11px] font-bold text-indigo-600 group-hover:translate-x-1 transition inline-flex items-center gap-1 pt-1">
                编排流水线 <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>

            {/* 卡片 3: 知识库管理 */}
            <div
              onClick={() => onOpenModal("knowledge")}
              className="group p-5 rounded-2xl bg-white hover:bg-emerald-50/30 border border-slate-200/90 hover:border-emerald-400 shadow-2xs hover:shadow-md transition cursor-pointer flex flex-col justify-between space-y-3"
            >
              <div className="space-y-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center font-bold group-hover:scale-105 transition">
                  <BookOpen className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-black text-slate-900 group-hover:text-emerald-600 transition flex items-center justify-between">
                  <span>企业知识库</span>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-500 transition" />
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  企业制度、风控规约与技术规范管理。支持切片检索调试、在线编辑修改与标准 Markdown 模版导入导出。
                </p>
              </div>
              <span className="text-[11px] font-bold text-emerald-600 group-hover:translate-x-1 transition inline-flex items-center gap-1 pt-1">
                管理知识库 <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>

            {/* 卡片 4: 智能体中心 */}
            <div
              onClick={() => onOpenModal("agents")}
              className="group p-5 rounded-2xl bg-white hover:bg-amber-50/30 border border-slate-200/90 hover:border-amber-400 shadow-2xs hover:shadow-md transition cursor-pointer flex flex-col justify-between space-y-3"
            >
              <div className="space-y-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center font-bold group-hover:scale-105 transition">
                  <Bot className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-black text-slate-900 group-hover:text-amber-600 transition flex items-center justify-between">
                  <span>智能体中心</span>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-amber-500 transition" />
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  多领域专家智能体配置。支持模型路由设定（通义千问、DeepSeek、本地 Ollama）与专业提示词设定。
                </p>
              </div>
              <span className="text-[11px] font-bold text-amber-600 group-hover:translate-x-1 transition inline-flex items-center gap-1 pt-1">
                配置智能体 <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>

            {/* 卡片 5: 扩展工具库 */}
            <div
              onClick={() => onOpenModal("tools")}
              className="group p-5 rounded-2xl bg-white hover:bg-cyan-50/30 border border-slate-200/90 hover:border-cyan-400 shadow-2xs hover:shadow-md transition cursor-pointer flex flex-col justify-between space-y-3"
            >
              <div className="space-y-2.5">
                <div className="w-10 h-10 rounded-xl bg-cyan-50 border border-cyan-100 text-cyan-600 flex items-center justify-center font-bold group-hover:scale-105 transition">
                  <Wrench className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-black text-slate-900 group-hover:text-cyan-600 transition flex items-center justify-between">
                  <span>扩展工具库</span>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-cyan-500 transition" />
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  系统受控工具与 API 注册中心。支持健康检查检测、高危 SQL 拦截核准与接口参数实时连通性测试。
                </p>
              </div>
              <span className="text-[11px] font-bold text-cyan-600 group-hover:translate-x-1 transition inline-flex items-center gap-1 pt-1">
                查看工具库 <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>

            {/* 卡片 6: 系统配置与审计日志 */}
            <div
              onClick={() => onOpenModal("settings")}
              className="group p-5 rounded-2xl bg-white hover:bg-purple-50/30 border border-slate-200/90 hover:border-purple-400 shadow-2xs hover:shadow-md transition cursor-pointer flex flex-col justify-between space-y-3"
            >
              <div className="space-y-2.5">
                <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 text-purple-600 flex items-center justify-center font-bold group-hover:scale-105 transition">
                  <Activity className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-black text-slate-900 group-hover:text-purple-600 transition flex items-center justify-between">
                  <span>系统配置与审计日志</span>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-purple-500 transition" />
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  大模型配置、API 密钥安全存取与全流程操作审计日志。记录每次问答的耗时、Token 成本与审核记录。
                </p>
              </div>
              <span className="text-[11px] font-bold text-purple-600 group-hover:translate-x-1 transition inline-flex items-center gap-1 pt-1">
                系统与审计 <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        </section>

        {/* 业务流水线区域 */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">
                业务自动化流水线
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                点击卡片即可在智能工作台中实时协同运行，左侧推演步骤，右侧毫秒级瀑布流观测
              </p>
            </div>

            {workflows.length > 0 && (
              <button
                onClick={() => onOpenModal("workflows")}
                className="text-xs text-blue-600 hover:text-blue-700 font-bold hover:underline cursor-pointer flex items-center gap-1"
              >
                <span>管理流水线 ({workflows.length})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {workflows.length === 0 ? (
            <div className="p-8 text-center bg-white border border-dashed border-slate-200 rounded-3xl space-y-3">
              <Layers className="w-10 h-10 text-slate-300 mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-700">暂无已配置的业务流水线</p>
                <p className="text-xs text-slate-400">系统已接入真实数据库持久化，您可以前往流水线编排页面新建或一键导入标准业务模版。</p>
              </div>
              <button
                onClick={() => onOpenModal("workflows")}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer inline-flex items-center gap-1.5"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>前往流水线页面导入或新建</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {workflows.map((wf) => (
                <div
                  key={wf.id}
                  onClick={() => {
                    if (onEnterWorkbenchWithPrompt) {
                      onEnterWorkbenchWithPrompt(wf.promptTemplate, true);
                    } else {
                      onEnterWorkbench();
                    }
                  }}
                  className="p-5 rounded-2xl bg-white border border-slate-200/90 hover:border-blue-400 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-4 cursor-pointer group"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-blue-50 text-blue-700 border-blue-200">
                          {wf.badge || wf.category || "自动化"}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">
                          {wf.version || "v1.0.0"}
                        </span>
                      </div>
                    </div>

                    <h3 className="text-sm font-black text-slate-900 group-hover:text-blue-600 transition">
                      {wf.name}
                    </h3>

                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                      {wf.description}
                    </p>

                    {wf.tags && wf.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
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

                  <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onEnterWorkbenchWithPrompt) {
                          onEnterWorkbenchWithPrompt(wf.promptTemplate, false);
                        }
                      }}
                      className="text-xs font-semibold text-slate-500 hover:text-blue-600 transition cursor-pointer"
                      title="填入工作台输入框（不自动发送）"
                    >
                      填入对话
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onEnterWorkbenchWithPrompt) {
                          onEnterWorkbenchWithPrompt(wf.promptTemplate, true);
                        }
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
                      title="在智能工作台中左右实时分屏执行"
                    >
                      <span>协同执行 ↗</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default HomePage;
