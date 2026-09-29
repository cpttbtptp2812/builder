# OwnAgent 现状与未来方向

> 更新：2026-03  
> 入口：`/work/ownagent`  
> 定位：**Skill 发版安全与因果归因平台**（B 方案）

---

## 1. 一句话

**OwnAgent 在 Skill 发布前，用确定性 SCM 回答：改这一步成功率先掉多少、哪步是根因、能否 merge（PASS / WARN / BLOCK）。**

对话 / RAG / 知识广场保留，作为 **验证沙盒**，不是主卖点。  
**理论（Parse·2 架构）** 保留为顶栏独立 Tab，展示 Agent 全链路可编排。

---

## 2. 产品架构（客户能走完的路径）

客户只做这一件事：**改技能 → 补测试问题 → 发版检查 → 发布 → 到对话里确认。**

```
顶栏：产品 | 理论
│
产品
├─ 技能（默认）
│    概览 → 编辑草稿 → 测试问题 → 发版检查（能否发布 + 原因）→ 版本记录
├─ 对话          确认发布后客户问出来的效果
├─ 资料库        技能要引用的原文
├─ 知识广场      已经确认、可复用的问答
├─ 检查
│    测试用例 / 路由对比 / 回归评测 / 回答质检 / 执行记录 / 处理过程
└─ 设置
     回答规则 / 接入配置 / 使用说明 / Prompt / 工具沙箱 / 能力图谱
│
理论
└─ Parse·2 架构
```

技能发布仍是主路径。检查和设置里的功能都留在侧栏，没有删。

---

## 3. 已实现能力

### 3.1 核心：确定性 SCM（产品内核）

| 能力 | 说明 | 代码 |
|------|------|------|
| **do(obs) 精确传播** | 对某步干预，向下游确定性 replay | `src/lib/deterministicScm.ts` |
| **Pivotal step** | 干预后翻转 PASS/FAIL 的因果根因步 | `analyzePivotalSteps` |
| **ΔP success** | 候选相对基线成功率差 | `consequenceDeltaForCompare` |
| **Fork ΔP** | 路由 ambiguous 时两 skill 成功率差 | `skillForkDelta` / `forkDeltaForAmbiguous` |
| **Outcome grader** | skeleton / all_ok / min_steps / release_overall | `src/lib/scmOutcome.ts` |
| **传播覆盖率** | exact vs sample 比例 + mock 补齐提示 | `src/lib/scmCoverage.ts` |

**UI：** `ScmAttributionPanel`（概览图 / 干预明细 / 测试 case）+ `ScmVisuals`（管道图、影响条、PASS/FAIL flip）

---

### 3.2 发版门禁（主用户路径）

| 能力 | 说明 | 位置 |
|------|------|------|
| **Skill Hub** | 内置 + 导入 skill；仪表盘（总数 / 待发布草稿 / 运行中） | `SkillComparePanel` 列表 |
| **草稿 → 发版检查 → 发布** | 编辑草稿不影响线上；检查后再发布 | 技能详情 Tab |
| **发版门禁三指标** | ΔP · 根因步骤 · PASS/WARN/BLOCK | `ReleaseGateHero` |
| **门禁原因列表** | 高风险 / 中风险 / 因果 flip 等原因 | `src/lib/releaseGate.ts` |
| **全量对比报告** | 结构 diff + 路由漂移 + 逐句 case + SCM 摘要 | `skillCompareReport.ts` |
| **报告导出** | Markdown + JSON（含 gate 字段） | 发版检查页 |
| **批量发版检查** | 对所有「有待发布草稿」的 skill 一键跑 check | 技能列表 `BatchCheckBar` |
| **Skill 格式修复** | 导入 / 打开时补 frontmatter、triggers、steps | `src/lib/skillRepair.ts` |
| **版本 / 草稿存储** | localStorage 草稿、发布记录、回滚 | `skillCompareStore.ts` |

**Verdict 映射：**

| 内部 | 门禁 | 含义 |
|------|------|------|
| approve | **PASS** | 允许发布 |
| warn | **WARN** | 谨慎发布，需确认 |
| reject | **BLOCK** | 阻止发布 |

---

### 3.3 Case 管理

