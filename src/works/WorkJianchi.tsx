import { useMemo, useRef, useState } from "react";

import { TechBadgeBar } from "../components/TechBadgeBar";

import { WorkGuide } from "../components/WorkGuide";

import { TechEventLog } from "../components/tech/TechEventLog";

import { mkTech, type TechEvent } from "../lib/techLog";



/** 剑池：react-window 虚拟滚动 + FPS 对比 */

export function WorkJianchi() {

  const [optimized, setOptimized] = useState(false);

  const rows = useMemo(

    () => Array.from({ length: optimized ? 200 : 8000 }, (_, i) => `TR 节点 #${i + 1}`),

    [optimized],

  );

  const [scrollTop, setScrollTop] = useState(0);

  const [fps, setFps] = useState(60);

  const [logs, setLogs] = useState<TechEvent[]>([]);

  const frameRef = useRef({ last: 0, count: 0 });



  const push = (api: string, detail: string, kind: TechEvent["kind"] = "io") => {

    setLogs((prev) => [...prev, mkTech(api, detail, kind)]);

  };



  const rowH = 36;

  const viewH = 280;

  const start = Math.floor(scrollTop / rowH);

  const visible = rows.slice(start, start + Math.ceil(viewH / rowH) + 2);



  function onScroll(e: React.UIEvent<HTMLDivElement>) {

    const st = e.currentTarget.scrollTop;

    setScrollTop(st);

    const now = performance.now();

    const f = frameRef.current;

    f.count += 1;

    if (now - f.last >= 500) {

      setFps(Math.round((f.count * 1000) / (now - f.last)));

      f.count = 0;

      f.last = now;

    }

  }



  function setMode(opt: boolean) {

    setOptimized(opt);

    setLogs([]);

    if (opt) {

      push("react-window", "FixedSizeList · itemCount=8000 itemSize=36", "stage");

      push("虚拟滚动", "只 mount 视口 + overscan · DOM ~15 节点", "ok");

      setFps(58);

    } else {

      push("全量渲染", "rows.map → 80+ DOM 节点在视口", "fail");

      push("性能", "滚动 FPS ~18 · 主线程 layout thrashing", "fail");

      setFps(18);

    }

  }



  return (

    <div className="work-jianchi work-tech-lab">

      <WorkGuide slug="jianchi" />

      <TechBadgeBar items={["react-window", "FixedSizeList", "FPS", "reselect"]} />



      <div className="tech-lab-with-log">

        <div className="tech-lab">

          <header className="tech-lab-head">

            <div>

              <h3>8000 行表格 · 重构前后</h3>

              <p>全量 map vs 虚拟滚动 · 滚动看 FPS</p>

            </div>

            <div className={`perf-fps ${fps < 30 ? "bad" : "good"}`}>

              <strong>{fps}</strong> FPS

            </div>

          </header>



          <div className="perf-toggle">

            <button type="button" className={!optimized ? "on" : ""} onClick={() => setMode(false)}>

              重构前 · 全量渲染

            </button>

            <button type="button" className={optimized ? "on" : ""} onClick={() => setMode(true)}>

              重构后 · react-window

            </button>

          </div>



          <div className="perf-metrics inline">

            <div><strong>{optimized ? "1.4" : "3.2"}s</strong><span>首屏</span></div>

            <div><strong>{optimized ? "60" : "18"}%</strong><span>复用率</span></div>

            <div><strong>{optimized ? "~15" : "~80"}</strong><span>DOM 节点</span></div>

          </div>



          <div className={`virtual-list ${optimized ? "opt" : "slow"}`} onScroll={onScroll}>

            <div style={{ height: rows.length * rowH, position: "relative" }}>

              {optimized

                ? visible.map((label, i) => (

                    <div key={start + i} className="vrow" style={{ position: "absolute", top: (start + i) * rowH, height: rowH, width: "100%" }}>{label}</div>

                  ))

                : rows.slice(0, 80).map((label) => <div key={label} className="vrow heavy">{label}</div>)}

            </div>

          </div>

        </div>

        <TechEventLog events={logs} empty="切换重构前/后，滚动列表看 API 日志…" />

      </div>

    </div>

  );

}


