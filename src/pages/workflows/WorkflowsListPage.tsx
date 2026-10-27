import React, { useState } from "react";
import {
  Layers,
  Plus,
  Play,
  Trash2,
  Edit2,
  Search,
  CheckCircle2,
  ShieldCheck,
  Zap,
  Briefcase,
  Terminal,
  Activity,
  FileText,
  Cpu,
  Database,
  SlidersHorizontal,
} from "lucide-react";
import { PipelineItem } from "../../types/platform";

interface WorkflowsListPageProps {
  workflows: PipelineItem[];
  onLaunchWorkflow: (wf: PipelineItem) => void;
  onOpenCreate: () => void;
  onOpenEdit: (wf: PipelineItem) => void;
  onDelete: (id: string) => void;
}

export const WorkflowsListPage: React.FC<WorkflowsListPageProps> = ({
  workflows,
  onLaunchWorkflow,
  onOpenCreate,
  onOpenEdit,
  onDelete,
}) => {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");

  const categories = [
    "ALL",
    ...Array.from(new Set(workflows.map((w) => w.category).filter(Boolean))),
  ];

  const filtered = workflows.filter((w) => {
    const matchesSearch =
      w.name.toLowerCase().includes(search.toLowerCase()) ||
      w.description.toLowerCase().includes(search.toLowerCase()) ||
      (w.tags && w.tags.some((t) => t.toLowerCase().includes(search.toLowerCase())));
    const matchesCategory =
      selectedCategory === "ALL" || w.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const renderIcon = (iconName?: string) => {
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
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* 顶部标题与行动区 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-black text-slate-900 tracking-tight">
              企业业务流水线中枢 (Pipeline Orchestration)
            </h2>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold border border-blue-200">
              共 {workflows.length} 条已纳管链路
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            所有业务流水线 100% 存储于后端数据库。支持自由增删改查、提示词参数模板绑定与工作台一键执行。
          </p>
        </div>

        <button
          onClick={onOpenCreate}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-md shadow-blue-500/20 transition cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>新建业务流水线</span>
        </button>
      </div>

      {/* 搜索与分类过滤栏 */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索流水线名称、执行链描述或规约标签..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-hidden focus:bg-white focus:border-blue-500 transition"
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-hide">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                selectedCategory === cat
                  ? "bg-slate-900 text-white shadow-2xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {cat === "ALL" ? "全部领域" : cat}
            </button>
          ))}
        </div>
      </div>

      {/* 列表渲染 */}
      {filtered.length === 0 ? (
        <div className="p-12 text-center bg-white border border-dashed border-slate-200 rounded-3xl space-y-3">
          <Layers className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-sm font-bold text-slate-700">未检索到匹配的业务流水线</p>
          <p className="text-xs text-slate-400">
            尝试更换关键词，或点击“新建业务流水线”创建一条专属链路
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((wf) => (
            <div
              key={wf.id}
              className="group p-5 bg-white border border-slate-200/90 hover:border-blue-400 rounded-2xl shadow-2xs hover:shadow-md transition flex flex-col justify-between space-y-4 text-left"
            >
              <div className="space-y-3">
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
                      onClick={() => onOpenEdit(wf)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                      title="编辑配置"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`确定要从数据库中删除流水线 [${wf.name}] 吗？`)) {
                          onDelete(wf.id);
                        }
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                      title="删除流水线"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <span className="p-1.5">{renderIcon(wf.icon)}</span>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-black text-slate-800 group-hover:text-blue-600 transition tracking-tight">
                    {wf.name}
                  </h3>
                  <p className="text-xs text-slate-500 leading-snug line-clamp-2 mt-1">
                    {wf.description}
                  </p>
                </div>

                {/* 触发提示词预览 */}
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-600 font-mono line-clamp-2">
                  <span className="font-bold text-slate-400 select-none">Prompt: </span>
                  {wf.promptTemplate}
                </div>

                {/* 标签 */}
                {wf.tags && wf.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
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

              {/* 卡片底栏 */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <div className="text-slate-400 font-mono">
                  <span>{wf.version || "v1.0.0"}</span>
                  <span className="mx-1.5">·</span>
                  <span>{wf.updatedAt || "刚刚"}</span>
                </div>

                <button
                  onClick={() => onLaunchWorkflow(wf)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition shadow-xs cursor-pointer"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>启动执行</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WorkflowsListPage;

