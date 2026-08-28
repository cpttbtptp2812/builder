import { useState } from "react";

import { mkTech, type TechEvent } from "../../lib/techLog";

import { TechEventLog } from "../tech/TechEventLog";



type Target = {

  id: string;

  label: string;

  shadow?: boolean;

  strategies: { name: string; ok: boolean; ms: number }[];

};



const TARGETS: Target[] = [

  {

    id: "btn",

    label: "提交按钮",

    strategies: [

      { name: "CSS #btn-primary", ok: true, ms: 12 },

      { name: "XPath //button", ok: true, ms: 28 },

    ],

  },

  {

    id: "input",

    label: "动态表单",

    strategies: [

      { name: "CSS input[name=sku]", ok: false, ms: 45 },

      { name: "文本模糊 match", ok: true, ms: 62 },

      { name: "IndexedDB 缓存", ok: true, ms: 8 },

    ],

  },

  {

    id: "table",

    label: "表格第 2 行",

    strategies: [

      { name: "CSS tr:nth(2)", ok: false, ms: 38 },

      { name: "表格坐标 (1,2)", ok: true, ms: 54 },

    ],

  },

  {

    id: "shadow",

    label: "Shadow DOM 按钮",

    shadow: true,

    strategies: [

      { name: "CSS .btn（light DOM）", ok: false, ms: 22 },

      { name: "shadowRoot.querySelector", ok: true, ms: 41 },

      { name: "IndexedDB 缓存", ok: true, ms: 6 },

    ],

  },

];



/** Locator：策略瀑布 + 技术事件流 */

export function LocatePlayground() {

  const [phase, setPhase] = useState<"before" | "after">("after");

  const [active, setActive] = useState<string | null>(null);

  const [step, setStep] = useState(-1);

  const [running, setRunning] = useState(false);

  const [totalMs, setTotalMs] = useState<number | null>(null);

  const [logs, setLogs] = useState<TechEvent[]>([]);



  const push = (api: string, detail: string, kind: TechEvent["kind"] = "io") => {

    setLogs((prev) => [...prev, mkTech(api, detail, kind)]);

  };



  const target = TARGETS.find((t) => t.id === active);

  const rate = phase === "before" ? 70 : 92;



  function locate(id: string) {

    setActive(id);

    setStep(-1);

    setRunning(true);

    setTotalMs(null);

    setLogs([]);

    const t = TARGETS.find((x) => x.id === id)!;

    push("locate()", `target='${t.label}' · 策略链 ${t.strategies.length} 级`, "stage");

    if (t.shadow) push("shadowRoot", "穿透 Shadow DOM · element.shadowRoot.querySelector", "stage");

    if (phase === "after") push("idbGet", `loc:${id} · 缓存优先`, "storage");



    let i = 0;

    let ms = 0;

    const timer = window.setInterval(() => {

      const s = t.strategies[i];

      if (s) {

        push(s.name, s.ok ? `✓ 命中 ${s.ms}ms` : `✗ miss ${s.ms}ms`, s.ok ? "ok" : "fail");

        if (s.ok) ms += s.ms;

      }

      setStep(i);

      i += 1;

      if (i >= t.strategies.length) {

        window.clearInterval(timer);

        setRunning(false);

        setTotalMs(ms);

        push("scrollIntoView", "{ block: 'center' }", "stage");

        push("dispatchEvent", "new MouseEvent('click', { bubbles: true })", "ok");

        push("queue.next()", "定位成功 → 执行下一步", "ok");

      }

    }, phase === "before" ? 800 : 550);

  }



  return (

    <div className="loc-enhanced">

      <div className="loc-phase-bar">

        <button type="button" className={phase === "before" ? "on" : ""} onClick={() => { setPhase("before"); push("mode", "优化前 · 无 IDB 缓存优先", "io"); }}>

          优化前 ~70%

        </button>

        <button type="button" className={phase === "after" ? "on" : ""} onClick={() => { setPhase("after"); push("mode", "优化后 · IDB 缓存优先", "io"); }}>

          优化后 ~90%

        </button>

        <strong className="loc-rate">{rate}% 命中率</strong>

      </div>



      <div className="tech-lab-with-log">

        <div className="loc-playground">

          <div className="loc-mock">

            <p className="loc-mock-title">点击元素触发定位 · {phase === "before" ? "策略较慢" : "缓存优先"}</p>

            <button type="button" className={`loc-el ${active === "btn" ? "on" : ""}`} onClick={() => locate("btn")}>

              提交按钮

            </button>

            <input className={`loc-el ${active === "input" ? "on" : ""}`} readOnly value="动态表单" onClick={() => locate("input")} />

            <table className={`loc-el ${active === "table" ? "on" : ""}`} onClick={() => locate("table")}>

              <tbody>

                <tr><td>行1</td><td>—</td></tr>

                <tr><td>行2</td><td>目标</td></tr>

              </tbody>

            </table>

            <div className="loc-shadow-host">

              <span>Shadow Host</span>

              <div className={`loc-shadow-inner ${active === "shadow" ? "on" : ""}`}>

                <button type="button" onClick={() => locate("shadow")}>Shadow 内按钮</button>

              </div>

            </div>

          </div>



          <div className="loc-cascade">

            {!target && <p className="loc-idle">← 点击页面元素（含 Shadow DOM）</p>}

            {target && (

              <>

                <header>

                  <strong>{target.label}</strong>

                  <span>{running ? "定位中…" : totalMs !== null ? `${totalMs}ms 总耗时` : "完成"}</span>

                </header>

                <ol>

                  {target.strategies.map((s, i) => (

                    <li

                      key={s.name}

                      className={i < step ? (s.ok ? "ok" : "fail") : i === step && running ? "trying" : ""}

                    >

                      <span>{s.name}</span>

                      {i <= step && <em>{s.ok ? `✓ ${s.ms}ms` : "✗ miss"}</em>}

                    </li>

                  ))}

                </ol>

              </>

            )}

          </div>

        </div>

        <TechEventLog events={logs} empty="点 mock 页面元素，看策略瀑布 API…" />

      </div>

    </div>

  );

}


