import React, { useState, useEffect, useRef } from "react";
import {
  Database,
  Upload,
  FileText,
  Search,
  CheckCircle2,
  Trash2,
  Sparkles,
  RefreshCw,
  FolderOpen,
  Plus,
  X,
  FileCode,
  Layers,
  ArrowRight,
} from "lucide-react";
import {
  fetchKnowledgeChunksApi,
  uploadKnowledgeChunkApi,
  deleteKnowledgeChunkApi,
  searchKnowledgeApi,
  KnowledgeChunkItem,
  RagRecallItem,
} from "../../services/api";

export default function KnowledgePage() {
  const [chunks, setChunks] = useState<KnowledgeChunkItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  // 混合检索测试台状态 (默认为空，由用户真实输入)
  const [testQuery, setTestQuery] = useState("");
  const [recallResults, setRecallResults] = useState<RagRecallItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // 文件上传与手动录入状态
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [manualTitle, setManualTitle] = useState("");
  const [manualKeywords, setManualKeywords] = useState("");
  const [manualCategory, setManualCategory] = useState("ENTERPRISE");
  const [manualContent, setManualContent] = useState("");

  // 加载知识库切片列表
  const loadChunks = async () => {
    setLoading(true);
    try {
      const data = await fetchKnowledgeChunksApi();
      setChunks(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChunks();
  }, []);

  // 真实文本文件上传：严格校验文件类型，杜绝将 PDF/Word 二进制乱码存入知识库
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const textExts = ["txt", "md", "markdown", "json", "csv", "sql", "log", "yaml", "yml", "xml", "html"];

    if (!textExts.includes(ext)) {
      alert(
        `【格式提示】当前平台为了保障 RAG 知识切片检索的高质量，仅支持直接解析纯文本/数据格式（.txt, .md, .csv, .json, .sql, .log 等）。\n\n您选择的「${file.name}」属于二进制富文本文件（如 PDF/Word），直接读取会产生乱码（如 %PDF）污染数据库。请将其复制转换为 Markdown 或纯文本文件，或点击右侧「录入切片」直接粘贴文档正文。`
      );
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();

    reader.onload = async (event) => {
      const content = event.target?.result as string;
      if (!content || !content.trim()) {
        alert("上传的文件内容为空，无法存入知识库");
        setIsUploading(false);
        return;
      }

      try {
        const res = await uploadKnowledgeChunkApi(
          file.name,
          content,
          "本地文档, " + ext.toUpperCase(),
          "FILE_UPLOAD"
        );
        alert(
          `【文档切片流水线完成】\n\n文档：${res.docTitle}\n• 文本长度：${content.length} 字符\n• 分块策略：500 字符分块 + 50 字符重叠\n• 生成切片：${res.totalChunks} 片\n• 离线向量成功：${res.successChunks} 片\n• 离线向量失败：${res.failedChunks} 片\n\n已全部持久化至 knowledge_chunk 数据库。`
        );
        await loadChunks();
      } catch (err: any) {
        alert("上传失败: " + err.message);
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };

    reader.onerror = () => {
      alert("读取本地文件失败");
      setIsUploading(false);
    };

    reader.readAsText(file, "UTF-8");
  };

  // 手动新增知识切片
  const handleSaveManualChunk = async () => {
    if (!manualTitle.trim() || !manualContent.trim()) {
      alert("请填写标题和知识切片正文");
      return;
    }
    try {
      await uploadKnowledgeChunkApi(
        manualTitle.trim(),
        manualContent.trim(),
        manualKeywords.trim() || "手动录入",
        manualCategory
      );
      setIsAddModalOpen(false);
      setManualTitle("");
      setManualKeywords("");
      setManualContent("");
      await loadChunks();
    } catch (err: any) {
      alert("保存失败: " + err.message);
    }
  };

  // 删除切片
  const handleDeleteChunk = async (id: string) => {
    if (!confirm("确定要从数据库物理删除该切片吗？")) return;
    try {
      await deleteKnowledgeChunkApi(id);
      setChunks((prev) => prev.filter((c) => c.id !== id));
    } catch (err: any) {
      alert("删除失败: " + err.message);
    }
  };

  // 真实混合检索测试：直接调用后端 hybridRagService.hybridSearch
  const handleTestSearch = async () => {
    if (!testQuery.trim() || isSearching) return;
    setIsSearching(true);
    setSearchError(null);
    try {
      const results = await searchKnowledgeApi(testQuery.trim());
      setRecallResults(results);
    } catch (err: any) {
      setSearchError(err.message || "检索失败");
    } finally {
      setIsSearching(false);
    }
  };

  const filteredChunks = chunks.filter(
    (c) =>
      c.docTitle.toLowerCase().includes(search.toLowerCase()) ||
      c.content.toLowerCase().includes(search.toLowerCase()) ||
      (c.keywords && c.keywords.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="flex-1 overflow-y-auto p-8 relative scrollbar-hide">
      <div className="max-w-6xl mx-auto space-y-7">
        {/* 顶部标题栏 */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">
                Knowledge Hub
              </span>
              <span className="text-xs text-slate-400">· 企业切片检索中台 (本地 H2 数据库引擎)</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">知识资源库</h1>
            <p className="text-xs text-slate-500 mt-1">
              真实读取数据库全量切片，支持本地纯文本文档解析与中文 N-Gram 词元加权检索在线召回
            </p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept=".txt,.md,.markdown,.json,.csv,.sql,.log,.yaml,.yml"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-2xl shadow-lg shadow-emerald-500/25 transition-all hover:-translate-y-0.5"
            >
              <Upload className="w-4 h-4" />
              <span>{isUploading ? "正在解析入库..." : "上传本地文档"}</span>
            </button>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-2xl shadow-xs transition"
            >
              <Plus className="w-4 h-4 text-emerald-600" />
              <span>录入切片</span>
            </button>
          </div>
        </div>

        {/* 真实检索测试实验台 (零写死，直接调用后端 HybridRagService) */}
        <div className="bg-white/90 backdrop-blur-md p-6 rounded-[2rem] border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>真实混合检索调试台 (Okapi BM25 倒排索引 + Dense 语义向量余弦 + RRF 融合)</span>
            </div>
            <span className="text-[10px] text-emerald-700 font-mono bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              Top-5 动态召回 · 真实数据库查验
            </span>
          </div>

          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={testQuery}
                onChange={(e) => setTestQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleTestSearch()}
                placeholder="输入检索语句，如：DDL 生产变更、跨行资金清算、IAM 提权..."
                className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
              />
            </div>
            <button
              onClick={handleTestSearch}
              disabled={isSearching}
              className="px-5 py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-black disabled:opacity-50 rounded-xl transition flex items-center gap-2"
            >
              {isSearching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-emerald-400" />}
              <span>{isSearching ? "正在检索中..." : "在线混合检索"}</span>
            </button>
          </div>

          {searchError && (
            <div className="p-3 text-xs text-red-600 bg-red-50 rounded-xl border border-red-100">
              {searchError}
            </div>
          )}

          {recallResults.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="text-[11px] font-bold text-slate-500">
                后端数据库实时命中切片 ({recallResults.length} 条):
              </div>
              <div className="grid grid-cols-1 gap-2.5">
                {recallResults.map((item, idx) => (
                  <div
                    key={item.chunkId || idx}
                    className="p-3.5 bg-slate-50/90 rounded-2xl border border-slate-200/80 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-[10px]">
                          {idx + 1}
                        </span>
                        <span className="font-bold text-slate-800">{item.projectName}</span>
                        <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">
                          {item.section}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 font-mono text-[11px]">
                        <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200" title="Okapi BM25 倒排索引检索 (TF × IDF × 文档长度归一化)">
                          BM25 倒排: {item.sparseScore}
                        </span>
                        <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200" title={`模式: ${item.vectorMode || '自动'} · 模型: ${item.vectorModel || '默认'}`}>
                          {item.vectorMode === 'NEURAL_EMBEDDING' ? 'Dense 神经向量: ' : 'Dense 词元哈希: '}{item.denseScore}
                        </span>
                        <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200" title="Reciprocal Rank Fusion (k=60) 双路倒数排名融合得分">
                          RRF 融合分: {item.rrfScore}
                        </span>
                      </div>
                    </div>
                    <p className="text-slate-600 leading-relaxed font-sans text-[11.5px] bg-white p-2.5 rounded-xl border border-slate-100">
                      {item.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 知识切片数据库全量表格 */}
        <div className="bg-white/90 backdrop-blur-md rounded-[2rem] border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-bold text-slate-800">
                数据库切片总览 ({chunks.length} 个)
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="过滤切片标题或关键字..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
              <button
                onClick={loadChunks}
                disabled={loading}
                className="p-2 text-slate-500 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition"
                title="刷新数据"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold text-slate-400">
                  <th className="py-3 px-4">切片 ID</th>
                  <th className="py-3 px-4">文档标题</th>
                  <th className="py-3 px-4">分块</th>
                  <th className="py-3 px-4">向量状态</th>
                  <th className="py-3 px-4">切片预览 (前 80 字)</th>
                  <th className="py-3 px-4">入库时间</th>
                  <th className="py-3 px-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredChunks.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      暂无知识切片。请点击上方「上传本地文档」或「录入切片」。
                    </td>
                  </tr>
                ) : (
                  filteredChunks.map((chunk) => (
                    <tr key={chunk.id} className="hover:bg-slate-50/80 transition group">
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-400">{chunk.id}</td>
                      <td className="py-3 px-4 font-medium text-slate-800 max-w-[180px] truncate" title={chunk.docTitle}>
                        {chunk.docTitle}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-[10px] font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md border border-blue-100">
                          #{chunk.chunkIndex} 块
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {chunk.embeddingJson ? (
                          <span className="text-[10px] font-mono bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
                            ● 已落库
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
                            ○ 仅关键词
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-500 max-w-[280px] truncate" title={chunk.content}>
                        {chunk.content}
                      </td>
                      <td className="py-3 px-4 text-[11px] text-slate-400">
                        {chunk.createdAt ? new Date(chunk.createdAt).toLocaleString() : "已持久化"}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleDeleteChunk(chunk.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"
                          title="物理删除"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 手动录入切片弹窗 */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] border border-slate-200/80 shadow-2xl w-full max-w-xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-600" />
                <span>录入知识切片到数据库</span>
              </h2>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">文档标题 / 规程名称</label>
                <input
                  type="text"
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  placeholder="例如：2026 核心结算交易容灾与对账规程"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">切片分类</label>
                  <select
                    value={manualCategory}
                    onChange={(e) => setManualCategory(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                  >
                    <option value="ENTERPRISE">ENTERPRISE (企业规程)</option>
                    <option value="TECH_SPEC">TECH_SPEC (技术规格)</option>
                    <option value="FINANCE">FINANCE (财务结算)</option>
                    <option value="SECURITY">SECURITY (安全特权)</option>
                    <option value="REGULATION">REGULATION (监管合规)</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">关键字 (逗号分隔)</label>
                  <input
                    type="text"
                    value={manualKeywords}
                    onChange={(e) => setManualKeywords(e.target.value)}
                    placeholder="SLA, 对账, 容灾"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">切片具体正文内容</label>
                <textarea
                  rows={6}
                  value={manualContent}
                  onChange={(e) => setManualContent(e.target.value)}
                  placeholder="输入知识库正文内容，供大模型进行 RAG 检索召回..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:outline-none font-sans"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                取消
              </button>
              <button
                onClick={handleSaveManualChunk}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-500/20 transition"
              >
                确认入库
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
