import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  buildVersionGate,
  gateQuestions,
  normalizeGateQuestions,
  readGateQuestions,
  writeGateQuestions,
  type GateSide,
  type VersionGateReport,
} from "../../lib/versionGate";
import { WorkPaperView } from "./WorkPaper";

type DraftQuestion = { id: string; text: string };

function draftId(): string {
  return `q-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function toDrafts(list: string[]): DraftQuestion[] {
  return list.map((text) => ({ id: draftId(), text }));
}

function Board({ side }: { side: GateSide }) {
  const top = Math.max(4, ...side.board.map((row) => row.score), 1);
  if (!side.board.length) return <p className="oa-gate-empty">没有说法命中</p>;
  return (
    <div className="oa-gate-board">
      {side.board.map((row) => (
        <div key={row.name} className="oa-gate-bar">
          <span>{row.name}</span>
          <i><b style={{ width: `${Math.round((row.score / top) * 100)}%` }} /></i>
          <em>{row.score}</em>
        </div>
      ))}
    </div>
  );
}

function Side({ label, side, hot }: { label: string; side: GateSide; hot?: boolean }) {
  return (
    <div className={hot ? "oa-gate-side is-hot" : "oa-gate-side"}>
      <span className="oa-gate-side-k">{label}</span>
      <strong>{side.who}</strong>
      <p>{side.text}</p>
      <div className="oa-gate-trace">
        <span>分 {side.score}</span>
        <span>领先 {side.margin}</span>
        {side.hits.slice(0, 2).map((hit) => <span key={hit}>{hit}</span>)}
      </div>
      {side.paper ? <WorkPaperView paper={side.paper} interactive={false} /> : null}
      {side.grid ? (
        <div className="oa-gate-grid">
          <table>
            <thead>
              <tr>{side.grid.columns.map((column) => <th key={column}>{column}</th>)}</tr>
            </thead>
            <tbody>
              {side.grid.rows.map((row, index) => (
                <tr key={index}>
                  {row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {side.gap ? <em>会出知识缺口</em> : <em className="is-ok">有引用，不出缺口</em>}
      <p className="oa-gate-rule">{side.rule}</p>
      <Board side={side} />
      {side.steps ? <p className="oa-gate-steps">{side.steps}</p> : null}
    </div>
  );
}

/** 切换前对照。确认之前不改线上。 */
export function VersionGate({
  name,
  versionId,
  cover,
  onClose,
  onConfirm,
}: {
  name: string;
  versionId: string;
  cover: string[];
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [questions, setQuestions] = useState<DraftQuestion[]>(() => toDrafts(readGateQuestions()));
  const [adding, setAdding] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [report, setReport] = useState<VersionGateReport>(() => buildVersionGate(versionId, readGateQuestions()));
  const [ranKey, setRanKey] = useState(() => readGateQuestions().join("\n"));
  const [showSame, setShowSame] = useState(false);
  const texts = normalizeGateQuestions(questions.map((item) => item.text));
  const dirty = texts.join("\n") !== ranKey;
  const changed = report.rows.filter((row) => row.changed);
  const same = report.rows.filter((row) => !row.changed);
  const visible = showSame ? report.rows : changed;

  function run(list = texts) {
    const next = normalizeGateQuestions(list);
    if (!next.length) return;
    writeGateQuestions(next);
    setQuestions(toDrafts(next));
    const built = buildVersionGate(versionId, next);
    setReport(built);
    setRanKey(next.join("\n"));
    setShowSame(false);
    setAdding("");
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function updateQuestion(id: string, text: string) {
    setQuestions((prev) => prev.map((item) => (item.id === id ? { ...item, text } : item)));
  }

  function removeQuestion(id: string) {
    setQuestions((prev) => prev.filter((item) => item.id !== id));
  }

  function addQuestion() {
    const text = adding.trim();
    if (!text) return;
    setQuestions((prev) => [...prev, { id: draftId(), text }]);
    setAdding("");
  }

  return createPortal(
    <div className="oa-gate" role="dialog" aria-modal="true" aria-labelledby="oa-gate-title">
      <button type="button" className="oa-gate-dim" aria-label="关闭" onClick={onClose} />
      <div className="oa-gate-sheet">
        <header className="oa-gate-head">
          <div className="oa-gate-kicker"><i />切换前对照</div>
          <h2 id="oa-gate-title">切到「{name}」之前</h2>
          <p>每句都跑同一套路由：去向、分数、领先分差、命中说法、步骤。</p>
          <div className="oa-gate-stats">
            <span><b>{report.routeFlips}</b> 句改道</span>
            <span><b>{report.stepDiffs}</b> 句步骤不同</span>
            <span><b>{report.tightened}</b> 句分差变小</span>
            <span><b>{report.gapMoves}</b> 句缺口不同</span>
          </div>
          {report.added.length || report.removed.length ? (
            <p className="oa-gate-delta">
              {report.removed.length ? `少了 ${report.removed.join("、")}` : ""}
              {report.removed.length && report.added.length ? "。" : ""}
              {report.added.length ? `多了 ${report.added.join("、")}` : ""}
            </p>
          ) : null}
        </header>
        <div className="oa-gate-body">
          <section className="oa-gate-edit">
            <div className="oa-gate-edit-bar">
              <strong>测试问句</strong>
              <span>{texts.length} 句</span>
              <button type="button" className="oa-gate-reset" onClick={() => setEditOpen((value) => !value)}>
                {editOpen ? "收起问句" : "编辑问句"}
              </button>
              <button type="button" className={dirty ? "oa-gate-run is-hot" : "oa-gate-run"} onClick={() => run()} disabled={!texts.length}>
                一键测试
              </button>
            </div>
            {editOpen ? (
              <>
                <ul>
                  {questions.map((item, index) => (
                    <li key={item.id}>
                      <span>{index + 1}</span>
                      <input
                        value={item.text}
                        aria-label={`第 ${index + 1} 句`}
                        maxLength={80}
                        onChange={(event) => updateQuestion(item.id, event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            run();
                          }
                        }}
                      />
                      <button type="button" aria-label="删除这句" onClick={() => removeQuestion(item.id)} disabled={questions.length <= 1}>
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    addQuestion();
                  }}
                >
                  <input
                    value={adding}
                    placeholder="再加一句客户会问的话"
                    maxLength={80}
                    onChange={(event) => setAdding(event.target.value)}
                  />
                  <button type="submit" disabled={!adding.trim() || questions.length >= 12}>添加</button>
                </form>
                <button
                  type="button"
                  className="oa-gate-reset oa-gate-reset-inline"
                  onClick={() => {
                    const fresh = gateQuestions();
                    setQuestions(toDrafts(fresh));
                    run(fresh);
                  }}
                >
                  恢复默认
                </button>
              </>
            ) : null}
            {dirty ? <p className="oa-gate-dirty">问句改过了，点一键测试才会按新的这批重跑。</p> : null}
          </section>
          {visible.length ? (
            <ul>
              {visible.map((row) => (
                <li key={row.q} className={row.changed ? "is-diff" : ""}>
                  <div className="oa-gate-q">
                    <strong>{row.q}</strong>
                    {row.tags.map((tag) => <em key={tag}>{tag}</em>)}
                  </div>
                  <div className="oa-gate-pair">
                    <Side label="现在" side={row.live} />
                    <Side label={name} side={row.next} hot={row.changed} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="oa-gate-quiet">
              <strong>这 {report.same} 句和现在一样</strong>
              <p>去向、说法、知识缺口都没有变。可以切，也可以先留着。</p>
            </div>
          )}
          {same.length && changed.length ? (
            <button type="button" className="oa-gate-more" onClick={() => setShowSame((value) => !value)}>
              {showSame ? "收起没变化的" : `还有 ${same.length} 句不会变`}
            </button>
          ) : null}
        </div>
        <footer className="oa-gate-foot">
          {cover.length ? <p>{cover.join("、")}里没发的修改会被盖掉。</p> : <p>确认后，线上技能换成这一版。已经发出的回复不会改。</p>}
          <div>
            <button type="button" onClick={onClose}>先不切</button>
            <button type="button" className="is-go" onClick={onConfirm}>确认切换</button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
