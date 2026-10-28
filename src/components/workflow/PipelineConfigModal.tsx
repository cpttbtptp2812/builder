import React, { useState, useEffect } from "react";
import {
  X,
  Layers,
  ShieldCheck,
  Zap,
  Briefcase,
  Terminal,
  Activity,
  FileText,
  Cpu,
  Database,
  Check,
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  ChevronDown,
  ChevronRight,
  Globe,
  Sliders,
  UserCheck,
  Sparkles,
} from "lucide-react";
import { PipelineItem, PipelineStep, StepActionType } from "../../types/platform";
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

const STEP_TYPE_CONFIG: Record<
  StepActionType,
  { label: string; desc: string; icon: any; color: string; bg: string; border: string }
> = {
  INPUT_EXTRACT: {
    label: "数据提取与脱敏",
    desc: "提取问句/表单入参字段，进行隐私脱敏与格式校验",
    icon: Database,
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-200",
  },
  RULE_CHECK: {
    label: "规则引擎校验",
    desc: "执行逻辑表达式或阈值判断，决定后续走向",
    icon: Sliders,
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
  },
  HITL_APPROVAL: {
    label: "2PC 人工安全审批门闩",
    desc: "针对高危操作挂起流转，等待授权审批释放",
    icon: UserCheck,
    color: "text-purple-600",
    bg: "bg-purple-50",
    border: "border-purple-200",
  },
  HTTP_TOOL: {
    label: "外部系统 API / MCP",
    desc: "调用真实的第三方接口、微服务或 MCP 工具网关",
    icon: Globe,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
  },
  LLM_REDUCE: {
    label: "大模型总结与归约",
    desc: "聚合各节点执行上下文，生成流式自然语言回答",
    icon: Sparkles,
    color: "text-indigo-600",
    bg: "bg-indigo-50",
    border: "border-indigo-200",
  },
};

const DEFAULT_STARTER_STEPS: PipelineStep[] = [
  {
    id: "step_1",
    name: "入参字段解析与安全掩码",
    type: "INPUT_EXTRACT",
    description: "从用户输入或上传材料中提取核心业务字段并做脱敏",
    config: {
      fields: "applicant, amount, department, target_date",
      maskSensitive: true,
    },
  },
  {
    id: "step_2",
    name: "业务制度与阈值合规判断",
    type: "RULE_CHECK",
    description: "对金额、职级或业务条件进行规则计算",
    config: {
      ruleExpr: "amount <= 50000 && department != ''",
    },
  },
  {
    id: "step_3",
    name: "2PC 人机审批确认门闩",
    type: "HITL_APPROVAL",
    description: "重要操作触发审批票据并挂起任务，等待人工放行",
    config: {
      approverRole: "技术总监 / 财务负责人",
      timeoutSeconds: 3600,
    },
  },
  {
    id: "step_4",
    name: "外部业务系统同步",
    type: "HTTP_TOOL",
    description: "调用企业后台业务接口完成物理生效",
    config: {
      apiUrl: "https://api.internal.com/v1/biz/apply",
      apiMethod: "POST",
      apiHeaders: "Authorization: Bearer {{SYSTEM_TOKEN}}",
    },
  },
  {
    id: "step_5",
    name: "办结结果聚合与流式输出",
    type: "LLM_REDUCE",
    description: "整合所有步骤产出，输出结构化办结报告",
    config: {
      outputFormat: "STREAM_TEXT",
    },
  },
];

