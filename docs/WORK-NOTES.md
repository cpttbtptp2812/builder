# OwnAgent 办事产品 — 工作注意事项（必读）

> **主文件路径（请在 IDE 里打开这一份）**：`docs/WORK-NOTES.md`  
> **用法**：每次动手改代码或跑验收前，**必须先通读本文**（即使用户没说「读注意事项」）。  
> **优先级**：本文与用户当面强调的口径冲突时，以用户最新指令为准；未冲突则本文为硬约束。

### 开工强制（Agent — 违反 = 重做）

1. **第一件事**：打开并通读 `docs/WORK-NOTES.md` 全文（含 §0.4 SKILL 形态、§7 踩坑表）。
2. **第二件事**：对照本文再动刀；用户说过的事（不要写死 demo、skill=办事程序）**不必等再提醒**。
3. **第三件事**：动 skill / 技能页 / 对话办事 / 发版任一环节，验收 §0.4 + §10，不是「改了几行代码」。
4. **第四件事（禁止让用户当测试）**：**改完必须先自测**，再请用户看。至少跑：
   - `npm run test:ownagent`（含 **`scripts/test-product-run-e2e.ts`**：当前正式开放的三技能 **无数据→门闩无 demo 明细** + 上传 CSV→办结数字来自材料；含 `test-product-route.ts` 路由）；
   - 若动 product-run / 门闩 / 引擎：`npm run build`；
   - 新增 `__*_` 工具：**必须**写入 `src/lib/skillToolRegistry.ts`，否则 Semcompiler 报 `UNKNOWN_TOOL` → `runnable: false` → 对话 **「未命中办事技能」**（用户已踩过）。
   **未自测通过，不得说「请验收」。**

### 任务怎么写、Agent 怎么交付（用户硬口径 — 已写入 `.cursor/rules/ownagent-work-notes.mdc`）

**用户要什么（Agent 必须默认懂）**

- **能处理正常流程的 skill**：用户材料 + 服务端逐步 process → 表/文书/CSV/修正/复核；**不是**固定 demo 文案、固定样例数据、触发词命中就回一段话。
- **零 demo**（§0.6）：办事主链只有「没材料 → 门闩」和「有材料 → 算这份材料」；发版验收 CSV **仅治理链**，不得当对话答案。

**每条任务请写「完成标准」**（直接引用本文小节），例如：

> 只做 §0.6 + §10 #1/#5/#7/#8；禁止扩 SKILL；交付附 `npm run test:ownagent` 全文 + §10 勾选。

**Agent 交付时必须带**

1. 当次完成标准里引用的 § 是否满足（逐条勾选或标明未做）。
2. `npm run test:ownagent` 完整输出；动 product-run / 门闩 / 引擎时还有 `npm run build`。
3. 未过 §10 / 自测 → **禁止**「请验收」「可以给客户看」。

**不满足时用户可一句话打回**：「不符合 WORK-NOTES §X，重做，别解释。」

**新会话第一条建议**：@ 本文 + **当次唯一目标**（避免 Agent 接着旧会话半成品当交付）。

**固定任务模板（用户已启用 — 复制即用）：** 见 [`docs/AGENT-TASK-TEMPLATE.md`](AGENT-TASK-TEMPLATE.md)

```
@docs/WORK-NOTES.md
唯一目标：（一件事）
完成标准：1. … 2. … 3. …
交付：npm run test:ownagent 全文 + 完成标准逐条勾选；未满足 = 无效，勿说改完
打回句：不符合完成标准，重做，别解释。
```

**Agent 交付回复结构（强制）**

1. 复述当次完成标准（3～5 条）
2. 逐条 ✅/❌
3. 粘贴 `npm run test:ownagent` 完整终端输出
4. 未全 ✅ → 只报缺口，**禁止**「请验收」「可以给客户看」

### Agent 不听话累加（用户口径 — 每不听话一次加一条）

