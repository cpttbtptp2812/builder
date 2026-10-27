# 《基于 GitHub REST 的 Pull Request 审查与合规代理落地方案白皮书》
**版本**：v2.0.0 (实测落地标准)  
**目标岗位对标**：30K–50K（第一段实现） / 40K–60K（第二段实现：含工具循环与评测集）

---

## 一、系统核心定义与边界

### 1. 唯一核心业务动作
> **指定仓库出现一个 Pull Request 之后，把差异拉下来，剪到放得进上下文，起草带文件和行号的意见，人点头才写回 GitHub，同一个提交不写第二次。**

### 2. 严禁写入简历与方案的伪概念（面试必翻车清单）
* ❌ **“虚拟线程支撑数千并发”**：GitHub 认证用户每小时仅 5,000 次配额，且存在每分钟二级限流，并发瓶颈在第三方配额而非底层线程；
* ❌ **“物理阻断合并”**：阻断合并取决于目标仓库管理员是否设置了 Branch Protection 强制检查项，评论（Review Comment）本身不具备阻断合并的强制力；
* ❌ **“剪枝率保底 75% / 单次成本 ¥0.008”**：没有依赖锁文件的 PR 剪枝率可能为 0；没有真实 usage 上报不要写死单次几厘钱；
* ❌ **“微秒级甘特图 / 三天极速交付”**：网络 RTT 和模型推流是秒级，对齐真实行号与幂等锁至少需要 7–12 个工作日。

---

## 二、技术选型与架构设计

### 1. 技术栈收敛
* **后端**：Java 21 + Spring Boot 3
* **数据库**：MySQL 8（使用现有 Compose 实例，承载状态机与审查记录）
* **GitHub 接口**：仅走官方 REST API v3，使用服务端个人访问令牌（PAT，仅分配 `repo` 或 `pull_requests:write` 权限）：
  - `GET /repos/{owner}/{repo}/pulls/{n}`：获取 PR 元数据与 head sha
  - `GET /repos/{owner}/{repo}/pulls/{n}/files`：获取变更文件的 `patch` 文本（避免全量 clone 仓库）
  - `POST /repos/{owner}/{repo}/pulls/{n}/reviews`：写回单次审查评论
  - `GET /repos/{owner}/{repo}/pulls/{n}/reviews`：故障恢复时查重
* **大模型服务**：OpenAI 兼容接口（如通义千问 `qwen-plus`），单次调用输出强约束 JSON：`path`、`line`、`rule_id`、`body`。不引入 LangChain 等重型框架。
* **前端工作台**：React + Vite 单页面。包含：仓库与 PR 号输入区、步骤进度、审查草案列表、同意/驳回操作区。不做高成本红绿 diff 编辑器，以结构化列表清晰展现。

### 2. 核心数据表设计（最低四张表）

```sql
-- 1. 审查任务主表
CREATE TABLE review_task (
    id VARCHAR(64) PRIMARY KEY,
    owner VARCHAR(64) NOT NULL,
    repo VARCHAR(64) NOT NULL,
    pr_number INT NOT NULL,
    head_sha VARCHAR(40) NOT NULL,
    status VARCHAR(32) NOT NULL, -- FETCHED, PRUNED, DRAFTED, AWAITING_APPROVAL, COMMITTING, COMMITTED, REJECTED, CANCELLED, FAILED
    failure_type VARCHAR(32),    -- BAD_CREDENTIALS, NOT_FOUND, DIFF_TOO_LARGE, TIMEOUT, RATE_LIMIT, GITHUB_REJECTED
    error_message VARCHAR(512),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. 步骤执行耗时与明细表
CREATE TABLE review_step (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    task_id VARCHAR(64) NOT NULL,
    step_name VARCHAR(32) NOT NULL, -- FETCH, PRUNE, LLM_DRAFT, PUBLISH
    duration_ms INT NOT NULL,
    input_summary VARCHAR(1024),
    output_summary VARCHAR(1024),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. 审查发现草案表 (Finding)
CREATE TABLE review_finding (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    task_id VARCHAR(64) NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    diff_line INT NOT NULL,
    rule_id VARCHAR(32) NOT NULL,
    comment_body TEXT NOT NULL,
    is_valid_diff_line BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. 写回发布防重凭证表 (Publish 幂等防重)
CREATE TABLE review_publish (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    owner VARCHAR(64) NOT NULL,
    repo VARCHAR(64) NOT NULL,
    pr_number INT NOT NULL,
    commit_sha VARCHAR(40) NOT NULL,
    status VARCHAR(32) NOT NULL, -- COMMITTING, COMMITTED
    github_review_id BIGINT,
    published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_pr_commit (owner, repo, pr_number, commit_sha)
);
```

---

## 三、两阶段实施功能路线

### 第一阶段：单次审查真实闭环（基石能力）
1. **真实拉取**：手填 `owner/repo` 与 PR 号，拉取元数据与各文件 `patch`，状态置为 `FETCHED`；
2. **两项剪枝**：
   - 过滤锁文件（`package-lock.json`、`pnpm-lock.yaml`、`yarn.lock`、`go.sum`、`Cargo.lock`）、压缩包、`dist/`、`target/`、`.map` 文件；
   - 其余仅提取 `@@` 变更块及上下各 3 行上下文。界面透明列出丢弃文件与保留块；
3. **规约加载与判定**：
   - 规则必须保存在仓库根目录下的独立 Markdown 文件中（从文件动态读取，禁止硬编码进 Java 字符串，方便现场修改规则重新触发对比）；
   - 四项基准规则：SQL 拼接风险、明文硬编码密钥、无界线程池风险、循环内数据库/RPC 调用；
