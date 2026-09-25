/** 真实提问记录 — 「问 AI」每次路由都落一条，供技能影响分析、漏答挖掘使用 */

import type { RouteDecision } from "./skillRouter";
import { routeKey } from "./skillRouter";

export type QueryLogEntry = {
  q: string;
  at: string;
  /** 技能 id 或 @open / @knowledge / @about-site */
  route: string;
  score: number;
};

const KEY = "ownagent:skill-query-log";
const MAX = 300;
export const QUERY_LOG_EVENT = "ownagent:query-logged";

function read(): QueryLogEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as QueryLogEntry[]) : [];
    return Array.isArray(list) ? list.filter((e) => e && typeof e.q === "string") : [];
  } catch {
    return [];
  }
}

function write(list: QueryLogEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX)));
    window.dispatchEvent(new CustomEvent(QUERY_LOG_EVENT));
  } catch {
    /* 隐私模式等 */
  }
}

export function normalizeQuery(q: string): string {
  return q.trim().replace(/\s+/g, " ").slice(0, 200);
}

export function logRoutedQuery(query: string, decision: Pick<RouteDecision, "kind" | "skillId" | "score">) {
  const q = normalizeQuery(query);
  if (q.length < 2) return;
  const list = read();
  const last = list[list.length - 1];
  if (last && last.q === q && Date.now() - Date.parse(last.at) < 60_000) return;
  list.push({ q, at: new Date().toISOString(), route: routeKey(decision), score: decision.score });
  write(list);
}

/** 最新在前 */
export function listQueryLog(): QueryLogEntry[] {
  return read().reverse();
}

export function clearQueryLog() {
  write([]);
}

export function skillQueryStats(skillId: string, days = 7) {
  const since = Date.now() - days * 86_400_000;
  const recent = read().filter((e) => Date.parse(e.at) >= since);
  const mine = recent.filter((e) => e.route === skillId);
  return { total: recent.length, handled: mine.length, latest: mine.slice(-5).reverse() };
}

/**
 * 示例提问 — 真实记录不足时用来演示影响分析和漏答挖掘；界面上会明确标注「示例」。
 * 故意混入一些当前没有技能能接住的说法。
 */
export const SAMPLE_USER_QUERIES: string[] = [
  "帮我巡检 https://staging.example.com 能否上线",
  "新版本今晚能发吗，帮忙看下预发环境",
  "预发环境挂了没，打不开的话告诉我",
  "staging 环境能正常访问吗",
  "灰度前帮我做个冒烟测试",
  "上线前帮我过一遍验收清单",
  "发版前检查一下首页",
  "回归一下预发环境，看看有没有报错",
  "这个页面加载慢不慢",
  "首屏时间多少，性能怎么样",
  "站点现在可用吗",
  "满一年年假有几天",
  "加班调休怎么申请",
  "VPN 权限怎么开通",
  "报销流程怎么走",
  "出差住宿标准是多少",
  "病假需要什么证明",
  "当前页有多少按钮",
  "帮我分析页面 DOM 结构",
  "这个按钮的定位器怎么写",
  "执行一下自动化回放",
  "跑一遍登录的 workflow",
  "查一下知识库里的 API 说明",
  "资料库里有没有部署文档",
  "介绍一下 OwnAgent 这个项目",
  "你做过哪些 Agent 项目",
  "这个网站是干嘛的",
  "今天天气怎么样",
  "帮我写一段周报",
  "预发环境首页能打开吗",
];
