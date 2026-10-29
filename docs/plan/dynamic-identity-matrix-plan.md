# 动态身份策略与管理互动系统落地执行计划
> **目标对标**：BOSS 直聘 / 猎聘 25K-35K「AI Agent 架构师 / 大模型应用研发 / AI 中台全栈」核心要求  
> **核心架构**：基于真实 MySQL 持久化的轻量级身份策略矩阵 + 运行时 LLM 工具动态剪枝（Identity-Aware Tool Pruning）+ B端确定性安全围栏

---

## 一、系统核心目标与防伪原则

1. **拒绝假 Demo**：
   - 绝不使用前端写死的枚举切换或纯前端 `includes("删")` 假模拟。
   - 所有的账号、角色、可用工具集、可见数据表、审批阈值必须真实持久化在 MySQL 中。
2. **即时联动生效**：
   - 在前端管理界面修改某角色的工具权限或数据表权限，点击保存写入数据库后，**无需重启前后端服务**，下一轮与 AI 的对话立即按新权限做决策。
3. **闭环演示场景**：
   - **普通操作员/实习生身份**：发起写操作或越权查薪资 -> LLM 物理无法感知该工具/表（未注入上下文） -> 明确提示无权限或拒绝。
   - **总监/审批官身份**：发起写操作 -> LLM 识别工具并调用 -> 系统判定超出阈值触发 `ApprovalTicket` 挂起工单或直接执行落库。

---

## 二、架构设计与物理数据库表

### 1. 数据库物理表（MySQL）

```sql
-- 1. 账号表（精简，挂载角色与部门）
CREATE TABLE IF NOT EXISTS sys_account (
    account_id VARCHAR(64) PRIMARY KEY COMMENT '账号唯一标识，如 intern_01, admin_01',
    username VARCHAR(64) NOT NULL COMMENT '显示姓名',
    role_code VARCHAR(32) NOT NULL COMMENT '角色标识：OPERATOR, AUDITOR, ADMIN',
    department VARCHAR(64) NOT NULL COMMENT '所属部门：运维部, 财务部, 研发部',
    avatar VARCHAR(255) DEFAULT '' COMMENT '头像或占位',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. 动态角色策略矩阵表（核心：决定大模型能摸到哪些工具、哪些表、是否需审批）
CREATE TABLE IF NOT EXISTS sys_role_policy (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    role_code VARCHAR(32) NOT NULL UNIQUE COMMENT '角色唯一标识',
    role_name VARCHAR(64) NOT NULL COMMENT '角色中文名',
    allowed_tools TEXT NOT NULL COMMENT 'JSON数组：["db_query", "iban_validator"] 或 ["*"]',
    allowed_tables TEXT NOT NULL COMMENT 'JSON数组：["biz_orders", "biz_inventory"]',
    require_approval_threshold INT DEFAULT 0 COMMENT '触发工单挂起的金额阈值（元），0为所有写操作均需审批',
    can_execute_write BOOLEAN DEFAULT FALSE COMMENT '是否允许物理写入底层系统',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 初始化 3 个典型企业身份数据
INSERT INTO sys_account (account_id, username, role_code, department) VALUES
('intern_01', '小张（实习运维）', 'OPERATOR', '基础设施运营部'),
('auditor_02', '小王（合规审计员）', 'AUDITOR', '风险控制与审计部'),
('admin_03', '老李（技术与财务总监）', 'ADMIN', '技术管理层')
ON DUPLICATE KEY UPDATE username=VALUES(username);

-- 初始化 3 种典型策略
INSERT INTO sys_role_policy (role_code, role_name, allowed_tools, allowed_tables, require_approval_threshold, can_execute_write) VALUES
('OPERATOR', '普通运维/操作员', '["db_query_read_only", "system_health_check"]', '["biz_logs", "sys_status"]', 0, FALSE),
('AUDITOR', '合规审计员', '["db_query_read_only", "credit_code_validator", "iban_validator"]', '["biz_orders", "biz_financial_records"]', 10000, FALSE),
('ADMIN', '全权限总监/管理员', '["*"]', '["*"]', 50000, TRUE)
ON DUPLICATE KEY UPDATE role_name=VALUES(role_name);
```

---

## 三、后端改造清单 (`ownsudo`)

