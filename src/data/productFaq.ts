/** 产品常见问题 — 首页场景引导里的预制问题及答案；资料库、服务端检索、产品客服技能共用 */

export type FaqTopicId = "product" | "pricing" | "setup" | "support" | "learn";

export type FaqEntry = {
  id: string;
  topic: FaqTopicId;
  q: string;
  /** 同义问法，参与匹配 */
  alt?: string[];
  /** 答案正文：可用单换行分行，不要空行（资料库按空行切段） */
  a: string;
};

export const FAQ_TOPICS: { id: FaqTopicId; docId: string; title: string }[] = [
  { id: "product", docId: "kb-faq-product", title: "产品介绍与行业方案" },
  { id: "pricing", docId: "kb-faq-pricing", title: "价格与试用" },
  { id: "setup", docId: "kb-faq-setup", title: "安装配置与功能使用" },
  { id: "support", docId: "kb-faq-support", title: "报错排查与技术支持" },
  { id: "learn", docId: "kb-faq-learn", title: "教程、高级功能与技术文档" },
];

export const PRODUCT_FAQ: FaqEntry[] = [
  /* ── 了解产品 ── */
  {
    id: "what",
    topic: "product",
    q: "产品是做什么的？",
    alt: ["这个产品是干什么的", "OwnAgent 能做什么", "你们是做什么产品的", "产品介绍"],
    a: "OwnAgent 是企业内部的 AI 知识助手：把公司文档、制度、常见问题录进资料库，员工或客户直接提问，AI 按资料作答并标出引用来源。\n流程是「先搜知识广场 → 再问 AI → 答完发布共享」：同事验证过的答案直接复用，不重复消耗模型；资料里没有的，AI 会明说不知道，不会编造。\n适合客服、实施、HR、IT 值班等需要反复回答同类问题的团队。",
  },
  {
    id: "features",
    topic: "product",
    q: "有哪些核心功能",
    alt: ["核心功能有哪些", "主要功能是什么", "都有什么功能", "功能列表"],
    a: "- **资料库**：录入或批量导入文档（文件 / 网页 / 粘贴），AI 回答时带引用\n- **知识广场**：共享已验证的问答，先搜再问，命中直接给答案\n- **技能**：按触发词把特定问题交给固定流程处理，例如制度值班、站点体检、发布前巡检\n- **回答规则**：规定哪些问题可以答、哪些必须拒答、哪些操作只能走工单\n- **回答质检 / 回归评测**：批量测试回答准确率，改动上线前对比新旧版本\n- **处理过程**：每次回答的检索、工具调用、耗时都能回放\n- **接入配置**：接任意 OpenAI 兼容模型和 MCP 工具，不配模型也能用",
  },
  {
    id: "compare",
    topic: "product",
    q: "和竞品有什么区别",
    alt: ["和其他产品比有什么优势", "跟竞品比怎么样", "为什么选你们", "和 ChatGPT 有什么区别"],
    a: "和通用聊天机器人、只做「上传文档 + 问答」的知识库产品相比，主要区别有三点：\n1. **答得有依据**：每条回答都绑定资料出处；资料外的问题按回答规则拒答，敏感操作只起草工单、人工确认后才执行。\n2. **过程看得见**：路由到哪个技能、检索命中哪几段、每个工具耗时多少，都能在「处理过程」里逐步回放，出错能定位到具体环节。\n3. **改动可验证**：改提示词、换模型、更新资料之前，用「回归评测」拿同一批问题跑新旧两版，看哪些题变差再决定上不上线。\n另外支持私有化部署，数据存在自己的数据库里；不配大模型也能跑检索和技能。",
  },
  {
    id: "cases",
    topic: "product",
    q: "有成功案例吗",
    alt: ["有客户案例吗", "谁在用", "有哪些客户", "落地案例"],
    a: "典型落地场景（客户信息已脱敏）：\n- **某在线教育公司 · 客服中心**：把课程、退费、排课规则录入资料库，常见咨询由广场直接命中，人工客服只处理复杂工单。\n- **某电商品牌 · 售前售后**：商品参数、物流、退换货政策集中维护，新人客服上岗当天即可使用。\n- **某制造企业 · 内部 IT / HR 值班**：年假、报销、VPN 等制度问答走「制度值班」技能，开通权限类请求只生成工单。\n需要详细的实施方案或上线数据，可联系商务：sales@example.com。",
  },
  {
    id: "industry",
    topic: "product",
    q: "适合什么行业？",
    alt: ["适合哪些行业", "哪些行业能用", "什么公司适合用", "适用场景"],
    a: "只要有「同类问题被反复问」的场景都适合，与行业关系不大。常见的有：\n- 教育培训：课程咨询、招生答疑、教务规则\n- 电商零售：售前商品咨询、售后退换货、物流查询\n- 金融保险：产品条款解释、业务办理指引（配合回答规则做合规控制）\n- 企业内部：HR 制度、IT 服务台、新人入职培训\n- SaaS / 软件：产品使用帮助、实施与部署问答\n判断标准：有成文资料、问题重复度高、答错有成本。",
  },
  {
    id: "edu",
    topic: "product",
    q: "教育行业能用吗",
    alt: ["学校能用吗", "老师能用吗", "学校老师能用吗", "培训机构能用吗", "教育机构适合吗", "在线教育能用吗"],
    a: "能用，教育是最常见的场景之一：\n- **招生与课程咨询**：把课程介绍、价格、开班时间录入资料库，家长和学员随时提问\n- **教务答疑**：排课、请假、补课、退费规则按原文作答，避免口径不一致\n- **内部培训**：新老师、新顾问入职时直接问，不用反复找老员工\n建议：退费、优惠这类容易出纠纷的内容，在「回答规则」里设为「只按资料原文回答」；涉及学员个人信息的查询不要放进资料库。",
  },
  {
    id: "ecom",
    topic: "product",
    q: "电商能用吗",
    alt: ["电商行业能用吗", "网店能用吗", "做电商适合吗", "零售能用吗"],
    a: "能用，适合售前、售后客服和运营团队：\n- **售前**：商品参数、尺码、活动规则录入资料库，客服或顾客直接查\n- **售后**：退换货、运费、发票等政策按原文回答，口径统一\n- **知识沉淀**：客服答过的好问题「发布到广场」，下次同类咨询直接命中，不再消耗模型\n大促前可以用「回归评测」批量测一遍活动规则问答，确认改了资料后没有答错。",
  },
  {
    id: "finance",
    topic: "product",
    q: "金融行业合规吗",
    alt: ["金融行业能用吗", "银行能用吗", "保险行业能用吗", "合规性怎么样", "数据安全吗"],
    a: "可以满足金融行业常见的合规要求，关键在部署方式和规则配置：\n- **数据不出域**：企业版支持私有化部署，资料与对话记录存在客户自己的数据库，可接内网部署的大模型\n- **答必有据**：回答绑定资料出处，资料外问题按「回答规则」拒答，不会编造收益、条款等关键信息\n- **敏感操作留痕**：开户、改权限等操作只起草工单，人工确认后才执行\n- **可审计**：每次问答的检索与处理过程都可回放\n具体的等保、行业监管要求，需要结合贵司的部署环境评估，可联系 sales@example.com 获取合规材料。",
  },
  {
    id: "pricing",
    topic: "pricing",
    q: "怎么收费？",
    alt: ["价格是多少", "怎么收费的", "多少钱", "收费标准", "套餐有哪些", "价格贵吗", "贵不贵"],
    a: "目前有三种方式：\n- **试用版**：14 天免费，最多 500 次 AI 问答，功能与标准版一致\n- **标准版**：按年订阅，含 5 个管理员账号、不限知识文档数量、知识广场共享\n- **企业版**：私有化部署 + 回答规则定制 + SSO 单点登录 + 专属技术支持，按部署规模报价\n大模型调用费用按贵司自己配置的模型账号结算，不经过我们。具体报价请联系商务：sales@example.com。",
  },
  {
    id: "free",
    topic: "pricing",
    q: "有免费版吗",
    alt: ["免费吗", "可以免费用吗", "有没有免费的"],
    a: "有两种免费用法：\n1. **14 天试用**：功能与标准版一致，最多 500 次 AI 问答，到期后可升级，数据保留。\n2. **本机运行**：在自己电脑上安装运行（见「安装失败怎么办」「环境要求是什么」），资料和对话都存在本机，适合个人或小团队体验，不含商务支持。\n另外，不配置大模型时，资料库检索、知识广场、技能都能正常使用，不产生模型费用。",
  },
  {
    id: "enterprise",
    topic: "pricing",
    q: "企业版多少钱",
    alt: ["企业版价格", "私有化部署多少钱", "企业版怎么收费"],
    a: "企业版按部署规模报价，主要看三项：\n- 使用人数 / 管理员账号数\n- 部署方式：私有云、本地机房，是否需要对接内网大模型\n- 定制内容：SSO 单点登录、回答规则定制、专属技能开发、驻场实施\n一般流程是先试用或做 POC，确认效果后出正式报价。请联系商务：sales@example.com，附上团队规模和部署要求，1 个工作日内回复。",
  },
  {
    id: "trial",
    topic: "pricing",
    q: "可以先试用吗",
    alt: ["能试用吗", "怎么申请试用", "试用多久", "有试用期吗"],
    a: "可以，试用 14 天，最多 500 次 AI 问答，功能与标准版一致。\n建议这样试：\n1. 在「资料库」导入 5～10 篇最常被问到的文档\n2. 在「问 AI」里用真实问题提问，看回答和引用是否准确\n3. 在「回答质检」或「回归评测」里批量测一轮，找出资料缺口\n试用期内的数据在升级后保留。",
  },

  /* ── 解决问题 ── */
  {
    id: "setup-issue",
    topic: "setup",
    q: "安装或配置遇到问题",
    alt: ["安装遇到问题", "配置遇到问题", "装不上", "配置不成功"],
    a: "先按顺序排查这三项，大部分问题都能解决：\n1. **环境**：Node.js 版本需要 22.5 及以上（`node -v` 查看），依赖要先执行 `npm install`\n2. **服务是否都启动了**：前端 `npm run dev`（默认 5173 端口），后端 `npm run dev:server`（默认 8787 端口）；后端没启动时页面仍可用，但数据只存在当前浏览器\n3. **大模型配置**：在「接入配置」里填 Base URL、模型名和 API Key，点测试确认能连通\n具体报错可以继续问「安装失败怎么办」「配置文件在哪里」「环境要求是什么」。",
  },
  {
    id: "install-fail",
    topic: "setup",
    q: "安装失败怎么办",
    alt: ["安装报错", "npm install 失败", "装不上怎么办", "启动不了"],
    a: "按报错类型处理：\n- **npm install 卡住或超时**：切换国内镜像 `npm config set registry https://registry.npmmirror.com` 后重试\n- **提示 node:sqlite 不存在 / 语法错误**：Node.js 版本太低，升级到 22.5 及以上\n- **端口被占用（EADDRINUSE）**：关掉占用 5173 / 8787 端口的程序，或用环境变量 `PORT` 换后端端口\n- **Docker 部署启动失败**：执行 `docker compose logs` 查看原因，常见是 `./data` 目录没有写权限\n- **页面打开空白**：按 F12 看控制台报错，通常是前端没构建完或缓存，强制刷新（Ctrl+F5）\n仍然解决不了，把报错截图发给技术支持（见「如何联系技术支持」）。",
  },
  {
    id: "config-file",
    topic: "setup",
    q: "配置文件在哪里",
    alt: ["配置在哪改", "环境变量怎么配", "配置文件路径", "去哪里改配置"],
    a: "配置分三处：\n- **界面配置（推荐）**：大模型、MCP 工具在「接入配置」里改；回答规则在「回答规则」里改；保存后立即生效\n- **服务端环境变量**：部署时设置，常用的有 `PORT`（后端端口，默认 8787）、`ADMIN_PASSWORD`（管理后台密码）、`DEEPSEEK_API_KEY` / `OPENAI_API_KEY`、`LLM_BASE_URL`、`LLM_MODEL`、`DATABASE_PATH`、`CORS_ORIGINS`\n- **数据文件**：默认在 `data/builder.db`（SQLite），资料库、广场、评测记录都在里面，备份这个文件即可\n后端未启动时，界面上的配置保存在当前浏览器的本地存储里。",
  },
  {
    id: "requirements",
    topic: "setup",
    q: "环境要求是什么",
    alt: ["系统要求", "服务器配置要求", "需要什么环境", "最低配置"],
    a: "- **使用端**：Chrome / Edge / Safari 最新两个版本，无需安装客户端\n- **本机运行**：Node.js 22.5 及以上，Windows / macOS / Linux 均可\n- **服务器部署**：2 核 4G 内存、20G 磁盘起步即可支撑百人团队；推荐 Docker Compose 部署\n- **大模型**：任意 OpenAI 兼容接口（DeepSeek、通义、Kimi、自建 vLLM / Ollama 等），可选\n- **网络**：Nginx 反向代理时需开启 SSE（关闭 proxy_buffering），否则回答不会逐字显示",
  },
  {
    id: "howto",
    topic: "setup",
    q: "功能不知道怎么用",
    alt: ["不会用", "怎么使用", "使用说明", "操作指南"],
    a: "建议先看左侧「新手指南」，三步上手：\n1. **录资料**：在「资料库」导入公司文档或 FAQ\n2. **提问**：在「问 AI」输入问题，看回答和引用来源\n3. **共享**：好的回答点「发布到广场」，下次同类问题直接命中\n管理员再看两个地方：「回答规则」控制 AI 能答什么，「回答质检」批量检查准确率。\n具体操作可以继续问「怎么导入数据」「怎么导出报表」「怎么设置权限」。",
  },
  {
    id: "import",
    topic: "setup",
    q: "怎么导入数据",
    alt: ["怎么导入文档", "如何导入资料", "批量导入", "怎么上传文档"],
    a: "在左侧「资料库」里有三种导入方式：\n- **文件导入**：支持 TXT、Markdown、CSV、JSON，可多选；Markdown 会按标题自动拆成多条\n- **网页导入**：填网页地址，自动抓取正文\n- **粘贴导入**：直接粘贴文本，导入前先预览拆分结果\nWord / PDF 请先另存为 TXT 或 Markdown。知识广场的问答可以在「知识广场」页用「导入」按钮导入 JSON。\n建议先导入最常被问到的内容，每条资料配 2～3 个示例问题，命中率会更高。",
  },
  {
    id: "export",
    topic: "setup",
    q: "怎么导出报表",
    alt: ["怎么导出数据", "能导出吗", "导出报告", "导出记录"],
    a: "按内容分别导出：\n- **评测报告**：「回归评测」里打开一次实验，点「下载报告」得到 Markdown；测试集可导出 CSV\n- **知识广场问答**：「知识广场」页点「导出」，得到 JSON，可再导入到其他环境\n- **会话记录**：对话页右侧「详情」里可导出当前会话\n- **技能配置**：「技能管理」里可导出单个 SKILL.md 或全部技能包\n运营数据（提问量、命中率、低置信度回答）在管理后台查看；需要定制报表可联系技术支持。",
  },
  {
    id: "permission",
    topic: "setup",
    q: "怎么设置权限",
    alt: ["权限怎么配置", "怎么控制谁能看", "怎么设置管理员", "权限管理"],
    a: "权限分三层：\n- **管理后台**：用管理员密码登录，才能修改资料库、配置和规则；密码由部署时的 `ADMIN_PASSWORD` 设定，默认 admin123，**上线前务必修改**\n- **AI 能答什么**：在「回答规则」里设置——哪些问题拒答、哪些只按资料原文回答、哪些操作（如开通 VPN、改系统权限）只能起草工单等人工批准\n- **按部门 / 角色隔离资料**：企业版支持 SSO 对接，按组织架构控制可见范围\n注意：资料库里的内容对所有能提问的人可见，涉密资料不要放进公共资料库。",
  },
  {
    id: "error",
    topic: "support",
    q: "系统报错了",
    alt: ["报错了怎么办", "出错了", "系统异常", "用不了了"],
    a: "先看报错出现在哪里：\n- **回答区显示错误**：多半是大模型连接问题，到「接入配置」点测试；401 表示 Key 不对，429 表示调用太频繁，稍后重试\n- **页面提示后端未启动 / 数据存在本浏览器**：后端服务没运行，执行 `npm run dev:server` 或检查 Docker 容器\n- **操作提示「未授权」**：管理员登录已失效，重新登录管理后台\n- **页面空白或按钮没反应**：按 F12 打开控制台看红色报错\n对照「常见错误码说明」可以快速定位；需要人工协助时，按「如何查看日志」收集日志后联系技术支持。",
  },
  {
    id: "error-codes",
    topic: "support",
    q: "常见错误码说明",
    alt: ["错误码", "报错代码什么意思", "401 是什么错误", "503 是什么意思"],
    a: "- **401 未授权**：大模型 API Key 错误或已过期；或管理后台登录失效，重新登录即可\n- **403 禁止访问**：Key 没有该模型权限，或跨域来源不在 `CORS_ORIGINS` 里\n- **404**：接口地址写错，检查「接入配置」里的 Base URL 是否带了 `/v1`\n- **429 请求过多**：模型服务限流，降低并发或稍后重试\n- **500 服务端错误**：看后端日志里的具体异常\n- **502 / 504 网关错误**：反向代理超时，调大超时时间并开启 SSE 支持\n- **503 服务不可用**：服务端没有配置大模型 Key（接口返回 LLM API key not configured）\n- **Failed to fetch**：浏览器连不上后端，确认后端已启动、地址和端口正确",
  },
  {
    id: "logs",
    topic: "support",
    q: "如何查看日志",
    alt: ["日志在哪里", "怎么看日志", "查看运行日志", "错误日志"],
    a: "- **单次回答**：对话下方点「回放决策」，或左侧「处理过程」，能看到路由到哪个技能、检索命中哪些段落、每个工具的入参、返回和耗时\n- **服务端日志**：本机运行时就在执行 `npm run dev:server` 的终端窗口里；Docker 部署用 `docker compose logs -f`\n- **浏览器端**：按 F12，在 Console 看报错，在 Network 里筛选 `/api/` 看请求和返回\n- **运营日志**：管理后台可按时间查看提问记录、命中情况和低置信度回答\n联系技术支持时，请附上报错截图和对应时间段的服务端日志。",
  },
  {
    id: "contact",
    topic: "support",
    q: "如何联系技术支持",
    alt: ["联系客服", "技术支持电话", "怎么找人工", "联系方式"],
    a: "- **邮件**：support@example.com，工作日 9:00–18:00，一般 4 小时内回复\n- **商务与报价**：sales@example.com\n- **企业版客户**：有专属支持群和对接工程师，紧急问题 7×24 小时响应\n提交问题时请附上：产品版本、部署方式（本机 / Docker / 私有化）、报错截图、发生时间，以及「如何查看日志」里收集的日志，能大幅缩短处理时间。",
  },

  /* ── 深度学习 ── */
  {
    id: "tutorial",
    topic: "learn",
    q: "有新手教程吗？",
    alt: ["新手教程", "入门教程", "怎么快速上手", "有使用教程吗"],
    a: "有，左侧「新手指南」就是三步上手教程：录入资料 → 提问 → 共享到广场。\n另外可以按需要看：\n- 「从零开始教程」：从安装到第一次提问的完整步骤\n- 「最佳实践指南」：怎么整理资料、怎么写规则，让回答更准\n- 「视频教程」：操作演示视频\n首页选「了解产品」「解决问题」「深度学习」任一场景，也会一步步引导你找到答案。",
  },
  {
    id: "from-zero",
    topic: "learn",
    q: "从零开始教程",
    alt: ["零基础教程", "从头开始怎么用", "第一次使用"],
    a: "1. **启动**：安装 Node.js 22.5+，执行 `npm install`，再分别运行 `npm run dev`（前端）和 `npm run dev:server`（后端）；或用 Docker：`docker compose up -d`\n2. **打开页面**：浏览器访问前端地址，进入「问 AI」\n3. **录入资料**：左侧「资料库」→ 导入 3～5 篇最常用的文档，每篇写 2～3 个示例问题\n4. **（可选）接模型**：「接入配置」填 Base URL、模型名和 API Key；不接也能用检索和技能\n5. **提问验证**：用真实问题提问，检查引用来源是否正确\n6. **沉淀**：好的回答点「发布到广场」\n7. **把关**：在「回答规则」设置拒答范围，在「回答质检」批量测一轮",
  },
  {
    id: "best-practice",
    topic: "learn",
    q: "最佳实践指南",
    alt: ["最佳实践", "怎么用效果最好", "使用建议", "怎么让回答更准"],
    a: "- **资料一条讲一件事**：一篇文档混很多主题会降低命中率；每条配 2～3 个用户真实会问的问法\n- **过期内容要删**：新旧制度同时存在会让回答自相矛盾，更新时直接替换旧条目\n- **先广场、后 AI**：高频问题整理成标准问答发布到广场，命中即答，稳定且不耗 Token\n- **规则兜底**：资料外的问题设为拒答；涉及改系统、改权限的操作设为只起草工单\n- **定期看缺口**：回答下方出现「知识缺口」提示时，说明资料没覆盖，按提示补充\n- **改动先评测**：换模型、改提示词、大批量更新资料前，用「回归评测」对比新旧版本",
  },
  {
    id: "video",
    topic: "learn",
    q: "视频教程",
    alt: ["有视频教程吗", "操作视频", "演示视频"],
    a: "视频教程按上手顺序分为：\n1. 产品概览（3 分钟）：先搜广场、再问 AI、答完共享的完整流程\n2. 资料库导入与整理（5 分钟）\n3. 回答规则与工单审批（4 分钟）\n4. 回答质检与回归评测（6 分钟）\n5. 接入自己的大模型与 MCP 工具（5 分钟）\n视频随产品版本更新，获取最新链接请联系 support@example.com。不方便看视频时，左侧「新手指南」提供同样内容的图文版。",
  },
  {
    id: "advanced",
    topic: "learn",
    q: "高级功能有哪些？",
    alt: ["有哪些高级功能", "进阶功能", "高级玩法"],
    a: "- **技能**：用 SKILL.md 声明触发词和执行步骤，把特定问题交给固定流程处理，在「技能管理」里编辑、试跑、发布\n- **自动化工作流**：把多个工具串成流程，例如站点体检、发布前巡检\n- **MCP 工具接入**：在「接入配置」接入外部 MCP 服务，AI 可调用贵司内部系统\n- **API 集成**：通过 HTTP 接口把问答能力嵌进自己的系统\n- **回归评测**：接入任意 AI 应用做 A/B 对比，改动上线前把关\n- **Prompt 模板**：按场景预置提示词\n详见「自动化工作流」「API 集成」「自定义扩展」。",
  },
  {
    id: "workflow",
    topic: "learn",
    q: "自动化工作流",
    alt: ["工作流怎么用", "怎么做自动化", "自动化流程"],
    a: "工作流通过「技能」实现：一个技能 = 触发词 + 若干执行步骤，每一步调用一个工具，上一步的结果可以传给下一步。\n内置示例：\n- **站点体检**：探活 → 页面结构 → 性能指标 → 汇总报告\n- **发布前巡检**：探测目标网址 → 对照资料库 → 给出通过 / 注意 / 失败清单\n- **制度值班**：判断问题类型 → 查手册原文 → 需要改权限时起草工单等人工批准\n在「技能管理」里可以复制一个内置技能改成自己的流程，先试跑、看结果，再发布。",
  },
  {
    id: "api",
    topic: "learn",
    q: "API 集成",
    alt: ["有 API 吗", "怎么接入自己的系统", "能对接吗", "接口集成"],
    a: "后端提供 HTTP 接口（默认 `http://<服务地址>:8787/api`），常用的有：\n- `POST /api/agent/guest`：提问，入参 `{ \"query\": \"问题\", \"sessionId\": \"会话ID\" }`，返回 `assistantText`（回答）和 `traces`（处理过程）\n- `POST /api/rag/retrieve`：只检索资料库，入参 `{ \"query\": \"...\", \"topK\": 5 }`\n- `GET /api/health`：健康检查\n管理类接口（资料库增删改、配置）需要先调用 `POST /api/admin/login` 获取令牌，放在请求头 `x-admin-token`。\n跨域调用时，把调用方域名加入环境变量 `CORS_ORIGINS`。完整接口清单见「API 文档」。",
  },
  {
    id: "extension",
    topic: "learn",
    q: "自定义扩展",
    alt: ["怎么二次开发", "能自定义吗", "扩展开发", "怎么加新功能"],
    a: "三种扩展方式，从易到难：\n1. **自定义技能**：在「技能管理」新建技能，写触发词和步骤即可，不用写代码\n2. **接入 MCP 工具**：把贵司内部系统包装成 MCP 服务，在「接入配置」添加后，AI 和技能都能调用\n3. **二次开发**：技能定义在 `src/skills/<技能名>/SKILL.md`，工具实现在前端 `src/lib/agentSkills.ts` 和服务端 `server/skills.ts`，新增工具后在 SKILL.md 的 steps 里引用\n改完后建议用「回归评测」跑一遍，确认没有影响已有问答。",
  },
  {
    id: "tech-docs",
    topic: "learn",
    q: "有技术文档吗？",
    alt: ["技术文档", "开发文档", "有文档吗"],
    a: "有，按用途分三份：\n- **API 文档**：接口地址、入参、返回格式和鉴权方式\n- **架构说明**：前后端组成、一次提问的处理链路、数据存在哪里\n- **部署文档**：本机运行、Docker、私有化部署的步骤和环境变量\n可以直接问这三个问题查看摘要；完整文档随安装包提供，也可以向 support@example.com 索取。",
  },
  {
    id: "api-docs",
    topic: "learn",
    q: "API 文档",
    alt: ["接口文档", "api 文档在哪", "接口说明"],
    a: "**基础地址**：`http://<服务地址>:8787/api`，请求和返回都是 JSON。\n- `GET /health`：服务状态，返回是否已配置大模型等信息\n- `POST /agent/guest`：提问，入参 `query`、`sessionId`，返回 `assistantText`、`traces`\n- `POST /multi-agent/run`：多角色协作回答，返回 `answer`、`citations`、`steps`\n- `POST /rag/retrieve`：检索资料库，入参 `query`、`topK`，返回命中片段和得分\n- `POST /admin/login`：管理员登录，入参 `password`，返回 `token`\n- `GET/POST /admin/knowledge`：资料库查询与新增（需请求头 `x-admin-token`）\n- `/evalops/*`：回归评测的被测对象、测试集、实验\n错误时返回 `{ \"error\": \"原因\" }` 和对应 HTTP 状态码，含义见「常见错误码说明」。",
  },
  {
    id: "architecture",
    topic: "learn",
    q: "架构说明",
    alt: ["系统架构", "技术架构是怎样的", "架构是什么样的", "技术原理"],
    a: "**组成**：浏览器前端（React）+ 后端服务（Node.js / Hono）+ SQLite 数据库；后端不在线时前端可独立运行，数据存在浏览器本地。\n**一次提问的处理链路**：\n1. 回答规则先判断：可答 / 拒答 / 只能起草工单\n2. 先搜资料库预设问法和知识广场，命中直接回答\n3. 技能路由：按触发词给各技能打分，交给得分最高的技能\n4. 技能按步骤调用工具（检索、探活、工单等），检索结果带出处编号\n5. 有大模型时基于检索结果生成回答，没有时直接整理检索原文\n6. 全过程写入「处理过程」，可回放\n**数据**：资料库、广场、规则、评测记录都在 `data/builder.db`。",
  },
  {
    id: "deploy-docs",
    topic: "learn",
    q: "部署文档",
    alt: ["怎么部署", "部署步骤", "私有化部署怎么做", "Docker 怎么部署"],
    a: "**Docker 部署（推荐）**：\n1. 准备一台 2 核 4G 以上的服务器，安装 Docker 和 Docker Compose\n2. 设置环境变量：`ADMIN_PASSWORD`（必改）、`DEEPSEEK_API_KEY` 或 `OPENAI_API_KEY`、`LLM_BASE_URL`、`LLM_MODEL`\n3. 执行 `docker compose up -d`，数据目录 `./data` 挂载持久化\n4. Nginx 反向代理时关闭 `proxy_buffering` 以支持 SSE 流式回答\n**本机运行**：Node.js 22.5+，`npm install` 后运行 `npm run dev` 和 `npm run dev:server`；构建静态前端用 `npm run build`。\n**备份**：定期备份 `data/builder.db` 即可。",
  },
];

