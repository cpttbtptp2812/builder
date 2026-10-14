import { useEffect, useMemo, useState } from "react";
import type { CounterfactualReport } from "../../lib/ledgerRuleModel";
import type { ShiftOptimizeReport } from "../../lib/shiftMilpTypes";
import { EvidenceIssuer } from "./EvidencePanel";
import { Counterfactual } from "./LedgerSolverPanel";
import { MaterialCanvas } from "./MaterialCanvas";
import { RunReplay } from "./MissionControl";
import { RunCollaboration } from "./RunCollaboration";
import { ShiftOptimizer } from "./ShiftOptimizerPanel";
import { labFetch, productRunApi } from "./labApi";
import { deskArgLabel } from "../../lib/deskArgLabels";
import { adoptIntoDraft, draftBase, patchStepArgs } from "../../lib/skillDraftAdopt";
import "./platformLab.css";

type Tool = "replay" | "evidence" | "materials" | "review" | "counterfactual" | "shift";

const TOOLS: { id: Tool; label: string; hint: string; skills?: string[] }[] = [
  { id: "replay", label: "回放与改参数", hint: "改一个规则重跑，看哪里变了" },
  { id: "materials", label: "材料原件", hint: "点数字，看它来自哪一格" },
  { id: "review", label: "这一单怎么跑的", hint: "取证、执行、审阅，失败的可以只改那一步" },
  { id: "evidence", label: "签名证据包", hint: "交付的数字能离线核验" },
  { id: "counterfactual", label: "最少改什么能放行", hint: "被拦的单最少改哪里", skills: ["ledger-desk"] },
  { id: "shift", label: "求最优排班", hint: "算出能证明最好的排法", skills: ["shift-desk"] },
];

/** 对话里办完的一单：回放、分叉、出证据包、在同一批材料上求解 */
export function ProductRunInsights({ sessionId, processId, skillId, version }: { sessionId: string; processId: string; skillId: string; version: string }) {
  const api = useMemo(() => productRunApi(sessionId), [sessionId]);
  const [runId, setRunId] = useState<string | null>(null);
  const [lookup, setLookup] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool | null>(null);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    setRunId(null);
    setLookup(null);
    void labFetch<{ runId: string; status: string }>(
      `/api/product-run/insight?sessionId=${encodeURIComponent(sessionId)}&processId=${encodeURIComponent(processId)}`,
    ).then((r) => {
      if (!alive) return;
      if (r.ok) setRunId(r.data.runId);
      else setLookup(r.error);
    });
    return () => {
      alive = false;
    };
  }, [sessionId, processId, version]);

  const tools = TOOLS.filter((t) => !t.skills || t.skills.includes(skillId));
  const needsRun = (t: Tool) => t === "replay" || t === "evidence" || t === "review";

  return (
    <div className="pl-root pl-embed pi-dock">
      <div className="pi-head">
        <span>深入这一单</span>
        {tools.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`pi-chip${tool === t.id ? " is-on" : ""}`}
            disabled={needsRun(t.id) && !runId}
            title={needsRun(t.id) && !runId ? lookup ?? "正在找这次办理的运行记录" : t.hint}
            onClick={() => setTool((cur) => (cur === t.id ? null : t.id))}
          >
            <i />
            {t.label}
            <small>{t.hint}</small>
          </button>
        ))}
      </div>
      {lookup && (tool === "replay" || tool === "evidence") ? <p className="pl-error">{lookup}</p> : null}
      {tool ? (
        <div className="pi-body">
          <div className="pl-panel">
            {tool === "replay" && runId ? (
              <>
                <h3>这一单的每一步</h3>
                <p className="pl-note">拖动下方滑块回到任意事件；点一步看当时的输入输出。改这一步的参数可以从那里分叉重跑，和原结果逐步对比，原单不受影响。</p>
                <RunReplay
                  api={api}
                  runId={runId}
                  focusIndex={focusIndex}
                  onAdoptFork={(f) => {
                    const r = patchStepArgs(draftBase(skillId), f.stepId, f.args);
                    if (!r.applied.length) return window.alert("技能原文里没找到这些参数，没法写进草稿");
                    adoptIntoDraft(skillId, r.raw, `对话里试出：${f.stepLabel} ${Object.entries(f.args).map(([k, v]) => `${deskArgLabel(k) ?? k}=${String(v)}`).join("、")}`);
                  }}
                />
              </>
            ) : null}
            {tool === "materials" ? <MaterialCanvas sessionId={sessionId} skillId={skillId} summary={version} /> : null}
            {tool === "review" && runId ? (
              <RunCollaboration
                api={api}
                runId={runId}
                onFocus={(index) => {
                  setFocusIndex(index);
                  setTool("replay");
                }}
              />
            ) : null}
            {tool === "evidence" && runId ? (
              <>
                <h3>给这一单出证据包</h3>
                <EvidenceIssuer api={api} runId={runId} compact />
              </>
            ) : null}
            {tool === "counterfactual" ? (
              <>
                <h3>被拦下的单子，最少改什么能放行</h3>
                <p className="pl-note">把技能里的阈值当成未知数，对你导入的这份台账求解：最小的规则改动、以及每行只改数据的办法。结果已用真实引擎重跑复核。</p>
                <Counterfactual
                  autoRun
                  solve={() => labFetch<CounterfactualReport>("/api/product-run/insight/counterfactual", { sessionId, skillId })}
                  onAdoptRaw={(raw, note) => adoptIntoDraft(skillId, raw, `最小改动放行：${note}`)}
                />
              </>
            ) : null}
            {tool === "shift" ? (
              <>
                <h3>同一批材料的最优排班</h3>
                <p className="pl-note">技能是按班次一个个排的；这里把整周放在一起求，先保覆盖、再控工时、最后照顾均衡，每一层都证明了没有更好的排法，并标出和刚才结果不同的格子。</p>
                <ShiftOptimizer autoRun solve={() => labFetch<ShiftOptimizeReport>("/api/product-run/insight/shift-optimize", { sessionId, skillId })} />
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
