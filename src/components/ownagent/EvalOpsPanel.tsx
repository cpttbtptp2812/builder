import { useCallback, useEffect, useRef, useState } from "react";
import { detectMode, evalStore, type StoreMode } from "../../lib/evalops/client";
import { DEFAULT_RUN_OPTIONS, newId, type EvalCase, type EvalRun, type EvalSuite, type EvalTarget } from "../../lib/evalops/types";
import { listKnowledgeDocs } from "../../lib/ownKnowledge";
import { OaBadge, OaBtn, OaPage, OaTabs } from "./OaUi";
import { EvalRuns, type JudgeInfo } from "./evalops/EvalRuns";
import { EvalSuites } from "./evalops/EvalSuites";
import { blankTarget, EvalTargets } from "./evalops/EvalTargets";
import "./evalops/evalops.css";

type Tab = "runs" | "suites" | "targets";

function demoCases(): EvalCase[] {
  const out: EvalCase[] = [];
  const docs = listKnowledgeDocs();
  for (let round = 0; out.length < 8 && round < 3; round++) {
    for (const d of docs) {
      const q = d.prompts[round];
      if (q && out.length < 8) out.push({ id: newId("case"), question: q, expectSource: d.title, origin: "manual" });
    }
  }
  if (!out.length) out.push({ id: newId("case"), question: "年假有几天？", origin: "manual" });
  return out;
}