/* ───────── 匹配 ───────── */

export function normalizeQuestion(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\s？?！!。，,、：:；;“”"'‘’（）()【】[\]《》<>…·~～]/g, "")
    .replace(/(吗|呢|呀|啊|吧|么)+$/, "");
}

function bigrams(s: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2));
  return out;
}

/** 字符二元组 Dice 系数 */
export function questionSimilarity(a: string, b: string): number {
  const x = bigrams(normalizeQuestion(a));
  const y = bigrams(normalizeQuestion(b));
  if (!x.length || !y.length) return 0;
  const pool = new Map<string, number>();
  for (const g of y) pool.set(g, (pool.get(g) ?? 0) + 1);
  let hit = 0;
  for (const g of x) {
    const n = pool.get(g) ?? 0;
    if (n > 0) {
      hit++;
      pool.set(g, n - 1);
    }
  }
  return (2 * hit) / (x.length + y.length);
}

export const FAQ_MATCH_THRESHOLD = 0.6;

export type FaqMatch = { entry: FaqEntry; score: number; matched: string };

export function matchFaq(query: string, entries: FaqEntry[] = PRODUCT_FAQ): FaqMatch | null {
  const q = normalizeQuestion(query);
  if (q.length < 2) return null;
  let best: FaqMatch | null = null;
  for (const entry of entries) {
    for (const form of [entry.q, ...(entry.alt ?? [])]) {
      const f = normalizeQuestion(form);
      if (!f) continue;
      const score = f === q ? 1 : questionSimilarity(q, f);
      if (!best || score > best.score) best = { entry, score, matched: form };
    }
  }
  return best && best.score >= FAQ_MATCH_THRESHOLD ? best : null;
}

