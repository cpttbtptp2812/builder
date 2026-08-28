import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WORKFLOWS } from "../data/demo";
import { runProcess } from "../engine";
import { useStore } from "../store";

export function WorkflowsPage() {
  const [channel, setChannel] = useState("全部");
  const openChat = useStore((s) => s.openChat);
  const nav = useNavigate();

  const channels = useMemo(
    () => ["全部", ...new Set(WORKFLOWS.map((w) => w.channel))],
    [],
  );

  const list = WORKFLOWS.filter((w) => channel === "全部" || w.channel === channel);

  function run(title: string) {
    const sid = openChat("master");
    nav("/demo/chat");
    window.setTimeout(() => runProcess(sid, title), 400);
  }

  return (
    <div className="page">
      <header>
        <h1>工作流库</h1>
        <p>对应 iMean：频道 / 场景 / 一键 startProcess + 回放</p>
      </header>
      <div className="filters">
        {channels.map((c) => (
          <button
            key={c}
            type="button"
            className={c === channel ? "f on" : "f"}
            onClick={() => setChannel(c)}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="cards">
        {list.map((w) => (
          <article key={w.id} className="tile wf">
            <span className="ch">{w.channel}</span>
            <h2>{w.title}</h2>
            <p>{w.desc}</p>
            <footer>
              <span>{w.steps} 步</span>
              <button type="button" className="cta sm" onClick={() => run(w.title)}>
                运行
              </button>
            </footer>
          </article>
        ))}
      </div>
    </div>
  );
}