export function EvalOpsPanel({
  focus = "all",
  openSuiteId = null,
  onEditSuite,
}: {
  /** suites = 只编辑题目；compare = 对比和版本；all = 原来的整页 */
  focus?: "all" | "suites" | "compare";
  openSuiteId?: string | null;
  onEditSuite?: (id: string) => void;
} = {}) {
  const [tab, setTab] = useState<Tab>(focus === "suites" ? "suites" : "runs");
  const [mode, setMode] = useState<StoreMode | null>(null);
  const [judge, setJudge] = useState<JudgeInfo>(null);
  const [targets, setTargets] = useState<EvalTarget[]>([]);
  const [suites, setSuites] = useState<EvalSuite[]>([]);
  const [runs, setRuns] = useState<EvalRun[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [openRun, setOpenRun] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [demoBusy, setDemoBusy] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const reload = useCallback(async () => {
    try {
      const [t, s, r] = await Promise.all([evalStore.listTargets(), evalStore.listSuites(), evalStore.listRuns()]);
      setTargets(t);
      setSuites(s);
      setRuns(r);
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e));
    } finally {
      setLoaded(true);
    }
  }, [notify]);

  useEffect(() => {
    void (async () => {
      setMode(await detectMode(true));
      setJudge(await evalStore.judgeInfo());
      await reload();
    })();
  }, [reload]);

  useEffect(() => {
    if (!runs.some((r) => r.status === "running" || r.status === "queued") || openRun) return;
    const t = setInterval(() => void evalStore.listRuns().then(setRuns).catch(() => {}), 2000);
    return () => clearInterval(t);
  }, [runs, openRun]);

  async function runDemo() {
    setDemoBusy(true);
    try {
      const a = await evalStore.saveTarget({ ...blankTarget("builtin"), id: newId("tgt"), name: "示例 · 完整流程", builtin: { variant: "full" }, note: "技能 + 资料库" });
      const b = await evalStore.saveTarget({ ...blankTarget("builtin"), id: newId("tgt"), name: "示例 · 只查资料库", builtin: { variant: "kb-only" }, note: "假设把技能关掉" });
      const s = await evalStore.saveSuite({ id: newId("suite"), name: "示例 · 资料库常见问题", description: "取自资料库每篇文档的推荐问题", cases: demoCases(), createdAt: "", updatedAt: "" });
      const r = await evalStore.startRun({ name: "示例：关掉技能会怎样", suiteId: s.id, targetAId: a.id, targetBId: b.id, options: { ...DEFAULT_RUN_OPTIONS, useLlmJudge: Boolean(judge) } });
      await reload();
      setTab("runs");
      setOpenRun(r.id);
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e));
    } finally {
      setDemoBusy(false);
    }
  }

  const steps = [
    { done: targets.length > 0, title: "接入被测对象", desc: "你的 AI 应用接口、模型，或本系统", tab: "targets" as const },
    { done: suites.length > 0, title: "准备测试集", desc: "上传、粘贴、从日志导入或从文档出题", tab: "suites" as const },
    { done: runs.length > 0, title: "跑一次对比", desc: "改动前后各跑一遍，看哪些题变差", tab: "runs" as const },
  ];
  const showGuide = loaded && !runs.length && focus !== "suites";
  const embedded = focus !== "all";
  const tabs = (
    onEditSuite
      ? [
          { id: "runs" as const, label: `对比${runs.length ? ` ${runs.length}` : ""}` },
          { id: "targets" as const, label: `版本${targets.length ? ` ${targets.length}` : ""}` },
        ]
      : [
          { id: "runs" as const, label: `实验${runs.length ? ` ${runs.length}` : ""}` },
          { id: "suites" as const, label: `测试集${suites.length ? ` ${suites.length}` : ""}` },
          { id: "targets" as const, label: `被测对象${targets.length ? ` ${targets.length}` : ""}` },
        ]
  );

  return (
    <OaPage
      chrome={!embedded}
      title="回归评测"
      desc="改提示词、换模型、更新知识库之前，用同一批问题把新旧两版各跑一遍，逐题告诉你哪些变好、哪些变坏、能不能上线。"
      toast={toast}
      actions={
        <span className="eo-head-badges">
          {mode ? (
            <OaBadge tone={mode === "server" ? "ok" : "warn"}>{mode === "server" ? "数据存在服务端" : "后端未启动 · 存在本浏览器"}</OaBadge>
          ) : null}
          <OaBadge tone={judge ? "info" : "neutral"}>{judge ? `裁判 ${judge.model}` : "未配置裁判模型"}</OaBadge>
        </span>
      }
    >
      {showGuide ? (
        <section className="eo-guide">
          <ol className="eo-steps">
            {steps.map((s, i) => (
              <li key={s.title} className={s.done ? "done" : ""}>
                <button type="button" onClick={() => {
                  setOpenRun(null);
                  if (s.tab === "suites" && onEditSuite) onEditSuite("");
                  else setTab(s.tab);
                }}>
                  <span className="eo-step-no">{s.done ? "✓" : i + 1}</span>
                  <span>
                    <strong>{s.title}</strong>
                    <em>{s.desc}</em>
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <div className="eo-guide-demo">
            <span className="eo-muted">不知道从哪开始？用本系统自带的 Agent 跑一个示例：对比「完整流程」和「只查资料库」。</span>
            <OaBtn size="sm" variant="ghost" disabled={demoBusy} onClick={() => void runDemo()}>
              {demoBusy ? "准备中…" : "一键跑示例"}
            </OaBtn>
          </div>
        </section>
      ) : null}

      {focus === "suites" ? null : (
      <OaTabs<Tab>
        label="回归评测"
        value={tabs.some((t) => t.id === tab) ? tab : "runs"}
        onChange={(t) => {
          setTab(t);
          if (t === "runs") setOpenRun(null);
        }}
        tabs={tabs}
      />
      )}

      <div className="eo-body">
        {!loaded ? (
          <p className="eo-muted">加载中…</p>
        ) : focus === "suites" || tab === "suites" ? (
          <EvalSuites suites={suites} onChanged={() => void reload()} notify={notify} openSuiteId={openSuiteId} />
        ) : tab === "runs" ? (
          <EvalRuns
            runs={runs}
            suites={suites}
            targets={targets}
            judge={judge}
            openId={openRun}
            onOpen={setOpenRun}
            onChanged={() => void reload()}
            goTab={setTab}
            notify={notify}
            onEditSuite={onEditSuite}
          />
        ) : (
          <EvalTargets targets={targets} onChanged={() => void reload()} notify={notify} />
        )}
      </div>
    </OaPage>
  );
}