4. **行号有效性强校验**：
   - 后端核对模型生成的行号是否真实落在该文件的 patch 差异范围中，丢弃脱幅行号，状态进入 `AWAITING_APPROVAL`；
   - 驳回则任务结束，远端 GitHub 保持 0 污染；
5. **两阶段原子写入**：
   - 点击同意后，**先向 `review_publish` 表插入占位记录（状态 `COMMITTING`）锁定唯一键**；
   - 占锁成功后调用 GitHub `POST /reviews` 接口；成功后写入 `github_review_id` 并将状态更新为 `COMMITTED`；
   - 再次遇到相同 SHA，直接读表返回，杜绝重复发评；
6. **故障分类记账**：
   - 明确拆分：`BAD_CREDENTIALS` (401)、`NOT_FOUND` (404)、`DIFF_TOO_LARGE`、`TIMEOUT`、`RATE_LIMIT` (403/429)、`GITHUB_REJECTED` (422)；
   - 仅对限流依据响应头 `x-ratelimit-reset` 执行等待后重试；超时标记为未完成，严禁显示通过。

### 第二阶段：提升岗位对标覆盖度（进阶能力）
7. **自主工具循环**：模型不再受硬编码 Java 顺序调度，提供 3 个只读工具（`get_pr`、`get_file_patch`、`get_check_runs`）由模型循环调用，写操作始终脱离模型工具集，由人工批准后由服务端单次触发；
8. **显式中断与取消**：增加停止按钮，取消正在传输的 GitHub HTTP 连接与模型流，状态记为 `CANCELLED`；
9. **基准评测集 (Evaluation)**：准备 10 个预先打标的已知 PR（标注真实缺陷与良性代码），批量运行并输出检出率（Recall）与误报率（Precision），用于提示词微调后的回归测试。

---

## 四、真实工程中的六大踩坑点与防御对策

1. **GitHub 不给超大差异**：
   - 当文件过多或体积过大时，`files` 接口中的 `patch` 字段为空。系统直接将状态置为 `DIFF_TOO_LARGE` 并标注任务未完成，不退化为误报极高的盲目新增行扫描。
2. **行号不匹配导致 HTTP 422**：
   - 模型往往混淆“文件实际物理行号”与“Git Diff 相对行号”，且 GitHub 严格区分 `LEFT`（删除行）与 `RIGHT`（新增行）。后端必须依据 patch 元数据建立行号映射校验表，校验失败则在前端标红提示修正，避免请求被 GitHub 直接打回 422。
3. **并发写操作竞态穿透**：
   - 严禁“先查数据库、没有记录再调 GitHub”这种 Check-then-act 竞态设计。必须利用 `review_publish` 表的联合唯一索引通过 `INSERT COMMITTING` 先行加锁。若因网络超时导致本地未记上 `review_id`，重试前先调用 `GET /reviews` 查询对齐。
4. **规则沉默与误报解释**：
   - 没出审查意见仅代表未命中该 4 条规则，不代表代码无缺陷。评测集的核心价值正是向面试官交代规则盲区与误报区间。
5. **令牌权限与限流隔离**：
   - 令牌脱敏，杜绝写入日志或下发前端；严格区分 401（凭证失效，不可重试）与 403/429（限流，根据 Header 退避）。
6. **与现有模拟对话解耦**：
   - PR 审查逻辑必须采用完全独立的 Controller 与 Service，严禁复用前端兜底的离线沙箱推流，失败就暴露真实错误状态。

---

## 五、真实工期与 30K–60K 招聘要求覆盖度核算

### 1. 真实工期测算
* **总估时**：**7 至 12 个工作日**（第一周用于跑通 MySQL 环境、真实连通 GitHub API、解析 patch 与行号对齐；第二周用于两阶段幂等加锁、前端操作流与异常处理）。

### 2. 岗位要求覆盖度客观核算

| 招聘核心要求（嘉立创、商汤、中大厂 Agent 岗位） | 仅完成第一段 | 完成第二段（工具循环+评测） |
| :--- | :--- :---: | :---: |
| 多轮工具调用（模型主导） | 0.5 (代码写死顺序) | **0.9** |
| 只读并行、写入串行 | 0.9 | **0.9** |
| 取消传导至外部请求 | 0.3 (仅依靠超时) | **0.8** |
| 任务续跑、幂等不重复写 | 0.7 | **0.8** |
| 失败分类与自适应重试 | 0.75 | **0.8** |
| 上下文预算与精准剪枝 | 0.8 | **0.8** |
| 写入前人工确认与差异审核 | 0.9 | **0.9** |
| 评测集与提示词回归测试 | 0.1 | **0.7** |
| 真实用量与成本核算 | 0.4 | **0.5** |
| 全栈流式交互与任务回放 | 0.7 | **0.7** |
| **加权覆盖率** | **~58%** | **~73%** |

### 3. 薪资定级与求职策略
* **第一段做实**：稳妥对标 **30K–50K** 的 Agent 全栈开发 / 业务流程自动化开发；
* **第二段做实**：能够得着 **40K–60K** 的 Agent 主循环与评测工程专家；
* **为什么够不着 60K–70K 的平台总监/首席架构师？**
  因为更高薪岗位考核的是自建模型网关、多租户调度、MCP Host、高并发 MQ、以及真实线上日活数与带团队年限，单体 PR 审查代理解决的是主循环与执行可靠性问题。