| # | 日期 | 加上的约束 |
|---|------|------------|
| 1 | 2026-10-11 | `scripts/test-product-run-e2e.ts` 并入 `npm run test:ownagent`；Agent **不得**仅用路由/governance 测试冒充「整个办事流程已测」。 |
| 2 | 2026-10-11 | **质量优先于速度**；**所有技能**须按真实可用标准排查/修复（非只改 sheet）；假数据/假办事 **零容忍**。 |
| 3 | 2026-10-11 | 办事 **新开 process 一律门闩**（有旧 session 数据也不得 auto-run）；guest 直跑 desk 禁止；浏览器 `runSkill` 禁五 desk；`test-desk-browser-block.ts`。 |
| 4 | 2026-10-11 | 门闩文案 **禁括号/内部说明**；就绪也必须有 **import parts + 重新导入 CSV**；`importParts` 须 `requirementsForSkill` 全量（曾错用 `missingForSession` 导致无上传区）。 |

### 质量优先（用户硬口令 — 写入 `.cursor/rules/ownagent-work-notes.mdc`）

- **不要求 Agent 多快**，要求 **有质量地完成**：该测的流程测完、该修的技能修通，不许为赶进度缩 scope、缩测试、留 demo 路径。
- **所有正式开放技能都有问题要一起查**：当前主链是报销对账、客服工单、门店排班；**policy / knowledge / release / 信贷 flow 等** 若进入产品或治理面，也必须 **逻辑通、不造假、不半套**，否则只能留在内部实验区。
- **交付 = 真实可用**，不是「路由命中 + 一段话」。

---

## 0. 第一原则：站在客户角度设计（最重要）

做任何界面、文案、流程、默认值之前，先问：

1. **办事员/业务用户**打开页面要办什么事？下一步是否一眼可见、点得到？
2. 他是否关心 Staging、SQLite、Guest、skill id、Neural Trace？—— **默认不应看到**。
3. 文案承诺的动作（导入、继续、修正、办结、下载）在**同一屏**是否有对应按钮？不能「说了没控件」。
4. 办完了没有？卡住时知不知道卡在哪、怎么继续？
5. 这是**能交付的产品**，还是给开发者/demo/招聘看的剧场？

**反模式**：按「我们代码里有什么模块」排页面（Baseline 表、Trace 星图、理论 Tab、Hub 流程）；按「客户要完成什么业务」排页面（导入材料 → 执行 → 文书 → 修正 → 复核 → 归档下载）。

治理/调试能力可以存在，但 **默认隐藏或进二级入口（inspector / 开发者 / 发版检查）**，不能占客户主视线。

### 0.1 客户看得懂（禁止「内部语言」）

- 界面、列表、门闩、页脚、Baseline：**中文业务名**（如「合同审查」「表格对账」），**禁止**裸 `contract-desk`、`dom-probe`、Staging/Prod 表占首屏。
- 英文 id、版本环境表、代码字段名 → 仅管理员折叠区或开发者视图。
- 搜索/路由可以用触发词，但展示给用户的永远是「解决什么问题」。

### 0.2 技能不是「匹配几个字」的 demo — 要能处理复杂业务

- **目标**：技能 = **可版本化的业务程序**（步骤 + 工具 + 参数 + 用户数据），能完成对账/审合同/流程等**复杂业务**，不是「触发词表 + 静态话术」。
- **应有闭环**：真实材料 → 服务端 process 逐步执行 → 文书/CSV 交付 → 发现问题 → **改 SKILL（步骤/参数/触发）** → 发版检查 → 对话/回归再验证。
- **禁止**把技能做成：只有「用户这样说」匹配字段可见、步骤只是展示文案、检查只在浏览器 mock 跑一遍、办事仍靠内置样例。
- **技能页必须让客户感知**：改的是**业务规则**（容差、缺票策略、汇总维度、工具链），不是多写几个关键词。

### 0.3 当前体感 gap（诚实口径，改产品时要消掉）

| 客户看到的 | 实际代码里还有啥 | 缺口 |
|------------|------------------|------|
| 「用户这样说」触发词占屏 | 同页有「按这些步骤做」= `steps` + `tool` + `args` | UI 像路由表，不像业务程序 |
| 「检查能不能发」8 句话 | 办事技能应走 **`/api/skills/run-inline` + 验收 CSV** | 非办事技能仍可用 mock |
| 对话办事 | 产品路径：`product-run` → `runSkillOnServer` → sheet/contract/flow engine | 与技能页检查 **不是同一条链** |
| 改草稿 | 可改 triggers / steps / args，发布进 live catalog | 缺「带样本数据试跑 process」的治理入口 |