export const PipelineConfigModal: React.FC<PipelineConfigModalProps> = ({
  isOpen,
  onClose,
  initialPipeline,
  onSaved,
}) => {
  const [activeTab, setActiveTab] = useState<"steps" | "basic">("steps");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("业务自动化");
  const [badge, setBadge] = useState("生产流水线");
  const [icon, setIcon] = useState("ShieldCheck");
  const [description, setDescription] = useState("");
  const [promptTemplate, setPromptTemplate] = useState("");
  const [tagsStr, setTagsStr] = useState("");
  const [version, setVersion] = useState("v1.0.0");
  const [enabled, setEnabled] = useState(true);
  const [steps, setSteps] = useState<PipelineStep[]>(DEFAULT_STARTER_STEPS);
  const [expandedStepId, setExpandedStepId] = useState<string | null>("step_1");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (initialPipeline) {
      setName(initialPipeline.name || "");
      setCategory(initialPipeline.category || "业务自动化");
      setBadge(initialPipeline.badge || "生产流水线");
      setIcon(initialPipeline.icon || "ShieldCheck");
      setDescription(initialPipeline.description || "");
      setPromptTemplate(initialPipeline.promptTemplate || "");
      setTagsStr(initialPipeline.tags ? initialPipeline.tags.join(", ") : "");
      setVersion(initialPipeline.version || "v1.0.0");
      setEnabled(initialPipeline.enabled !== false);

      if (initialPipeline.steps && initialPipeline.steps.length > 0) {
        setSteps(initialPipeline.steps);
        setExpandedStepId(initialPipeline.steps[0].id);
      } else if (initialPipeline.topologyJson) {
        try {
          const parsed = JSON.parse(initialPipeline.topologyJson);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setSteps(parsed);
            setExpandedStepId(parsed[0].id);
          } else {
            setSteps(DEFAULT_STARTER_STEPS);
            setExpandedStepId(DEFAULT_STARTER_STEPS[0].id);
          }
        } catch {
          setSteps(DEFAULT_STARTER_STEPS);
        }
      } else {
        setSteps(DEFAULT_STARTER_STEPS);
      }
    } else {
      setName("");
      setCategory("人事行政");
      setBadge("入职录用流水线");
      setIcon("ShieldCheck");
      setDescription("入参提取 → 薪酬职级校验 → 2PC 审批门闩 → 外部工号生成 → 邮件通知与归档");
      setPromptTemplate("请启动新员工录用审批流水线：解析录用材料中的职级与薪资，核验合规性并提交人机审批门闩，审批通过后同步创建系统账号。");
      setTagsStr("录用审批, 规则校验, 2PC拦截, 系统同步");
      setVersion("v1.0.0");
      setEnabled(true);
      setSteps(DEFAULT_STARTER_STEPS);
      setExpandedStepId(DEFAULT_STARTER_STEPS[0].id);
    }
    setActiveTab("steps");
    setErrorMsg("");
  }, [initialPipeline, isOpen]);

  if (!isOpen) return null;

  // 步骤移动：上移
  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    setSteps((prev) => {
      const next = [...prev];
      const tmp = next[index - 1];
      next[index - 1] = next[index];
      next[index] = tmp;
      return next;
    });
  };

  // 步骤移动：下移
  const handleMoveDown = (index: number) => {
    if (index === steps.length - 1) return;
    setSteps((prev) => {
      const next = [...prev];
      const tmp = next[index + 1];
      next[index + 1] = next[index];
      next[index] = tmp;
      return next;
    });
  };

  // 删除步骤
  const handleDeleteStep = (id: string) => {
    if (steps.length <= 1) {
      setErrorMsg("流水线至少需要保留 1 个步骤");
      return;
    }
    setSteps((prev) => prev.filter((s) => s.id !== id));
    if (expandedStepId === id) setExpandedStepId(null);
  };

  // 新增步骤
  const handleAddStep = () => {
    const newId = `step_${Date.now()}`;
    const newStep: PipelineStep = {
      id: newId,
      name: `新增步骤 #${steps.length + 1}`,
      type: "HTTP_TOOL",
      description: "自定义处理节点",
      config: {
        apiUrl: "https://api.internal.com/v1/action",
        apiMethod: "POST",
      },
    };
    setSteps((prev) => [...prev, newStep]);
    setExpandedStepId(newId);
  };

  // 更新步骤字段
  const updateStep = (id: string, updates: Partial<PipelineStep>) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
  };

  // 更新步骤 config 内部字段
  const updateStepConfig = (id: string, configUpdates: Record<string, any>) => {
    setSteps((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, config: { ...s.config, ...configUpdates } } : s
      )
    );
  };

  // 提交保存至后端 MySQL
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
    if (steps.length === 0) {
      setErrorMsg("流水线步骤不能为空");
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
        steps,
        topologyJson: JSON.stringify(steps),
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-3xl bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* 顶部标题栏 */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-sm shadow-blue-500/30">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-slate-900">
                  {initialPipeline ? "配置业务流程清单 (Step Recipe)" : "新建业务数据流水线"}
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-blue-50 text-blue-700 border border-blue-200 font-bold">
                  {steps.length} 个执行节点
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-sans">
                纯动态数据流 · 0 硬编码 · 配置将直接存入 MySQL 驱动执行瀑布流
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

        {/* 选项卡切换器 */}
        <div className="flex border-b border-slate-100 bg-white px-6 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab("steps")}
            className={`px-4 py-2.5 text-xs font-bold transition border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === "steps"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>核心步骤清单 (Step Recipe)</span>
            <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[10px] font-mono">
              {steps.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("basic")}
            className={`px-4 py-2.5 text-xs font-bold transition border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === "basic"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>流程基础属性与触发指令</span>
          </button>
        </div>

        {/* 表单内容 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs bg-slate-50/30">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* TAB 1: 步骤清单配置 (Step Recipe) */}
          {activeTab === "steps" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">
                    垂直步骤执行序列
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    运行时将按此清单从上到下严格顺序执行，每一步的输出将作为黑板上下文传递给下一步
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddStep}
                  className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200/80 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>添加执行步骤</span>
                </button>
              </div>

              {/* 步骤列表栈 */}
              <div className="space-y-2.5">
                {steps.map((step, idx) => {
                  const cfg = STEP_TYPE_CONFIG[step.type] || STEP_TYPE_CONFIG.HTTP_TOOL;
                  const IconComp = cfg.icon;
                  const isExpanded = expandedStepId === step.id;

                  return (
                    <div
                      key={step.id}
                      className={`rounded-2xl border transition overflow-hidden bg-white ${
                        isExpanded
                          ? "border-blue-300 ring-2 ring-blue-50 shadow-sm"
                          : "border-slate-200/90 hover:border-slate-300 shadow-xs"
                      }`}
                    >
                      {/* 卡片头部概览 */}
                      <div
                        onClick={() =>
                          setExpandedStepId(isExpanded ? null : step.id)
                        }
                        className="p-3.5 flex items-center justify-between cursor-pointer select-none"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center font-mono font-bold text-[11px]">
                            {idx + 1}
                          </span>
                          <div
                            className={`w-7 h-7 rounded-xl flex items-center justify-center border ${cfg.bg} ${cfg.color} ${cfg.border}`}
                          >
                            <IconComp className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-800 text-xs">
                                {step.name}
                              </span>
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${cfg.bg} ${cfg.color} ${cfg.border}`}
                              >
                                {cfg.label}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                              {step.description || cfg.desc}
                            </p>
                          </div>
                        </div>

                        {/* 快捷操作区 */}
                        <div
                          className="flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveUp(idx)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 transition cursor-pointer"
                            title="上移"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === steps.length - 1}
                            onClick={() => handleMoveDown(idx)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 transition cursor-pointer"
                            title="下移"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteStep(step.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer ml-1"
                            title="删除此步骤"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <div className="w-px h-3.5 bg-slate-200 mx-1" />
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedStepId(isExpanded ? null : step.id)
                            }
                            className="p-1 text-slate-400 hover:text-slate-700 transition"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* 展开的编辑详情面板 */}
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-2 border-t border-slate-100 bg-slate-50/50 space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="font-bold text-slate-700">步骤名称</label>
                              <input
                                type="text"
                                value={step.name}
                                onChange={(e) =>
                                  updateStep(step.id, { name: e.target.value })
                                }
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:border-blue-500 outline-hidden font-medium text-slate-800 transition"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="font-bold text-slate-700">节点类型</label>
                              <select
                                value={step.type}
                                onChange={(e) =>
                                  updateStep(step.id, {
                                    type: e.target.value as StepActionType,
                                  })
                                }
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:border-blue-500 outline-hidden font-medium text-slate-800 transition cursor-pointer"
                              >
                                {Object.entries(STEP_TYPE_CONFIG).map(([k, v]) => (
                                  <option key={k} value={k}>
                                    {v.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="font-bold text-slate-700">步骤说明</label>
                            <input
                              type="text"
                              value={step.description || ""}
                              onChange={(e) =>
                                updateStep(step.id, { description: e.target.value })
                              }
                              placeholder="简述本节点在业务流中的处理内容..."
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:border-blue-500 outline-hidden text-slate-700 transition"
                            />
                          </div>

                          {/* 类型专属配置表单 */}
                          {step.type === "INPUT_EXTRACT" && (
                            <div className="p-3 bg-white border border-blue-100 rounded-xl space-y-2">
                              <label className="font-bold text-blue-900 block">
                                待提取/映射的参数字段（逗号隔开）
                              </label>
                              <input
                                type="text"
                                value={step.config.fields || ""}
                                onChange={(e) =>
                                  updateStepConfig(step.id, { fields: e.target.value })
                                }
                                placeholder="例如：applicant, amount, department, order_id"
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                              />
                              <label className="flex items-center gap-2 cursor-pointer pt-1 text-slate-700 font-medium">
                                <input
                                  type="checkbox"
                                  checked={step.config.maskSensitive !== false}
                                  onChange={(e) =>
                                    updateStepConfig(step.id, {
                                      maskSensitive: e.target.checked,
                                    })
                                  }
                                  className="rounded text-blue-600 border-slate-300"
                                />
                                <span>开启敏感字段脱敏掩码（如身份证、密码、手机号）</span>
                              </label>
                            </div>
                          )}

                          {step.type === "RULE_CHECK" && (
                            <div className="p-3 bg-white border border-amber-100 rounded-xl space-y-2">
                              <label className="font-bold text-amber-900 block">
                                规则判断表达式 (Rule Expression)
                              </label>
                              <input
                                type="text"
                                value={step.config.ruleExpr || ""}
                                onChange={(e) =>
                                  updateStepConfig(step.id, { ruleExpr: e.target.value })
                                }
                                placeholder="例如：amount <= 50000 || role == 'MANAGER'"
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800"
                              />
                              <p className="text-[11px] text-slate-400">
                                规则引擎将自动代入上下文变量进行物理真假判定
                              </p>
                            </div>
                          )}

                          {step.type === "HITL_APPROVAL" && (
                            <div className="p-3 bg-white border border-purple-100 rounded-xl space-y-2">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div>
                                  <label className="font-bold text-purple-900 block">
                                    核准审批角色 (Approver Role)
                                  </label>
                                  <input
                                    type="text"
                                    value={step.config.approverRole || ""}
                                    onChange={(e) =>
                                      updateStepConfig(step.id, {
                                        approverRole: e.target.value,
                                      })
                                    }
                                    placeholder="例如：技术总监 / 财务负责人 / 安全官"
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                                  />
                                </div>
                                <div>
                                  <label className="font-bold text-purple-900 block">
                                    超时等待秒数 (Timeout Seconds)
                                  </label>
                                  <input
                                    type="number"
                                    value={step.config.timeoutSeconds || 3600}
                                    onChange={(e) =>
                                      updateStepConfig(step.id, {
                                        timeoutSeconds: parseInt(e.target.value) || 3600,
                                      })
                                    }
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                                  />
                                </div>
                              </div>
                              <p className="text-[11px] text-slate-400">
                                执行到此步骤时，流式瀑布流将自动变黄挂起，原地弹出【批准/驳回】操作按钮
                              </p>
                            </div>
                          )}

                          {step.type === "HTTP_TOOL" && (
                            <div className="p-3 bg-white border border-emerald-100 rounded-xl space-y-2">
                              <div className="grid grid-cols-4 gap-2">
                                <div className="col-span-1">
                                  <label className="font-bold text-emerald-900 block">
                                    Method
                                  </label>
                                  <select
                                    value={step.config.apiMethod || "POST"}
                                    onChange={(e) =>
                                      updateStepConfig(step.id, {
                                        apiMethod: e.target.value,
                                      })
                                    }
                                    className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold"
                                  >
                                    <option value="GET">GET</option>
                                    <option value="POST">POST</option>
                                    <option value="PUT">PUT</option>
                                    <option value="DELETE">DELETE</option>
                                  </select>
                                </div>
                                <div className="col-span-3">
                                  <label className="font-bold text-emerald-900 block">
                                    API 端点 URL
                                  </label>
                                  <input
                                    type="text"
                                    value={step.config.apiUrl || ""}
                                    onChange={(e) =>
                                      updateStepConfig(step.id, {
                                        apiUrl: e.target.value,
                                      })
                                    }
                                    placeholder="https://api.yourcompany.com/v1/action"
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="font-bold text-emerald-900 block">
                                  请求头配置 (Headers)
                                </label>
                                <input
                                  type="text"
                                  value={step.config.apiHeaders || ""}
                                  onChange={(e) =>
                                    updateStepConfig(step.id, {
                                      apiHeaders: e.target.value,
                                    })
                                  }
                                  placeholder="Authorization: Bearer {{TOKEN}}"
                                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                                />
                              </div>
                            </div>
                          )}

                          {step.type === "LLM_REDUCE" && (
                            <div className="p-3 bg-white border border-indigo-100 rounded-xl space-y-2">
                              <label className="font-bold text-indigo-900 block">
                                最终输出渲染格式
                              </label>
                              <select
                                value={step.config.outputFormat || "STREAM_TEXT"}
                                onChange={(e) =>
                                  updateStepConfig(step.id, {
                                    outputFormat: e.target.value,
                                  })
                                }
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                              >
                                <option value="STREAM_TEXT">流式自然语言打字渲染 (Stream Markdown)</option>
                                <option value="JSON">结构化数据 JSON 结果包</option>
                                <option value="TABLE">报告与表格凭证视图</option>
                              </select>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 底部新增大卡片 */}
              <button
                type="button"
                onClick={handleAddStep}
                className="w-full py-3 border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 rounded-2xl text-slate-500 hover:text-blue-600 font-bold flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>在末尾添加下一步骤</span>
              </button>
            </div>
          )}

          {/* TAB 2: 基础信息与提示词配置 */}
          {activeTab === "basic" && (
            <div className="space-y-4">
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
                    placeholder="例如：新员工入职审批流水线"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:border-blue-500 outline-hidden font-medium text-slate-800 transition"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">版本标识</label>
                  <input
                    type="text"
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    placeholder="v1.0.0"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:border-blue-500 outline-hidden font-mono text-slate-800 transition"
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
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:border-blue-500 outline-hidden font-medium text-slate-800 transition cursor-pointer"
                  >
                    <option value="人事行政">人事行政</option>
                    <option value="财务合规风控">财务合规风控</option>
                    <option value="DevOps / SRE 运维">DevOps / SRE 运维</option>
                    <option value="研发效能治理">研发效能治理</option>
                    <option value="客户成功与运营">客户成功与运营</option>
                    <option value="企业知识资产">企业知识资产</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">卡片徽标文字 (Badge)</label>
                  <input
                    type="text"
                    value={badge}
                    onChange={(e) => setBadge(e.target.value)}
                    placeholder="例如：入职录用流水线"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:border-blue-500 outline-hidden font-medium text-slate-800 transition"
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
                              : "bg-white border-slate-200 text-slate-500 hover:bg-slate-100"
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
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="例如：入参提取 → 薪酬校验 → 人工审批 → 外部系统同步 → 办结归档"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:border-blue-500 outline-hidden font-medium text-slate-800 transition"
                />
              </div>

              {/* 触发提示词模板 */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <span>触发提示词模板 (Prompt Template)</span>
                    <span className="text-rose-500">*</span>
                  </span>
                </label>
                <textarea
                  rows={3}
                  value={promptTemplate}
                  onChange={(e) => setPromptTemplate(e.target.value)}
                  placeholder="请输入清晰的端到端自动化业务处理指令..."
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:border-blue-500 outline-hidden font-sans text-xs text-slate-800 leading-relaxed transition"
                />
              </div>

              {/* 标签列表 */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 flex items-center justify-between">
                  <span>核心特性标签</span>
                </label>
                <input
                  type="text"
                  value={tagsStr}
                  onChange={(e) => setTagsStr(e.target.value)}
                  placeholder="例如：录用审批, 规则校验, 2PC拦截, 系统同步"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:border-blue-500 outline-hidden font-medium text-slate-800 transition"
                />
              </div>
            </div>
          )}
        </div>

        {/* 底部操作区 */}
        <div className="px-6 py-3.5 border-t border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="text-[11px] text-slate-400 flex items-center gap-2">
            <span>已配置 {steps.length} 个步骤节点</span>
            <span>•</span>
            <span>支持任意甲方业务流即时扩展</span>
          </div>

          <div className="flex items-center gap-3">
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
                <span>正在保存至数据库...</span>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>保存业务流水线配置</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PipelineConfigModal;
