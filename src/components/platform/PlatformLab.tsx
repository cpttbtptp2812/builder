import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { checkBackendHealth, type BackendHealth } from "../../lib/apiClient";
import type { ProductDataSlot } from "../../lib/productDataStore";
import type { SkillDataRequirement } from "../../lib/productSkillInputs";
import { RouteConfidencePanel } from "../ownagent/RouteConfidence";
import { EvidencePanel } from "./EvidencePanel";
import { LedgerSolverPanel } from "./LedgerSolverPanel";
import { MissionControl } from "./MissionControl";
import { MutationPanel } from "./MutationPanel";
import { ShiftOptimizerPanel } from "./ShiftOptimizerPanel";
import { downloadText, LAB_SKILLS, labFetch, requirementsOf, useLabSession } from "./labApi";
import "./platformLab.css";

type TabId = "run" | "evidence" | "shift" | "rules" | "mutation" | "route";
const TABS: { id: TabId; label: string; tech: string }[] = [
  { id: "run", label: "运行台", tech: "事件溯源 · 回放 · 分叉" },
  { id: "evidence", label: "证据验真", tech: "Merkle · Ed25519" },
  { id: "shift", label: "最优排班", tech: "HiGHS MILP" },
  { id: "rules", label: "规则求解", tech: "Z3 SMT" },
  { id: "mutation", label: "变异测试", tech: "门闩自检" },
  { id: "route", label: "路由置信度", tech: "共形预测" },
];

const TAB_KEY = "ownagent:lab-tab";

function slotRequirements(): { req: SkillDataRequirement; skills: string[] }[] {
  const out = new Map<ProductDataSlot, { req: SkillDataRequirement; skills: string[] }>();
  for (const s of LAB_SKILLS) {
    for (const r of requirementsOf(s.id)) {
      const hit = out.get(r.slot);
      if (hit) hit.skills.push(s.label);
      else out.set(r.slot, { req: r, skills: [s.label] });
    }
  }
  return [...out.values()];
}