**验收方向**：发版检查与对话办事应尽可能 **同源**（同一 kernel、同一数据槽）；技能页首屏应突出 **步骤参数 + 试跑 process**，触发词降为辅助。

### 0.4 SKILL 该是什么 / 禁止「傻逼 skill」（用户原话口径）

**Skill 是什么（唯一正确定义）**  
可发版的 **办事程序**：`steps[].tool` + `steps[].args` + **用户材料** → 服务端逐步执行 → 表/文书/CSV。**不是**触发词表，**不是** SKILL 里写一段「读入六列」当办事结果。

**禁止（写了就等于 demo，用户会骂）**

| 禁止 | 例子 |
|------|------|
| 步骤 `label` 写死未跑就知道的细节 | 「读入六列」「取近 6 个月」「切成六块」——列数/行数/块数 **只能来自本次引擎输出** |
| 把 `label` 当客户看到的办事说明 | 客户看 **process 每步 detail** 或 **参数摘要**（容差、汇总维、缺票策略） |
| 触发词当 skill 本体 | 首屏一大排说法，步骤像装饰 |
| 命中触发词 → 回 Markdown | 无导入、无逐步 trace、无 WorkPaper/下载 |
| 用户说过不要 demo 仍留内置样例路径 | 正式开放的办事技能 **productWorkbench + 用户 CSV**；样例仅发版 **验收 CSV**，不当对话答案 |

**正式办事技能 SKILL.md 写法**

- `label`：短 phase 名（认列 / 汇总 / 对账 / 出表）或 **空**，**不要**编造列数、月数、块数。
- 业务规则只放在 **`args`**（tax、tolerance、groupBy、directorAt…）；改 args = 改业务。
- 展示层用 `src/lib/deskStepLabels.ts`：**静态**用 tool+args 生成说明；**跑起来**用引擎 `detail` 当标题。
- `triggers`：仅路由；列表/card **先展示规则摘要**，说法次要、小字。

**Agent 曾犯、禁止再犯**

- 读了注意事项仍把 SKILL 当「文案配置文件」。
- 只改执行链（server run）不清 demo 句、不改 UI 读 label 的方式。
- 把 WORK-NOTES/架构说明抄到客户界面。

### 0.5 复杂 skill 才是产品价值（用户原话）

- **本系统卖的是**：繁琐、多步、多分支、多材料、可发版治理的 **复杂 skill**——不是「两三个互动就结束」的轻量问答。
- **量级参考**：一个值得上架的复杂 skill，SKILL + 引擎/分支/案例 **宜 ≥400 行量级**（或等价：多阶段、多守卫、多交付物）；**几行 steps 的玩具 skill** 客户自己试跑即可，**不应占办事首屏**。
- **复杂体现在**：输入契约、逐步 process、参数化规则、分支/卡点、状态、文书+CSV、发版回归——不是 trigger 多、label 长。
- **Agent 验收**：改 skill/对话/门闩后，自问「这像复杂办事程序，还是像匹配+一段话？」

### 0.6 零 demo（用户硬口令 — 违反即重做）

- **禁止新增**任何 demo、示范、样板、MiniLive、假数据剧场、Hub showcase、SkillFromDemo 进 **办事主链 / 技能首屏 / 对话默认路径**。
- **禁止**用「加一点 demo 方便看」当理由；发版验收 CSV **仅治理链**用，**不得**当对话里的内置答案。
- **禁止**在界面加「示范」「样板」标签忽悠客户；信贷多轮包 **不出现在**办事员技能列表。
- 用户说「不要 demo」= **不要加、不要留、不要换名再上加**。

---

## 1. 产品是什么（一句话）

