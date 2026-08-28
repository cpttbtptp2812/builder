import { useState } from "react";

import { TechBadgeBar } from "../components/TechBadgeBar";

import { WorkGuide } from "../components/WorkGuide";

import { BundleWaterfall } from "../components/fx/BundleWaterfall";

import { TechEventLog } from "../components/tech/TechEventLog";

import { mkTech, type TechEvent } from "../lib/techLog";



const APPS = [

  { id: "fee", name: "费控报销", color: "#22d3ee" },

  { id: "approve", name: "审批中心", color: "#818cf8" },

  { id: "report", name: "报表分析", color: "#f0b429" },

];



/** 微前端：qiankun + Bundle 瀑布图 */

export function WorkFee() {

  const [active, setActive] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);

  const [progress, setProgress] = useState(0);

  const [chunk, setChunk] = useState<string | null>(null);

  const [logs, setLogs] = useState<TechEvent[]>([]);



  const push = (api: string, detail: string, kind: TechEvent["kind"] = "io") => {

    setLogs((prev) => [...prev, mkTech(api, detail, kind)]);

  };



  function load(id: string) {

    const app = APPS.find((a) => a.id === id)!;

    setLoading(true);

    setActive(null);

    setProgress(0);

    push("registerMicroApps", `{ name: '${app.name}', activeRule: '/${id}' }`, "stage");

    push("loadMicroApp", `fetch entry HTML/JS · dynamic import`, "stage");

    const t = window.setInterval(() => {

      setProgress((p) => {

        const next = p + 8;

        if (next >= 100) {

          window.clearInterval(t);

          setLoading(false);

          setActive(id);

          push("mount", `${app.name} 挂载到 container · 样式 sandbox 隔离`, "ok");

          return 100;

        }

        if (next === 40) push("bootstrap", "子应用 bootstrap 生命周期", "io");

        if (next === 72) push("mount", "子应用 mount · ReactDOM.render", "io");

        return next;

      });

    }, 50);

  }



  function onChunkSelect(name: string) {

    setChunk(name);

    push("rollup visualizer", `chunk '${name}' · dynamic import 按需加载`, "stage");

  }



  const app = APPS.find((a) => a.id === active);



  return (

    <div className="work-fee work-tech-lab">

      <WorkGuide slug="fee" />

      <TechBadgeBar items={["qiankun", "registerMicroApps", "dynamic import", "sandbox"]} />



      <section className="tech-section">

        <header className="tech-section-head">

          <h3>Bundle 瀑布图</h3>

          <span>点色块看 chunk 名称 · 指导拆包</span>

        </header>

        <BundleWaterfall onSelect={onChunkSelect} />

        {chunk && (

          <div className="wf-chunk-detail pop-in">

            <strong>{chunk}</strong>

            <span>路由级 lazy · gzip 可再优化</span>

          </div>

        )}

      </section>



      <div className="tech-lab-with-log">

        <div className="tech-lab">

          <header className="tech-lab-head">

            <div>

              <h3>子应用切换</h3>

              <p>qiankun bootstrap → mount 生命周期</p>

            </div>

          </header>

          <div className="mf-shell">

            <header className="mf-header">

              <span>微前端主应用</span>

              <nav>

                {APPS.map((a) => (

                  <button key={a.id} type="button" className={active === a.id ? "on" : ""} onClick={() => load(a.id)}>{a.name}</button>

                ))}

              </nav>

            </header>

            <div className="mf-viewport">

              {loading && (

                <div className="mf-progress">

                  <i style={{ width: `${progress}%` }} />

                  <span>loadMicroApp… {progress}%</span>

                </div>

              )}

              {!loading && app && (

                <div className="mf-sub pop-in" style={{ borderColor: app.color }}>

                  <h3>{app.name}</h3>

                  <p>独立部署 · sandbox 样式隔离</p>

                </div>

              )}

              {!loading && !app && <p className="mf-empty">选 Tab 看 qiankun 加载链</p>}

            </div>

          </div>

        </div>

        <TechEventLog events={logs} empty="切换 Tab 或点瀑布图 chunk…" />

      </div>

    </div>

  );

}