| 能力 | 说明 | 位置 |
|------|------|------|
| **自定义 case CRUD** | query + grader，localStorage | `skillTraceCaseStore.ts` |
| **Case 管理页** | 按 skill 查看内置 + 自定义；编辑 / 删除；导入导出 JSON | `CaseManagementPanel` |
| **从 trace 生成 case** | SCM 面板 → 测试 case Tab | `ScmCaseEditor` + `traceCaseSuggest.ts` |
| **Case 参与发版检查** | `buildTestQueries` 合并 custom + 内置 case | `skillCompareReport.ts` |
| **Repo 级 case** | `.ownagent/cases.json`（CLI / CI 可读） | 仓库根目录 |

---

### 3.4 验证沙盒（保留，非主卖点）

| 能力 | 说明 |
|------|------|
| **对话试跑** | 真实问法验证路由与回答体感 |
| **运行追踪** | 逐步执行 skill、看 trace、prove 基线 |
| **资料库 / 知识广场** | 支撑 knowledge 类 skill 语料 |
| **回答规则 / 质检 / 回归评测** | 运营与质量闭环 |
| **EvalOps** | 批量实验与版本对比 |

---

### 3.5 理论（Parse·2）

| 能力 | 说明 |
|------|------|
| **顶栏「理论」Tab** | 与「工作台」并列，不隐藏 |
| **AgentHubOverview** | 全链路节点可点、Flow 编排、与实现映射 |
| **说明条** | Parse·2 架构 · 与发版门禁同源运行时 |

---

### 3.6 CLI / CI / 仓库约定（Phase 2）

| 能力 | 命令 / 文件 |
|------|-------------|
| **Semcompiler + mock trace** | `npm run prove` → `scripts/prove.ts` |
| **全 skill 门禁 check** | `npm run check:skills` → `scripts/ownagent-check.ts --all --ci` |
| **单 skill check** | `npm run check:skill -- path/to/SKILL.md` |
| **Baseline 文件** | `.ownagent/baselines/{skillId}.json` |
| **Case 文件** | `.ownagent/cases.json` |
| **GitHub Action** | `.github/workflows/skill-gate.yml`（prove + check，PR 评论 Verdict 表） |

CLI 输出 JSON schema：`ownagent-check/1`，含每 skill 的 `gate` / `reasons` / trace 通过率。

---

### 3.7 服务端 API（Phase 3 基础）

`npm run dev:server` 后可用（`server/skillGate.ts`）：

| 方法 | 路径 | 作用 |
|------|------|------|
| POST | `/api/skill-gate/check` | 静态检查 + 基础 gate（完整 SCM 仍在浏览器） |
| GET/POST | `/api/skill-gate/baseline/:skillId` | 读写 repo baseline |
| POST | `/api/skill-gate/publish` | 发布并写 baseline（BLOCK 拒绝） |
| POST | `/api/skill-gate/rollback` | 回滚审计 |
| GET | `/api/skill-gate/audit` | 审计日志（SQLite） |

---

### 3.8 团队与 IDE（Phase 3 基础）

| 能力 | 说明 | 位置 |
|------|------|------|
| **WARN 审批队列** | WARN 发布时写入待审批；列表可批准 | `teamStore.ts` + 技能列表 `TeamApprovalBar` |
| **staging/prod baseline 标签** | localStorage 标记（浏览器端） | `teamStore.ts` |
| **VS Code 插件雏形** | 打开 SKILL.md 状态栏显示 PASS/WARN/BLOCK | `extensions/ownagent-skill-gate/` |

---

## 4. 关键文件索引

| 域 | 路径 |
|----|------|
| 产品壳 / 导航 | `src/works/WorkOwnAgent.tsx` |
| 技能 + 发版 | `src/components/ownagent/SkillComparePanel.tsx` |
| SCM UI | `ScmAttributionPanel.tsx`, `ScmVisuals.tsx` |
| Case | `CaseManagementPanel.tsx`, `skillTraceCaseStore.ts` |
| 门禁逻辑 | `releaseGate.ts`, `skillCompareReport.ts` |
| SCM 算法 | `deterministicScm.ts`, `provingGround.ts` |
| CLI | `scripts/ownagent-check.ts`, `scripts/prove.ts` |
| API | `server/skillGate.ts` |
| 方向（战略） | 本文 §6 |

---

## 5. 已知边界（诚实说明）

以下为 **已有基础但未完全产品化** 的部分：

