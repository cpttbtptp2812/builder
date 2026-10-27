import React, { useState, useEffect } from "react";
import {
  Wrench,
  Database,
  Calculator,
  RefreshCw,
  Power,
  ShieldCheck,
  Zap,
  CheckCircle2,
} from "lucide-react";
import { ToolItem } from "../../types/platform";
import { fetchToolsApi, toggleToolApi } from "../../services/api";

export default function ToolsMarketPage() {
  const [tools, setTools] = useState<ToolItem[]>([]);
  const [loading, setLoading] = useState(false);

  const loadTools = async () => {
    setLoading(true);
    try {
      const list = await fetchToolsApi();
      setTools(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTools();
  }, []);

  // 切换开关
  const handleToggleTool = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const newState = await toggleToolApi(id);
      setTools((prev) =>
        prev.map((t) => (t.id === id ? { ...t, isEnabled: newState } : t))
      );
    } catch (err: any) {
      alert("切换失败: " + err.message);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 sm:p-8 relative scrollbar-hide">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* 顶部企业级说明条 */}
        <div className="flex items-center justify-between border-b border-slate-200/80 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 tracking-tight">智能体外部能力插件 (Function Calling)</h1>
              <span className="text-[11px] font-mono font-bold bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full border border-blue-200">
                标准 JSON Schema 协议
              </span>
            </div>
            <p className="text-xs text-slate-500">
              在此管理已挂载至平台的外部企业能力。开启后，大模型在对话推理过程中将根据用户意图自主决策并调用对应工具。
            </p>
          </div>
          <button
            onClick={loadTools}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition cursor-pointer shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-blue-600" : "text-slate-500"}`} />
            <span>刷新状态</span>
          </button>
        </div>

        {/* 工具插件卡片列表 (整洁清爽的双列/单列排版，删掉无意义的测试沙箱) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {tools.map((t) => (
            <div
              key={t.id}
              className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-slate-300 transition flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                      <Wrench className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black text-slate-900">{t.displayName}</h3>
                      <div className="text-[10px] font-mono text-blue-600 mt-0.5">
                        {t.name}
                      </div>
                    </div>
                  </div>

                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 shrink-0 font-medium">
                    {t.category}
                  </span>
                </div>

                <p className="text-xs text-slate-500 leading-relaxed min-h-[36px]">
                  {t.desc}
                </p>
              </div>

              {/* 底部控制与特性栏 */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1 text-[11px] text-slate-400">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>参数强校验自愈</span>
                </div>

                <button
                  onClick={(e) => handleToggleTool(t.id, e)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
                    t.isEnabled
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                      : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                  }`}
                  title="点击切换智能体是否可以自主调度此工具"
                >
                  <Power className="w-3 h-3" />
                  <span>{t.isEnabled ? "已挂载" : "已停用"}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
