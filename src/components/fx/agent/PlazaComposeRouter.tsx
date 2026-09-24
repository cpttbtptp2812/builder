/** 输入区预检索 — 打字时并行查广场 / Skill 路由 / 资料库 */

import { useEffect, useRef, useState } from "react";
import { explainDiscovery } from "../../../lib/agentSkills";
import { retrieveRag } from "../../../lib/ragEngine";
import { listPlaza, type PlazaItem } from "../../../lib/plazaFeed";

export function PlazaComposeRouter({
  input,
  running,
  onUsePlaza,
}: {
  input: string;
  running: boolean;
  onUsePlaza: (item: PlazaItem) => void;
}) {
  const [hits, setHits] = useState<PlazaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [skill, setSkill] = useState<{ name: string; score: number } | null>(null);
  const [ragHit, setRagHit] = useState<{ title: string; score: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const q = input.trim();

  useEffect(() => {
    clearTimeout(timer.current);
    if (running || q.length < 2) {
      setHits([]);
      setSkill(null);
      setRagHit(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        const [plaza, rag] = await Promise.all([
          listPlaza(q, 3),
          Promise.resolve(retrieveRag(q, 1)),
        ]);
        setHits(plaza.items);
        const topSkill = explainDiscovery(q)[0];
        setSkill(
          topSkill && topSkill.score > 0
            ? { name: topSkill.skill.name, score: Math.round(topSkill.score * 20) }
            : null,
        );
        const topRag = rag.hits[0];
        setRagHit(
          topRag
            ? { title: topRag.projectName || topRag.chunkId, score: Math.round(topRag.score * 100) }
            : null,
        );
      } finally {
        setLoading(false);
      }
    }, 280);
    return () => clearTimeout(timer.current);
  }, [q, running]);

  if (running || q.length < 2) return null;

  const hasPlaza = hits.length > 0;
  const hasRoute = Boolean(skill || ragHit);

  return (
    <div className="plaza-compose-router" aria-label="发送前预检索">
      <div className="plaza-compose-router-head">
        <strong>发送前预检索</strong>
        <span>
          {loading
            ? "检索中…"
            : hasPlaza
              ? `广场 ${hits.length} 条可直用`
              : hasRoute
                ? "未命中广场，将走下方路由"
                : "未命中，Enter 调用 AI"}
        </span>
      </div>

      {!loading && hasRoute ? (
        <div className="plaza-compose-router-route">
          {skill ? (
            <span className="plaza-route-chip skill">
              Skill · {skill.name} {skill.score}%
            </span>
          ) : null}
          {ragHit ? (
            <span className="plaza-route-chip rag">
              资料库 · {ragHit.title} {ragHit.score}%
            </span>
          ) : null}
        </div>
      ) : null}

      {hasPlaza ? (
        <ul className="plaza-compose-router-list">
          {hits.map((hit) => (
            <li key={hit.id}>
              <button type="button" className="plaza-compose-router-item" onClick={() => onUsePlaza(hit)}>
                <span className="plaza-compose-router-q">{hit.question}</span>
                <span className="plaza-compose-router-a">
                  {hit.answer.replace(/\s+/g, " ").slice(0, 96)}
                  {hit.answer.length > 96 ? "…" : ""}
                </span>
                <span className="plaza-compose-router-action">采用 · 跳过 AI</span>
              </button>
            </li>
          ))}
        </ul>
      ) : !loading ? (
        <p className="plaza-compose-router-miss">
          {hasRoute
            ? "按 Enter 将按 Skill / 资料库路由生成回答。"
            : "广场与资料库暂无强匹配，Enter 将调用 AI 检索与生成。"}
        </p>
      ) : null}
    </div>
  );
}
