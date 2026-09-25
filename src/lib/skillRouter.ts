/** 技能路由 — 聊天与技能管理共用的唯一决策函数，可注入任意技能目录做沙盘推演 */

import { allRunnableSkills, scoreSkillDetailed, type AgentSkill, type SkillDiscoveryRow } from "./agentSkills";
import { classifyCapability } from "./policyDesk";
import { matchKnowledgeSection } from "./ownKnowledge";
import { matchFaq, matchFaqLoose } from "../data/productFaq";

/** 资料库问答段优先，内置产品问答兜底 */
function matchProductQuestion(query: string): { q: string; score: number } | null {
  const kb = matchKnowledgeSection(query);
  const faq = matchFaq(query);
  if (kb && (!faq || kb.score >= faq.score)) return { q: kb.section.q, score: kb.score };
  return faq ? { q: faq.entry.q, score: faq.score } : null;
}

export const HEALTH_INTENT = /检查|正不正常|正常吗|能不能打开|打得开|探活|健康|体检|性能|ttfb|latency|加载慢|慢不慢|可用吗/i;
export const ABOUT_SITE_INTENT =
  /是干嘛|干嘛的|这是什么网站|这个网站是|看一下这个网站|看下这个网站|看一下这个站|本站是干嘛|这个站是/i;
export const KNOWLEDGE_INTENT = /介绍|讲讲|说说|了解一下|做过|简历|经历|背景|技术栈|项目|知识库|imean|ownagent|剑池|难点|挑战|架构/i;
export const URL_RE = /https?:\/\/[^\s)）"'<>]+/i;

export type RouteKind = "skill" | "open" | "knowledge" | "about-site";

export type RouteDecision = {
  kind: RouteKind;
  /** kind=skill 时为技能 id，否则为 null */
  skillId: string | null;
  skill?: AgentSkill;
  /** 给人看的去向，例如「发布前巡检」「开放工具（没有技能接手）」 */
  label: string;
  score: number;
  hits: string[];
  /** 为什么这样分，给人看 */
  rule: string;
  /** 触发词打分第一名与第二名的分差；第二名为 0 分时等于第一名分数 */
  margin: number;
  ranked: SkillDiscoveryRow[];
};

export const ROUTE_KIND_LABEL: Record<Exclude<RouteKind, "skill">, string> = {
  open: "开放工具（没有技能接手）",
  knowledge: "知识检索（没有技能接手）",
  "about-site": "本站介绍（没有技能接手）",
};

/** 路由去向的稳定 key：技能 id 或非技能分支名 */
export function routeKey(d: Pick<RouteDecision, "kind" | "skillId">): string {
  return d.kind === "skill" ? d.skillId! : `@${d.kind}`;
}

export function routeKeyLabel(key: string, catalog?: AgentSkill[]): string {
  if (key.startsWith("@")) return ROUTE_KIND_LABEL[key.slice(1) as Exclude<RouteKind, "skill">] ?? key;
  const s = (catalog ?? allRunnableSkills()).find((x) => x.id === key);
  return s ? skillLabel(s) : key;
}

export function skillLabel(s: Pick<AgentSkill, "name" | "description">): string {
  const head = s.description.split(/[—–\-]/)[0]?.trim();
  return head && head.length >= 2 && head.length <= 24 ? head : s.name;
}

export function rankSkills(query: string, catalog: AgentSkill[]): SkillDiscoveryRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return catalog.map((skill) => ({ skill, score: 0, hits: [], breakdown: [] }));
  return catalog.map((s) => scoreSkillDetailed(s, q)).sort((a, b) => b.score - a.score);
}

/**
 * 决策顺序：
 * 0. 与产品常见问题几乎一致（≥0.8）→ 产品客服；相近（≥0.6）则排在第 1 步之后
 * 1. 触发词强命中（≥2 分）且领先第二名 → 交给该技能（运维改说法能真正生效）
 * 2. 带网址 → 开放工具；健康/性能问法 → 站点分析；问本站 → 本站介绍；制度问法 → 制度值班；经历/项目 → 知识检索
 * 3. 触发词 ≥2 分但与其他技能打平 → 排序第一的技能
 * 4. 其余 → 开放工具
 */
export function routeQuery(query: string, catalog: AgentSkill[] = allRunnableSkills()): RouteDecision {
  const ranked = rankSkills(query, catalog);
  const top = ranked[0];
  const second = ranked[1];
  const margin = top ? top.score - (second?.score ?? 0) : 0;
  const find = (id: string) => catalog.find((s) => s.id === id);

  const toSkill = (skill: AgentSkill, rule: string, score: number, hits: string[]): RouteDecision => ({
    kind: "skill",
    skillId: skill.id,
    skill,
    label: skillLabel(skill),
    score,
    hits,
    rule,
    margin,
    ranked,
  });
  const toKind = (kind: Exclude<RouteKind, "skill">, rule: string): RouteDecision => ({
    kind,
    skillId: null,
    label: ROUTE_KIND_LABEL[kind],
    score: 0,
    hits: [],
    rule,
    margin,
    ranked,
  });

  const faqSkill = find("product-faq");
  const faq = faqSkill && !URL_RE.test(query) ? matchProductQuestion(query) : null;
  const toFaq = () => toSkill(faqSkill!, `内置规则：产品常见问题（像「${faq!.q}」，相似度 ${faq!.score.toFixed(2)}）`, 3, [faq!.q]);

  if (faq && faq.score >= 0.8) return toFaq();
  if (top && top.score >= 2 && margin >= 1) {
    return toSkill(top.skill, `命中说法：${top.hits.join("、")}`, top.score, top.hits);
  }
  if (faq) return toFaq();
  if (URL_RE.test(query)) return toKind("open", "带网址，且没有技能的说法明显命中");

  const health = find("site-analyzer");
  if (HEALTH_INTENT.test(query) && health) {
    return toSkill(health, "内置规则：检查 / 性能类问法", 2, ["health-intent"]);
  }
  if (ABOUT_SITE_INTENT.test(query)) return toKind("about-site", "内置规则：问这个网站是什么");

  const policy = find("policy-desk");
  const cap = classifyCapability(query);
  if (cap.matched && policy) return toSkill(policy, `内置规则：制度类问法（${cap.cap}）`, 3, [cap.cap]);

  if (KNOWLEDGE_INTENT.test(query)) return toKind("knowledge", "内置规则：经历 / 项目类问法");

  if (top && top.score >= 2) {
    return toSkill(top.skill, `命中说法：${top.hits.join("、")}（与其他技能打平，按排序取第一）`, top.score, top.hits);
  }
  const near = faqSkill && !URL_RE.test(query) ? matchFaqLoose(query) : null;
  if (near) {
    return toSkill(faqSkill!, `内置规则：没有更合适的去向，按最接近的产品问题「${near.entry.q}」作答`, 1, [near.entry.q]);
  }
  return toKind("open", top?.score ? `说法只命中 ${top.score} 分，不够 2 分` : "没有命中任何技能的说法");
}
