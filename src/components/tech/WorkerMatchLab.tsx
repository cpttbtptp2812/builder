import { useState } from "react";

import { WORKFLOWS } from "../../data/demo";

import { idbGet, idbSet } from "../../lib/idbCache";

import { workerMatch, type WorkerMatchResult } from "../../lib/matchWorker";

import { mkTech, type TechEvent } from "../../lib/techLog";

import { TechEventLog } from "./TechEventLog";



/** Web Worker 向量匹配 + IndexedDB 二级缓存 */

export function WorkerMatchLab({ onPick }: { onPick?: (title: string) => void }) {

  const [query, setQuery] = useState("");

  const [results, setResults] = useState<WorkerMatchResult[] | null>(null);

  const [loading, setLoading] = useState(false);

  const [workerMs, setWorkerMs] = useState(0);

  const [cacheHit, setCacheHit] = useState<boolean | null>(null);

  const [mainBlocked, setMainBlocked] = useState<number | null>(null);

  const [logs, setLogs] = useState<TechEvent[]>([]);



  const push = (api: string, detail: string, kind: TechEvent["kind"] = "io") => {

    setLogs((prev) => [...prev, mkTech(api, detail, kind)]);

  };



  async function search(text: string) {

    if (!text.trim()) return;

    setLoading(true);

    setResults(null);

    setCacheHit(null);



    const key = `emb:${text.trim().toLowerCase()}`;

    push("idbGet", `key='${key}' · 查 IndexedDB 匹配缓存`, "storage");



    const cached = await idbGet<WorkerMatchResult[]>(key);

    if (cached) {

      push("IndexedDB hit", `~8ms 返回 ${cached.length} 条 · 跳过 Worker`, "ok");

      setCacheHit(true);

      setWorkerMs(0);

      setResults(cached);

      setLoading(false);

      return;

    }



    push("IndexedDB miss", "无缓存 → 启动 Worker", "io");

    push("worker.postMessage", `{ query: "${text.trim()}" } · 主线程 0ms 阻塞`, "stage");

    setCacheHit(false);

    const t0 = performance.now();

    const { results: matched, workerMs: wms } = await workerMatch(text);

    push("Worker.onmessage", `cosineSimilarity 完成 · Worker 内 ${wms}ms`, "ok");

    push("idbSet", `写入缓存 key='${key}'`, "storage");

    setMainBlocked(Math.round(performance.now() - t0));

    setWorkerMs(wms);

    setResults(matched);

    await idbSet(key, matched);

    setLoading(false);

  }



  const presets = ["批量改价上架", "发布前检查"];



  return (

    <div className="tech-lab-with-log">

      <div className="tech-lab">

        <header className="tech-lab-head">

          <div>

            <h3>语义匹配</h3>

            <p>Web Worker 余弦相似度 · IndexedDB 二级缓存</p>

          </div>

          <div className="tech-lab-metrics">

            {workerMs > 0 && <span>Worker {workerMs}ms</span>}

            {mainBlocked !== null && cacheHit === false && <span>RTT {mainBlocked}ms</span>}

            {cacheHit === true && <span className="ok">IndexedDB hit</span>}

          </div>

        </header>



        <div className="tech-lab-actions">

          {presets.map((p) => (

            <button key={p} type="button" className="ghost-btn sm" onClick={() => { setQuery(p); void search(p); }}>

              {p}

            </button>

          ))}

        </div>



        <form className="wf-matcher-input" onSubmit={(e) => { e.preventDefault(); void search(query); }}>

          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="输入任务描述…" />

          <button type="button" className="cta sm" disabled={loading} onClick={() => void search(query)}>

            {loading ? "Worker 计算中…" : "worker.postMessage()"}

          </button>

        </form>



        {loading && (

          <div className="tech-lab-loading">

            <span className="live-pulse">OFF MAIN THREAD</span>

            余弦相似度计算中…

          </div>

        )}



        {results && (

          <div className="wf-matcher-results">

            {results.map((r) => {

              const wf = WORKFLOWS.find((w) => w.id === r.id);

              return (

                <button key={r.id} type="button" className="wf-matcher-pick" onClick={() => onPick?.(r.title)}>

                  <div>

                    <strong>{r.title}</strong>

                    <span>{wf?.desc ?? r.desc}</span>

                  </div>

                  <div className="wf-score">

                    <b>{Math.round(r.score * 100)}%</b>

                    <span>cosine</span>

                  </div>

                </button>

              );

            })}

          </div>

        )}

      </div>

      <TechEventLog events={logs} empty="点 worker.postMessage() 或预设，看 IDB / Worker 调用链…" />

    </div>

  );

}