function MaterialDock() {
  const lab = useLabSession();
  const slots = useMemo(slotRequirements, []);
  const [busy, setBusy] = useState<ProductDataSlot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputs = useRef<Partial<Record<ProductDataSlot, HTMLInputElement | null>>>({});

  async function onFile(slot: ProductDataSlot, file: File | undefined) {
    if (!file) return;
    setBusy(slot);
    setError(null);
    const r = await lab.upload(slot, file);
    setBusy(null);
    if (!r.ok) setError(`${file.name}：${r.error}`);
  }

  return (
    <div className="pl-dock">
      <div className="pl-dock-head">
        <strong>材料</strong>
        <span>{lab.sessionId ? `会话 ${lab.sessionId.slice(0, 14)}… · 只存在本次实验台会话里` : "导入你的 CSV，所有功能都在这批材料上算"}</span>
        {lab.materials.length ? (
          <button type="button" className="pl-btn pl-btn--ghost pl-btn--sm" onClick={lab.reset}>
            换一批
          </button>
        ) : null}
      </div>
      <div className="pl-dock-slots">
        {slots.map(({ req, skills }) => {
          const m = lab.materials.find((x) => x.slot === req.slot);
          return (
            <div key={req.slot} className={`pl-slot${m ? " is-filled" : ""}${busy === req.slot ? " is-busy" : ""}`}>
              <div className="pl-slot-top">
                <b>{req.label}</b>
                <small>{skills.join(" · ")}</small>
              </div>
              {m ? (
                <div className="pl-slot-file">
                  <span title={m.title}>{m.title}</span>
                  <em>
                    {m.rows} 行 · {m.columns.length} 列
                  </em>
                </div>
              ) : (
                <div className="pl-slot-file is-empty">
                  <span>未导入</span>
                </div>
              )}
              <div className="pl-slot-actions">
                <button type="button" className="pl-btn pl-btn--sm" onClick={() => inputs.current[req.slot]?.click()} disabled={busy != null}>
                  {busy === req.slot ? "导入中…" : m ? "替换" : "导入 CSV"}
                </button>
                {req.templateCsv ? (
                  <button
                    type="button"
                    className="pl-link"
                    title={req.templateCsv.split("\n")[0]}
                    onClick={() => downloadText(`${req.label}-表头.csv`, `${req.templateCsv.split("\n")[0]}\n`, "text/csv;charset=utf-8")}
                  >
                    表头模板
                  </button>
                ) : null}
              </div>
              <input
                ref={(el) => {
                  inputs.current[req.slot] = el;
                }}
                type="file"
                accept=".csv,.txt"
                hidden
                onChange={(e) => {
                  void onFile(req.slot, e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </div>
          );
        })}
      </div>
      {error ? <p className="pl-error">{error}</p> : null}
    </div>
  );
}

function StatusStrip() {
  const [health, setHealth] = useState<BackendHealth | null | undefined>(undefined);
  const [keyId, setKeyId] = useState<string | null>(null);
  useEffect(() => {
    void checkBackendHealth(true).then(setHealth);
    void labFetch<{ keyId: string }>("/api/evidence/public-key").then((r) => r.ok && setKeyId(r.data.keyId));
  }, []);
  const online = !!health?.ok;
  return (
    <div className="pl-status">
      <span className={`pl-pill${online ? " is-live" : health === null ? " is-down" : ""}`}>
        <i />
        {health === undefined ? "连接服务…" : online ? `服务在线 · ${health!.runtime}` : "服务离线"}
      </span>
      {online ? (
        <>
          <span className="pl-pill">数据库 {health!.db}</span>
          <span className="pl-pill">已执行 {health!.skillRuns} 次技能</span>
          <span className="pl-pill">{health!.llm ? "大模型已配置" : "未配置大模型（以下功能都不依赖它）"}</span>
        </>
      ) : null}
      {keyId ? <span className="pl-pill pl-mono">签名密钥 {keyId}</span> : null}
    </div>
  );
}

export function PlatformLab() {
  const [tab, setTabState] = useState<TabId>(() => {
    const t = sessionStorage.getItem(TAB_KEY) as TabId | null;
    return t && TABS.some((x) => x.id === t) ? t : "run";
  });
  const setTab = (t: TabId) => {
    sessionStorage.setItem(TAB_KEY, t);
    setTabState(t);
  };
  const [runs, setRuns] = useState<{ runId: string; label: string; status: string }[]>([]);
  const onRunsChange = useCallback((r: typeof runs) => setRuns(r), []);

  return (
    <div className="pl-root">
      <div className="pl-aurora" aria-hidden />
      <header className="pl-hero">
        <div className="pl-hero-copy">
          <span className="pl-eyebrow">OwnAgent · 实验台</span>
          <h1>每一步都可回放、可证明、可核对</h1>
          <p>求解器、事件溯源和密码学签名直接跑在你导入的业务材料上：哪条规则拦了单子、排班还能不能更好、交付的数字从哪来，都给出可复核的答案。</p>
        </div>
        <StatusStrip />
      </header>

      <MaterialDock />

      <nav className="pl-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? "is-on" : ""} onClick={() => setTab(t.id)}>
            <span>{t.label}</span>
            <small>{t.tech}</small>
          </button>
        ))}
      </nav>

      <div className="pl-stage">
        <div hidden={tab !== "run"}>
          <MissionControl onRunsChange={onRunsChange} />
        </div>
        <div hidden={tab !== "evidence"}>
          <EvidencePanel sharedRuns={runs} />
        </div>
        <div hidden={tab !== "shift"}>
          <ShiftOptimizerPanel />
        </div>
        <div hidden={tab !== "rules"}>
          <LedgerSolverPanel />
        </div>
        <div hidden={tab !== "mutation"}>
          <MutationPanel />
        </div>
        <div hidden={tab !== "route"}>
          <section className="pl-panel pl-panel--light">
            <header className="pl-panel-head">
              <div>
                <h2>路由置信度</h2>
                <p>用共形预测给「这句话交给哪个技能」一个有覆盖率保证的候选集；校准样本不够的类别会直接标出来，不假装有保证。</p>
              </div>
            </header>
            <RouteConfidencePanel />
          </section>
        </div>
      </div>
    </div>
  );
}