**企业办事 + 同一套技能治理**：对话是**运行面**（当前正式开放：报销对账、客服工单、门店排班），技能/发版/回归是**治理面**；不是 Hub 演示、不是广场剧场、不是开发者自嗨页。

---

## 2. 视觉与可读性 — 硬约束（含白底白字）

### 2.1 禁止

- **白底白字、浅灰字 on 白底、浅字 on 浅底** — 客户区正文、标题、标签、按钮文字必须清晰可读。
- 把**下载/主操作按钮**样式套成与 **× 关闭** 相同的窄方块（会导致文字竖排、像乱码「svc」）。
- 用 `#fff` / 极浅色的 `strong`、`span`、chip 落在白色卡片/抽屉/气泡上且无描边。
- 优化时**删掉图标、删能力、收窄到看不见答案** — 优化 ≠ 删除。

### 2.2 必须

- 正文/标题：深色系（如 `#0f172a`、`#334155`）；次要说明：`#64748b` 及以上对比度。
- 主按钮：深色字 on 浅底，或白字 on 饱和色底；**hover/disabled** 也要分得清。
- 改 UI 后 **肉眼扫一遍**：抽屉头、问题区标题、部门合计卡片、门闩区、表格脚 —— 不能「几乎看不见」。
- 流式结束后 **meta/按钮预留高度**，避免答案区 **闪一下** 再拼底部条。

### 2.3 自检清单（动 CSS 必过）

- [ ] 白色/浅灰背景上的所有文字是否都能轻松阅读？
- [ ] 抽屉/对话框右上角每个按钮是否像按钮（有文案、够宽）？
- [ ] 禁用态是否像「不能点」而不是「消失了」？
- [ ] 手机/窄屏下关键操作是否仍可见（不只看 desktop）？

---

## 3. 客户运行面 — 绝对禁止

| 禁止 | 说明 |
|------|------|
| 演示当产品 | Hub/showcase/plaza-first、信贷多轮 showcase 流、AgentHubOverview 当主界面 |
| 浏览器假跑办事 | 客户技能在浏览器 `runSkill` + 内置样例行/样例合同 |
| 内部标识外露 | `contract-desk`、`sheet-desk`、SQLite、processId、Built-in Agent、Guest/LLM 标签 |
| 只改 UI 不改后端 | WorkPaper「一键修正」仅本地 state、不 writeback 数据集、不 rerun process |
| 文案说要做、控件没有 | 正文写「下方导入 CSV / 继续执行」，但没有 `ProductRunParts` |
| 流程断头 | 「人工审核」后无办结/下载/对话结论；合同场景套对账提示语 |
| 状态撒谎 | 右侧 Trace「4/4 完成」但业务还在 **待导入** 门闩 |
| 测一个改一个 | 无整体计划就 patch；用户问现象时 silent 改代码不先答 |
| 反复问「客户是谁」 | 口径已定：企业办事 + 技能治理，不要每轮重新「咨询」 |
| 客户界面露英文 skill id | 一律 `skillLabel` / description 中文头 |
| 技能列表当开发面板 | Baseline/dom-probe 进折叠；首屏只办事技能 |
| **新增 demo/示范/样板** | §0.6 零 demo；办事只有真实材料+process |

---

## 4. 客户运行面 — 必须满足

### 4.1 办事内核（同源）

- **Skill** = 版本化 `src/skills/*/SKILL.md`（步骤 + 工具）。
- **执行** = 服务端 `runSkillOnServer` + 各 Engine，`productWorkbench: true`，**无内置业务样例数据**。
- **Process** = `processId` + SQLite `product_processes` / `product_datasets` + 导入门闩 + SSE `/api/product-run/stream`。
- **交付** = WorkPaper + CSV 下载；修正 = 写回 slot CSV → **rerun** → 刷新 message / paper。
- **治理** = 同一技能目录：对比、evalops、case、check、发版门禁；与运行面共用 catalog。

### 4.2 对话 UI（`WorkOwnAgent` → 对话 → `AgentProductDemo` hubMode=false）

