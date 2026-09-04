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
    oneLiner: "Skill Runtime Lab：Router 可见打分 + Site Audit（fetch + Performance API）+ DOM Probe + Workflow 入队 — MCP 流水线 Trace 可展开 JSON。",
    demoProves: "Router Lab 改意图看 score breakdown；Site Audit 看真实 latency/TTFB；DOM Probe 看 role 分布；MCP Console 发 JSON-RPC。",
    steps: [
      "Router Lab — 输入「分析性能 metrics」→ 看 trigger 加权矩阵 → Run site-analyzer",
      "Site Audit — 流水线 http_probe → snapshot → Performance API → 指标面板",
      "DOM Probe — browser_snapshot 全树 → role 分布 / 交互密度 → 跳转 Locator Lab",
      "Workflow — workflow_run 入队 + 执行面 snapshot → 跳转 SDK Lab",
    ],
    compare: {
      usual: { title: "Prompt 硬编码工具", desc: "Agent 换场景就要改 system prompt，难复用" },
      here: { title: "SKILL.md + MCP", desc: "manifest 可版本化，trigger 自动路由，工具走统一协议" },
    },
  },

  agent: {
    slug: "agent",
    oneLiner: "完整 Agent 闭环：配置 LLM API → 真实 Tool Call Loop → MCP 真实执行（http_probe / knowledge_search / snapshot）→ 多轮 Replan 直到回复。",
    demoProves: "配置 DeepSeek/OpenAI Key 后直接对话；Agent 自主选工具；右侧 Trace 逐步展开 JSON；workflow_run 触发 noVNC。",
    steps: [
      "配置 LLM — DeepSeek / OpenAI / Ollama，Key 存 sessionStorage",
      "点「发布前检查」或输入问题 — LLM 流式 Reasoning + 自动 Tool Call",
      "右侧 Agent Loop Trace — 每轮 tools/call 可展开真实 JSON",
      "下半 MCP Console — 手动对照 JSON-RPC 协议",
    ],
    compare: {
      usual: { title: "聊天 + 硬编码 tool", desc: "流和工具各做各的，协议说不清" },
      here: { title: "SSE 消费 + MCP 协议", desc: "一层看产品体验，一层看工具工程" },
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
