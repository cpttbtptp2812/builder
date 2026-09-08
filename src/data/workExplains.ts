/** 各项目演示页 — 与页面内容一一对应 */

export type WorkExplain = {
  slug: string;
  oneLiner: string;
  demoProves: string;
  steps: string[];
  compare?: {
    usual: { title: string; desc: string };
    here: { title: string; desc: string };
  };
};

export const WORK_EXPLAINS: Record<string, WorkExplain> = {
  imean: {
    slug: "imean",
    oneLiner: "智能自动化平台成品：用自然语言描述任务，系统匹配工作流并在真实浏览器里逐步执行。",
    demoProves: "完整产品链路：对话匹配 → 选流程 → 本地/云端/远程执行 → 流程图与浏览器同步高亮回放。",
    steps: [
      "输入或点预设「批量改价上架」，再点匹配结果 — 自动开始回放",
      "看浏览器区：聚光灯圈住当前元素，顶部 LIVE API 横幅",
      "价格 ¥99→¥129 逐字变化，表格出现「已改」，按钮变绿「提交成功」",
      "右侧技术事件流同步打出 querySelector / dispatchEvent",
    ],
    compare: {
      usual: { title: "脚本 + 人工运维", desc: "改价靠人手点后台，难复用" },
      here: { title: "对话驱动自动化", desc: "说人话就能跑通一整条业务流程" },
    },
  },

  skills: {
    slug: "skills",
    oneLiner: "SkillForge：SKILL.md 定义意图与工具链 — Router 可见打分，三个 Skill 跑真实 MCP 流水线并出指标面板。",
    demoProves: "Router Lab 改意图看 score breakdown；Site Audit 看 fetch + Performance API；DOM Probe 看 role 分布；每步 Trace 可展开 JSON。",
    steps: [
      "Router Lab — 输入「分析性能 metrics」→ 看 trigger 矩阵 → Run site-analyzer",
      "Site Audit — http_probe → snapshot → Performance API → latency 面板",
      "DOM Probe — browser_snapshot 全树 → role 分布 / 交互密度",
      "Workflow — workflow_run 入队 + 执行面 snapshot",
    ],
    compare: {
      usual: { title: "Prompt 硬编码工具", desc: "Agent 换场景就要改 system prompt，难复用" },
      here: { title: "SKILL.md + MCP", desc: "manifest 可版本化，trigger 自动路由，工具走统一协议" },
    },
  },

  agent: {
    slug: "agent",
    oneLiner: "UniAgent：默认 Guest 免配置，Router 选 Skill 后走 MCP 真实执行；可选 LLM 开启完整 Tool Call Loop。",
    demoProves: "输入或点预设即跑通；右侧 Agent Loop Trace 展开 tools/call JSON；下方 MCP Console 可手动对照协议。",
    steps: [
      "直接输入问题，或点欢迎区预设 — Guest 自动 Router + MCP",
      "看右侧 Trace — 每步 tools/call  latency 与返回体",
      "需要 LLM 时在配置栏勾选「启用我的 LLM」",
      "展开「平台分层」对照 SkillForge / Platform Lab 模块",
    ],
    compare: {
      usual: { title: "聊天 + 硬编码 tool", desc: "流和工具各做各的，协议说不清" },
      here: { title: "Guest + MCP 协议", desc: "点开就能用，产品体验与工程 Trace 同屏" },
    },
  },

  "dev-debug": {
    slug: "dev-debug",
    oneLiner: "Agent 开发调试台：对话、Skills、RAG / Multi-Agent、路由回归，Tab 切换。",
    demoProves: "一个入口替代原 UniAgent / SkillForge / Platform 三页；需 npm run dev:server 启 SQLite 后端。",
    steps: [
      "Tab「对话」— Guest 模式输入问题，看 MCP Trace",
      "Tab「Skills」— Router 矩阵 + 跑 Skill 流水线",
      "Tab「Platform」— RAG 召回 + 三 Agent 协作",
      "Tab「路由测试」— 固定用例回归",
    ],
    compare: {
      usual: { title: "三个分散 Demo 页", desc: "来回跳，不知道先看哪" },
      here: { title: "统一调试台", desc: "按模块 Tab 切换" },
    },
  },

  eval: {
    slug: "eval",
    oneLiner: "Skill 路由回归：固定用例检查 Router 是否选对 Skill，并统计工具链延迟。",
    demoProves: "运行用例后看通过率、失败列表、P50/P99。",
    steps: [
      "点「运行全部用例」",
      "看 Router 准确率与工具延迟",
      "展开失败样本或完整用例表",
    ],
    compare: {
      usual: { title: "手动试几条 prompt", desc: "换一句就不知道还对不对" },
      here: { title: "固定回归集", desc: "改 Router 后一键重跑" },
    },
  },

  platform: {
    slug: "platform",
    oneLiner: "RAG 召回 + 三 Agent 协作 Trace。",
    demoProves: "RAG 看 chunk 相关度；Multi-Agent 看各角色依次执行。",
    steps: [
      "跑 RAG 或 Multi-Agent 演示",
      "改问题看召回变化",
      "路由测试见 Skill 路由测试页",
    ],
    compare: {
      usual: { title: "文档描述", desc: "难以验证行为" },
      here: { title: "可交互 Lab", desc: "chunk 与 Trace 可在线看" },
    },
  },

  builder: {
    slug: "builder",
    oneLiner: "React Flow 流程编辑器：拖节点、Copilot 改图、模拟运行——本页只有画布，不含对话和回放。",
    demoProves: "useNodesState 拖拽、onConnect 连边、Copilot patchGraph 插节点、BFS 模拟高亮路径",
    steps: [
      "左侧 palette 拖 HTTP / LLM / DOM 节点到画布",
      "拖 Handle 圆点 onConnect 加边",
      "点「AI 优化」→ Copilot 分析并插入 Merge 节点",
      "点「模拟运行」→ 路径节点依次高亮",
    ],
    compare: {
      usual: { title: "纯表单配流程", desc: "步骤多难维护、非技术看不懂" },
      here: { title: "React Flow + Copilot", desc: "图一眼看懂，AI 直接改图结构" },
    },
  },

  sse: {
    slug: "sse",
    oneLiner: "Agent 底层协议层：左 SSE 原始 chunk、右 UIMessage parse 结果、中技术事件流——专门调试 parse 和续传。",
    demoProves: "TTFB / chunk 数 / node:http 指标；send() vs useAutoResume；pause 时日志打出 pendingTurnId",
    steps: [
      "▶ send() 开始收流 → 看三栏同步更新",
      "左栏黑底白字看原始 SSE 帧",
      "右栏看 reasoning-delta / tool-call 等 part",
      "暂停后 ↻ useAutoResume → 看中栏续传 API 日志",
    ],
    compare: {
      usual: { title: "解析藏在 Provider", desc: "出错只能打 log，不好对照" },
      here: { title: "三栏对照 + 技术流", desc: "原始流、parse、API 并排" },
    },
  },

  locator: {
    slug: "locator",
    oneLiner: "ReplaySDK 定位模块：点 mock 页面元素，看 CSS → XPath → 文本 → 缓存策略瀑布。",
    demoProves: "每种策略 try/fail + ms；Shadow DOM 走 shadowRoot.querySelector；优化后 IDB 缓存优先",
    steps: [
      "点提交按钮 / 动态表单 / 表格 / Shadow 内按钮",
      "右侧策略链 + 中栏技术事件流同步",
      "切换「优化前 / 后」看命中率和缓存策略",
      "成功后日志打出 scrollIntoView + dispatch(click)",
    ],
    compare: {
      usual: { title: "只认一种 CSS", desc: "改版就挂，~70% 成功率" },
      here: { title: "策略瀑布 + IDB", desc: "一种不行换另一种，~92%" },
    },
  },

  sdk: {
    slug: "sdk",
    oneLiner: "纯 TS 执行引擎：TaskQueue 逐步跑步骤，PostMessage 跨窗口 mutex，CompressionStream 持久化队列。",
    demoProves: "pause/skip 状态机；主窗口 / Popup 轮流 executing；gzip 18.6KB→4.2KB；控制台打 API 日志",
    steps: [
      "▶ 运行回放 → 技术流打出 execute(step)",
      "试暂停 / 跳过 → TaskQueue 状态变更日志",
      "看窗口栏 postMessage lock/unlock",
      "上方 CompressionStream 区看 gzip round-trip",
    ],
    compare: {
      usual: { title: "绑死在 React", desc: "只能在自己页面跑" },
      here: { title: "纯 SDK 注入", desc: "任意网站挂脚本就能回放" },
    },
  },

  extension: {
    slug: "extension",
    oneLiner: "MV3 录制扩展 demo：Content Script 捕获 click/input，isolated world 高亮，输出 steps.json。",
    demoProves: "chrome.storage.session 持久化；capture 阶段监听；JSON schema 对齐 Builder / SDK",
    steps: [
      "▶ 录制此页 → 日志打出 addEventListener(capture)",
      "看页面高亮跟着步骤走",
      "右侧黑底 JSON 实时增长",
      "录完 → 可导入 Builder 继续编排",
    ],
    compare: {
      usual: { title: "手写 steps JSON", desc: "慢、selector 易错" },
      here: { title: "录一遍导出", desc: "真实 DOM 操作生成 JSON" },
    },
  },

  jianchi: {
    slug: "jianchi",
    oneLiner: "8000 行表格重构对比：全量渲染 vs react-window 虚拟滚动，滚动时 FPS / DOM 节点实时变化。",
    demoProves: "重构前 ~80 DOM / 18 FPS；重构后 ~15 DOM / 58+ FPS；技术流解释 FixedSizeList 公式",
    steps: [
      "选「重构前 · 8000 行」滚动 → 看 FPS 掉、日志打全量 map",
      "选「重构后 · 虚拟滚动」→ 日志打 startIndex / visibleCount",
      "对比首屏、复用率、DOM 节点三指标",
    ],
    compare: {
      usual: { title: "8000 行全渲染", desc: "DOM 爆炸，滚动卡死" },
      here: { title: "只渲染视口行", desc: "DOM ~15，FPS 58+" },
    },
  },

  cmb: {
    slug: "cmb",
    oneLiner: "WebRTC 远程见证：RTCPeerConnection 从 Offer 到双录的状态机，弱网 ICE 重连思路。",
    demoProves: "createOffer → setRemoteDescription → ontrack → MediaRecorder；RTT 实时；技术流逐步打出 API",
    steps: [
      "▶ 发起远程见证 → 看状态条 + 技术日志",
      "Offer / ICE / Connected / 双录 逐步变绿",
      "视频区 REC + RTT 延迟数字",
      "断开 → oniceconnectionstatechange failed → restartIce",
    ],
    compare: {
      usual: { title: "只展示视频 UI", desc: "看不出 WebRTC API" },
      here: { title: "状态机 + 技术流", desc: "每步对应 RTCPeerConnection 调用" },
    },
  },

  fee: {
    slug: "fee",
    oneLiner: "qiankun 微前端 + Bundle 分析：瀑布图看 chunk 体积，Tab 切换看 registerMicroApps → mount。",
    demoProves: "rollup visualizer 瀑布；dynamic import 按需加载；切换 Tab 时技术流打 loadMicroApp 生命周期",
    steps: [
      "点瀑布图色块 → chunk 名称和 gzip 体积",
      "Tab 切换费控/审批/报表 → 看加载进度 + 技术日志",
      "mount 完成后子应用样式隔离挂载",
    ],
    compare: {
      usual: { title: "大单体", desc: "改一行发整个系统" },
      here: { title: "qiankun 子应用", desc: "独立部署、路由级按需加载" },
    },
  },
};

export function getWorkExplain(slug: string): WorkExplain | null {
  return WORK_EXPLAINS[slug] ?? null;
}
