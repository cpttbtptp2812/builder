/** 客户可配置知识库 — localStorage，检索与欢迎问句同源 */

import {
  faqKnowledgeDocs,
  normalizeQuestion,
  parseQaSections,
  questionSimilarity,
  FAQ_MATCH_THRESHOLD,
  type QaSection,
} from "../data/productFaq";

export type KnowledgeDoc = {
  id: string;
  title: string;
  body: string;
  prompts: string[];
  updatedAt: number;
};

const KEY = "ownagent-knowledge-v1";
const VER_KEY = "ownagent-knowledge-ver";

const SEED: Omit<KnowledgeDoc, "updatedAt">[] = [
  {
    id: "kb-imean",
    title: "iMean AI 智能自动化",
    body:
      "iMean AI 是智能浏览器自动化平台：自然语言描述任务，系统在真实浏览器中执行。架构拆成 Builder（React Flow 工作流）、Agent（对话入口）、SDK（回放引擎）。跨窗口用 PostMessage 全局任务队列调度；元素定位用多策略链（CSS → XPath → 表格坐标 → 文本模糊），成功率从 70% 提升到 90%+。支持本地执行、云端 VNC、远程 Agent 三种模式。",
    prompts: ["介绍一下 iMean 的架构", "iMean 元素定位怎么做的"],
  },
  {
    id: "kb-ownagent",
    title: "OwnAgent 对话与 Agent Loop",
    body:
      "OwnAgent 是浏览器内可运行的 Agent：意图路由 → MCP 工具 → 检索带 chunkId → 能力锁。无后端时走 Guest Runtime，有服务时走 Hono + SQLite。技能用 SKILL.md 声明触发词与步骤，路由按词打分取 Top-1。",
    prompts: ["OwnAgent 是做什么的", "OwnAgent 的 Agent Loop 怎么跑"],
  },
  {
    id: "kb-skillforge",
    title: "SkillForge 技能运行时",
    body:
      "SkillForge 从 SKILL.md 解析 frontmatter 与 steps，注册成可运行技能。Router 对问句与触发词打分；命中后按步骤调用 MCP 工具并写出运行轨迹。内置 site-analyzer、dom-probe、workflow-orchestrator、policy-desk、knowledge-lookup。",
    prompts: ["SkillForge 怎么路由技能", "SkillForge 支持哪些内置技能"],
  },
  {
    id: "kb-jianchi",
    title: "阿里剑池前端重构",
    body:
      "阿里剑池项目侧重前端重构与性能优化：拆包、懒加载、关键路径渲染优化，以及与业务稳定性相关的监控与回滚策略。可回答架构取舍、性能指标与团队协作方式。",
    prompts: ["讲讲阿里剑池做了哪些优化"],
  },
  ...faqKnowledgeDocs(),
];

function now() {
  return Date.now();
}

function bumpVersion() {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(VER_KEY, String(now()));
}

export function knowledgeCorpusVersion(): string {
  if (typeof localStorage === "undefined") return "0";
  return localStorage.getItem(VER_KEY) ?? "0";
}

function readRaw(): KnowledgeDoc[] | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { docs?: KnowledgeDoc[] };
    return Array.isArray(parsed.docs) ? parsed.docs : null;
  } catch {
    return null;
  }
}

function writeRaw(docs: KnowledgeDoc[]) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify({ docs }));
  bumpVersion();
}

function migrateKnowledge(docs: KnowledgeDoc[]): KnowledgeDoc[] {
  const byId = new Map(docs.map((d) => [d.id, d]));
  let changed = false;
  for (const seed of SEED) {
    const existing = byId.get(seed.id);
    if (!existing) {
      byId.set(seed.id, { ...seed, updatedAt: now() });
      changed = true;
      continue;
    }
    const body = existing.body.trim() ? existing.body : seed.body;
    const prompts =
      existing.prompts.map((p) => p.trim()).filter(Boolean).length > 0
        ? existing.prompts
        : seed.prompts;
    if (body !== existing.body || prompts !== existing.prompts) {
      byId.set(seed.id, { ...existing, body, prompts, updatedAt: now() });
      changed = true;
    }
  }
  const next = [...byId.values()];
  if (changed) writeRaw(next);
  return next;
}

export function ensureKnowledgeSeeded(): KnowledgeDoc[] {
  const existing = readRaw();
  if (existing?.length) return migrateKnowledge(existing);
  const seeded = SEED.map((d) => ({ ...d, updatedAt: now() }));
  writeRaw(seeded);
  return seeded;
}

