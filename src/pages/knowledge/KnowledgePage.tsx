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
  Download,
  Edit2,
  FileDown,
  BookOpen,
} from "lucide-react";
import {
  fetchKnowledgeChunksApi,
  uploadKnowledgeChunkApi,
  deleteKnowledgeChunkApi,
  updateKnowledgeChunkApi,
  searchKnowledgeApi,
  KnowledgeChunkItem,
  RagRecallItem,
} from "../../services/api";
import { useToast } from "@/context/ToastContext";

interface KnowledgeTemplate {
  title: string;
  category: string;
  keywords: string;
  fileName: string;
  summary: string;
  content: string;
}

const KNOWLEDGE_TEMPLATES: KnowledgeTemplate[] = [
  {
    title: "企业员工差旅报销制度（参考范本）",
    category: "FINANCE",
    keywords: "差旅报销, 一线城市, 住宿标准, 超标提醒, 财务审核",
    fileName: "企业员工差旅报销与合规手册.md",
    summary: "一线城市住宿上限 600 元/间夜，交通工具报销规则，超标审批特批流程。",
    content: `# 企业员工差旅报销制度（参考范本）

## 1. 住宿标准与报销限额
- 一线城市（北京、上海、广州、深圳）普通员工住宿报销标准上限为 600 元/间夜。
- 新一线城市及省会城市住宿报销标准上限为 450 元/间夜。
- 其余城市住宿报销标准上限为 300 元/间夜。

## 2. 交通工具出行规范
- 跨城交通优先选择高铁二等座或经济舱机票。
- 严禁未经前置特批私自乘坐商务座或头等舱。

## 3. 超标拦截与审批流程
- 超标差额部分系统自动拦截预警，需发起二级财务特批流程。
- 特批未获批准的，超标部分由员工个人自理。
`,
  },
  {
    title: "生产系统安全运维规约（参考范本）",
    category: "SRE_OPS",
    keywords: "DROP, TRUNCATE, DELETE, 人工审批, 数据安全",
    fileName: "数据库安全运维与操作规范.md",
    summary: "生产环境严禁无 WHERE 的修改或删除，DROP/TRUNCATE 必须经过人工审批放行。",
    content: `# 生产系统安全运维规约（参考范本）

## 1. 生产数据操作红线
- 严禁未经管理员审批在生产环境执行无 WHERE 条件的 DELETE 或 UPDATE 变更。
- 单次批量删除或修改超过 1000 行记录，必须提前备份并提交审批。

## 2. 高危 DDL 操作审批
- 凡涉及 DROP TABLE、TRUNCATE TABLE、ALTER TABLE 加唯一索引等重度操作，必须通过管理员人工审批放行。
- 变更必须在业务低峰期（凌晨 00:00 - 06:00）窗口内执行。

## 3. 查询操作受控
- 数据库查询工具仅限执行受控 SELECT 查询与 EXPLAIN 分析。
- 单次查询结果上限不得超过 1000 条，禁止 SELECT * 跨大表扫描。
`,
  },
  {
    title: "企业合同与付款风控规约（参考范本）",
    category: "LEGAL",
    keywords: "合同审核, 单笔付款, 合规审查, 法务审批",
    fileName: "企业商务合同与付款风控规范.md",
    summary: "单笔 5 万元以上支出必须复核，预付款超过 30% 预警，用印需人工审批。",
    content: `# 企业合同与付款风控规约（参考范本）

## 1. 付款金额分级风控
- 单笔金额超过人民币 50,000 元的支出类合同，严禁直接自动支付，必须附带法务初审意见与复核凭据。
- 超过人民币 200,000 元的重大采购，必须由财务总监与业务主管双人联合审批。

## 2. 预付款与违约金条款
- 凡涉及预付款比例超过总标的 30% 的协议，系统必须提醒合规预警并提交法务特批。
- 合同履约保证金比例不应低于 10%，账期要求不少于 30 个工作日。

## 3. 印章与签署安全
- 涉及加盖公章与法人章的授权指令，严禁在未完成审批的情况下执行。
`,
  },
];

