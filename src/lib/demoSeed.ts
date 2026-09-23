/** GitHub Pages 演示 — 无后端时灌入本机示例数据（不影响有后端时的 SQLite） */

import type { PlazaItem } from "./plazaFeed";
import { ensureKnowledgeSeeded } from "./ownKnowledge";

const LOCAL_KEY = "oa-feed-local";

const DEMO_PLAZA: PlazaItem[] = [
  {
    id: "demo-qa-1",
    question: "OwnAgent 是做什么的？",
    answer:
      "OwnAgent 是企业内部 AI 知识助手，核心流程是「先搜知识广场、再问 AI、答完发布共享」。适合客服、实施、HR 等团队减少重复问答。",
    author: "产品团队",
    avatar_color: "#6366f1",
    source_doc: null,
    tags: ["产品"],
    likes: 3,
    views: 12,
    pinned: 1,
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: "demo-qa-2",
    question: "怎么部署 OwnAgent？",
    answer:
      "推荐 Docker Compose：docker compose up -d。配置 ADMIN_PASSWORD 和 LLM API Key 后，访问 /admin 管理知识库。GitHub Pages 为演示部署，完整功能需 Docker 或本地 npm run dev:full。",
    author: "运维同事",
    avatar_color: "#059669",
    source_doc: null,
    tags: ["部署"],
    likes: 1,
    views: 8,
    pinned: 0,
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "demo-qa-3",
    question: "AI 回答不准确怎么办？",
    answer:
      "1. 在管理后台「知识库」补充内容；2. 将正确问答发布到广场；3. 在「知识运营」查看低置信度回答并校对。（管理后台需启动后端）",
    author: "客服主管",
    avatar_color: "#0891b2",
    source_doc: null,
    tags: ["FAQ"],
    likes: 2,
    views: 5,
    pinned: 0,
    created_at: new Date().toISOString(),
  },
];

function loadLocalPlaza(): PlazaItem[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]") as PlazaItem[];
  } catch {
    return [];
  }
}

export function ensurePlazaDemoSeed() {
  if (loadLocalPlaza().length > 0) return;
  try {
    const cached = JSON.parse(localStorage.getItem("oa-feed-cache") || "[]") as PlazaItem[];
    if (cached.length > 0) return;
  } catch { /* */ }
  localStorage.setItem(LOCAL_KEY, JSON.stringify(DEMO_PLAZA));
  localStorage.setItem("oa-feed-cache", JSON.stringify(DEMO_PLAZA));
}

/** 应用启动时调用：知识库 + 广场演示数据 */
export function ensureDemoReady() {
  ensureKnowledgeSeeded();
  ensurePlazaDemoSeed();
}

export function isDemoHost(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.location.hostname.includes("github.io") ||
    import.meta.env.PROD && !import.meta.env.VITE_API_BASE
  );
}