export function listKnowledgeDocs(): KnowledgeDoc[] {
  return ensureKnowledgeSeeded().slice().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function saveKnowledgeDoc(input: {
  id?: string;
  title: string;
  body: string;
  prompts: string[];
}): KnowledgeDoc {
  const docs = ensureKnowledgeSeeded();
  const title = input.title.trim() || "未命名条目";
  const body = input.body.trim();
  const prompts = input.prompts.map((p) => p.trim()).filter(Boolean).slice(0, 6);
  const id = input.id?.trim() || `kb-${Date.now().toString(36)}`;
  const next: KnowledgeDoc = { id, title, body, prompts, updatedAt: now() };
  const idx = docs.findIndex((d) => d.id === id);
  const list = idx >= 0 ? docs.map((d, i) => (i === idx ? next : d)) : [next, ...docs];
  writeRaw(list);
  return next;
}

export function deleteKnowledgeDoc(id: string) {
  writeRaw(ensureKnowledgeSeeded().filter((d) => d.id !== id));
}

export function resetKnowledgeToSeed() {
  writeRaw(SEED.map((d) => ({ ...d, updatedAt: now() })));
}

function normPrompt(s: string) {
  return s.trim().toLowerCase();
}

export { parseQaSections, type QaSection };

function findSection(doc: KnowledgeDoc, question: string): QaSection | null {
  const q = normalizeQuestion(question);
  if (!q) return null;
  return parseQaSections(doc.body).find((s) => normalizeQuestion(s.q) === q) ?? null;
}

export type SectionMatch = { doc: KnowledgeDoc; section: QaSection; score: number };

/** 在所有资料的问答段里找最接近的问题（允许换个说法） */
export function matchKnowledgeSection(query: string, threshold = FAQ_MATCH_THRESHOLD): SectionMatch | null {
  const q = normalizeQuestion(query);
  if (q.length < 2) return null;
  let best: SectionMatch | null = null;
  for (const doc of listKnowledgeDocs()) {
    for (const section of parseQaSections(doc.body)) {
      const f = normalizeQuestion(section.q);
      const score = f === q ? 1 : questionSimilarity(q, f);
      if (!best || score > best.score) best = { doc, section, score };
    }
  }
  return best && best.score >= threshold ? best : null;
}

function formatPresetDocAnswer(doc: KnowledgeDoc, query: string, prompt?: string): string {
  const section = findSection(doc, prompt ?? query) ?? (prompt ? findSection(doc, query) : null);
  if (section) return section.a;
  const sections = parseQaSections(doc.body);
  if (sections.length >= 2) {
    return [`## ${doc.title}`, "", `这篇资料回答了 ${sections.length} 个问题，可以直接问其中任意一个：`, "", ...sections.map((s) => `- ${s.q}`)].join("\n");
  }
  const lines = [`## ${doc.title}`, "", doc.body.trim()];
  if (/怎么|如何|怎样/.test(query)) {
    lines.unshift(`针对「${query.trim()}」，说明如下：`, "");
  }
  return lines.join("\n");
}

export type PresetMatch = {
  doc: KnowledgeDoc;
  answer: string;
  score: number;
};

export function matchPresetQuery(query: string): PresetMatch | null {
  const q = normPrompt(query);
  if (!q) return null;

  for (const doc of listKnowledgeDocs()) {
    if (!doc.body.trim()) continue;
    const section = findSection(doc, query);
    if (section) return { doc, answer: section.a, score: 1 };
  }

  for (const doc of listKnowledgeDocs()) {
    if (!doc.body.trim()) continue;
    for (const raw of doc.prompts) {
      const p = normPrompt(raw);
      if (!p) continue;
      if (p === q) return { doc, answer: formatPresetDocAnswer(doc, query, raw), score: 1 };
    }
    const title = normPrompt(doc.title);
    if (q === title || (title.length >= 4 && /^(介绍|讲讲|说说|了解)/.test(q) && q.includes(title))) {
      return { doc, answer: formatPresetDocAnswer(doc, query), score: 1 };
    }
  }

  for (const doc of listKnowledgeDocs()) {
    if (!doc.body.trim()) continue;
    for (const raw of doc.prompts) {
      const p = normPrompt(raw);
      if (!p || p.length < 4 || q.length < 4) continue;
      if (q.includes(p) || p.includes(q)) {
        return { doc, answer: formatPresetDocAnswer(doc, query, raw), score: 0.88 };
      }
    }
  }

  return null;
}

/** 只推有正文的知识条目；欢迎页每条目取首个示例问句，保证都能命中 */
export function listKnowledgePrompts(limit = 4): { label: string; text: string; hint: string; docId: string }[] {
  const out: { label: string; text: string; hint: string; docId: string }[] = [];
  const seen = new Set<string>();
  for (const doc of listKnowledgeDocs()) {
    if (!doc.body.trim()) continue;
    const p = doc.prompts.map((x) => x.trim()).find(Boolean);
    if (!p || seen.has(normPrompt(p))) continue;
    seen.add(normPrompt(p));
    out.push({
      label: p,
      text: p,
      hint: doc.title,
      docId: doc.id,
    });
    if (out.length >= limit) return out;
  }
  return out;
}

/** 跟进问句 — 排除已问过 / 当前句，只从有正文的条目里轮换 */
export function listFollowUpPrompts(exclude: string[] = [], limit = 3): string[] {
  const blocked = new Set(exclude.map(normPrompt));
  const out: string[] = [];
  for (const doc of listKnowledgeDocs()) {
    if (!doc.body.trim()) continue;
    for (const raw of doc.prompts) {
      const p = raw.trim();
      if (!p || blocked.has(normPrompt(p)) || out.some((x) => normPrompt(x) === normPrompt(p))) continue;
      out.push(p);
      if (out.length >= limit) return out;
    }
  }
  return out;
}

export function knowledgeDocsAsChunks(): {
  chunkId: string;
  projectId: string;
  projectName: string;
  section: "desc" | "narrative";
  text: string;
  charCount: number;
}[] {
  const chunks: {
    chunkId: string;
    projectId: string;
    projectName: string;
    section: "desc" | "narrative";
    text: string;
    charCount: number;
  }[] = [];
  for (const doc of listKnowledgeDocs()) {
    if (!doc.body.trim()) continue;
    chunks.push({
      chunkId: `custom:${doc.id}`,
      projectId: doc.id,
      projectName: doc.title,
      section: "desc",
      text: `${doc.title}\n${doc.body}`,
      charCount: doc.body.length + doc.title.length,
    });
    doc.body.split(/\n\n+/).forEach((para, i) => {
      const t = para.trim();
      if (!t || t.length < 12) return;
      chunks.push({
        chunkId: `custom:${doc.id}:p${i}`,
        projectId: doc.id,
        projectName: doc.title,
        section: "narrative",
        text: t,
        charCount: t.length,
      });
    });
  }
  return chunks;
}