export default function KnowledgePage() {
  const toast = useToast();
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

  // 在线编辑切片弹窗状态
  const [editingChunk, setEditingChunk] = useState<KnowledgeChunkItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editKeywords, setEditKeywords] = useState("");
  const [editCategory, setEditCategory] = useState("ENTERPRISE");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

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

  // 模版下载功能：直接生成真实的 .md 文件供用户本地保存与编辑
  const handleDownloadTemplate = (template: KnowledgeTemplate) => {
    const blob = new Blob([template.content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = template.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 模版一键导入到数据库
  const handleImportTemplateToDb = async (template: KnowledgeTemplate) => {
    setIsUploading(true);
    try {
      const res = await uploadKnowledgeChunkApi(
        template.title,
        template.content,
        template.keywords,
        template.category
      );
      toast.success(`《${template.title}》已切分并存入数据库！共生成 ${res.totalChunks} 个知识切片`, "导入成功");
      await loadChunks();
    } catch (err: any) {
      toast.error(err.message || "服务异常", "导入失败");
    } finally {
      setIsUploading(false);
    }
  };

  // 真实文本文件上传
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const textExts = ["txt", "md", "markdown", "json", "csv", "sql", "log", "yaml", "yml", "xml", "html"];

    if (!textExts.includes(ext)) {
      toast.warning(
        `您选择的「${file.name}」属于二进制格式，请另存为 Markdown 或纯文本文件后再行导入，或点击「录入切片」直接粘贴。`,
        "文件格式提示"
      );
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();

    reader.onload = async (event) => {
      const content = event.target?.result as string;
      if (!content || !content.trim()) {
        toast.warning("上传的文件内容为空，无法存入知识库", "空文件提示");
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
        toast.success(
          `文档「${res.docTitle}」已完成切片并存入数据库（${res.totalChunks} 片）`,
          "文档导入成功"
        );
        await loadChunks();
      } catch (err: any) {
        toast.error(err.message || "上传解析失败", "上传失败");
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };

    reader.onerror = () => {
      toast.error("读取本地文件失败，请检查文件权限", "读取错误");
      setIsUploading(false);
    };

    reader.readAsText(file, "UTF-8");
  };

  // 手动新增知识切片
  const handleSaveManualChunk = async () => {
    if (!manualTitle.trim() || !manualContent.trim()) {
      toast.warning("请填写标题和知识切片正文内容", "表单未完成");
      return;
    }
    try {
      await uploadKnowledgeChunkApi(
        manualTitle.trim(),
        manualContent.trim(),
        manualKeywords.trim() || "手动录入",
        manualCategory
      );
      toast.success(`知识切片《${manualTitle.trim()}》已持久化到数据库！`, "录入成功");
      setIsAddModalOpen(false);
      setManualTitle("");
      setManualKeywords("");
      setManualContent("");
      await loadChunks();
    } catch (err: any) {
      toast.error(err.message || "服务异常", "保存失败");
    }
  };

  // 打开编辑弹窗
  const handleOpenEdit = (chunk: KnowledgeChunkItem) => {
    setEditingChunk(chunk);
    setEditTitle(chunk.docTitle);
    setEditContent(chunk.content);
    setEditKeywords(chunk.keywords || "");
    setEditCategory(chunk.category || "ENTERPRISE");
  };

  // 保存切片编辑更新
  const handleSaveEdit = async () => {
    if (!editingChunk) return;
    if (!editTitle.trim() || !editContent.trim()) {
      toast.warning("标题与正文内容不能为空", "校验失败");
      return;
    }
    setIsSavingEdit(true);
    try {
      await updateKnowledgeChunkApi(editingChunk.id, {
        docTitle: editTitle.trim(),
        content: editContent.trim(),
        keywords: editKeywords.trim(),
        category: editCategory,
      });
      setEditingChunk(null);
      await loadChunks();
      toast.success("制度切片已成功更新并同步数据库！", "更新成功");
    } catch (err: any) {
      toast.error(err.message || "更新失败", "更新异常");
    } finally {
      setIsSavingEdit(false);
    }
  };

  // 删除切片
  const handleDeleteChunk = async (id: string) => {
    try {
      await deleteKnowledgeChunkApi(id);
      setChunks((prev) => prev.filter((c) => c.id !== id));
      toast.success("该知识切片已从数据库中彻底移除", "删除成功");
    } catch (err: any) {
      toast.error(err.message || "删除异常", "删除失败");
    }
  };

  // 真实混合检索测试
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
        {/* 顶部标题栏与全局操作按钮 */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">
                企业制度知识库
              </span>
              <span className="text-xs text-slate-400">· 动态数据库存储 · 全流程可自主编辑</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">企业制度与规章管理</h1>
            <p className="text-xs text-slate-500 mt-1">
              文档与切片全部存入系统数据库，支持在线编辑、下载模版、本地导入与物理删除。AI 回答时将自动检索此处真实数据。
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
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-2xl shadow-lg shadow-emerald-500/25 transition-all hover:-translate-y-0.5 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>{isUploading ? "正在解析导入..." : "上传本地文档"}</span>
            </button>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-2xl shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4 text-emerald-600" />
              <span>录入新切片</span>
            </button>
          </div>
        </div>

        {/* ── 模块 1: 示例规章制度文档模版库 (支持直接下载 .md 文件到本地，也支持一键导入数据库) ── */}
        <div className="bg-gradient-to-r from-emerald-50/70 via-slate-50 to-blue-50/60 p-6 rounded-[2rem] border border-emerald-200/70 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-emerald-600" />
              <h2 className="text-sm font-black text-slate-900">
                常用企业制度文档模版
              </h2>
              <span className="text-[11px] text-slate-500">
                （可下载到本地按需修改后上传，或直接导入数据库中供 AI 检索）
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {KNOWLEDGE_TEMPLATES.map((tpl, idx) => (
              <div
                key={idx}
                className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition flex flex-col justify-between space-y-3"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {tpl.category}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">.md 格式</span>
                  </div>
                  <h3 className="text-xs font-black text-slate-800 tracking-tight line-clamp-1" title={tpl.title}>
                    {tpl.title}
                  </h3>
                  <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">
                    {tpl.summary}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleDownloadTemplate(tpl)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl font-bold text-xs transition border border-slate-200/80 cursor-pointer"
                    title="下载此 Markdown 模版文件到您的电脑"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>下载模版</span>
                  </button>

                  <button
                    onClick={() => handleImportTemplateToDb(tpl)}
                    disabled={isUploading}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition shadow-2xs cursor-pointer disabled:opacity-50"
                    title="切分并存入系统数据库"
                  >
                    <Upload className="w-3 h-3" />
                    <span>导入数据库</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── 模块 2: 真实检索测试实验台 (零写死，直接调用后端 HybridRagService) ── */}
        <div className="bg-white/90 backdrop-blur-md p-6 rounded-[2rem] border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>知识库检索调试台 (测试输入问句，验证数据库知识匹配与召回得分)</span>
            </div>
            <span className="text-[10px] text-emerald-700 font-mono bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              真实数据库查验 · Top-5 召回
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
                placeholder="输入检索语句，如：差旅住宿报销限额是多少？数据库删除操作有什么规矩？"
                className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
              />
            </div>
            <button
              onClick={handleTestSearch}
              disabled={isSearching}
              className="px-5 py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-black disabled:opacity-50 rounded-xl transition flex items-center gap-2 cursor-pointer"
            >
              {isSearching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-emerald-400" />}
              <span>{isSearching ? "正在查询中..." : "试搜一下知识库"}</span>
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
                数据库命中切片 ({recallResults.length} 条):
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
                        <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          匹配得分: {item.sparseScore}
                        </span>
                        <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          相关度: {typeof item.rrfScore === "number" ? (item.rrfScore * 100).toFixed(0) + "%" : item.rrfScore}
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

        {/* ── 模块 3: 知识切片数据库总览表格 (支持搜索过滤、在线编辑、物理删除) ── */}
        <div className="bg-white/90 backdrop-blur-md rounded-[2rem] border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-bold text-slate-800">
                数据库切片清单 ({chunks.length} 个)
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="搜索文档标题或内容..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
              <button
                onClick={loadChunks}
                disabled={loading}
                className="p-2 text-slate-500 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition cursor-pointer"
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
                  <th className="py-3 px-4">分类</th>
                  <th className="py-3 px-4">切片预览 (前 80 字)</th>
                  <th className="py-3 px-4">入库时间</th>
                  <th className="py-3 px-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredChunks.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 space-y-2">
                      <p className="font-bold text-slate-500">数据库暂无知识切片记录</p>
                      <p className="text-xs text-slate-400">
                        您可以点击上方「常用企业制度文档模版」一键导入或下载本地编辑，也可以点击「上传本地文档」或「录入新切片」。
                      </p>
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
                        <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                          {chunk.category || "ENTERPRISE"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 max-w-[280px] truncate" title={chunk.content}>
                        {chunk.content}
                      </td>
                      <td className="py-3 px-4 text-[11px] text-slate-400">
                        {chunk.createdAt ? new Date(chunk.createdAt).toLocaleString() : "已持久化"}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEdit(chunk)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition cursor-pointer"
                            title="在线编辑修改此切片"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteChunk(chunk.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition cursor-pointer"
                            title="从数据库中物理删除"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── 弹窗 1: 手动录入新切片弹窗 ── */}
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
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">文档标题 / 制度名称</label>
                <input
                  type="text"
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  placeholder="例如：公司差旅管理规定与报销标准"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">所属分类</label>
                  <select
                    value={manualCategory}
                    onChange={(e) => setManualCategory(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:outline-none cursor-pointer"
                  >
                    <option value="ENTERPRISE">ENTERPRISE (企业规章)</option>
                    <option value="FINANCE">FINANCE (财务报销)</option>
                    <option value="SRE_OPS">SRE_OPS (系统运维)</option>
                    <option value="LEGAL">LEGAL (法务合同)</option>
                    <option value="TECH_SPEC">TECH_SPEC (技术规约)</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">关键字 (逗号分隔)</label>
                  <input
                    type="text"
                    value={manualKeywords}
                    onChange={(e) => setManualKeywords(e.target.value)}
                    placeholder="差旅, 住宿, 报销标准"
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
                  placeholder="输入制度条款正文，AI 在提问时会自动检索匹配此内容..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:outline-none font-sans"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleSaveManualChunk}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-500/20 transition cursor-pointer"
              >
                确认入库
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 弹窗 2: 在线编辑切片弹窗 ── */}
      {editingChunk && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] border border-slate-200/80 shadow-2xl w-full max-w-xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-blue-600" />
                <h2 className="text-base font-bold text-slate-900">
                  编辑制度条目 (ID: {editingChunk.id})
                </h2>
              </div>
              <button
                onClick={() => setEditingChunk(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">文档标题 / 制度名称</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">所属分类</label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:outline-none cursor-pointer"
                  >
                    <option value="ENTERPRISE">ENTERPRISE (企业规章)</option>
                    <option value="FINANCE">FINANCE (财务报销)</option>
                    <option value="SRE_OPS">SRE_OPS (系统运维)</option>
                    <option value="LEGAL">LEGAL (法务合同)</option>
                    <option value="TECH_SPEC">TECH_SPEC (技术规约)</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">关键字 (逗号分隔)</label>
                  <input
                    type="text"
                    value={editKeywords}
                    onChange={(e) => setEditKeywords(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">切片正文内容 (支持修改)</label>
                <textarea
                  rows={8}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:outline-none font-sans text-xs leading-relaxed"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                onClick={() => setEditingChunk(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
                className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20 transition cursor-pointer disabled:opacity-50"
              >
                {isSavingEdit ? "正在保存更新..." : "保存修改并写入数据库"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
