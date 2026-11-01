// 平台全局通用类型定义

export type NavTab = "chat" | "agents" | "knowledge" | "tools" | "logs" | "settings" | "workflows";

export type StepActionType =
  | "INPUT_EXTRACT"   // 字段映射与数据提取
  | "RULE_CHECK"      // 规则计算与判断
  | "HTTP_TOOL"       // 外部 API / 接口调用
  | "HITL_APPROVAL"   // 人工安全审批与复核
  | "LLM_REDUCE";     // 大模型总结与结果输出

export interface PipelineStep {
  id: string;
  name: string;
  type: StepActionType;
  description?: string;
  config: {
    fields?: string;
    maskSensitive?: boolean;
    ruleExpr?: string;
    apiUrl?: string;
    apiMethod?: "GET" | "POST" | "PUT";
    apiHeaders?: string;
    apiBodyTemplate?: string;
    approverRole?: string;
    timeoutSeconds?: number;
    outputFormat?: "STREAM_TEXT" | "JSON" | "TABLE";
  };
}

export interface McpServerTool {
  name: string;
  description: string;
  enabled: boolean;
}

export interface McpServerConfig {
  id: string;
  name: string;
  description: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  transport?: "stdio" | "sse" | "http";
  enabled: boolean;
  tools?: McpServerTool[];
  status?: "connected" | "disconnected" | "standby";
  type?: "feishu" | "dingtalk" | "wechat" | "custom_mcp" | "git_pr" | "email";
  webhookUrl?: string;
  secretToken?: string;
  decisionMode?: "ai_adaptive" | "always_exec" | "p0_only";
  triggerCondition?: "p0_only" | "p0_p1" | "all";
}

export interface AgentSkillConfig {
  id: string;
  name: string;
  description: string;
  icon?: string;
  enabled: boolean;
  triggerRule?: string;
  promptInstruction: string;
  parametersSchema?: string;
  category?: string;
}

export interface ContextVariable {
  key: string;
  name: string;
  example: string;
  description: string;
}

export interface PromptSuggestionItem {
  id: string;
  label: string;
  prompt: string;
  category: string;
  enabled: boolean;
  icon?: string;
  executionMode?: "chat" | "pipeline" | "silent";
  toolPermission?: "readonly" | "sandbox" | "sudo";
  injectDiff?: boolean;
  contextRounds?: "single" | "recent3" | "all";
  preferredModel?: string;
  temperature?: number;
  enableThinking?: boolean;
  riskAction?: "warn" | "block_pr" | "webhook";
}

export interface AgentPromptConfig {
  systemPrompt: string;
  persona: string;
  greetingMessage?: string;
  scenarioId?: string;
  suggestions?: PromptSuggestionItem[];
  variables?: ContextVariable[];
  safetyRules?: string[];
  userPromptTemplate?: string;
}

export interface AgentModelConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  modePreset: "developer" | "reviewer" | "release" | "custom";
}

export interface GitRepositoryConfig {
  id?: string;                      // 仓库唯一标识，如 repo-frontend
  name?: string;                    // 仓库业务名称，如 前端核心工程 (frontend-web)
  repoUrl: string;                  // Git 仓库远程地址
  branch: string;                   // 监控目标分支，如 main, dev, release/v2.1
  authType: "token" | "ssh" | "none"; // 认证方式
  accessToken?: string;             // GitHub / GitLab Access Token
  sshKey?: string;                  // SSH 私钥
  localPath?: string;               // 本地代码仓库物理路径
  pollingIntervalMinutes: number;   // 检查频率（分钟）
  autoAnalyzeCommit: boolean;       // 每次新提交自动代码体检
  enabled?: boolean;                // 是否开启监控
  watchEvents?: {
    push: boolean;                  // 监控 Push
    pullRequest: boolean;           // 监控 PR
    tagCreate: boolean;             // 监控 Tag
  };
  lastCommitSha?: string;           // 最近一次提交 SHA
  lastCommitMessage?: string;       // 最近一次提交说明
  lastCommitAuthor?: string;        // 最近一次提交人
  lastCommitTime?: string;          // 最近一次提交时间
  filesCount?: number;              // 改动文件数
  healthStatus?: "healthy" | "warning" | "error"; // 健康状态
  healthMessage?: string;           // 质检概况说明
  status: "connected" | "disconnected" | "connecting" | "error";
  errorMsg?: string;
}

