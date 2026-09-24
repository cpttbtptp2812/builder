import { useMemo, useState } from "react";
import { retrieveRag, type RagRetrieveResult } from "../../lib/ragEngine";
import { listKnowledgePrompts } from "../../lib/ownKnowledge";
import { KnowledgeEditor } from "../fx/agent/KnowledgeEditor";
import {
  OaEmpty,
  OaChips,
  OaPage,
  OaSearchRow,
  OaStatGrid,
  OaTabs,
} from "./OaUi";

/** 资料库：录入 + 检索测试 */
export function RagPanel() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<RagRetrieveResult | null>(null);
  const [tab, setTab] = useState<"edit" | "search">("edit");
  const [rev, setRev] = useState(0);

  const corpusInfo = useMemo(() => retrieveRag("__warmup__", 1), [rev]);
  const presets = useMemo(() => listKnowledgePrompts(6).map((p) => p.text), [rev]);

  function run(q: string) {
    const text = q.trim();
    if (!text) return;
    setQuery(text);
    setResult(retrieveRag(text, 5));
  }

  return (
    <OaPage
      title="资料库"
      desc="录入公司产品说明、FAQ、制度文档。AI 回答时会优先引用这些内容。"
    >
      <OaTabs
        label="资料库"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "edit", label: "管理资料" },
          { id: "search", label: "测试检索" },
        ]}
      />

      {tab === "edit" ? (
        <KnowledgeEditor onChanged={() => setRev((n) => n + 1)} />
      ) : (
        <>
          <p className="oa-toolbar-lead" style={{ marginBottom: "0.85rem" }}>
            输入问题，检查资料库里有没有相关内容。没有命中时请回到「管理资料」补充。
          </p>

          <OaSearchRow
            value={query}
            onChange={setQuery}
            onSubmit={() => run(query)}
            placeholder="例如：产品怎么部署"
            buttonLabel="检索"
          />
          <OaChips items={presets} onPick={run} />

          <OaStatGrid
            items={[
              { label: "语料块", value: corpusInfo.chunkCount },
              { label: "本次耗时", value: result ? `${result.latencyMs}ms` : "—" },
              {
                label: "命中条数",
                value: result ? result.hits.length : "—",
                tone: result && result.hits.length > 0 ? "ok" : undefined,
              },
            ]}
          />

          {!result ? (
            <OaEmpty>选择上方示例，或输入问题开始检索</OaEmpty>
          ) : result.hits.length === 0 ? (
            <OaEmpty>没有命中。请到「管理资料」补充相关内容。</OaEmpty>
          ) : (
            <ul className="oa-list">
              {result.hits.map((h) => (
                <li key={h.chunkId} className="oa-list-item">
                  <div>
                    <strong style={{ fontSize: "0.8125rem" }}>
                      {h.projectName} · {h.section}
                      {h.aspectKey ? `/${h.aspectKey}` : ""}
                    </strong>
                    <p>{h.text.slice(0, 220)}{h.text.length > 220 ? "…" : ""}</p>
                    {h.matchedTerms.length > 0 ? (
                      <span style={{ fontSize: "0.72rem", color: "#a1a1aa" }}>
                        命中词：{h.matchedTerms.join("、")}
                      </span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </OaPage>
  );
}
