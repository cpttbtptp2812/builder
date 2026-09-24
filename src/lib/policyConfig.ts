import type { Capability, PolicyClause } from "./policyDesk";
import { POLICY_HANDBOOK } from "./policyDesk";

export type PolicyRuleRow = {
  id: string;
  label: string;
  enabled: boolean;
  cap: Capability;
  /** 每行一条关键词，匹配问句即触发 */
  keywords: string;
  reason: string;
  topic?: PolicyClause["topic"];
};

export type PolicySettings = {
  requireCitation: boolean;
  requireHitlForMutate: boolean;
  refuseMessage: string;
  rules: PolicyRuleRow[];
};

const CONFIG_KEY = "ownagent-policy-settings";
const HANDBOOK_KEY = "ownagent-policy-handbook";

export const DEFAULT_POLICY_RULES: PolicyRuleRow[] = [
  {
    id: "refuse-offtopic",
    label: "拒绝无关问题",
    enabled: true,
    cap: "abstain",
    keywords: "上市\n天气\n股价\n几点了\n今天星期",
    reason: "不在资料范围内，拒绝编造",
  },
  {
    id: "mutate-ticket",
    label: "敏感操作走工单",
    enabled: true,
    cap: "mutate",
    keywords: "开通\nvpn\n换电脑\n更换设备\n改权限\n蓝屏\n重置密码",
    reason: "会改动系统，只生成工单等人工批准",
    topic: "vpn",
  },
  {
    id: "read-leave",
    label: "年假 / 休假",
    enabled: true,
    cap: "read",
    keywords: "年假\n休假\n请假",
    reason: "制度问答 · 年假",
    topic: "leave",
  },
  {
    id: "read-overtime",
    label: "加班制度",
    enabled: true,
    cap: "read",
    keywords: "加班",
    reason: "制度问答 · 加班",
    topic: "overtime",
  },
  {
    id: "read-reimburse",
    label: "报销制度",
    enabled: true,
    cap: "read",
    keywords: "报销",
    reason: "制度问答 · 报销",
    topic: "reimburse",
  },
  {
    id: "read-general",
    label: "通用制度",
    enabled: true,
    cap: "read",
    keywords: "制度\n手册\n工单",
    reason: "制度问答",
  },
];

export const DEFAULT_POLICY_SETTINGS: PolicySettings = {
  requireCitation: true,
  requireHitlForMutate: true,
  refuseMessage: "这个问题不在资料范围内，我无法编造答案。请换一个问题，或联系管理员补充资料。",
  rules: DEFAULT_POLICY_RULES,
};

function readJson<T>(key: string): T | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

export function loadPolicySettings(): PolicySettings {
  const saved = readJson<Partial<PolicySettings>>(CONFIG_KEY);
  if (!saved) return structuredClone(DEFAULT_POLICY_SETTINGS);
  return {
    requireCitation: saved.requireCitation ?? DEFAULT_POLICY_SETTINGS.requireCitation,
    requireHitlForMutate: saved.requireHitlForMutate ?? DEFAULT_POLICY_SETTINGS.requireHitlForMutate,
    refuseMessage: saved.refuseMessage?.trim() || DEFAULT_POLICY_SETTINGS.refuseMessage,
    rules: mergeRules(saved.rules),
  };
}

function mergeRules(saved?: PolicyRuleRow[]): PolicyRuleRow[] {
  if (!saved?.length) return structuredClone(DEFAULT_POLICY_RULES);
  const byId = new Map(saved.map((r) => [r.id, r]));
  return DEFAULT_POLICY_RULES.map((def) => {
    const hit = byId.get(def.id);
    if (!hit) return { ...def };
    return {
      ...def,
      ...hit,
      keywords: hit.keywords ?? def.keywords,
      reason: hit.reason?.trim() || def.reason,
      label: hit.label?.trim() || def.label,
    };
  });
}

export function savePolicySettings(settings: PolicySettings) {
  writeJson(CONFIG_KEY, settings);
}

export function resetPolicySettings() {
  if (typeof localStorage !== "undefined") localStorage.removeItem(CONFIG_KEY);
}

export function loadPolicyHandbook(): PolicyClause[] {
  const saved = readJson<PolicyClause[]>(HANDBOOK_KEY);
  if (!saved?.length) return [...POLICY_HANDBOOK];
  return saved;
}

export function savePolicyHandbook(clauses: PolicyClause[]) {
  writeJson(HANDBOOK_KEY, clauses);
}

export function resetPolicyHandbook() {
  if (typeof localStorage !== "undefined") localStorage.removeItem(HANDBOOK_KEY);
}

export function keywordsToPatterns(keywords: string): RegExp[] {
  return keywords
    .split(/\n|,|，/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((part) => {
      try {
        return new RegExp(part, "i");
      } catch {
        return new RegExp(part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      }
    });
}

export function matchPolicyRules(query: string, settings = loadPolicySettings()) {
  const q = query.trim();
  for (const rule of settings.rules) {
    if (!rule.enabled) continue;
    const patterns = keywordsToPatterns(rule.keywords);
    if (patterns.some((re) => re.test(q))) {
      return {
        cap: rule.cap,
        matched: true,
        reason: rule.reason,
        topic: rule.topic,
        ruleId: rule.id,
        ruleLabel: rule.label,
      };
    }
  }
  return {
    cap: "read" as Capability,
    matched: false,
    reason: "未命中任何规则，按普通问答处理",
    ruleId: null as string | null,
    ruleLabel: null as string | null,
  };
}
