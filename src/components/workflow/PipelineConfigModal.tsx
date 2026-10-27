import React, { useState, useEffect } from "react";
import {
  X,
  Layers,
  Sparkles,
  ShieldCheck,
  Zap,
  Briefcase,
  Terminal,
  Activity,
  FileText,
  Cpu,
  Database,
  Check,
  HelpCircle,
} from "lucide-react";
import { PipelineItem } from "../../types/platform";
import { saveWorkflowApi } from "../../services/api";

interface PipelineConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPipeline: PipelineItem | null;
  onSaved: (saved: PipelineItem) => void;
}

const ICON_OPTIONS = [
  { label: "安全防护", value: "ShieldCheck", icon: ShieldCheck },
  { label: "性能加速", value: "Zap", icon: Zap },
  { label: "商务风控", value: "Briefcase", icon: Briefcase },
  { label: "研发效能", value: "Terminal", icon: Terminal },
  { label: "监控指标", value: "Activity", icon: Activity },
  { label: "规约手册", value: "FileText", icon: FileText },
  { label: "算力模型", value: "Cpu", icon: Cpu },
  { label: "数据库", value: "Database", icon: Database },
];

export const PipelineConfigModal: React.FC<PipelineConfigModalProps> = ({
  isOpen,
  onClose,
  initialPipeline,
  onSaved,
}) => {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("DevOps / SRE 运维");
  const [badge, setBadge] = useState("生产巡检拦截");
  const [icon, setIcon] = useState("ShieldCheck");
  const [description, setDescription] = useState("");
  const [promptTemplate, setPromptTemplate] = useState("");
  const [tagsStr, setTagsStr] = useState("");
  const [version, setVersion] = useState("v1.0.0");
  const [enabled, setEnabled] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (initialPipeline) {
      setName(initialPipeline.name || "");
      setCategory(initialPipeline.category || "DevOps / SRE 运维");
      setBadge(initialPipeline.badge || "生产巡检拦截");
      setIcon(initialPipeline.icon || "ShieldCheck");
      setDescription(initialPipeline.description || "");
      setPromptTemplate(initialPipeline.promptTemplate || "");
      setTagsStr(initialPipeline.tags ? initialPipeline.tags.join(", ") : "");
      setVersion(initialPipeline.version || "v1.0.0");
      setEnabled(initialPipeline.enabled !== false);
    } else {
      setName("");
      setCategory("DevOps / SRE 运维");
      setBadge("自动化治理流水线");
      setIcon("ShieldCheck");
      setDescription("规约对齐 → 状态感知 → 业务规则检验 → 人机核准 → 物理生效 → 审计存证");
      setPromptTemplate("请启动生产巡检与合规治理流水线：检索相关规范，调用受控工具查询运行状态，若有高危变更强制执行人机协同 2PC 拦截。");
      setTagsStr("安全规约, 工具调用, 二阶段拦截, 审计闭环");
      setVersion("v1.0.0");
      setEnabled(true);
    }
    setErrorMsg("");
  }, [initialPipeline, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg("请输入业务流水线名称");
      return;
    }
    if (!promptTemplate.trim()) {
      setErrorMsg("请输入触发提示词模板");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg("");
      const tags = tagsStr
        .split(/[,，]/)
        .map((s) => s.trim())
        .filter(Boolean);

      const saved = await saveWorkflowApi({
        id: initialPipeline?.id,
        name: name.trim(),
        category: category.trim(),
        badge: badge.trim(),
        icon,
        description: description.trim(),
        promptTemplate: promptTemplate.trim(),
        tags,
        version: version.trim(),
        enabled,
      });

      onSaved(saved);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "保存流水线配置失败，请检查后端网络与数据库");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* 顶部标题栏 */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200/80 text-blue-600 flex items-center justify-center font-bold">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800">
                {initialPipeline ? "编辑业务自动化流水线" : "新建业务自动化流水线"}
              </h3>
              <p className="text-[11px] text-slate-400 font-mono">
                配置将持久化至 MySQL 数据库，支持在工作台与首页一键触发
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 表单内容 */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl font-medium">
              {errorMsg}
            </div>
          )}

          {/* 名称与版本 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="font-bold text-slate-700 flex items-center gap-1">
                <span>流水线名称</span>
                <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：生产巡检与高危变更核准"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-hidden font-medium text-slate-800 transition"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700">版本标识</label>
              <input
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="v1.0.0"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-hidden font-mono text-slate-800 transition"
              />
            </div>
          </div>

          {/* 业务领域与徽标 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700">业务领域 / 归属类别</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 outline-hidden font-medium text-slate-800 transition cursor-pointer"
              >
                <option value="DevOps / SRE 运维">DevOps / SRE 运维</option>
                <option value="系统架构深度">系统架构深度</option>
                <option value="财务合规风控">财务合规风控</option>
                <option value="研发效能治理">研发效能治理</option>
                <option value="企业知识资产">企业知识资产</option>
                <option value="客户成功与运营">客户成功与运营</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-700">卡片徽标文字 (Badge)</label>
              <input
                type="text"
                value={badge}
                onChange={(e) => setBadge(e.target.value)}
                placeholder="例如：SRE 运维高危拦截"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 outline-hidden font-medium text-slate-800 transition"
              />
            </div>
          </div>

          {/* 图标与启用状态 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700">卡片主题图标</label>
              <div className="flex flex-wrap gap-1.5">
                {ICON_OPTIONS.map((opt) => {
                  const IconComp = opt.icon;
                  const isSelected = icon === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setIcon(opt.value)}
                      title={opt.label}
                      className={`p-2 rounded-xl border flex items-center justify-center transition cursor-pointer ${
                        isSelected
                          ? "bg-blue-50 border-blue-500 text-blue-600 ring-2 ring-blue-100"
                          : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                      }`}
                    >
                      <IconComp className="w-4 h-4" />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5 sm:pt-4">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                />
                <span className="font-bold text-slate-700">启用该流水线（在首页与工作台展示）</span>
              </label>
              <p className="text-[11px] text-slate-400">停用后可在管理中心随时重新激活</p>
            </div>
          </div>

          {/* 链路阶段描述 */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700 flex items-center justify-between">
              <span>链路执行流描述</span>
              <span className="text-[11px] font-normal text-slate-400">简明概述各阶段流转过程</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="例如：规约对齐 → 库表感知 → 高危SQL拦截 → 人机核准 → 物理生效 → 审计归档"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 outline-hidden font-medium text-slate-800 transition"
            />
          </div>

          {/* 触发提示词模板 */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <span>触发提示词模板 (Prompt Template)</span>
                <span className="text-rose-500">*</span>
              </span>
              <span className="text-[11px] font-normal text-slate-400">
                用户点击“启动流水线”时发送给大模型/智能体的完整指令
              </span>
            </label>
            <textarea
              rows={4}
              value={promptTemplate}
              onChange={(e) => setPromptTemplate(e.target.value)}
              placeholder="请输入清晰的端到端自动化业务处理指令..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 outline-hidden font-sans text-xs text-slate-800 leading-relaxed transition"
            />
          </div>

          {/* 标签列表 */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700 flex items-center justify-between">
              <span>核心特性标签</span>
              <span className="text-[11px] font-normal text-slate-400">用英文或中文逗号隔开</span>
            </label>
            <input
              type="text"
              value={tagsStr}
              onChange={(e) => setTagsStr(e.target.value)}
              placeholder="例如：安全规约, 工具调用, 二阶段拦截, 审计闭环"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 outline-hidden font-medium text-slate-800 transition"
            />
          </div>
        </form>

        {/* 底部操作区 */}
        <div className="px-6 py-3.5 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition cursor-pointer"
          >
            取消
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleSubmit}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-md shadow-blue-500/20 transition cursor-pointer flex items-center gap-1.5"
          >
            {isSubmitting ? (
              <span>正在保存入库...</span>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>保存流水线配置</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PipelineConfigModal;