1. **服务端 SCM** — API check 以静态检查为主；完整 ΔP / pivotal 仍依赖浏览器运行时。  
2. **Case 同步** — 测试 Case 页可「同步到仓库 / 从仓库拉取」（需 `npm run dev:server`）；无 API 时仍可下载 JSON。  
3. **团队审批** — 本地 localStorage，无多用户 / SSO / 通知。  
4. **VS Code 插件** — 调用 CLI 的雏形，未上架 Marketplace。  
5. **GitHub Action** — PR 评论为 Verdict 表；未在 PR 内嵌完整 ΔP 图。  
6. **生产 trace 回流** — `traceCaseSuggest` 已有，未接真实生产日志管道。  
7. **Exact 覆盖率** — 有仪表与提示，mock 需人工补 `MOCK_PROFILES`。

---

## 6. 未来方向

### 6.1 产品叙事（不变）

继续 **B 方案**：卖「发版安全 + 因果归因」，不卖「又一个 Chat/RAG」。

主故事：**改这一步，后果会不会 flip → 哪步是根因 → 能不能 merge。**

---

### 6.2 近期（1–2 个月）— 把「能用」做成「敢用」

| 优先级 | 方向 | 目标 |
|--------|------|------|
| P0 | **Case 与 repo 同步** | 已有：测试 Case → 同步到仓库 / 从仓库拉取 |
| P0 | **Killer 路径** | 已有：技能列表「5 分钟发版路径」直达 release-inspector |
| P1 | **服务端完整 check** | API 跑与浏览器同源的 compare + SCM，供 CI 不依赖浏览器 |
| P1 | **PR 评论增强** | GitHub Action 贴 ΔP、pivotal step、case 失败明细 |
| P1 | **Baseline 工作流** | staging baseline vs prod baseline 可视化；发布自动 bump |

---

### 6.3 中期（3–6 个月）— 嵌入工作流

| 方向 | 内容 |
|------|------|
| **CI 一等公民** | `ownagent check` 成为 SKILL.md PR 的默认 required check |
| **多 skill 编排** | 路由 ambiguous 汇总报告；skill 依赖图 |
| **审计与合规** | 谁发布、哪版、gate 结果、是否 override — 可导出 |
| **IDE 插件正式版** | 侧边栏 ΔP、pivotal 预览；保存时 pre-check |
| **Mock 工作台** | 按 tool 补 mock，提升 exact 覆盖率到可审计阈值 |

---

### 6.4 长期（6–12 个月）— 平台化

| 方向 | 内容 |
|------|------|
| **OwnAgent Cloud / 私有化** | 团队、环境、审批流、API key |
| **生产 trace 回流** | 失败 trace → 自动 suggest case → 一键加入回归集 |
| **OEM** | 嵌入 iMean 类 Agent 平台，作为「Skill CI 模块」 |
| **品类定义** | 对外话术成为用户原话：「Skill 的发版门禁 / pivotal step / ΔP」 |

---

### 6.5 刻意不做（或维持次要）

- 不做主打 FAQ 问答的 **A 方案** 叙事（对话/RAG 保持沙盒）。  
- 不做纯 lint / 结构 diff 工具（Compare 服务 SCM，不是反过来）。  
- 不为了 demo 堆黑盒 Chat UI。

---

## 7. 成功标准（12 个月）

**算成功：**

- 外部团队在 PR 里用 `ownagent check` 或 Skill Gate Action 作为 merge 依据  
- 用户描述产品是「Skill 发版安全 / pivotal / ΔP」  
- 至少一次生产事故复盘引用 OwnAgent 门禁报告  

**不算成功：**

- 只有对话 DAU，Skill check 周活为 0  
- 报告只看结构 diff，无人看 ΔP / pivotal  
- 产品仍被介绍成「带 SCM 的聊天 demo」  

---

## 8. 快速验证命令

```bash
# 前端
npm run dev
# → /work/ownagent

# 编译 + mock trace
npm run prove

# 全 skill 门禁（CI 模式：仅 BLOCK 失败）
npm run check:skills

# 单文件
npm run check:skill -- src/skills/release-inspector/SKILL.md

# API
npm run dev:server
# POST http://localhost:8787/api/skill-gate/check
```

---

*文档维护：重大功能合并后更新 §3 与 §5。*
