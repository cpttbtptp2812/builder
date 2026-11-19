export type RealityAdapterKind = "git" | "browser" | "retrieval" | "code" | "approval" | "agent" | "terminal" | "model" | "generic";

const isObject = (value: unknown): value is Record<string, any> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const readPath = (source: unknown, path: string): any => {
  if (!isObject(source)) return undefined;
  if (source[path] !== undefined && source[path] !== null && source[path] !== "") return source[path];
  return path.split(".").reduce<any>((value, key) =>
    value !== null && value !== undefined ? value[key] : undefined, source);
};

/** Read both flattened OTel attributes and nested JSON representations. */
export function readRealityAttribute(detail: any, keys: string[]): any {
  const candidates = [
    detail,
    detail?.attributes,
    detail?.rightDetail,
    detail?.rightDetail?.attributes,
    detail?.data,
    detail?.data?.attributes,
  ];
  for (const key of keys) {
    for (const candidate of candidates) {
      const value = readPath(candidate, key);
      if (value !== undefined) return value;
    }
  }
  return undefined;
}

export function parseRealityPayload(value: any): any {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed || (trimmed[0] !== "[" && trimmed[0] !== "{")) return value;
  try { return JSON.parse(trimmed); } catch { return value; }
}

export function toRealityMessageList(value: any): any[] | undefined {
  const parsed = parseRealityPayload(value);
  if (Array.isArray(parsed)) return parsed;
  if (isObject(parsed)) return [parsed];
  return undefined;
}

export function realityMessageText(message: any): string {
  if (typeof message === "string") return message;
  if (isObject(message)) {
    if (typeof message.content === "string") return message.content;
    if (typeof message.text === "string") return message.text;
    if (Array.isArray(message.content)) {
      return message.content.map((part: any) => part?.text ?? part?.content ?? "").filter(Boolean).join("\n");
    }
    if (Array.isArray(message.parts)) {
      return message.parts.map((part: any) => part?.text ?? part?.content ?? "").filter(Boolean).join("\n");
    }
  }
  try { return JSON.stringify(message, null, 2); } catch { return String(message ?? ""); }
}

const toolVerbs: Array<[RegExp, string]> = [
  [/^(get|read|fetch|load|retrieve)_/, "读取"],
  [/^(search|find|query)_/, "搜索"],
  [/^(list|enumerate)_/, "列出"],
  [/^(create|add|new)_/, "创建"],
  [/^(update|edit|modify|patch)_/, "修改"],
  [/^(delete|remove|drop)_/, "删除"],
  [/^(execute|run|invoke)_/, "执行"],
  [/^(send|submit|post)_/, "提交"],
  [/^(check|validate|verify)_/, "检查"],
];

const knownToolLabels: Record<string, string> = {
  get_git_repo_status: "检查仓库状态",
  get_git_commit_history: "读取提交历史",
  get_git_diff: "查看代码改动",
  get_git_file: "读取项目文件",
  search_code: "搜索代码",
};

export function formatRealityActionLabel(name: string): string {
  if (!name) return "Agent 行动";
  if (knownToolLabels[name]) return knownToolLabels[name];
  const normalized = name.toLowerCase().replace(/[.\\/-]+/g, "_");
  const match = toolVerbs.find(([pattern]) => pattern.test(normalized));
  const remainder = match ? normalized.replace(match[0], "") : normalized;
  const readable = remainder.split("_").filter(Boolean).join(" ");
  return match ? match[1] + readable : readable.charAt(0).toUpperCase() + readable.slice(1);
}

export function classifyRealityAdapter(input: {
  tool?: string;
  operation?: string;
  title?: string;
  phase?: string;
}): RealityAdapterKind {
  const name = [input.tool, input.operation, input.title].filter(Boolean).join(" ").toLowerCase();
  if (/git|github|commit|branch|repository/.test(name)) return "git";
  if (/browser|playwright|navigate|click|screenshot|computer/.test(name)) return "browser";
  if (/file|code|diff|edit|write|patch/.test(name)) return "code";
  if (/retriev|search|knowledge|vector|embedding|citation|rag/.test(name) || input.phase === "context") return "retrieval";
  if (/approv|permission|policy|risk|authorize/.test(name)) return "approval";
  if (/agent|delegate|handoff|transfer/.test(name)) return "agent";
  if (/terminal|shell|command|exec/.test(name)) return "terminal";
  if (/chat|inference|generate_content|invoke_model|model_call|llm/.test(name) || input.phase === "llm") return "model";
  return "generic";
}

/** Convert common structured tool results into concise, factual UI copy. */
export function summarizeRealityResult(value: any): string {
  if (value === undefined || value === null) return "执行端尚未提供结果";
  if (typeof value === "string") return value.length > 180 ? value.slice(0, 180) + "…" : value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.length ? `返回 ${value.length} 项数据` : "返回空列表";
  if (value.success === false || value.ok === false) return String(value.error || value.message || "操作未成功");
  const data = isObject(value.data) ? value.data : value;
  const parts: string[] = [];
  const repository = data.repository || data.repoName || data.repo_name;
  const branch = data.branch || data.ref;
  if (repository) parts.push(`仓库：${repository}`);
  if (branch) parts.push(`分支：${branch}`);
  if (typeof data.clean === "boolean") parts.push(data.clean ? "工作区干净" : "存在未提交修改");
  if (Array.isArray(data.commits)) parts.push(`读取到 ${data.commits.length} 条提交记录`);
  if (Array.isArray(data.files) || Array.isArray(data.changedFiles)) parts.push(`涉及 ${(data.files || data.changedFiles).length} 个文件`);
  if (typeof data.count === "number") parts.push(`共 ${data.count} 项`);
  if (typeof data.total === "number") parts.push(`共 ${data.total} 项`);
  if (typeof data.status === "string") parts.push(`状态：${data.status}`);
  if (typeof data.message === "string" && parts.length < 2) parts.push(data.message);
  if (parts.length) return parts.slice(0, 3).join(" · ");
  if (value.success === true || value.ok === true) return String(value.message || "操作成功，执行端已确认");
  return `已收到执行结果（${Object.keys(value).length} 个字段）`;
}