export const FAQ_LOOSE_THRESHOLD = 0.25;

/** 低于正式阈值时的「最接近」候选：只在其他路由都没接住时用，回答会明说「最接近」 */
export function matchFaqLoose(query: string): FaqMatch | null {
  const q = normalizeQuestion(query);
  if (q.length < 2) return null;
  let best: FaqMatch | null = null;
  for (const entry of PRODUCT_FAQ) {
    for (const form of [entry.q, ...(entry.alt ?? [])]) {
      const score = questionSimilarity(q, form);
      if (!best || score > best.score) best = { entry, score, matched: form };
    }
  }
  return best && best.score >= FAQ_LOOSE_THRESHOLD ? best : null;
}

export function relatedFaq(entry: FaqEntry, limit = 3): FaqEntry[] {
  return PRODUCT_FAQ.filter((e) => e.topic === entry.topic && e.id !== entry.id).slice(0, limit);
}

export function faqAnswerMarkdown(entry: FaqEntry): string {
  const rel = relatedFaq(entry).map((e) => `「${e.q.replace(/[？?]$/, "")}」`);
  return [entry.a, rel.length ? `\n还可以问：${rel.join("、")}` : ""].join("\n").trim();
}

export type QaSection = { q: string; a: string };

/** 解析正文里的「问：… 答：…」/「Q：… A：…」段落 */
export function parseQaSections(body: string): QaSection[] {
  const out: QaSection[] = [];
  for (const part of body.split(/\n(?=\s*(?:问|Q)[:：])/)) {
    const m = part.trim().match(/^(?:问|Q)[:：]\s*([^\n]*?)\s*(?:\n\s*)?(?:答|A)[:：]\s*([\s\S]+)$/);
    if (m?.[1] && m[2]?.trim()) out.push({ q: m[1].trim(), a: m[2].trim() });
  }
  return out;
}