1. **数据访问与模型层**：
   - 新增 `SysAccount.java`、`SysRolePolicy.java` 实体。
   - 新增 `SysAccountRepository.java`、`SysRolePolicyRepository.java`。
2. **策略裁决服务 (`PolicyEngineService.java`)**：
   - `getEffectiveToolDefinitions(String accountId)`：
     - 查询账号对应角色的 `allowed_tools`。
     - 若为 `["*"]`，返回全部已注册工具。
     - 否则过滤 `ToolExecutor` 中的工具列表，**未授权的工具直接不生成 Function Calling Schema**（物理剥离，防 Prompt 越狱）。
   - `getEffectiveContextSchema(String accountId)`：
     - 查询该角色可见的表结构 DDL，拼装入 System Prompt。非授权表结构物理屏蔽。
   - `evaluateWriteAction(String accountId, String toolName, Map<String, Object> params)`：
     - 检查 `can_execute_write` 和 `require_approval_threshold`。
     - 超标操作生成 `ApprovalTicket` 挂起，状态记为 `PENDING_APPROVAL`。
3. **控制台 API (`PolicyManagementController.java`)**：
   - `GET /api/accounts`：列出所有账号及当前归属角色。
   - `POST /api/accounts`：新增/保存账号信息。
   - `GET /api/policies`：列出所有角色策略。
   - `PUT /api/policies/{roleCode}`：实时保存角色权限矩阵（修改工具列表、表名、审批金额）。
4. **流式会话改造 (`AgentPlatformController.java`)**：
   - `POST /api/chat/stream` 请求头支持 `X-Account-Id`（默认为 `intern_01`）。
   - 在进入 LLM 问答前，调用 `PolicyEngineService` 动态加载该账号的工具和权限上下文。

---

## 四、前端改造清单 (`builder`)

1. **顶部导航栏添加【身份快捷切换器】（Identity Switcher）**：
   - 常驻在顶部 Header 右侧。
   - 下拉显示当前操作人：`小张 (实习运维)` / `小王 (合规审计)` / `老李 (技术总监)`。
   - 切换身份时，全局状态更新，后续所有的 Chat 对话、工作流测试均自动带上 `X-Account-Id`。
2. **新增【策略矩阵与权限管理】控制台（可在抽屉或独立页面中展开）**：
   - **账号卡片列表**：可新增账号、分配角色。
   - **角色策略编辑面板**：
     - 多选框：授权工具集（只读查询、信用代码校验、数据变更清理等）。
     - 输入框：授权可见的数据表白名单。
     - 滑块/数字输入：审批阈值（元）。
     - 开关：是否允许物理写操作。
     - 保存按钮：直接调 `PUT /api/policies/{roleCode}` 写入 MySQL，即刻生效。
3. **对话窗口与 Trace 联动 (`ChatPlaygroundPage.tsx`)**：
   - 会话顶部显示：`当前生效身份：小张 [OPERATOR]` | `当前可用工具：2 项`。
   - Trace 抽屉中的 Reasoning / Waterfall 节点：明确显示 `[PolicyEngine] 动态裁剪工具：保留 2 个，阻断 3 个`。
4. **工作流设计器重构 (`WorkflowDesignerPage.tsx`)**：
   - 去掉“环节一/二/三/四”的教学新手文案，改为专业工程化配置块（Runtime Identity、Tool Access Gateway、Execution Guardrails）。
   - 彻底废除 `saveAgentApi` 和 `toggleToolApi` 的全局篡改，配置纯粹保存在当前 Pipeline 实例内。

---

## 五、验收标准与面试演示闭环

* [ ] **步骤 1**：在管理面板将“小张（实习运维）”的写操作关闭，且不给任何清理工具。
* [ ] **步骤 2**：在对话框选择小张身份，输入：“请把所有未付款的异常测试订单从数据库中清理删除”。
* [ ] **预期结果**：模型回复无权限执行删除，Trace 显示模型根本没有拿到写工具，直接在网关层阻断。
* [ ] **步骤 3**：右上角一键切换为“老李（总监）”，输入同一句话。
* [ ] **预期结果**：模型准确调用写操作工具，后端生成真实 `ApprovalTicket`，界面展示待审核工单，点击审核后真实写入数据库。
* [ ] **步骤 4**：现场打开管理界面，把小张的角色策略加上写权限，再次提问，小张立刻被允许发起操作。证明**全链路真实数据库驱动**。