- 场景卡片 / 自然语言，**不**罗列 skill id。
- **无** slash、对话内 `/eval`、多 Agent、广场优先、sheet 对比剧场（产品路径）。
- 缺数据：**同一条 assistant 消息**上必须有 `productRun.status === waiting_import` 的 UI：**下载模板、导入 CSV、继续执行**（`ProductRunParts.tsx`）。
- 门闩文案：**技能中文名 + 材料名**，禁止 `contract-desk`。
- 页脚：**技能中文名 + 耗时**；禁止 SQLite / Guest / 内部 id。
- 右侧「办理进度」跟 `product-run`；Trace 剧场不与「待导入」矛盾。

### 4.3 文书抽屉（WorkPaper）

- **完整流程**：系统对账 → 人工复核 → 办结归档 → 对话结论 + **下载对账表 CSV**（文案写全）。
- 场景化提示：合同 ≠ 对账话术。

### 4.4 参考方向

- 流程模型参考 `E:\tianyangAgent\agent`（processId、import/resume、step parts）。
- 落地以 **builder-native `product-run`** 为准。

---

## 5. 技能治理面 — 与客户分界

| 给客户 / 办事员 | 仅治理 / 开发者 |
|-----------------|-----------------|
| 技能能解决什么、怎么触发、能否发版 | **环境 Baseline（Staging/Prod）**、`dom-probe` 表 |
| 发版检查、导入 SKILL、对话试跑 | 同步仓库、Mock 回归、能力图谱当首页 |
| 资料库、规则、连接 | Neural Trace / DNA / Gap 默认仅 inspector |

**技能页**：客户要「技能解决问题」，不是「一屏版本号表」。

- 首屏只展示当前正式开放的 **3 个办事技能**（报销对账/客服工单/门店排班）。未完成同源 product-run 与浏览器全链验收的能力不得对客户展示。
- 卡片展示：**中文名、步骤管线、用户常说触发词**；点进详情可 **编辑步骤/发版检查**。
- **技能页顶栏（给客户看的文案）**：只写业务语言，例如「在这里维护办理规则：客户怎么说会接上、接到后按哪几步处理；改完先检查，再到对话里用您的材料试一遍。」
- **禁止**把本文、架构说明、Agent 口径原句贴到 UI（含：`process`、服务端、`触发词`、步骤程序、演示匹配、办事技能 = … 等）。

---

## 6. 演示 / 双轨残留（系统清除，勿再进主链）

Hub 主路径、HubChatDock、demoSeed、slash、in-chat eval、multi-agent compose、假 knowledge 剧场、save-as-skill 主路径、Insight/Gap/DNA 默认外露、理论 Tab 当产品、lab works 与产品同入口、双 skill 源、AgentSkillsDemo 当客户脸等 —— 可留 **非默认路由 / lab**，不得出现在办事主链。

---

## 7. 经常犯的问题（Agent / 开发 — 禁止再犯）

