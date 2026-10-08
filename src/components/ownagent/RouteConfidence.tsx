import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  getConformalRouter,
  getRouteAlpha,
  readRouteFeedback,
  ROUTER_EVENT,
  semanticStatus,
  setRouteAlpha,
  upgradeToSemantic,
  type ConformalRouter,
  type RouteVerdict,
  type RouterStats,
} from "../../lib/conformalRouter";
import { forkDeltaForAmbiguous, type ForkDeltaReport } from "../../lib/deterministicScm";
import { ScmForkViz } from "./ScmVisuals";
import { SKILL_PUBLISH_EVENT } from "../../lib/skillCompareStore";

const ALPHAS = [0.2, 0.1, 0.05];
const pct = (x: number) => `${Math.round(x * 100)}%`;

const STATUS_TEXT: Record<RouteVerdict["status"], string> = {
  confident: "直接交给它",
  ambiguous: "先反问用户",
  unsure: "候选太多，走通用流程",
  ood: "不像任何一类，走通用流程",
};

/** 接得准 — 这句话会交给哪个技能，以及正确去向还在不在候选里 */
export function RouteConfidencePanel() {
  const [open, setOpen] = useState(false);
  const [router, setRouter] = useState<ConformalRouter | null>(null);
  const [alpha, setAlpha] = useState(getRouteAlpha);
  const [model, setModel] = useState(semanticStatus);
  const [probe, setProbe] = useState("");
  const [verdict, setVerdict] = useState<RouteVerdict | null>(null);
  const [fork, setFork] = useState<ForkDeltaReport | null>(null);

  useEffect(() => {
    let alive = true;
    const sync = () => {
      setModel({ ...semanticStatus() });
      void getConformalRouter().then((r) => alive && setRouter(r));
    };
    sync();
    window.addEventListener(ROUTER_EVENT, sync);
    window.addEventListener(SKILL_PUBLISH_EVENT, sync);
    return () => {
      alive = false;
      window.removeEventListener(ROUTER_EVENT, sync);
      window.removeEventListener(SKILL_PUBLISH_EVENT, sync);
    };
  }, []);

  const stats: RouterStats | null = useMemo(() => (router ? router.stats(alpha) : null), [router, alpha]);

  useEffect(() => {
    if (!router || !probe.trim()) {
      setVerdict(null);
      setFork(null);
      return;
    }
    let alive = true;
    const t = window.setTimeout(() => {
      void router.decide(probe.trim(), alpha).then(async (v) => {
        if (!alive) return;
        setVerdict(v);
        if (v.status === "ambiguous" && v.set.length >= 2) {
          const ids = v.set.map((c) => c.id).filter((id) => !id.startsWith("@"));
          setFork(await forkDeltaForAmbiguous(probe.trim(), ids));
        } else {
          setFork(null);
        }
      });
    }, 250);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [router, probe, alpha]);

  function pickAlpha(a: number) {
    setRouteAlpha(a);
    setAlpha(a);
  }

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const semantic = router?.embedderKind === "semantic";
  const loadPct =
    model.status === "loading" && model.progress?.total ? Math.round((model.progress.loaded / model.progress.total) * 100) : null;
  const feedbackN = readRouteFeedback().length;

  return (
    <>
      <button type="button" className="own-skm-batch-btn own-skm-batch-btn--pop" onClick={() => setOpen(true)}>
        准确度{stats ? ` ${pct(stats.coverage)}` : ""}
      </button>
      {open
        ? createPortal(
            <div className="oa-modal-backdrop" role="dialog" aria-modal="true" aria-label="准确度" onClick={() => setOpen(false)}>
              <div className="oa-modal oa-modal--wide own-rc" onClick={(event) => event.stopPropagation()}>
                <header className="own-rc-head">
                  <div>
                    <strong>准确度</strong>
                    <p>每句话给出一组可能的去向。只剩一个就执行，剩几个就先问，不靠一个分数硬猜。</p>
                  </div>
                  <button type="button" className="own-rc-close" onClick={() => setOpen(false)}>
                    关闭
                  </button>
                </header>
                {stats ? (
        <div className="own-rc-body">

          <div className="own-rc-row">
            <span>目标</span>
            <div className="own-rc-seg">
              {ALPHAS.map((a) => (
                <button key={a} type="button" className={a === alpha ? "is-on" : ""} onClick={() => pickAlpha(a)}>
                  {pct(1 - a)}
                </button>
              ))}
            </div>
            <span className="own-rc-model">
              {semantic ? (
                "语义模型 bge-small-zh · 本机运行"
              ) : model.status === "loading" ? (
                `语义模型下载中${loadPct != null ? ` ${loadPct}%` : "…"}`
              ) : (
                <>
                  字符模型（只认字面）
                  <button type="button" className="own-skm-batch-btn" onClick={() => void upgradeToSemantic()}>
                    {model.status === "error" ? "重试加载语义模型" : "加载语义模型 · 24MB"}
                  </button>
                </>
              )}
            </span>
          </div>

          <div className="own-rc-grid">
            <div>
              <b className={stats.coverage + 0.02 >= 1 - alpha ? "is-ok" : "is-warn"}>{pct(stats.coverage)}</b>
              <span>实测覆盖率</span>
              <small>正确去向在候选里的比例，承诺 ≥ {pct(1 - alpha)}</small>
            </div>
            <div>
              <b>{pct(stats.singletonRate)}</b>
              <span>直接执行</span>
              <small>其中做对 {pct(stats.singletonAccuracy)}</small>
            </div>
            <div>
              <b>{stats.avgSetSize.toFixed(1)}</b>
              <span>平均候选数</span>
              <small>越接近 1 越果断</small>
            </div>
            <div>
              <b>{pct(stats.oodDetected)}</b>
              <span>拦下无关问题</span>
              <small>误拦正常问题 {pct(stats.oodFalseAlarm)}</small>
            </div>
          </div>

          <p className="own-rc-note">
            对照：如果只看最高分 ≥ {pct(1 - alpha)} 就执行，能执行 {pct(stats.naiveConfidentRate)} 的问题，做对{" "}
            {pct(stats.naiveConfidentAccuracy)}；只选最高分则做对 {pct(stats.top1Accuracy)}。数据：{stats.n} 句校准
            {feedbackN ? ` · 其中 ${feedbackN} 句来自用户在反问里的选择` : ""}，随机切分 200 次取平均。
          </p>

          <div className="own-rc-try">
            <input value={probe} onChange={(e) => setProbe(e.target.value)} placeholder="试一句，看看会交给谁" />
            {verdict ? (
              <div className="own-rc-verdict">
                <strong>{STATUS_TEXT[verdict.status]}</strong>
                <ul>
                  {(verdict.set.length ? verdict.set : [verdict.top]).map((c) => (
                    <li key={c.id}>
                      <span>{c.label}</span>
                      <i style={{ width: `${Math.max(2, c.p * 100)}%` }} />
                      <em>{pct(c.p)}</em>
                    </li>
                  ))}
                </ul>
                {fork && verdict.status === "ambiguous" && verdict.set.length >= 2 ? (
                  <div className="own-rc-fork">
                    <strong>SCM 选哪条路差多少</strong>
                    <ScmForkViz fork={fork} />
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
                ) : (
                  <p className="own-rc-lead">正在校准…</p>
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
