export const STEP_IDS = [
  "nlu",
  "intent",
  "entity",
  "plan",
  "context",
  "dsl",
  "manage",
  "pattern",
  "engine",
  "mech",
  "ctrl",
  "browser",
  "mcp",
  "kb",
] as const;

export type StepId = (typeof STEP_IDS)[number];

export type StepDef = {
  id: StepId;
  label: string;
  sub: string;
  color: string;
  kicker: string;
  api: string;
  explain: string;
  job: string;
  why: string;
  problem: string;
  io: { in: string; out: string };
  points: string[];
  mark: string;
};

export const STEP_REGISTRY: Record<StepId, StepDef> = {
  nlu: {
    id: "nlu",
    label: "理解问句",
    sub: "读自然语言",
    color: "#60a5fa",
    kicker: "理解层 · tokenizer",
    api: "normalize(query) → { tokens, scripts, chars }",
    job: "把用户原句切成词，并数中文、英文、数字各有多少。",
    why: "后面认意图、抽字段都要拿「词」来对，不能对着一整句茫茫然。",
    problem: "中文没有空格。若只按空白切，整句是一块，后面什么都对不上。",
    explain:
      "用户刚说完一句话。这一步先把句子切成词，并数里面有多少中文、英文、数字。它不管你想干什么，只把「可读的词」交给下一步去对技能。",
    io: { in: "用户原句", out: "词列表 + 中英数字各多少" },
    points: [
      "用标点和空白切开，不调用大模型",
      "中文多，后面就按中文触发词加分；英文多，就按工具名加分",
      "做完只交给「辨认意图」，这里不给答案",
    ],
    mark: "token 芯片 + 字种计数",
  },
  intent: {
    id: "intent",
    label: "辨认意图",
    sub: "要做什么",
    color: "#3b82f6",
    kicker: "理解层 · skill router",
    api: "explainDiscovery(query) → SkillDiscoveryRow[]",
    job: "用切好的词去对每条技能的触发词，只留下分最高的那一条。",
    why: "先定「要干什么」，后面才知道该拆哪张任务单、调哪些工具。",
    problem: "两条技能分数咬死时若都往下走，调度会打架，跑出两套结果。",
    explain:
      "拿上一步切好的词，去对站点里每条技能的触发词。谁分高，就认定你要干那件事。只有第一名会继续往下走，避免同时开两条流程。",
    io: { in: "词 / 原句", out: "选中的技能 + 分数 + 加分理由" },
    points: [
      "按词是否出现在技能触发词里加分，不是语义向量",
      "只把第一名交给「规划任务」",
      "下方表格可以改问句，立刻看分数怎么变",
    ],
    mark: "skill / score / breakdown 表",
  },
  entity: {
    id: "entity",
    label: "抽出实体",
    sub: "关键字段",
    color: "#38bdf8",
    kicker: "理解层 · slot fill",
    api: "extractSlots(query) → { url, target, actions }",
    job: "从问句里抠出网址、对象、动作，写成后面能填的变量。",
    why: "探活、填参不能靠整句，必须有明确的 url / 对象 / 动作。",
    problem: "问句没写网址时槽是空的，浏览器不知道打哪个地址。",
    explain:
      "从问句里抠出后面真正要用的字段：网址、对象、动作。问句没写网址时，就用你当前正在看的这个页面地址顶上。这些字段会写进变量，后面填参、探活都靠它们。",
    io: { in: "问句 + 当前页地址", out: "url / 对象 / 动作，写入变量" },
    points: [
      "问句里有 http 就用它，没有就用本页地址",
      "「本站」会被理解成当前这个站点",
      "动作来自固定词：检查、探活、分析、检索",
    ],
    mark: "url / target / actions 表",
  },
  plan: {
    id: "plan",
    label: "规划任务",
    sub: "拆成步骤",
    color: "#818cf8",
    kicker: "编排层 · planner",
    api: "Planner → Executor → Reviewer",
    job: "把选中的技能拆成「谁先做、谁后做」的任务单，此时还不开跑。",
    why: "一整件事不拆开，失败时不知道坏在哪一步，也不能并行。",
    problem: "把整站检查揉成一步，慢，而且一页挂了整单作废。",
    explain:
      "已经知道要做哪条技能了。这一步把它拆成任务单：谁先做、谁后做、谁来收口。还没真正开跑，只是把「一整件事」拆成能执行的几步。",
    io: { in: "选中的技能 + 抽出来的字段", out: "计划：先做什么、再做什么" },
    points: [
      "Planner 定顺序，Executor 才去调工具，Reviewer 负责汇总",
      "不拆开的话，失败时不知道是哪一页挂了",
      "下方可以跑一遍三角色协作，看每步产出",
    ],
    mark: "三个角色节点 + Multi-Agent 实验室",
  },
  context: {
    id: "context",
    label: "整理上下文",
    sub: "会话与页面",
    color: "#67e8f9",
    kicker: "理解层 · working set",
    api: "buildWorkingSet({ page, memory, budget })",
    job: "只留这一轮真正用得上的页面信息和对话，多的裁掉。",
    why: "模型窗口有限，还要给后面的工具结果留空位。",
    problem: "把整页 HTML 和 12 轮聊天全塞进去会爆窗口，后面每步都卡。",
    explain:
      "模型窗口装不下整页 HTML 和全部聊天记录。这一步只留这一轮真正用得上的：当前网址、标题、最近对话，多的裁掉，并给后面的工具结果留空位。",
    io: { in: "当前页面 + 聊天记录", out: "裁过的上下文 + 还剩多少额度" },
    points: [
      "页面信息取自你正在看的这一页，不是写死的示例",
      "额度按文本大概有多长来估",
      "不裁的话，后面每一步都可能再爆一次",
    ],
    mark: "当前 origin / title / budget",
  },
  dsl: {
    id: "dsl",
    label: "流程定义",
    sub: "入参 · 步骤 · 出参",
    color: "#f59e0b",
    kicker: "编排层 · SKILL.md",
    api: "AgentSkill { skillPath, triggers, steps, tools }",
    job: "把任务单写成机器认的说明书：进什么、做哪几步、出来什么。",
    why: "内核只认字段，不认你口头上的步骤名。",
    problem: "只写了步骤名、没写出参，下一步读不到探活结果。",
    explain:
      "把任务单写成机器认的说明书：进去是什么、做哪几步、出来是什么。没写清出入参，后面的运行内核会对不上字段，看起来像坏了。",
    io: { in: "技能编号", out: "说明书：路径 / 触发词 / 步骤 / 能用的工具" },
    points: [
      "说明书在站内 skills 目录里",
      "工具名单是白名单，没写上的不能调",
      "步骤是给解释器看的，不是给人看的待办备忘",
    ],
    mark: "出现 skillPath 与步骤表",
  },
  manage: {
    id: "manage",
    label: "流程管理",
    sub: "存储 · 排队 · 版本",
    color: "#fbbf24",
    kicker: "编排层 · queue",
    api: "workflow_run → { workflowId, status, version }",
    job: "把说明书变成一张工单：排队、去重、记下版本。",
    why: "同一请求点两次不该打两遍；以后还要能回放同一份。",
    problem: "不排队、不记版本，刷新页面就会再探活一次，数据对不上。",
    explain:
      "说明书要变成一张工单才能跑。这一步负责排队、去重、记下版本。和「流程定义」不同：定义是菜谱，这里是这一桌点的那一张单。",
    io: { in: "钉住的技能版本", out: "工单号 + 排队 / 运行 / 完成" },
    points: [
      "版本记下来，以后才能回放同一份",
      "同一请求点两次，应该合并成一单，而不是打两遍",
      "失败只改这张工单，不会改原来的说明书",
    ],
    mark: "workflowId + 可推进状态",
  },
  pattern: {
    id: "pattern",
    label: "执行模式",
    sub: "顺序 · 并行 · 分叉",
    color: "#fb923c",
    kicker: "编排层 · scheduler",
    api: "schedule(steps, seq | par | branch)",
    job: "决定这几步是顺序、并行还是失败走另一条，此时还不执行。",
    why: "互不依赖的步骤排成一条队，纯属浪费时间。",
    problem: "三页都能同时探活，却一个完再打下一个，体感会慢三倍。",
    explain:
      "同样几步，可以一个接一个，也可以几路一起跑，或者失败走另一条。这一步只决定「怎么排」，还不执行。三页互不依赖时，并行会快很多。",
    io: { in: "步骤列表 + 选哪种排法", out: "谁等谁、谁可以一起跑" },
    points: [
      "顺序：探活完了才看页面",
      "并行：几页同时打，最后再汇总",
      "分叉：失败走重试，成功才进下一步",
    ],
    mark: "seq / par / branch 三档",
  },
  engine: {
    id: "engine",
    label: "运行内核",
    sub: "解析 · 调度 · 调能力",
    color: "#a78bfa",
    kicker: "运行层 · interpreter",
    api: "step() · pc++ · dispatch(tool)",
    job: "按说明书一步一步调工具，走一步程序计数器加一。",
    why: "要能单步看清「现在卡在哪」，而不是黑盒一次跑完。",
    problem: "说明书写 probe、运行时叫 http_probe，名字对不上就停住。",
    explain:
      "真正开跑的地方。按说明书一步一步调工具：读当前步、调用、写回结果，然后走到下一步。说明书里的名字和实际工具名对不上，就会停在第一步。",
    io: { in: "说明书 + 已填好的变量", out: "每一步的成功 / 失败 + 走到第几步" },
    points: [
      "点一次 step() 只往前走一步，方便看卡在哪",
      "要调的工具必须在白名单里",
      "reset 只清进度，不改说明书",
    ],
    mark: "pc 计数 + step()",
  },
  mech: {
    id: "mech",
    label: "落地机制",
    sub: "填参 · 沙箱 · 协同",
    color: "#c084fc",
    kicker: "运行层 · binding + sandbox",
    api: "inject(args, vars) → sandbox.call() → HITL",
    job: "把 ${变量} 填成真实值，危险的写入要等人点头。",
    why: "这是安全门：访客页上乱填是事故，不是功能。",
    problem: "空位没填就往外打，或没人批准就改页面。",
    explain:
      "把说明书里的 ${网址} 空位填成真实值，并且挡住危险的写入。需要你点头的操作会停在这里等放行。这是安全门，不是又一次「判断你要干什么」。",
    io: { in: "带空位的参数 + 变量", out: "填好的参数 / 是否等人点头" },
    points: [
      "先填空再调用，避免把 ${url} 五个字直接打到网上",
      "沙箱里只准备，还不会对外发请求",
      "你点「允许」之后，才真正去调工具",
    ],
    mark: "模板替换 + HITL 放行",
  },
  ctrl: {
    id: "ctrl",
    label: "运行管控",
    sub: "跟踪 · 重试 · 回退",
    color: "#fbbf24",
    kicker: "运行层 · eval / retry",
    api: "runRouterEval() → expected vs predicted",
    job: "盯着每一步的成败，只重试坏的那一段，留下已经成功的。",
    why: "一次超时不该让整次检查作废。",
    problem: "3 路里 1 路超时，若整单标红，另外两页的结果也丢了。",
    explain:
      "跑的过程中谁超时、谁失败，这一步负责盯着。默认不要因为一页挂了就把整单作废：留下已经成功的，只重试坏的那一段。",
    io: { in: "正在跑的各步结果", out: "成功留下 / 失败重试 / 整单是否还算数" },
    points: [
      "先对照「本来该走哪条技能、实际走了哪条」",
      "失败时优先改触发词，而不是去调模型温度",
      "重试一般是等一会儿再试，最多几次就停",
    ],
    mark: "expected / predicted + 评测台",
  },
  browser: {
    id: "browser",
    label: "浏览器能力",
    sub: "探活 · 看页面",
    color: "#34d399",
    kicker: "能力层 · http + DOM",
    api: "http_probe + browser_snapshot",
    job: "真正去打开网页：探活能不能访问，再看页面上有什么。",
    why: "内核自己不碰浏览器，要看站点时调用这一步。",
    problem: "页面还在转圈就拍照，会把加载骨架当成最终内容。",
    explain:
      "真正去打开网页：先探活能不能访问，再看页面上有哪些能点的东西。运行内核说「看一眼这个站点」时，调用的就是它。拍太早会把加载中的骨架当成最终页。",
    io: { in: "网址 / 要看的页面", out: "能不能打开、多慢、页面上有什么" },
    points: [
      "探活打的是当前这个站点，不是假数据",
      "看页面用的是你正在浏览的这一页",
      "等页面稳定后再拍，节点数才靠得住",
    ],
    mark: "真实 status / latency + Runtime Lab",
  },
  mcp: {
    id: "mcp",
    label: "协议工具",
    sub: "tools/call",
    color: "#2dd4bf",
    kicker: "能力层 · JSON-RPC 2.0",
    api: "tools/list · tools/call",
    job: "用统一协议列出工具、再调用其中一把，内核不直接碰外部接口。",
    why: "对话、技能、检索走同一套调用方式，才好开关和排错。",
    problem: "工具没登记时会报找不到方法，看起来像模型不会调用。",
    explain:
      "内核不会直接碰外部接口。它通过这一层、用统一的协议去「列出有哪些工具、调用其中一把」。开关没打开时，会报找不到方法，看起来像模型不会调用。",
    io: { in: "要调哪把工具 + 参数", out: "协议回包，成功或错误" },
    points: [
      "先问有哪些工具，再调用",
      "和对话里的工具开关是同一份名单",
      "失败会带回错误，不会把整个页面打挂",
    ],
    mark: "jsonrpc: 2.0 + Bridge",
  },
  kb: {
    id: "kb",
    label: "知识检索",
    sub: "站内说明",
    color: "#818cf8",
    kicker: "能力层 · hybrid RAG",
    api: "retrieveRag(query, topK) → RagHit[]",
    job: "在本站项目说明里找出最相关的几段，带着出处交回去。",
    why: "写答案要能引用，不能把整库倒进模型窗口。",
    problem: "52 段全塞进去会再爆一次窗口，也没法核对引用。",
    explain:
      "在本站自己的项目说明里找相关段落，而不是去网上搜，也不是把整库塞进模型。只把最相关的几段带着出处交回去，后面写答案才能引用。",
    io: { in: "问题 + 要几段", out: "命中的段落 + 分数 + 命中了哪些词" },
    points: [
      "材料是这个作品集里的项目说明，不是外网",
      "按词是否对得上打分，不是向量库",
      "汇总答案时会带上这些段落编号，方便核对",
    ],
    mark: "chunkId + score + RAG 实验室",
  },
};

export function isStepId(id: string | null | undefined): id is StepId {
  return Boolean(id && id in STEP_REGISTRY);
}

export function getStep(id: string | null | undefined): StepDef {
  return isStepId(id) ? STEP_REGISTRY[id] : STEP_REGISTRY.nlu;
}
