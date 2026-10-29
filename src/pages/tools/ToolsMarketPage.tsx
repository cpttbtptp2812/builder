import React, { useState, useEffect } from "react";
import {
  Wrench,
  Database,
  Calculator,
  RefreshCw,
  Power,
  ShieldCheck,
  Play,
  CheckCircle2,
  AlertTriangle,
  Code2,
  X,
  Layers,
  Plus,
  Edit2,
  Trash2,
  Search,
} from "lucide-react";
import { ToolItem } from "../../types/platform";
import {
  fetchToolsApi,
  toggleToolApi,
  testToolApi,
  saveToolApi,
  deleteToolApi,
} from "../../services/api";
import { useToast } from "@/context/ToastContext";

export default function ToolsMarketPage() {
  const toast = useToast();
  const [tools, setTools] = useState<ToolItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  // 测试弹窗状态
  const [activeTestTool, setActiveTestTool] = useState<ToolItem | null>(null);
  const [testPayloadStr, setTestPayloadStr] = useState<string>("");
  const [testRunning, setTestRunning] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  // 增/改 弹窗状态
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTool, setEditingTool] = useState<ToolItem | null>(null);
  const [formId, setFormId] = useState("");
  const [formFunctionName, setFormFunctionName] = useState("");
  const [formDisplayName, setFormDisplayName] = useState("");
  const [formCategory, setFormCategory] = useState<"SYSTEM" | "BUSINESS" | "FINANCE" | "SECURITY">("BUSINESS");
  const [formDesc, setFormDesc] = useState("");
  const [formSchema, setFormSchema] = useState("{}");
  const [isSaving, setIsSaving] = useState(false);

  const loadTools = async () => {
    setLoading(true);
    try {
      const list = await fetchToolsApi();
      setTools(list || []);
    } catch {
      setTools([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTools();
  }, []);

  const handleToggleTool = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const newState = await toggleToolApi(id);
      setTools((prev) =>
        prev.map((t) => (t.id === id ? { ...t, isEnabled: newState } : t))
      );
      toast.success(newState ? "工具已启用并就绪" : "工具已停用并受控拦截", "工具状态切换");
    } catch (err: any) {
      toast.error(err.message || "后端接口异常", "切换状态失败");
    }
  };

  // 打开测试面板
  const handleOpenTest = (tool: ToolItem) => {
    setActiveTestTool(tool);
    setTestResult(null);
    setTestPayloadStr(tool.paramsSchema || "{}");
  };

  // 执行测试
  const handleRunTest = async () => {
    if (!activeTestTool) return;
    setTestRunning(true);
    setTestResult(null);
    try {
      let parsed = {};
      try {
        parsed = JSON.parse(testPayloadStr);
      } catch {
        parsed = { raw: testPayloadStr };
      }
      const res = await testToolApi(activeTestTool.name, parsed);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ error: true, message: err.message || "执行接口异常" });
    } finally {
      setTestRunning(false);
    }
  };

  // 打开新建弹窗
  const handleOpenCreate = () => {
    setEditingTool(null);
    setFormId(`tool-${Date.now().toString().slice(-6)}`);
    setFormFunctionName("");
    setFormDisplayName("");
    setFormCategory("BUSINESS");
    setFormDesc("");
    setFormSchema('{\n  "query": "param"\n}');
    setIsEditModalOpen(true);
  };

  // 打开编辑弹窗
  const handleOpenEdit = (tool: ToolItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTool(tool);
    setFormId(tool.id);
    setFormFunctionName(tool.name);
    setFormDisplayName(tool.displayName || tool.name);
    setFormCategory((tool.category as any) || "BUSINESS");
    setFormDesc(tool.desc || "");
    setFormSchema(tool.paramsSchema || "{}");
    setIsEditModalOpen(true);
  };

  // 保存工具（新增或修改）
  const handleSaveTool = async () => {
    if (!formDisplayName.trim() || !formFunctionName.trim()) {
      toast.warning("请填写工具显示名称与调用函数名", "表单校验未通过");
      return;
    }
    setIsSaving(true);
    try {
      await saveToolApi({
        id: formId,
        name: formFunctionName.trim(),
        displayName: formDisplayName.trim(),
        desc: formDesc.trim(),
        category: formCategory,
        isEnabled: editingTool ? editingTool.isEnabled : true,
        paramsSchema: formSchema,
      });
      setIsEditModalOpen(false);
      toast.success(`工具【${formDisplayName.trim()}】已成功持久化至注册中心！`, "保存成功");
      await loadTools();
    } catch (err: any) {
      toast.error(err.message || "后端接口异常", "保存工具失败");
    } finally {
      setIsSaving(false);
    }
  };

  // 删除工具
  const handleDeleteTool = async (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteToolApi(id);
      setTools((prev) => prev.filter((t) => t.id !== id));
      toast.success(`工具【${name}】已成功注销并从注册中心移除`, "注销成功");
    } catch (err: any) {
      toast.error(err.message || "删除异常", "注销失败");
    }
  };

  const filteredTools = tools.filter(
    (t) =>
      t.displayName.toLowerCase().includes(search.toLowerCase()) ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.desc && t.desc.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="flex-1 overflow-y-auto bg-[#F8FAFC] text-slate-800 p-6 lg:p-8 space-y-6">
      {/* 顶部标题栏 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-50 border border-cyan-100 text-cyan-600 flex items-center justify-center font-bold">
              <Wrench className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              扩展工具库与接口管理
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            注册外部系统 API 与受控业务执行工具，支持在线修改参数配置、连通性测试与运行开关
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            onClick={loadTools}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer border border-slate-200"
            title="刷新工具列表"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-md shadow-blue-500/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ 注册受控工具</span>
          </button>
        </div>
      </div>

      {/* 搜索过滤栏 */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索工具名称、函数标识或说明..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-500 transition shadow-2xs"
          />
        </div>
        <span className="text-xs text-slate-400 font-mono">
          已登记工具: {tools.length} 项
        </span>
      </div>

      {/* 工具卡片列表 */}
      {filteredTools.length === 0 ? (
        <div className="py-20 text-center bg-white border border-dashed border-slate-200 rounded-3xl space-y-3">
          <Wrench className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-sm font-bold text-slate-700">暂无匹配的扩展工具</p>
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>立即注册新工具</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTools.map((t) => (
            <div
              key={t.id}
              className={`p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between space-y-4 shadow-2xs hover:shadow-md ${
                t.isEnabled
                  ? "bg-white border-slate-200/90 hover:border-blue-400"
                  : "bg-slate-50/80 border-slate-200/60 opacity-60"
              }`}
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                      {t.category || "BUSINESS"}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {t.id}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => handleOpenEdit(t, e)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                      title="编辑工具配置"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteTool(t.id, t.displayName, e)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                      title="删除工具"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleToggleTool(t.id, e)}
                      className={`p-1.5 rounded-lg transition cursor-pointer ${
                        t.isEnabled
                          ? "text-emerald-600 hover:bg-emerald-50"
                          : "text-slate-400 hover:bg-slate-100"
                      }`}
                      title={t.isEnabled ? "点击禁用工具" : "点击启用工具"}
                    >
                      <Power className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-black text-slate-900 tracking-tight">
                    {t.displayName}
                  </h3>
                  <span className="text-[11px] font-mono text-blue-600 font-semibold block mt-0.5">
                    {t.name}()
                  </span>
                </div>

                <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                  {t.desc || "暂无详细描述"}
                </p>
              </div>

              <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      t.isEnabled ? "bg-emerald-500 animate-pulse" : "bg-slate-300"
                    }`}
                  />
                  {t.isEnabled ? "正常挂载运行" : "已暂停调度"}
                </span>

                <button
                  type="button"
                  onClick={() => handleOpenTest(t)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>测试调用</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── 弹窗 1: 新建 / 编辑工具弹窗 ── */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-blue-600" />
                <h2 className="text-base font-bold text-slate-900">
                  {editingTool ? `编辑工具: ${editingTool.displayName}` : "注册新受控工具"}
                </h2>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">工具唯一 ID</label>
                <input
                  type="text"
                  value={formId}
                  onChange={(e) => setFormId(e.target.value)}
                  disabled={!!editingTool}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-600 disabled:opacity-60 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">显示名称</label>
                  <input
                    type="text"
                    value={formDisplayName}
                    onChange={(e) => setFormDisplayName(e.target.value)}
                    placeholder="如：企业客户数据查询"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">函数标识名 (Function Name)</label>
                  <input
                    type="text"
                    value={formFunctionName}
                    onChange={(e) => setFormFunctionName(e.target.value)}
                    placeholder="如：query_customer_info"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">业务分类</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as any)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="BUSINESS">BUSINESS (业务系统工具)</option>
                  <option value="SYSTEM">SYSTEM (底层系统工具)</option>
                  <option value="FINANCE">FINANCE (财务核算工具)</option>
                  <option value="SECURITY">SECURITY (安全审查工具)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">工具功能描述</label>
                <textarea
                  rows={2}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="说明工具的用途、受控边界与输入要求..."
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 resize-none leading-relaxed"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">参数 Schema 模板 (JSON)</label>
                <textarea
                  rows={3}
                  value={formSchema}
                  onChange={(e) => setFormSchema(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 font-mono border border-slate-200 rounded-xl outline-none focus:border-blue-500 resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveTool}
                disabled={isSaving}
                className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20 transition cursor-pointer disabled:opacity-50"
              >
                {isSaving ? "正在保存..." : "确认保存工具"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 弹窗 2: 实时测试调用面板 ── */}
      {activeTestTool && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Play className="w-4 h-4 text-emerald-600 fill-current" />
                <h2 className="text-base font-bold text-slate-900">
                  测试调用: {activeTestTool.displayName} ({activeTestTool.name})
                </h2>
              </div>
              <button
                onClick={() => setActiveTestTool(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  输入测试入参 (JSON 格式):
                </label>
                <textarea
                  rows={4}
                  value={testPayloadStr}
                  onChange={(e) => setTestPayloadStr(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 font-mono border border-slate-200 rounded-xl outline-none focus:border-blue-500 resize-none text-slate-800"
                />
              </div>

              {testResult && (
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    后端真实返回结果:
                  </label>
                  <div className="p-3 bg-slate-900 text-emerald-400 font-mono text-[11px] rounded-xl max-h-48 overflow-y-auto whitespace-pre-wrap break-all border border-slate-800">
                    {JSON.stringify(testResult, null, 2)}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <span className="text-[11px] text-slate-400">
                直连后端受控执行引擎
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTestTool(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  关闭
                </button>
                <button
                  type="button"
                  onClick={handleRunTest}
                  disabled={testRunning}
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-500/20 transition cursor-pointer disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{testRunning ? "正在执行中..." : "立即运行测试"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
