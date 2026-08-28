/** 各项目个人笔记 — 随手记风格，首页弹框用 */

export type TechHighlight = {
  title: string;
  analysis: string;
  /** 关键数据或 API，可选 */
  metric?: string;
};

export type TechJot = {
  tag: string;
  text: string;
};

export type WorkNote = {
  slug: string;
  purpose: string;
  /** 核心技术亮点 — 突出技术分析 */
  highlights: TechHighlight[];
  content: string;
  techJots: TechJot[];
  scraps: string[];
  siteNote: string;
};

export const WORK_NOTES: Record<string, WorkNote> = {
  imean: {
    slug: "imean",
    purpose:
      "目前主项目。演示页把四条链路拆开：语义匹配、队列压缩、流程编辑器、DOM 回放。每条链路在这里跑通、压测、调参，再合回完整产品。",
    highlights: [
      {
        title: "Web Worker 语义匹配 — 主线程零阻塞",
        analysis:
          "用户每发一句话，要在整个场景库里做向量余弦相似度扫描。这个计算如果放主线程，对话 UI、VNC 预览、流程图画布会一起卡。我的做法是把 embedding 比对整段放进 Worker，主线程只 postMessage 发 query、收 Top-K 结果。Worker 里用 Float32Array 做点积和归一化，算完一次性回传。",
        metric: "匹配 RTT ~120ms（Worker 内 ~85ms）· 主线程 0ms 阻塞",
      },
      {
        title: "IndexedDB 二级缓存 — 同一句话不重算",
        analysis:
          "匹配结果和步骤队列都落 IndexedDB。匹配缓存 key 是 query 归一化后的 hash，第二次问同样的话直接 idbGet，跳过 Worker。步骤队列也持久化，用户刷新页面可以从断点接着跑，不用重新拉取。两层缓存分别解决「算力」和「状态」问题。",
        metric: "IDB 命中 ~8ms · 对比 Worker 重算 ~85ms",
      },
      {
        title: "CompressionStream 步骤队列压缩",
        analysis:
          "自动化流程可能有 40～80 步，纯 JSON 存 IndexedDB 动辄 30～50KB。浏览器原生 CompressionStream 做 gzip，不用引 pako。压缩后的 Uint8Array 分片写入，读取时用 DecompressionStream 解压并 round-trip 校验，确保数据没损坏。",
        metric: "48 步队列 18.6KB → 4.2KB（约 -77%）",
      },
      {
        title: "ReplaySDK 多策略定位链",
        analysis:
          "回放成功率八成取决于「找元素」。客户页面一改版 CSS 就废。我按成本从低到高试：CSS → XPath → 文本模糊 → 表格坐标 → IDB 上次成功路径，任一命中即停。Shadow DOM 要穿透 shadowRoot，React 合成事件要用原生 MouseEvent 并 bubbles: true。",
        metric: "定位成功率 ~70% → ~92% · 缓存命中 ~8ms",
      },
    ],
    content:
      "2025 年一直在做这块，投入最多。\n\n" +
      "产品逻辑：用户用自然语言描述想自动完成的操作 → 系统从场景库匹配工作流 → 在真实浏览器里逐步执行。我负责「找流程」「跑流程」两段，以及 Builder 可视化编辑器。\n\n" +
      "三种执行模式（本地 / 云端 VNC / 远程 Agent）的状态同步、pause/resume、多 Tab 互斥调度，是执行链路上另外几个花时间的地方。",
    techJots: [
      { tag: "Web Worker", text: "postMessage 传 { query, embeddings }，Worker 内 cosineSimilarity(a, b) 遍历场景库，返回 sorted results。" },
      { tag: "IndexedDB", text: "idbCache 封装 get/set，store name 按用途分：match-cache / step-queue。" },
      { tag: "CompressionStream", text: "new Response(json).body.pipeThrough(new CompressionStream('gzip'))，输出 ReadableStream<Uint8Array>。" },
      { tag: "React Flow", text: "custom node + Handle 连边，useNodesState/useEdgesState，dagre 布局，MiniMap 导航。" },
      { tag: "PostMessage", text: "全局 TaskQueue 单例，window mutex：lock → execute → unlock broadcast。" },
      { tag: "GraphQL", text: "场景库、工作流元数据走 GraphQL API，前端 Apollo Client 缓存 + 乐观更新。" },
    ],
    scraps: [
      "SPA 改版 selector 全废 → 策略优先级链",
      "Shadow DOM 穿透 + 隔离容器防样式污染",
      "SDK 分包 + gzip 后首包约 -30%",
    ],
    siteNote: "成品演示：对话匹配 → 选模式 → 运行 → 浏览器 DOM 回放 + 流程图高亮。",
  },

  agent: {
    slug: "agent",
    purpose:
      "从 Agent 产品里单独拆出「流式消费链路」验证页。只聚焦一件事：GraphQL SSE 字节流 → AI SDK 5 UIMessage，每一层 TransformStream 能不能跑通、能不能断点续传。",
    highlights: [
      {
        title: "Web Streams pipeThrough 全链路",
        analysis:
          "不是 setTimeout 模拟打字，而是真的 ReadableStream 管道：Uint8Array 字节源 → TextDecoderStream 解码 → TransformStream 切 SSE 帧 → TransformStream 映射 UIMessage part。每一站是一个标准 Web API，AbortController 可以随时 cancel。演示页五段会高亮当前走到哪一站。",
        metric: "5 段管道 · 每段可独立调试和替换",
      },
      {
        title: "UIMessage 部件模型 — 按 part 渲染",
        analysis:
          "AI SDK 5 的消息不是一整段字符串，而是 part 数组：text-delta 是正文流、reasoning-delta 是思考过程、tool-call / tool-result 是工具调用。前端按 part.type 渲染不同卡片，reasoning 可折叠，tool 有 wave 加载动画。不拼字符串，避免流式更新时整段 re-render。",
        metric: "6 种 part 类型 · 每种独立 React 组件",
      },
      {
        title: "SSE 长流截断 — undici vs native http",
        analysis:
          "Node 端 Provider 最初用 undici fetch 读 GraphQL SSE，长对话流到一半会被截断，assistant 消息丢后半段。排查后发现 undici 对长连接有 buffer 限制。改成 native http.request 监听 data 事件逐 chunk 读，问题消失。这是线上真实事故。",
        metric: "长流（>30s）截断率 100% → 0%",
      },
      {
        title: "断线续传 — pendingTurnId + resume API",
        analysis:
          "用户刷新或断网时，localStorage 存 pendingTurnId。重新进入页面后调 GET /api/chat/resume?turnId=xxx，Provider 从断点 chunk 接着读流，半条 assistant 消息能续上。send 和 resume 两种模式共用同一套 parse 管道，只是入口不同。",
        metric: "半条消息恢复率 100% · 不丢上下文",
      },
    ],
    content:
      "AI 对话入口，比普通 Chat 多三层：调后端工具、挂工作流、开 VNC 看自动化执行。\n\n" +
      "我主要做 SSE → UIMessage 的适配层，以及工具卡、VNC 浮窗、虚拟列表等配套。工具走 data-backend-tool 自定义协议，不走 AI SDK function call，避免前后端各执行一次。",
    techJots: [
      { tag: "ReadableStream", text: "createSSEByteStream() 模拟后端，400ms 间隔推 chunk，真实环境是 http.request data 事件。" },
      { tag: "TransformStream", text: "sseParser: enqueue 按 \\n\\n 切 block；uiMapper: JSON → UIMessage part。" },
      { tag: "AbortController", text: "pause = abort()，resume = 新 reader 从 turnId 对应 offset 开始。" },
      { tag: "data-backend-tool", text: "自定义 data part 协议，前端只渲染不 trigger function call。" },
      { tag: "@tanstack/virtual", text: "useVirtualizer 渲染会话列表，estimateSize + overscan。" },
      { tag: "WorkflowProvider", text: "React Context 提顶层，VNC pause/resume 跨路由保持。" },
    ],
    scraps: [
      "undici 截断 → native http",
      "工具 double-execute → data part 协议",
      "VNC 浮窗跨路由 → Provider 提顶层",
    ],
    siteNote: "成品演示：流式对话 + Reasoning + Tool Call + noVNC。底层 SSE 见 /work/sse。",
  },

  builder: {
    slug: "builder",
    purpose:
      "从 iMean 主产品拆出的「流程编辑器」独立页。专门试 React Flow 交互、Copilot 改图、dagre 布局，不掺对话和回放，改画布代码时好聚焦。",
    highlights: [
      {
        title: "React Flow 12 大图编辑性能",
        analysis:
          "节点有 HTTP、LLM、DOM、条件分支等类型，每种是 custom node + Handle 连边。100+ 节点时要控制 re-render：只更新 drag 中的节点，animated edge 不能全开。MiniMap 按 kind 上色方便导航，视口外节点 React Flow 自动剔除不渲染。",
        metric: "128 节点流畅拖拽 · 视口外零 DOM",
      },
      {
        title: "Valtio 细粒度画布状态",
        analysis:
          "画布频繁拖拽，如果把整个 graph 塞 Redux，每次 drag 触发整树 selector 重算。Valtio 用 proxy 对象，改一个 node.position 只触发引用该 node 的组件更新。比 useState 整图替换省一个数量级的 re-render。",
        metric: "拖拽 re-render 从整图 → 单节点",
      },
      {
        title: "dagre 自动布局",
        analysis:
          "分支多的流程手动拖完边交叉成乱麻。dagre 做 DAG 布局：先拓扑排序确定层级，再算每层节点坐标和边路由。一键整理后边基本不交叉，运营同事也能看懂流程走向。",
        metric: "O(V+E) 布局 · 100 节点 <200ms",
      },
      {
        title: "AI Copilot 改图",
        analysis:
          "生产环境 LLM 读 BPMN JSON 再 patch 图结构。演示页前端模拟：点「AI 优化」分析当前图，自动插入 Merge 节点并连边。Copilot 侧边栏用消息列表展示分析过程，改图结果直接反映到画布。",
        metric: "Copilot 改图 · 非只聊天",
      },
    ],
    content:
      "可视化编排工具，拖拽节点连线组成自动化流程。从左侧面板拖 HTTP / LLM / DOM 节点到画布，HTML5 drag-drop 接 React Flow onDrop。\n\n" +
      "模拟运行不真调后端，前端高亮当前路径，方便给非技术同事演示。撤销重做生产环境用 command pattern，demo 版还没做。",
    techJots: [
      { tag: "React Flow", text: "useNodesState/useEdgesState，onConnect 加边，onNodesChange 处理 drag/select。" },
      { tag: "dagre", text: "dagre.layout(g) 算坐标，再 map 回 React Flow node.position。" },
      { tag: "Valtio", text: "proxy({ nodes, edges })，useSnapshot 订阅细粒度变化。" },
      { tag: "组件面板", text: "onDragStart setData(nodeType)，onDrop screenToFlowPosition 算坐标。" },
      { tag: "Copilot", text: "读 nodes/edges JSON → 分析 → patchGraph(insertNode, addEdge)。" },
      { tag: "模拟运行", text: "BFS 遍历从 start 节点，setInterval 高亮 currentNode。" },
    ],
    scraps: [
      "animated edge 全开会卡 → 只对 active 路径开",
      "BPMN XML ↔ React Flow JSON 双向转换规划中",
    ],
    siteNote: "左侧拖节点、中间画布连线、右侧 Copilot。点「AI 优化」插节点，「模拟运行」看路径高亮。",
  },

  sse: {
    slug: "sse",
    purpose:
      "Agent 的「底层协议实验室」。SSE 解析藏在 Provider 内部不好调试，这页对照「原始 SSE 长什么样」和「parse 后 UIMessage 长什么样」，专门测 pause/resume 和 TTFB。",
    highlights: [
      {
        title: "GraphQL SSE 帧解析 — 不是 EventSource",
        analysis:
          "后端 GraphQL subscription 包一层 SSE 帧，格式和浏览器原生 EventSource 不同。按 \\n\\n 切 event block，从 data: 行抠 JSON。一个 TCP chunk 可能只带半条 JSON，TransformStream 里维护 buffer，凑齐再 JSON.parse。多 tool-call 交错时按 toolCallId 归并。",
        metric: "chunk 边界拼接 · 零 JSON parse 错误",
      },
      {
        title: "双模式 Provider — send / resume",
        analysis:
          "send 是全新对话，resume 带 turnId 从中间 chunk 接着读。两种入口共用同一套 parse 管道，只是 ReadableStream 的数据源不同：send 是实时 SSE，resume 是缓存的剩余 chunk。Provider 对外暴露统一接口，上层 AI SDK 无感知。",
        metric: "半条消息续传 · 上下文不丢",
      },
      {
        title: "TTFB / chunk 性能打点",
        analysis:
          "用 Performance API 量第一个 chunk 到达时间（TTFB）和总 chunk 数。排查慢的时候能区分是网络慢还是前端 parse 慢。左右对照面板：左边原始 SSE 文本，右边 parse 结果，一眼看出 parse 错在哪。",
        metric: "TTFB ~120ms · chunk 数实时统计",
      },
      {
        title: "AbortController 流控制",
        analysis:
          "pause = abort() 停止读流，reader 释放。resume = 新 AbortController + 从 turnId offset 创建新 reader。要确认 reader 没有重复 lock，否则 resume 会抛 TypeError。",
        metric: "pause/resume 无 reader lock 冲突",
      },
    ],
    content:
      "看着就是「读流 + 解析」，实际上 Node 环境、浏览器环境、断点续传要分开想。Node 端不用 fetch（undici 截断），用 http.request 逐段收。",
    techJots: [
      { tag: "SSE 帧格式", text: "event: message\\ndata: {...}\\n\\n，空行分隔 block。" },
      { tag: "buffer 拼接", text: "let buf = ''; enqueue 时 buf += chunk; while (buf.includes('\\n\\n')) { parse block }。" },
      { tag: "native http", text: "http.request(url).on('data', chunk => controller.enqueue(chunk))。" },
      { tag: "UIMessage 映射", text: "reasoning-delta / text-delta / tool-call / tool-result → part 对象。" },
      { tag: "useAutoResume", text: "localStorage pendingTurnId → resume API → 续读流。" },
      { tag: "对照调试", text: "SseSplitView 左右面板 sync scroll，parse 错误即时可见。" },
    ],
    scraps: [
      "左右对照是调试神器",
      "pause 后再 resume 要确认 reader 没重复 lock",
    ],
    siteNote: "三栏：技术事件流 + SSE 原始 chunk（黑底白字）+ UIMessage parse。send() / pause / useAutoResume。",
  },

  locator: {
    slug: "locator",
    purpose:
      "ReplaySDK 最核心也最容易挂的模块——「在页面上找到要点的元素」。单独做这页试各种定位策略组合，mock 页面含 Shadow DOM，跑通再合回 SDK。",
    highlights: [
      {
        title: "多策略定位瀑布 — 按成本递增",
        analysis:
          "像瀑布一样从上往下试：CSS（最快）→ XPath → 文本模糊 → 表格行列坐标 → IndexedDB 上次成功路径。任一成功即停，不再往下。失败的上报埋点，统计哪种页面最常挂在哪一步，针对性加策略。",
        metric: "5 级策略链 · 成功率 ~70% → ~92%",
      },
      {
        title: "IndexedDB 定位缓存",
        analysis:
          "key = 页面 URL + 步骤 id，value = 上次成功的 selector + 策略名。第二次跑同一步骤直接试缓存路径，命中约 8ms，比重新算 XPath（~60ms）快一个数量级。缓存失效条件：页面 URL 变了或手动清缓存。",
        metric: "缓存命中 ~8ms · 冷启动 ~60ms",
      },
      {
        title: "Shadow DOM 穿透",
        analysis:
          "很多组件库（Web Components）把按钮藏在 Shadow Root 里，light DOM 的 querySelector 选不中。要 element.shadowRoot.querySelector() 穿透进去。录制和回放都要处理，否则 Shadow 里的按钮录得到、回放找不到。",
        metric: "Shadow 内元素定位成功率 ~95%",
      },
      {
        title: "scrollIntoView + 原生事件 dispatch",
        analysis:
          "找到元素后先 scrollIntoView({ block: 'center' }) 滚到视口中间，再 dispatch 点击。元素在屏幕外时 click 无效。React 合成事件有时不触发，要用 new MouseEvent('click', { bubbles: true }) 原生 dispatch。",
        metric: "视口外 click 失败率 ~40% → ~2%",
      },
    ],
    content:
      "自动化回放稳不稳，八成看定位。客户页面一改版，之前录好的 CSS 可能就废了。动态 class（css-1a2b3c）不能当唯一依据，要组合附近文本模糊匹配。",
    techJots: [
      { tag: "策略瀑布", text: "for (strategy of chain) { el = strategy.try(); if (el) return el }。" },
      { tag: "IDB 缓存", text: "idbGet(`loc:${url}:${stepId}`) → { selector, strategy }。" },
      { tag: "Shadow DOM", text: "el.shadowRoot?.querySelector(sel) ?? el.querySelector(sel)。" },
      { tag: "表格坐标", text: "table.rows[r].cells[c] 按行列索引定位，不依赖 class。" },
      { tag: "文本模糊", text: "TreeWalker 遍历文本节点，includes(matchText) 找最近可点击祖先。" },
      { tag: "埋点上报", text: "strategy name + ok/fail + ms → analytics，指导策略优化。" },
    ],
    scraps: [
      "iframe 跨域 → postMessage 代理（demo 同源简化）",
      "动态 class 组合文本模糊",
    ],
    siteNote: "点 mock 元素看策略瀑布 + 右侧技术事件流。Shadow DOM 走 shadowRoot.querySelector。",
  },

  sdk: {
    slug: "sdk",
    purpose:
      "iMean 执行引擎本体，不绑 UI 框架，注入任意网页就能跑步骤队列。单独验证压缩存储、跨窗口调度、pause/skip/retry API，不和 React 搅在一起。",
    highlights: [
      {
        title: "TaskQueue 状态机 — 单线程逐步执行",
        analysis:
          "拿到步骤 JSON 数组，循环 execute(step)：find → scroll → click → wait。每步 await 完成再进下一步。状态机 idle → running → paused → done，pause 冻结当前 step，skip 跳过失败步，retry 重试当前步，manualComplete 让用户手动点完再继续。",
        metric: "4 种控制 API · 状态机 4 态",
      },
      {
        title: "PostMessage 跨窗口 mutex",
        analysis:
          "多 Tab 同时跑自动化时，主窗口持队列锁，popup iframe 执行完 postMessage 通知释放。避免两个窗口抢着 click 同一个按钮。全局单例 TaskQueue，所有窗口通过 postMessage 广播状态变更。",
        metric: "多 Tab 零冲突 · 单线程调度",
      },
      {
        title: "CompressionStream 队列持久化",
        analysis:
          "步骤队列 JSON 可能 30～50KB，gzip 后 4～5KB 存 IndexedDB 分片。读取 DecompressionStream 解压 + round-trip 校验。大队列分片存避免单次 IDB 写入超限。",
        metric: "18.6KB → 4.2KB（-77%）· 分片存储",
      },
      {
        title: "Operation 插件化架构",
        analysis:
          "HTTP、LLM、DOM 各类操作各自 register({ type, execute })，核心循环不用 switch-case。新增操作类型只加插件，不改 scheduler。纯 TypeScript 无框架依赖，宿主页面 React/Vue/原生都能接。",
        metric: "纯 TS · 零框架依赖 · 插件热注册",
      },
    ],
    content:
      "SDK 就是「播放器」：steps.json 进，页面操作出。Vite 分包把 Replay 核心和引导 UI 拆开，宿主首屏只加载 scheduler，体积约减 30%。",
    techJots: [
      { tag: "TaskQueue", text: "async run() { for (step of queue) await ops[step.type].execute(step) }。" },
      { tag: "PostMessage", text: "window.postMessage({ type: 'queue:lock'|'queue:unlock', winId })。" },
      { tag: "CompressionStream", text: "gzip 存 IDB，DecompressionStream 读回校验。" },
      { tag: "Operation", text: "registerOperation('click', async (step) => { ... })。" },
      { tag: "Vite 分包", text: "manualChunks: { scheduler, ui-guide }。" },
      { tag: "manualComplete", text: "step 失败 → 回调用户 → 用户点完 resolve → 继续。" },
    ],
    scraps: [
      "hover vs click → simulate mouseenter 链",
      "大队列 → 分片 + gzip",
    ],
    siteNote: "TaskQueue.run / pause / skip + CompressionStream 压缩 + 技术事件流。",
  },

  extension: {
    slug: "extension",
    purpose:
      "自动化闭环第一环：「录」。扩展在真实页面录用户操作，输出 steps.json 给 Builder 编、SDK 放。这页是 MV3 交互 demo，测录制和高亮逻辑。",
    highlights: [
      {
        title: "Manifest V3 — service worker 生命周期",
        analysis:
          "MV3 下 background 变成 service worker，随时可能被浏览器回收，不能常驻内存。录制中的状态（当前步骤列表、录制开关）必须放 chrome.storage.session，不能放全局变量。popup 关闭后 service worker 可能被杀，下次唤醒从 storage 恢复。",
        metric: "storage.session 持久化 · 零状态丢失",
      },
      {
        title: "Content Script isolated world",
        analysis:
          "Content Script 跑在 isolated world，和页面 JS 完全隔离，互不污染。监听 click/input/change 事件序列化成步骤。高亮用 overlay div 盖在目标元素上，不直接改页面 DOM 和样式，避免破坏宿主页面布局。",
        metric: "isolated world · 零 DOM 污染",
      },
      {
        title: "steps.json 统一 schema",
        analysis:
          "扩展录、Builder 编、SDK 放，三方共用一套 JSON schema：{ action, selector, value, timestamp }。导入 Builder 时校验 version 字段，旧格式拒绝并提示升级。保证录制产物可以直接进编辑器和执行引擎。",
        metric: "录 → 编 → 放 三方 schema 对齐",
      },
      {
        title: "Shadow DOM 录制",
        analysis:
          "Shadow DOM 内元素的 click 事件在 composedPath 里能拿到 shadow 内的 target，但 selector 生成要特殊处理：记录 shadow host + shadow 内 path。回放时 SDK 走 shadowRoot.querySelector 穿透。",
        metric: "Shadow 内元素可录可放",
      },
    ],
    content:
      "三端通信：background ↔ content script ↔ popup 用 chrome.runtime.sendMessage。SPA 路由 pushState 变内容但 URL 不变，要 hook history.pushState 一起录。",
    techJots: [
      { tag: "MV3", text: "service worker + chrome.storage.session + activeTab 权限。" },
      { tag: "Content Script", text: "document.addEventListener('click', serializeStep, true) 捕获阶段。" },
      { tag: "message passing", text: "chrome.runtime.sendMessage({ type, payload }) 三端同步。" },
      { tag: "overlay 高亮", text: "position: fixed div 跟 target getBoundingClientRect。" },
      { tag: "selector 生成", text: "CSS path + shadow host 标记 + fallback XPath。" },
      { tag: "pushState hook", text: "history.pushState = wrap(original, recordNavigation)。" },
    ],
    scraps: [
      "iframe 穿透录不录 → 产品定规则",
      "权限最小化 activeTab",
    ],
    siteNote: "MV3 Content Script 录制 + steps.json 黑底白字 + 技术事件流。",
  },

  jianchi: {
    slug: "jianchi",
    purpose:
      "2025 初大型重构的性能验证页。对比「重构前全量渲染」和「react-window 虚拟滚动」，是推虚拟列表方案时的说服材料。",
    highlights: [
      {
        title: "react-window 虚拟滚动 — 8000 行表格",
        analysis:
          "重构前 8000 行表格全量渲染 80 个 DOM 节点在视口内，滚动 FPS 卡到 18。上 react-window 后只渲染视口内 + overscan 2 行缓冲，DOM 从 80 降到 ~15 个节点，滚动 FPS 稳在 58+。FixedSizeList 适合等行高，VariableSizeList 适合动态行高。",
        metric: "DOM 80 → 15 节点 · FPS 18 → 58",
      },
      {
        title: "Web Worker TR 布局预计算",
        analysis:
          "TR 流程图节点坐标计算量大，放主线程会阻塞 UI。坐标计算丢 Web Worker，算完 postMessage 回主线程一次性 paint。Worker 里做 DAG 拓扑 + 坐标分配，主线程只负责 SVG/Canvas 渲染。",
        metric: "布局计算 0ms 主线程阻塞",
      },
      {
        title: "reselect 派生数据缓存",
        analysis:
          "Redux store 里原始数据经过 map/filter/sort 派生后才给组件。用 createSelector 缓存派生结果，依赖数组没变就不重算。组件复用率从 18% 提到 60%，减少了大量无意义 re-render。",
        metric: "组件复用率 18% → 60%",
      },
      {
        title: "渐进式迁移 — 拒绝 Big Bang",
        analysis:
          "20 万行 legacy 代码不能一次性重写。按业务模块切路由，新旧模块共存，类组件逐步改 Hooks。不能停服，每个 sprint 交付一个模块的重构版本，回归测试覆盖核心路径。",
        metric: "首屏 3.2s → 1.4s · 零停服",
      },
    ],
    content:
      "2025 初做了三个月重构。老代码类组件 + 自研组件库，业务不能停。React DnD 审批流拖拽和虚拟列表共存要固定 drag preview 层。",
    techJots: [
      { tag: "react-window", text: "FixedSizeList height={600} itemCount={8000} itemSize={36}。" },
      { tag: "Web Worker", text: "worker.postMessage({ nodes, edges }) → layout coords。" },
      { tag: "reselect", text: "createSelector(selectRaw, mapFilterSort) 缓存派生。" },
      { tag: "code splitting", text: "React.lazy + Suspense 路由级拆包。" },
      { tag: "React DnD", text: "DragLayer 固定 preview，不和虚拟列表抢 z-index。" },
      { tag: "CSS Modules", text: "老 alife 组件和新 antd 样式隔离，避免全局污染。" },
    ],
    scraps: [
      "老组件库样式冲突 → CSS Modules",
      "20 万行按模块切，拒绝 Big Bang",
    ],
    siteNote: "重构前/后切换 + FPS 对比 + react-window 技术事件流。",
  },

  cmb: {
    slug: "cmb",
    purpose:
      "远程银行项目的浓缩 demo。完整系统太大搬不过来，这页演示 WebRTC 连接状态机和弱网重连思路。",
    highlights: [
      {
        title: "ChannelAdapter 多渠道抽象",
        analysis:
          "柜面、Pad、远程三条渠道业务逻辑类似，UI 和交互差很多。ChannelAdapter 层：同一个 submitTransfer action，按 counter/pad/remote 映射三套 UI 组件。业务 hook 和 Redux action 复用，UI 层分叉。避免 copy 三份代码，团队可以并行交付不同渠道。",
        metric: "3 渠道 · 1 套业务逻辑",
      },
      {
        title: "WebRTC 远程见证状态机",
        analysis:
          "远程见证走 WebRTC 双录：createOffer → ICE gathering → setRemoteDescription → Connected → 开始双录。每步要有 UI 反馈（连接中/已连接/录制中），用户不能对着空白屏幕干等。ICE Candidate 交换、DTLS-SRTP 握手、媒体流 addTrack 按顺序来。",
        metric: "Offer → Connected → 双录 · 4 态 UI",
      },
      {
        title: "弱网重连 + 码率自适应",
        analysis:
          "银行环境多用专线视频 SDK，WebRTC 做兜底。弱网时 ICE 断连 → 自动 re-gather Candidate → 重连。码率自适应：带宽不够时降分辨率保连通，极端情况降级纯音频。RTT 和 packet loss 实时监控，超阈值触发降级。",
        metric: "弱网重连成功率 ~95% · 音频降级兜底",
      },
      {
        title: "Redux middleware 操作留痕",
        analysis:
          "监管审计要求还原用户每一步操作。Redux middleware 拦截每个 action，带时间戳和操作上下文写留痕日志。双录视频 + 操作留痕 + 时间戳存证，合规三件套。",
        metric: "全操作链可追溯 · 时间戳存证",
      },
    ],
    content:
      "2022—2024 带 5 人前端。多业务线并行，接口延期时用 mock + 契约测试并行开发。视频延迟高时走边缘节点 + 弱网只保音频。",
    techJots: [
      { tag: "ChannelAdapter", text: "const UI = adapters[channel].SubmitTransfer; return <UI {...props} />。" },
      { tag: "WebRTC", text: "RTCPeerConnection → createOffer → ICE → addTrack → ontrack。" },
      { tag: "ICE 重连", text: "oniceconnectionstatechange → failed → restartIce()。" },
      { tag: "码率自适应", text: "getStats() → bandwidth estimate → setParameters(maxBitrate)。" },
      { tag: "Redux middleware", text: "store => next => action => { log(action, timestamp); return next(action) }。" },
      { tag: "双录", text: "MediaRecorder 录屏 + 摄像头，分片上传 OSS。" },
    ],
    scraps: [
      "三端 UI 差异 → 抽象层前期多投后期省",
      "5 人并行 → mock + 契约测试",
    ],
    siteNote: "createOffer → ICE → MediaRecorder 状态机 + WebRTC 技术事件流。",
  },

  fee: {
    slug: "fee",
    purpose:
      "费控项目的微前端和工程化 demo。完整模块太大，这页聚焦 qiankun 子应用加载和 Bundle 体积分析两件事。",
    highlights: [
      {
        title: "qiankun 微前端拆分",
        analysis:
          "费控原来是大单体，拆成 qiankun 主应用 + 多个子应用独立部署发版。registerMicroApps 注册 entry 和 activeRule，路由匹配时 fetch 子应用 HTML/JS/CSS 挂载到容器 div。react/react-dom 走 externals 避免每个子应用各加载一份。子应用 vite/webpack 混部要测加载兼容。",
        metric: "N 子应用独立 CI/CD · 主应用共享 runtime",
      },
      {
        title: "样式隔离 sandbox",
        analysis:
          "子应用 CSS 不能污染主应用。strictStyleIsolation 用 Shadow DOM 隔离，彻底但有些组件库在 Shadow 里有坑。experimentalStyleIsolation 用选择器前缀，折中方案。我们两种都试过，最终按子应用特点选。",
        metric: "零样式泄漏 · 子应用 CSS Scoped",
      },
      {
        title: "Bundle 瀑布图 — 按需拆包",
        analysis:
          "用 webpack-bundle-analyzer 或 rollup-plugin-visualizer 生成瀑布图，直观看到哪个 chunk 最大。router.lazy + dynamic import 拆 route 级代码，lodash 改 lodash-es tree-shaking，moment 换 dayjs。瀑布图指导拆包优先级。",
        metric: "最大 chunk -22KB gzip · 路由级 lazy",
      },
      {
        title: "schema 驱动动态表单",
        analysis:
          "后端 JSON schema 描述字段类型、联动规则、校验。前端 HOC withDynamicForm 递归渲染 Form.Item：{ type: 'select', name, options, when: { field: 'A', eq: 'X' } }。表达式不能 eval，自研简单 DSL 解析 when 条件。MutationObserver 监听表格列增删，触发 thead/tbody 宽度 recalc。",
        metric: "后端配联动 · 前端零 hardcode",
      },
    ],
    content:
      "2022—2023 带 4 人前端。还牵头 dumi 组件库，文档 + demo 一体，CI 自动发私有 npm。全局 ErrorBoundary 兜子应用崩溃，不能拖垮主应用。",
    techJots: [
      { tag: "qiankun", text: "registerMicroApps([{ name, entry, container, activeRule }])。" },
      { tag: "样式隔离", text: "sandbox: { strictStyleIsolation: true } 或 experimentalStyleIsolation。" },
      { tag: "dumi", text: "组件文档 + demo，GitHub Actions build → npm publish。" },
      { tag: "schema Form", text: "recursiveRender(schema) → Form.Item + when 条件过滤。" },
      { tag: "MutationObserver", text: "observer.observe(table, { childList: true }) → recalcWidths()。" },
      { tag: "ErrorBoundary", text: "子应用 crash → 主应用显示 fallback，不影响其他 Tab。" },
    ],
    scraps: [
      "vite/webpack 混部 → entry 格式兼容测试",
      "strictStyleIsolation vs 性能 tradeoff",
    ],
    siteNote: "Bundle 瀑布图 + qiankun Tab 切换 + registerMicroApps 技术事件流。",
  },
};

export function getWorkNote(slug: string): WorkNote | null {
  return WORK_NOTES[slug] ?? null;
}

export function getWorkBrief(slug: string): WorkNote | null {
  return getWorkNote(slug);
}