| # | 问题 | 正确做法 |
|---|------|----------|
| 1 | **白底白字、低对比 chip/标题** | 见 §2；抽屉/问题区/合计卡强制深色字 |
| 2 | **正文要导入 CSV，界面没有** | 保证 `message.productRun` + `ProductRunParts` 与门闩文案同条消息 |
| 3 | **页脚/路由显示 `contract-desk`** | 展示名用 description/中文名，不用 YAML `name` id |
| 4 | **一键修正只改前端** | writeback dataset + `rerun` + 刷新 paper |
| 5 | **人工审核后没然后** | 复核 →「办结归档」→ 对话结论 + 下载 |
| 6 | **下载按钮像乱码** | 下载钮独立 class，勿共用关闭钮 32×32 |
| 7 | **Trace 显示完成但仍要材料** | 产品态以 `productRun.status` 为准，门闩时 Trace 勿写「已完成」 |
| 8 | **技能页 Baseline 占首屏** | 隐藏或挪到开发者/发版深度页 |
| 9 | **优化 = 去掉流式/流程图/功能** | 默认收起可以，代码链和客户能力不能删没 |
| 10 | **输入问题后看不到答案** | 查 padding、max-width、被挡、被清空 |
| 11 | **API 未启动静默走浏览器假数据** | 办事技能必须明确报错：`dev:full` / :8787 |
| 12 | **改乱后不 commit，整段丢失** | 提醒用户分批 commit；未要求不要擅自 commit |
| 13 | **从 transcript 硬恢复整库** | 小步对照 git/stash，不全量 replay 500 文件 |
| 14 | **复制 demo 页当产品** | 技术并进「五柱/core」，不搬 Hub 页面 |
| 15 | **用户问「X 在哪」直接开改** | **先答根因与位置**，再给计划，再改 |
| 16 | **用户要计划，却先改了一处** | 先写计划与验收，再动刀 |
| 17 | **合同/对账/流程共用一套提示** | 按 `paper.kind` / 场景分文案与步骤 |
| 18 | **继续探索/弹框挡在对话框上** | 客户路径控制 follow-up 干扰（历史踩坑） |
| 19 | **来源用抽屉** | 历史要求：来源勿抽屉（变更需与用户确认） |
| 20 | **对话框太窄、表格看不全** | 产品 chat 放宽宽度，表格可横向滚动 |
| 21 | **不改注意事项也乱做** | 每会话开工前读 `docs/WORK-NOTES.md` |
| 22 | **技能列表仍是英文/ Baseline** | 中文 `skillLabel`；Baseline 仅管理员折叠 |
| 23 | **以为技能=触发词匹配** | 办事走 product-run + 可改 steps；治理走发版/check |
| 24 | **技能页只有匹配字段有用** | 步骤/args 才是引擎；检查需对齐 product-run，不能仅 mock |
| 25 | **复杂业务靠写死 demo** | 应用引擎+用户数据；迭代改 SKILL 而非改前端文案 |
| 26 | **把 WORK-NOTES/架构句抄给客户** | §5 顶栏用业务话术；内部 lane/kernel 只写在本文 |
| 27 | **SKILL 步骤写「六列/六月/六块」** | §0.4；label 短名；数字来自引擎 detail |
| 28 | **注意事项写了仍当 demo 做** | 开工强制三条；动 skill 必过 §0.4 |
| 29 | **skill=匹配+死回复** | 必须有材料/process/交付；见 §0.4 定义 |
| 30 | **用户多次说不要 demo 仍留** | 默认当已说过；全库办事 skill 按 §0.4 清 |
| 31 | **注意事项当背景不执行** | 开工强制三条 + §10 逐条打勾，不是读完就改代码 |
| 32 | **说下方导入、按钮在上** | 同条消息：说明文在上、`ProductRunParts` 在下（§10 #5） |
| 33 | **首屏玩具 skill** | 复杂 skill ≥§0.5；简单 skill 不进主链 |

---

## 7.1 技能调用流程（代码真实路径，供对齐产品）

**两条 lane，不要混为一谈：**

| Lane | 入口 | 执行内核 | 数据 |
|------|------|----------|------|
| **办事（运行面）** | 对话 `WorkOwnAgent` → `AgentProductDemo`（`productWorkbench: true`） | `apiStartProductRun` → SSE → `executeProcess` → **`runSkillOnServer`** | 会话 SQLite **`product_datasets`**，用户 CSV |
| **治理（技能页）** | `SkillComparePanel` 编辑草稿 / 发版 | 办事技能：**`run-inline` / liveGate**；其它：**mock** | 办事与对话 **同引擎** |

### A. 办事 lane（客户要的结果在这里）

1. **用户发话** → `guestAgentRuntime` 里 `pickSkill`（目录 = 线上 runnable skills；可 `pinSkillId` 钉住技能）。
2. **路由**（`skillRouter.routeQuery`）：触发词打分 + 内置规则（如 sheet 操作、desk 优先、信贷流程等）；`productWorkbench` 下未命中则**不**走知识库兜底，只提示可试说法。
3. **命中办事技能**（`isCustomerSkill` 且非信贷多轮）→ **`apiStartProductRun`**（`POST` + **`/api/product-run/stream`** SSE）。
4. **`startProductRun` / `executeProcess`**（`server/productRun.ts`）：
   - 查 `requirementsForSkill` + `product_datasets` 行数 → 缺材料则 **`waiting_import`**，SSE `gate`，正文 + **`ProductRunParts`**（模板 / 导入 / 继续执行）。
   - 材料齐 → `augmentQuery` 把各 slot 的 CSV 拼进 query → **`runSkillOnServer(skillId, augmented, sessionId, { productWorkbench: true, onStep })`**。
