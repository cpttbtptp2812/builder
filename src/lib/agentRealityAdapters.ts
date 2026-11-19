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
  kind?: string;
}): RealityAdapterKind {
  // Specialized views require explicit semantic evidence, never title keywords.
  const explicitKind = String(input.kind ?? "").toLowerCase();
  const knownKinds: RealityAdapterKind[] = ["git", "browser", "retrieval", "code", "approval", "agent", "terminal", "model"];
  if (knownKinds.includes(explicitKind as RealityAdapterKind)) return explicitKind as RealityAdapterKind;
  if (input.operation && ["chat", "completion", "generate_content", "embeddings"].includes(input.operation.toLowerCase())) return "model";
  return "generic";
}

/** Preserve the actual returned value; never convert arbitrary JSON into claims. */
export function summarizeRealityResult(value: any): string {
  if (value === undefined || value === null) return "未上报";
  if (typeof value === "string") return value.length > 180 ? value.slice(0, 180) + "…" : value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try { return JSON.stringify(value, null, 2); }
  catch { return String(value); }
}
