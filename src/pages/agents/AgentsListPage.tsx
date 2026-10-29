import React, { useState } from "react";
import {
  Plus,
  Bot,
  Play,
  Trash2,
  Edit,
  Database,
  Wrench,
  BrainCircuit,
  Search,
  CheckCircle2,
  Calendar,
  User,
  X,
  Sparkles,
  Layers,
} from "lucide-react";
import { AgentItem } from "../../types/platform";
import { useToast } from "@/context/ToastContext";

interface AgentsListPageProps {
  agents: AgentItem[];
  onOpenChat: (agent: AgentItem) => void;
  onUpdateAgent: (updated: AgentItem) => void;
  onDeleteAgent: (id: string) => void;
  onCreateAgent: (newAgent: AgentItem) => void;
}

export default function AgentsListPage({
  agents,
  onOpenChat,
  onUpdateAgent,
  onDeleteAgent,
  onCreateAgent,
}: AgentsListPageProps) {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AgentItem | null>(null);

  // 表单状态
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formModel, setFormModel] = useState("deepseek-chat");
  const [formPrompt, setFormPrompt] = useState("");
  const [formTemp, setFormTemp] = useState(0.7);
  const [formToolsCount, setFormToolsCount] = useState<number>(0);
  const [formKbCount, setFormKbCount] = useState<number>(0);
  const [formEnableMemory, setFormEnableMemory] = useState<boolean>(true);

  const openCreateModal = () => {
    setEditingAgent(null);
    setFormName("");
    setFormDesc("");
    setFormModel("deepseek-chat");
    setFormPrompt("你是一个专业高效的业务智能助手，请依据事实严谨回答。");
    setFormTemp(0.7);
    setFormToolsCount(0);
    setFormKbCount(0);
    setFormEnableMemory(true);
    setIsModalOpen(true);
  };

  const openEditModal = (a: AgentItem) => {
    setEditingAgent(a);
    setFormName(a.name);
    setFormDesc(a.description);
    setFormModel(a.model);
    setFormPrompt(a.systemPrompt);
    setFormTemp(a.temperature);
    setFormToolsCount(a.toolsCount ?? 0);
    setFormKbCount(a.kbCount ?? 0);
    setFormEnableMemory(a.enableMemory !== false);
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!formName.trim()) {
      toast.warning("请输入智能体名称", "表单校验未通过");
      return;
    }

    if (editingAgent) {
      onUpdateAgent({
        ...editingAgent,
        name: formName,
        description: formDesc,
        model: formModel,
        systemPrompt: formPrompt,
        temperature: formTemp,
        toolsCount: formToolsCount,
        kbCount: formKbCount,
        enableMemory: formEnableMemory,
        updatedAt: "刚刚",
      });
      toast.success(`智能体【${formName}】配置已更新！`, "更新成功");
    } else {
      onCreateAgent({
        id: `agent-${Date.now().toString().slice(-4)}`,
        name: formName,
        description: formDesc,
        avatarColor: "bg-blue-600",
        model: formModel,
        temperature: formTemp,
        systemPrompt: formPrompt,
        toolsCount: formToolsCount,
        kbCount: formKbCount,
        enableMemory: formEnableMemory,
        status: "PUBLISHED",
        updatedAt: "刚刚",
      });
      toast.success(`智能体【${formName}】已创建并持久化！`, "创建成功");
    }
    setIsModalOpen(false);
  };

  const filtered = agents.filter(
    (a) => a.name.includes(search) || a.description.includes(search)
  );

  return (
    <div className="flex-1 overflow-y-auto p-8 relative">
      <div className="max-w-6xl mx-auto space-y-7">
        {/* 顶部标题区 (对齐 tianyangAgent 呼吸感大标题) */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-blue-600 uppercase tracking-wider bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">
                Agents Studio
              </span>
              <span className="text-xs text-slate-400">· 企业数字员工矩阵</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">智能体中心</h1>
            <p className="text-xs text-slate-500 mt-1">
              构建、配置并发布具备私有知识库检索与业务工具调用能力的专业生产级智能体
            </p>
          </div>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-2xl shadow-lg shadow-blue-500/25 transition-all hover:-translate-y-0.5"
          >
            <Plus className="w-4 h-4" />
            <span>新建智能体</span>
          </button>
        </div>

        {/* 搜索与快捷过滤条 */}
        <div className="flex items-center justify-between bg-white/80 backdrop-blur-md p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200/80 rounded-xl px-3.5 py-2 w-80">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索智能体名称、职能或模型..."
              className="bg-transparent text-xs text-slate-800 outline-none w-full"
            />
          </div>
          <div className="flex items-center gap-5 text-xs text-slate-500 font-medium">
            <span>智能体总数: <strong className="text-slate-900">{agents.length}</strong></span>
            <span>已发布生产: <strong className="text-emerald-600">{agents.filter((a) => a.status === "PUBLISHED").length}</strong></span>
          </div>
        </div>

        {/* 智能体卡片网格 (核心复刻 tianyangAgent: rounded-[2rem] + 右上角弥散光圈 + 悬浮动效) */}
        <div className="grid grid-cols-3 gap-6">
          {filtered.map((agent) => (
            <div
              key={agent.id}
              onClick={() => openEditModal(agent)}
              className="group relative flex flex-col justify-between overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white p-6 shadow-sm transition-all duration-500 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-blue-500/10 cursor-pointer"
            >
              {/* 装饰性背景光晕圆 (复刻 tianyangAgent: scale-150 悬浮放大) */}
              <div
                className={`absolute -right-6 -top-6 h-28 w-28 rounded-full opacity-10 transition-transform duration-500 group-hover:scale-150 ${
                  agent.avatarColor || "bg-blue-600"
                }`}
              />

              {/* 卡片头部：大图标 + 状态徽章 */}
              <div className="relative z-10 mb-4 flex items-start justify-between">
                <div
                  className={`relative flex h-14 w-14 items-center justify-center rounded-2xl shadow-md text-white ${
                    agent.avatarColor || "bg-blue-600"
                  }`}
                >
                  <Bot className="w-7 h-7" />
                </div>
                <span
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                    agent.status === "PUBLISHED"
                      ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                      : "bg-slate-100 text-slate-500 border-slate-200"
                  }`}
                >
                  {agent.status === "PUBLISHED" ? "已发布运行" : "草稿中"}
                </span>
              </div>

              {/* 卡片内容：标题 + 描述 */}
              <div className="relative z-10 mb-4 flex-1">
                <h3 className="mb-1.5 text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                  {agent.name}
                </h3>
                <p className="line-clamp-2 text-xs font-normal leading-relaxed text-slate-500 h-10">
                  {agent.description}
                </p>

                {/* 技能属性徽标 */}
                <div className="flex items-center gap-2 mt-4 text-[11px] text-slate-500">
                  <span className="flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200/60 font-medium">
                    <Database className="w-3 h-3 text-emerald-600" /> {agent.kbCount} 知识库
                  </span>
                  <span className="flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200/60 font-medium">
                    <Wrench className="w-3 h-3 text-indigo-600" /> {agent.toolsCount} 插件
                  </span>
                  {agent.enableMemory && (
                    <span className="flex items-center gap-1 bg-purple-50 text-purple-700 px-2.5 py-1 rounded-xl border border-purple-100 font-medium">
                      <BrainCircuit className="w-3 h-3" /> 记忆已开启
                    </span>
                  )}
                </div>
              </div>

              {/* 卡片底栏：创建者 + 更新时间 + 快捷操作 */}
              <div className="relative z-10 flex items-center justify-between border-t border-slate-100 pt-4 mt-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                    <User size={12} />
                  </div>
                  <span className="truncate text-xs font-semibold text-slate-600">
                    Admin · {agent.model}
                  </span>
                </div>

                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => openEditModal(agent)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                    title="编辑配置"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onDeleteAgent(agent.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                    title="删除"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => openEditModal(agent)}
                    className="flex items-center gap-1 px-3 py-1 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition ml-1 cursor-pointer"
                  >
                    <Edit className="w-3 h-3" />
                    <span>编辑资产</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 弹窗：新建/编辑智能体 (圆角 2xl + 现代表单) */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900">
                  {editingAgent ? "编辑智能体配置" : "新建业务智能体"}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-700 font-semibold">智能体名称</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="如：企业技术架构专家 / 订单服务助理"
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 mt-1 outline-none focus:bg-white focus:border-blue-500 font-medium"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-700 font-semibold">业务职能描述</label>
                  <textarea
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    rows={2}
                    placeholder="简述该智能体的业务职能与受众..."
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 mt-1 outline-none focus:bg-white focus:border-blue-500 resize-none font-normal"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-700 font-semibold">模型底座</label>
                    <select
                      value={formModel}
                      onChange={(e) => setFormModel(e.target.value)}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 mt-1 outline-none font-mono"
                    >
                      <option value="deepseek-chat">DeepSeek-V3</option>
                      <option value="deepseek-reasoner">DeepSeek-R1</option>
                      <option value="gpt-4o">OpenAI GPT-4o</option>
                      <option value="qwen-2.5-72b">通义千问 72B</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-700 font-semibold">采样温度 ({formTemp})</label>
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      max="1"
                      value={formTemp}
                      onChange={(e) => setFormTemp(parseFloat(e.target.value))}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 mt-1 outline-none font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-700 font-semibold">系统人设 Prompt</label>
                  <textarea
                    value={formPrompt}
                    onChange={(e) => setFormPrompt(e.target.value)}
                    rows={4}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 mt-1 outline-none focus:bg-white focus:border-blue-500 font-sans resize-none"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3 pt-1">
                  <div>
                    <label className="text-xs text-slate-700 font-semibold">绑定工具数</label>
                    <input
                      type="number"
                      min="0"
                      value={formToolsCount}
                      onChange={(e) => setFormToolsCount(parseInt(e.target.value) || 0)}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 mt-1 outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-700 font-semibold">绑定知识库数</label>
                    <input
                      type="number"
                      min="0"
                      value={formKbCount}
                      onChange={(e) => setFormKbCount(parseInt(e.target.value) || 0)}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 mt-1 outline-none font-mono"
                    />
                  </div>
                  <div className="flex flex-col justify-center">
                    <label className="text-xs text-slate-700 font-semibold mb-1">长程记忆</label>
                    <label className="flex items-center gap-1.5 cursor-pointer mt-1">
                      <input
                        type="checkbox"
                        checked={formEnableMemory}
                        onChange={(e) => setFormEnableMemory(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                      />
                      <span className="text-xs text-slate-600 font-medium">启用记忆检索</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2.5">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20"
                >
                  保存智能体
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