5. **`runSkillOnServer`**（`server/skills.ts`）：按 SKILL 的 **`steps[]`** 顺序 `callTool(step.tool, resolveArgs(step.args))`；复杂业务在 **tool + args**（如 `__sheet_*` → `sheetEngine`：tax、tolerance、missing、groupBy）。
6. **收尾**：`synthesizeResponse` + `paperForSkill` → SSE `finish` → 消息带 **`productRun`** + **`workPaper`**；修正走写回 dataset → **rerun** 同一 process 链。

### B. 治理 lane（技能页「表格对账」对比 / 8 句话）

1. **展示**：从 catalog 读 SKILL（live vs draft）— **triggers**、**steps 文案**、**args**（表单改容差/缺票/汇总维等会改 draft）。
2. **「检查能不能发」**：对 **gate 问题集**（`listGateQuestionRows`，如 8 句）逐条 **`runSkillCompare`**：
   - 用 baseline/candidate 两份 hydrated SKILL 替换 catalog 里该 id；
   - 办事技能：**服务端 inline + 验收 CSV**；其它技能 mock。比 trace / 路由，**不以触发词 diff 当主结论**。
3. **发布后**：draft 进 live catalog → **办事 lane 的 `getSkill` / 路由 / steps 才变**；但 **发版检查仍不等于** 用客户 CSV 跑过 product-run。

### C. 技能本体里「除了匹配字段还有什么」

- **triggers**：只负责 **进哪个技能**（路由分 ≥2 等规则），不执行业务。
- **steps + tool + args**：才是 **复杂业务程序**（例：`sheet-desk` 四步 `__sheet_parse__` → aggregate → reconcile → report，参数改合计与拦截行）。
- **数据槽**（`productSkillInputs`）：办事 lane 强制用户 CSV；治理 lane 默认不绑同一套数据。

**产品对齐目标**：治理检查与办事执行 **同源 kernel + 同源验收数据**；技能页首屏突出 **步骤参数与试跑 process**，触发词降为辅助。

---

## 8. 工程与协作方式

- **客户视角** → **先答后改** → **先计划后动刀** → **小步验收**（§0、§7）。
- 运行：`npm run dev:full`（`:5173` + `:8787`）。
- **最小 diff**；不顺手 refactor 无关文件。
- 用户未要求 **不要 commit**。

---

## 9. 已知坑（代码定位）

| 现象 | 根因方向 |
|------|----------|
| 无 CSV/继续执行 | 无 `productRun` / status 不对 / 未渲染 `ProductRunParts` |
| 说下方导入、按钮在上 | 曾先渲染 `ProductRunParts` 再 Markdown；见 §10 #5 |
| `contract-desk` 外露 | `route.skillName`、`gateMessage`、`MessageTimeFoot` |
| 修正无下文 | `WorkPaper` 未接 `applyPaperRerun` |
| Baseline 给客户看 | `SkillComparePanel` → `BaselineEnvBoard` |
| 样式继承导致白字 | `.ua-bubble`、`.oa-work-drawer-head button` 过宽选择器 |

---

## 10. 验收清单（改完必过 — 执行清单，不是建议）