export interface PipelineItem {
  id: string;
  name: string;
  description: string;
  category: string;
  badge: string;
  icon?: string;
  promptTemplate: string;
  tags: string[];
  version?: string;
  enabled: boolean;
  sortOrder?: number;
  updatedAt?: string;
  topologyJson?: string;
  steps?: PipelineStep[];
  agentId?: string;
  mcpServers?: McpServerConfig[];
  skills?: AgentSkillConfig[];
  promptConfig?: AgentPromptConfig;
  modelConfig?: AgentModelConfig;
  gitConfig?: GitRepositoryConfig;
  gitRepositories?: GitRepositoryConfig[];
}

export interface AgentItem {
  id: string;
  name: string;
  description: string;
  avatarColor: string;
  model: string;
  temperature: number;
  systemPrompt: string;
  toolsCount: number;
  kbCount: number;
  enableMemory: boolean;
  status: "PUBLISHED" | "DRAFT" | "OFFLINE";
  updatedAt: string;
}

export interface KnowledgeDocument {
  id: string;
  name: string;
  size: string;
  chunks: number;
  status: "READY" | "INDEXING" | "FAILED";
  updatedAt: string;
  type: "pdf" | "md" | "txt" | "xlsx";
}

export interface ToolItem {
  id: string;
  name: string;
  displayName: string;
  desc: string;
  category: "SYSTEM" | "BUSINESS" | "EXTERNAL";
  isEnabled: boolean;
  paramsSchema: string;
}

export interface AuditLogItem {
  id: string;
  time: string;
  agentName: string;
  eventType: string;
  toolName?: string;
  parameters?: string;
  model: string;
  duration: string;
  tokensIn: number;
  tokensOut: number;
  isRealUsage?: boolean;
  status: "SUCCESS" | "FAILED" | "TIMEOUT" | "ABORTED";
}

// ══════════════ 工作流运行时与瀑布流类型 ══════════════

export interface WorkflowInstanceData {
  id: string;
  workflowId: string;
  status: "RUNNING" | "SUSPENDED_APPROVAL" | "COMPLETED" | "FAILED" | "REJECTED_ROLLED_BACK";
  triggeredBy: string;
  startedAt: string;
  finishedAt?: string;
  currentNodeId?: string;
  inputParams?: string;
}

export interface NodeExecutionData {
  id: string;
  instanceId: string;
  nodeId: string;
  nodeName: string;
  nodeType: string;
  status: "RUNNING" | "SUCCESS" | "FAILED" | "BLOCKED" | "COMPENSATED";
  outputPayload?: string;
  startedAt?: string;
  endedAt?: string;
  latencyMs?: number;
  costTokens?: number;
}

export interface ApprovalTicketData {
  id: string;
  instanceId: string;
  nodeId: string;
  policyLevel: string;
  riskScore: number;
  operationSummary: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  operatorId?: string;
  auditReason?: string;
  signatureHash?: string;
  decidedAt?: string;
}

export interface WorkflowEventMessageData {
  eventType: string;
  instanceId: string;
  nodeId?: string;
  nodeName?: string;
  nodeType?: string;
  status?: string;
  payload?: any;
  timestamp?: number;
}

