/** 启动时把 knowledge 语料写入 SQLite */

import { PROJECT_DETAILS } from "../src/data/knowledge.ts";
import { FAQ_TOPICS, PRODUCT_FAQ } from "../src/data/productFaq.ts";
import { dbAll, dbGet, dbRun, nowIso, type RagChunkRow } from "./db.ts";

type RagSection = RagChunkRow["section"];

export function seedRagCorpus() {
  const count = dbGet<{ c: number }>("SELECT COUNT(*) as c FROM rag_chunks");
  if (count && count.c > 0) return count.c;

  const chunks: RagChunkRow[] = [];

  for (const p of PROJECT_DETAILS) {
    const push = (chunkId: string, section: RagSection, text: string, aspectKey?: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      chunks.push({
        chunk_id: chunkId,
        project_id: p.id,
        project_name: p.name,
        section,
        aspect_key: aspectKey ?? null,
        text: trimmed,
        char_count: trimmed.length,
      });
    };

    push(`${p.id}:desc`, "desc", p.desc);
    push(`${p.id}:arch`, "architecture", p.architecture);
    push(`${p.id}:topics`, "topics", p.interviewTopics.join(" · "));
    p.narrative.split(/\n\n+/).forEach((para, i) => push(`${p.id}:narr-${i}`, "narrative", para));
    p.challenges.forEach((c, i) => push(`${p.id}:chal-${i}`, "challenge", c));
    for (const [k, v] of Object.entries(p.aspects)) {
      push(`${p.id}:asp-${k}`, "aspect", v, k);
    }
  }

  for (const row of chunks) {
    dbRun(
      `INSERT INTO rag_chunks (chunk_id, project_id, project_name, section, aspect_key, text, char_count) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [row.chunk_id, row.project_id, row.project_name, row.section, row.aspect_key, row.text, row.char_count],
    );
  }

  dbRun(
    `INSERT OR IGNORE INTO memories (session_id, mem_key, value, category, updated_at) VALUES (?, ?, ?, ?, ?)`,
    ["global", "tech_focus", "Agent · MCP · Skills 运行时 · DOM 回放 SDK", "preference", nowIso()],
  );

  return chunks.length;
}

/** 产品问答写进检索库：每次启动覆盖同 id，改了 productFaq.ts 重启即生效 */
export function seedFaqChunks() {
  const titleOf = new Map(FAQ_TOPICS.map((t) => [t.id, t]));
  for (const e of PRODUCT_FAQ) {
    const topic = titleOf.get(e.topic)!;
    const text = `问：${e.q}\n答：${e.a}`;
    dbRun(
      `INSERT OR REPLACE INTO rag_chunks (chunk_id, project_id, project_name, section, aspect_key, text, char_count) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [`faq:${e.id}`, topic.docId, topic.title, "desc", null, text, text.length],
    );
  }
  return PRODUCT_FAQ.length;
}

export function getChunkCount() {
  return dbGet<{ c: number }>("SELECT COUNT(*) as c FROM rag_chunks")?.c ?? 0;
}

export function getAllChunks(): RagChunkRow[] {
  return dbAll<RagChunkRow>("SELECT * FROM rag_chunks");
}