1. **报销对账**：导入 → 继续执行 → 文书 → 修正 rerun → 复核 → 办结 → 下载 CSV；**无白字**。
2. **客服工单 / 门店排班**：各自两份材料门闩有导入+继续；导入后办结到多表文书；无内部 id。
3. **技能列表**：仅当前正式开放的三技能 + 中文名 + 步骤可编辑入口；Baseline 只在折叠里。
4. **对话**：无 slash/plaza/multi；API 挂有明确提示。
5. **门闩同屏**：读「下方导入/继续执行」→ 肉眼看按钮是否在说明**下面**（`AgentProductDemo` 先 copy 后 `ProductRunParts`）。
6. **复杂 skill 方向**：办事 skill 按 §0.5 扩程序，不靠加 trigger/长 label 冒充复杂。
7. **零 demo 数据链**：无导入 → **仅门闩**，正文/步骤 **无** 具体行、人名、金额；有导入 → 数字与明细 **只来自本次上传**，表标题用 **材料名**，禁止把「问句里的表」当客户可见标签。
8. **结论像办事、不像演示**：finish 以 **一句结论** 为主；同一 step detail **不得** 在正文与步骤区重复两遍；禁止固定演示稿结构冒充针对本材料的回复。
9. **客户自带 CSV**：必须走导入槽 + process；**不得** 仍展示内置张三/12800 或模板样例（除非客户自己导入的就是模板文件）。
10. **生产安全**：无 token 不可读写材料、运行/试跑/发布技能；跨用户 session/process 返回 403；无默认口令；SSRF 内网地址被拒绝。
11. **发布同源**：发布/回滚后服务端 live catalog 立即生效，另一浏览器与纯 API 跑到同一版本。
12. **运维可恢复**：CI 全绿、生产只暴露 TLS、备份可恢复、日志不含客户 CSV、密码或个人模型 Key。

---

## 11. 文档维护

- 用户新要求 → 追加 §0–§7 合适章节 + 变更摘要。
- 策略配置：`/.ownagent/policy.yml`。

### 变更摘要

- **2026-10-11**：初版；`docs/` 主副本。
- **2026-10-11**：新增 **§0 客户视角**；扩充 **§2 白底白字**；新增 **§7 经常犯的问题（20 条）**。
- **2026-10-11**：§0.1 禁止客户看不懂；§0.2 技能=程序+process 非 demo 匹配；强制每会话读本文；§7 增至 23 条。
- **2026-10-11**：§0.2/§0.3 复杂业务技能与技能页 gap；§7 增至 25 条；补充调用流程说明入口。
- **2026-10-11**：§5 技能页顶栏客户话术 + §7 #26；去掉「process/触发词」类 UI 文案（`SkillComparePanel`）。
- **2026-10-11**：办事五技能统一 `mustRunServerProcessSkill`：对话 product-run、发版 `run-inline`/liveGate；禁浏览器 mock；`flow-desk` 与信贷多轮分流修正。
- **2026-10-11**：§开工强制、§0.4 SKILL 形态（禁写死 demo label）；§7 #27–#30；五技能 SKILL 清 demo 句；展示 `deskStepLabels`。
- **2026-10-11**：§0.5 复杂 skill（≥400 行量级）；§10 执行清单 #5–#6；门闩文案+布局修复；§7 #31–#33。
- **2026-10-11**：办事链去内置业务数据：`sheet/contract/data/image` 引擎无导入/内嵌 CSV 即失败；`image-desk` 增 `voucher-ocr-blocks` 槽；删 MCP `example.com` 假探活；技能页去信贷多轮包与 SkillFromDemo；门闩态 trace 标「待导入」。
- **2026-10-11**：复杂办事程序：`sheetDeskProgram.ts` + `flowDeskProgram.ts`；`sheet-desk` 16 步（契约/行检/交叉/缺票守卫/升级/四表交付）；`flow-desk` 9 步（批量/对账同步/cap/双签）；改 args = 改分支与守卫。
- **2026-10-11**：§开工 #4 自测门禁；`contract/data/image` 多步 program + SKILL；**根因**：新工具未进 `skillToolRegistry` → 五技能不进路由目录；`test-product-route.ts` 进 `test:ownagent`。
- **2026-10-11**：任务完成标准模板 + §10 #7–#9（零 demo 链、结论 UI、客户 CSV）；`.cursor/rules/ownagent-work-notes.mdc` 全项目 alwaysApply。
- **2026-10-11**：五办事 skill 同源：`workbenchDataset`（session 导入槽优先）、product-run 不再拼问句 CSV；办结 `synthesizeProductFinishMessage`；步骤不双写 stream。
- **2026-10-11**：`test-product-run-e2e.ts` → `test:ownagent`；WORK-NOTES「不听话累加」#1。