export const DEFAULT_ENTERPRISE_WORKFLOWS: PipelineItem[] = [
  {
    id: "wf-git-agent",
    name: "Git 仓库实时监控与代码智能体",
    category: "研发效能",
    badge: "Git 监控智能体",
    icon: "GitBranch",
    description: "配置 Git 仓库地址后，智能体在对话中实时解析代码库状态，自动监控每次 Commit 与改动，深度排查代码 Bug、安全漏洞与潜在合并隐患。",
    tags: ["Git 监控", "仓库凭证配置", "视觉排查", "安全漏洞", "协同任务"],
    promptTemplate: "请检查当前监控的 Git 仓库（分支：main），分析最新一次提交改动了哪些文件，评估是否存在潜在的代码 Bug、死锁或安全隐患，并输出体检报告。",
    version: "v1.2.0",
    enabled: true,
    sortOrder: 1,
    updatedAt: "刚刚",
    gitRepositories: [],
    modelConfig: {
      model: "Claude 3.5 Sonnet",
      temperature: 0.2,
      maxTokens: 4096,
      topP: 0.95,
      modePreset: "developer",
    },
    promptConfig: {
      persona: "Git 仓库专属智能守望官与代码架构师。专注于实时监控 Git 仓库分支动态、代码提交与 PR 合并，随时在对话中解答用户对代码库状态的提问，发现潜在 Bug 与安全隐患第一时间预警。",
      systemPrompt: `你是一名企业级 Git 仓库智能守望官与代码架构师。
用户已配置了指定的 Git 仓库（{{repo_url}}，分支：{{branch}}）。
你的职责是协助用户在对话中全面了解 Git 仓库的一切情况：
1. 响应用户针对 Git 仓库的提问（如查询最新提交、对比代码改动、统计提交频率与分支状态）；
2. 针对 Git 每次提交（Commit）或改动（Diff），深度分析代码是否存在逻辑漏洞、空指针、未处理异常、并发死锁或敏感信息泄露；
3. 当用户询问“当前代码库有什么问题”时，调用 MCP 工具获取最近提交与代码差异，给出清晰的健康度评级与行级修复建议；
4. 严禁执行不可逆的高危指令（如 git push --force），在分支合并前主动提示潜在代码冲突。`,
      variables: [
        { key: "repo_url", name: "仓库地址", example: "https://github.com/ownagent/backend-service.git", description: "当前监控的 Git 远程或本地仓库地址" },
        { key: "branch", name: "监控分支", example: "main", description: "当前监听的目标分支" },
        { key: "latest_commit", name: "最新提交", example: "c83f12a (feat: token refresh)", description: "最近一次提交记录及说明" },
        { key: "git_diff", name: "最新代码改动", example: "diff --git a/src/auth.ts...", description: "最近提交的代码变更差异" },
        { key: "author_name", name: "提交作者", example: "Engineer <eng@ownagent.io>", description: "提交人名称与邮箱" },
      ],
      safetyRules: [
        "严禁执行 git push --force 或分支强行删除指令",
        "自动拦截明文 API Key、密码与私钥文件泄露",
        "提交说明必须清晰阐述改动动机，拒绝泛义词 (如 'fix', 'update')",
        "检测到合并冲突时必须标出冲突文件并给出解冲突建议",
      ],
      userPromptTemplate: "请检查当前监控的 Git 仓库（{{repo_url}}，分支：{{branch}}），分析最新代码改动是否存在 Bug 或安全风险？",
    },
    mcpServers: [
      {
        id: "mcp-git-local",
        name: "git-mcp-server",
        description: "本地 Git 版本控制系统 MCP 桥接服务，支持仓库状态检视与受控提交操作",
        command: "npx -y @modelcontextprotocol/server-git",
        args: ["--repository", "./"],
        env: { GIT_TERMINAL_PROMPT: "0" },
        transport: "stdio",
        enabled: true,
        status: "connected",
        tools: [
          { name: "git_status", description: "获取工作区与暂存区文件变动状态", enabled: true },
          { name: "git_diff", description: "提取工作区或暂存区的代码差异", enabled: true },
          { name: "git_commit", description: "按标准提交信息执行 commit 操作", enabled: true },
          { name: "git_branch", description: "列出、创建或切换本地分支", enabled: true },
          { name: "git_log", description: "检索最近提交记录及图谱信息", enabled: true },
        ],
      },
      {
        id: "mcp-github-remote",
        name: "github-mcp",
        description: "GitHub / GitLab 远程代码协同 MCP 协议服务，支持 PR 自动创建与行级审查",
        command: "npx -y @modelcontextprotocol/server-github",
        args: [],
        env: { GITHUB_PERSONAL_ACCESS_TOKEN: "ghp_secure_credential_token" },
        transport: "stdio",
        enabled: true,
        status: "connected",
        tools: [
          { name: "pr_create", description: "自动根据分支差异创建 Pull Request", enabled: true },
          { name: "pr_review", description: "对代码变更提交行级评审与审核决议", enabled: true },
          { name: "issue_comment", description: "在关联需求 Issue 中记录协同日志", enabled: true },
        ],
      },
      {
        id: "mcp-filesystem",
        name: "filesystem-mcp",
        description: "受控工作区安全文件系统服务，仅限受检代码工程目录的读写访问",
        command: "npx -y @modelcontextprotocol/server-filesystem",
        args: ["./src"],
        transport: "stdio",
        enabled: true,
        status: "connected",
        tools: [
          { name: "read_file", description: "读取指定代码文件全文内容", enabled: true },
          { name: "list_directory", description: "列出目录下的代码文件树", enabled: true },
          { name: "search_files", description: "在代码库中基于正则搜索符号或关键词", enabled: true },
        ],
      },
      {
        id: "mcp-terminal-sandbox",
        name: "terminal-sandbox-mcp",
        description: "只读命令沙箱环境，支持代码静态扫描与单元测试套件安全触发",
        command: "sandbox-exec --profile=git-only",
        args: [],
        transport: "stdio",
        enabled: false,
        status: "standby",
        tools: [
          { name: "run_linter", description: "执行 eslint / checkstyle 静态合规扫描", enabled: true },
          { name: "run_unit_test", description: "执行关联变更的单元测试", enabled: true },
        ],
      },
    ],
    skills: [
      {
        id: "skill-commit-linter",
        name: "Conventional Commits 自动规范质检",
        description: "基于 Angular/Conventional Commits 工业规范，严格检查提交信息前缀、动词时态与字符长度限制，并智能输出纠错建议。",
        icon: "CheckSquare",
        enabled: true,
        triggerRule: "git commit / 提交说明质检",
        category: "规范质检",
        promptInstruction: "强校验提交信息格式：<type>(<scope>): <subject>。type 必须为 feat/fix/docs/refactor/perf/test/chore 之一，首行不超过 72 字符，禁止句末标点。",
      },
      {
        id: "skill-conflict-resolver",
        name: "代码合并冲突智能研判与解冲突方案推荐",
        description: "当检测到 <<<<<<< HEAD 冲突标记时，智能对比三方祖先版本语义，分析业务意图差异，给出无损合并代码与回归验证建议。",
        icon: "GitMerge",
        enabled: true,
        triggerRule: "检测到 Git 冲突标记时自动触发",
        category: "冲突消解",
        promptInstruction: "提取 Base、Ours、Theirs 三方片段，辨识双方对同一逻辑的演进诉求，生成不丢弃任何业务逻辑的合并结果。",
      },
      {
        id: "skill-pr-review-expert",
        name: "代码变更安全与质量深度代码审查",
        description: "深度审查代码变更，定位潜在安全漏洞（硬编码凭证、SQL 注入、XSS）、未捕获并发竞态与圈复杂度过高问题。",
        icon: "ShieldAlert",
        enabled: true,
        triggerRule: "pr review / 代码审查 / 提交前质检",
        category: "代码审查",
        promptInstruction: "逐行审查变更文件，针对并发安全性、异常处理完备性、内存泄漏及代码清晰度提出具体的修复代码建议。",
      },
      {
        id: "skill-changelog-generator",
        name: "版本发布日志与 Release Note 自动萃取",
        description: "遍历两 Tag 之间的 Git 提交历史，按特性 (Features)、修复 (Fixes) 与破坏性变更智能归类，输出精美 Markdown 发布简报。",
        icon: "FileText",
        enabled: true,
        triggerRule: "/changelog / 生成发布日志",
        category: "发布自动化",
        promptInstruction: "汇总指定区间 Git Log，剥离琐碎 chore 提交，按用户视角提炼重点更新，生成规范的 Keep a Changelog 格式日志。",
      },
      {
        id: "skill-branch-standard",
        name: "分支命名与生命周期规范核验",
        description: "检查新建分支是否遵循 feature/xxx, hotfix/xxx, release/xxx 规范，并智能绑定关联的 Jira/工单编号。",
        icon: "GitBranch",
        enabled: true,
        triggerRule: "新建分支 / checkout -b",
        category: "分支管理",
        promptInstruction: "校验分支命名合规度，未绑定工单时发出提醒，推荐标准规范命名的分支名。",
      },
    ],
    steps: [
      {
        id: "step-git-diff",
        name: "1. 本地代码差异与状态感知 (MCP Git Diff)",
        type: "INPUT_EXTRACT",
        description: "调用 git-mcp-server 提取暂存区代码变动、变动文件清单与当前分支基线",
        config: {
          fields: "repo_name, branch_name, changed_files, diff_content",
          maskSensitive: true,
          outputFormat: "JSON",
        },
      },
      {
        id: "step-git-linter",
        name: "2. Conventional Commits 规范与安全合规核查 (Skill Linter)",
        type: "RULE_CHECK",
        description: "搭载 Commit Linter 技能库与合规规则，核验提交格式、硬编码凭证与高危改动",
        config: {
          ruleExpr: "no_secret_leaks == true && commit_format_valid == true",
          timeoutSeconds: 5,
        },
      },
      {
        id: "step-git-conflict",
        name: "3. 代码变更冲突研判与风险评级",
        type: "RULE_CHECK",
        description: "研判目标分支合并状态，若存在冲突或破坏性变更则自动评定风险等级并推荐解冲突方案",
        config: {
          ruleExpr: "breaking_changes_detected == false",
          timeoutSeconds: 10,
        },
      },
      {
        id: "step-git-hitl",
        name: "4. 关键分支合并人工复核闸口 (HITL Approval)",
        type: "HITL_APPROVAL",
        description: "涉及生产环境或 release/main 分支变更时，挂起等待技术主管或代码评审员人工复核授权",
        config: {
          approverRole: "架构师 / 技术主管",
          timeoutSeconds: 1800,
        },
      },
      {
        id: "step-git-publish",
        name: "5. 结构化提交生成与发布归档 (MCP Push & LLM Reduce)",
        type: "HTTP_TOOL",
        description: "经由受控审批后生成规范化提交并写入 Git 日志，同步更新全链路审计记录",
        config: {
          apiUrl: "/api/tools/execute",
          apiMethod: "POST",
          timeoutSeconds: 15,
        },
      },
    ],
  },
  {
    id: "wf-data-analytics",
    name: "企业全域数据清洗与智能分析流",
    category: "数据智能",
    badge: "生产流水线",
    icon: "Database",
    description: "面向企业核心运营与财务数据的端到端智能流水线，涵盖多源数据抽取脱敏、合规性清洗与阈值校验、高风险账目人工校验复核，以及大模型智能 BI 指标分析与决策简报生成。",
    tags: ["数据清洗", "脱敏规则", "规则合规", "BI 分析", "审计存证"],
    promptTemplate: "请提取本期财务与业务流水数据，校验金额阈值与合规性规则，调用 SQL 聚合工具计算指标，并生成结构化分析总结报告。",
    version: "v2.0.0",
    enabled: true,
    sortOrder: 2,
    updatedAt: "刚刚",
    modelConfig: {
      model: "Claude 3.5 Sonnet",
      temperature: 0.1,
      maxTokens: 4096,
      topP: 0.9,
      modePreset: "reviewer",
    },
    promptConfig: {
      persona: "企业级商业智能分析师与数据合规专家，精通数据清洗、合规风控模型与经营指标诊断。",
      systemPrompt: `你是一名企业数据清洗与经营分析专家。
你的职责是处理企业级多源结构化数据流水：
1. 提取核心字段（经办人、费用类别、金额、归属部门），执行严格数据脱敏；
2. 依据企业合规阈值标准核查异常动资；
3. 调用 SQL 计算分析工具完成指标聚合；
4. 输出包含核心洞察与风险提示的结构化经营简报。`,
      variables: [
        { key: "dataset_name", name: "数据集名称", example: "finance_q4_stream", description: "当前接入的数据集标识" },
        { key: "audit_threshold", name: "核查阈值", example: "50000", description: "高风险动资告警阈值" },
        { key: "department", name: "归属部门", example: "研发中心", description: "申请或支出部门" },
      ],
      safetyRules: [
        "身份证、银行账号等个人敏感数据必须执行加盐脱敏",
        "单笔金额超过限额时必须强行挂起进入人工审批流程",
        "禁止执行带有删除或表结构修改的 SQL 脚本",
      ],
      userPromptTemplate: "请清洗并分析数据集 {{dataset_name}}，核对金额是否超额，并生成可视化经营分析报告。",
    },
    mcpServers: [
      {
        id: "mcp-bi-db",
        name: "database-analytics-mcp",
        description: "企业只读分析数据库连接服务，支持指标聚合与统计查询",
        command: "npx -y @modelcontextprotocol/server-postgres",
        args: ["postgresql://readonly@bi-db:5432/analytics"],
        transport: "stdio",
        enabled: true,
        status: "connected",
        tools: [
          { name: "execute_query", description: "执行只读 SQL 统计聚合语句", enabled: true },
          { name: "describe_table", description: "获取数据表元数据结构", enabled: true },
        ],
      },
    ],
    skills: [
      {
        id: "skill-data-cleanser",
        name: "多源脏数据清洗与异常值过滤",
        description: "自动识别缺失值、离群点与格式错位，采用行业通用插补与正则规整算法清洗原始流水。",
        icon: "Sparkles",
        enabled: true,
        triggerRule: "数据导入与清洗",
        category: "数据治理",
        promptInstruction: "严格校验时间格式、货币单位与枚举字段，自动标出离群值并生成清洗报告。",
      },
      {
        id: "skill-bi-synthesizer",
        name: "经营指标多维归因与趋势分析",
        description: "针对营收、成本与利润指标计算环比与同比变动，定位关键波动归因因子。",
        icon: "Activity",
        enabled: true,
        triggerRule: "生成经营分析报告",
        category: "经营分析",
        promptInstruction: "提取关键 KPI 指标，按照经营决策视角组织文字，输出要点摘要与整改建议。",
      },
    ],
    steps: [
      {
        id: "step-data-extract",
        name: "1. 多源业务流水提取与字段脱敏",
        type: "INPUT_EXTRACT",
        description: "从原始数据流中提取 applicant, amount, category 等关键维度并实施合规脱敏",
        config: {
          fields: "applicant, amount, category, dept",
          maskSensitive: true,
          outputFormat: "JSON",
        },
      },
      {
        id: "step-data-rule",
        name: "2. 财务合规阈值与风控规则核查",
        type: "RULE_CHECK",
        description: "比对企业财务制度规约，核验单笔及累计开支限额标准",
        config: {
          ruleExpr: "amount <= 50000",
          timeoutSeconds: 5,
        },
      },
      {
        id: "step-data-hitl",
        name: "3. 大额超限资金人工复核闸口",
        type: "HITL_APPROVAL",
        description: "若单笔金额超标或跨科目支出，自动阻断并提交财务主管人工签字审批",
        config: {
          approverRole: "财务总监 / 风控合规官",
          timeoutSeconds: 3600,
        },
      },
      {
        id: "step-data-sql",
        name: "4. 数据库分析工具计算与聚合",
        type: "HTTP_TOOL",
        description: "调用受控 SQL 分析工具在隔离沙箱中执行指标聚合计算",
        config: {
          apiUrl: "/api/tools/execute",
          apiMethod: "POST",
          timeoutSeconds: 15,
        },
      },
      {
        id: "step-data-report",
        name: "5. 智能经营分析简报生成与存证",
        type: "LLM_REDUCE",
        description: "大模型汇总分析图谱，生成结构化经营决策简报并落库防篡改审计存证",
        config: {
          outputFormat: "STREAM_TEXT",
        },
      },
    ],
  },
];