/** 未命中：说明没找到，并按主题列出能直接问的问题 */
export function faqFallbackMarkdown(query: string): string {
  const q = query.trim();
  const near = matchFaqLoose(q);
  if (near) {
    return [`资料里没有和「${q}」完全一样的问题，最接近的是「${near.entry.q.replace(/[？?]$/, "")}」：`, "", faqAnswerMarkdown(near.entry)].join("\n");
  }
  const lines = [`资料里暂时没有「${q}」的明确答案，我不想编一个给你。下面这些问题可以直接问：`, ""];
  for (const t of FAQ_TOPICS) {
    const qs = PRODUCT_FAQ.filter((e) => e.topic === t.id).slice(0, 3).map((e) => e.q);
    lines.push(`- **${t.title}**：${qs.join(" / ")}`);
  }
  lines.push("", "需要人工帮忙可以发邮件到 support@example.com。");
  return lines.join("\n");
}

/** 资料库条目：每题一段「问：… / 答：…」，空行分段 */
export function faqKnowledgeDocs(): { id: string; title: string; body: string; prompts: string[] }[] {
  return FAQ_TOPICS.map((t) => {
    const list = PRODUCT_FAQ.filter((e) => e.topic === t.id);
    return {
      id: t.docId,
      title: t.title,
      body: list.map((e) => `问：${e.q}\n答：${e.a}`).join("\n\n"),
      prompts: list.slice(0, 3).map((e) => e.q),
    };
  });
}
