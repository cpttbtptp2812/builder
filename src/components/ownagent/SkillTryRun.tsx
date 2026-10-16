import { useMemo, useRef, useState } from "react";
import { downloadText } from "../../lib/importedSkills";
import { isLlmConfigured, isLlmProbeLive, loadLlmConfig, toProductLlmConfig } from "../../lib/llmConfig";
import { isInlineRuntimeSkill } from "../../lib/agentSkills";
import { requirementsForSkill, type SkillDataRequirement } from "../../lib/productSkillInputs";
import { PRODUCT_FILE_ACCEPT } from "../../lib/uploadProductFile";
import {
  clearTryMaterial,
  compareTryRuns,
  loadTryMaterial,
  runSkillTry,
  saveTryMaterial,
  tryRunSessionId,
  uploadTryMaterial,
  uploadTryMaterialFile,
  type TryMaterial,
  type TryRunSummary,
  type TryStep,
} from "../../lib/skillTryRun";
import { OaBtn } from "./OaUi";
import "../../styles/skill-try-run.css";

type Side = { version: string; summary: TryRunSummary };
type TryResult = { online: Side; draft: Side | null; query: string; at: number };

function modelLine(): { text: string; tone: "ok" | "warn" | "off" } {
  const cfg = loadLlmConfig();
  if (!isLlmConfigured(cfg)) return { text: "大模型没接：模型那一步会跳过，结论只用计算结果。", tone: "off" };
  if (isLlmProbeLive(cfg)) return { text: `大模型 ${cfg.model} 已连通：模型那一步会真实调用。`, tone: "ok" };
  return { text: `大模型 ${cfg.model} 已配置但没测通：模型那一步可能失败。去「规则 → 接入配置」测一下。`, tone: "warn" };
}

function StepCell({ step }: { step: TryStep | null }) {
  if (!step) return <td className="sk-try-cell is-none">没有这一步</td>;
  return (
    <td className={`sk-try-cell${step.ok ? "" : " is-bad"}`}>
      {step.ok ? null : <strong>没通过：</strong>}
      {step.detail}
    </td>
  );
}

function Conclusion({ label, side }: { label: string; side: Side }) {
  const s = side.summary;
  return (
    <div className={`sk-try-verdict${s.ok ? "" : " is-bad"}`}>
      <span className="sk-try-verdict-tag">
        {label} v{side.version} · {s.ok ? `${s.steps.length} 步全部跑完` : `停在第 ${s.steps.indexOf(s.failedStep!) + 1} 步`} ·{" "}
        {s.totalMs < 1000 ? `${s.totalMs} 毫秒` : `${(s.totalMs / 1000).toFixed(1)} 秒`}
      </span>
      <p>{s.conclusion || "没有产出结论"}</p>
      {s.model ? (
        <p className={`sk-try-model is-${s.model.state}`}>
          {s.model.state === "used" ? `模型说明（${s.model.model}）：${s.model.text}` : null}
          {s.model.state === "failed" ? `模型那一步失败：${s.model.text}` : null}
          {s.model.state === "skipped" ? s.model.text : null}
        </p>
      ) : null}
    </div>
  );
}

export function SkillTryRun({
  skillId,
  online,
  draft,
  hasChanges,
  liveVersion,
  draftVersion,
  stepLabels,
  defaultQuery,
}: {
  skillId: string;
  online: string;
  draft: string;
  hasChanges: boolean;
  liveVersion: string;
  draftVersion: string;
  stepLabels: Record<string, string>;
  defaultQuery: string;
}) {
  const reqs = useMemo(() => requirementsForSkill(skillId), [skillId]);
  const inlineRun = isInlineRuntimeSkill(skillId);
  const needsMaterial = reqs.length > 0;
  const [materials, setMaterials] = useState<Record<string, TryMaterial | null>>(() =>
    Object.fromEntries(reqs.map((r) => [r.slot, loadTryMaterial(skillId, r.slot)])),
  );
  const [query, setQuery] = useState(defaultQuery);
  const [busy, setBusy] = useState<"" | "file" | "run">("");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [result, setResult] = useState<TryResult | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const model = modelLine();

  const missing = reqs.filter((r) => !materials[r.slot]);
  const runDisabled = busy !== "" || missing.length > 0 || !query.trim();
  const ranRaw = useRef<{ online: string; draft: string } | null>(null);
  const stale = result != null && ranRaw.current != null && (ranRaw.current.online !== online || ranRaw.current.draft !== draft);

  async function pickFile(req: SkillDataRequirement, file: File) {
    setBusy("file");
    setError(null);
    setNote(null);
    const sessionId = tryRunSessionId(skillId);
    try {
      const up = await uploadTryMaterialFile(sessionId, skillId, req.slot, file);
      if (!up.ok) {
        setError(`「${file.name}」没导进去：${up.error}`);
        return;
      }
      const m: TryMaterial = { slot: req.slot, title: up.title, csv: up.csv };
      const kept = saveTryMaterial(skillId, m);
      setMaterials((prev) => ({ ...prev, [req.slot]: m }));
      setResult(null);
      setNote(`已载入「${up.title}」共 ${up.rows} 行${kept ? "" : "（文件较大，刷新页面后需要重新选）"}`);
    } finally {
      setBusy("");
    }
  }

  function removeMaterial(req: SkillDataRequirement) {
    clearTryMaterial(skillId, req.slot);
    setMaterials((prev) => ({ ...prev, [req.slot]: null }));
    setResult(null);
  }

  async function run() {
    if (runDisabled) return;
    setBusy("run");
    setError(null);
    setNote(null);
    const sessionId = tryRunSessionId(skillId);
    const snap = { online, draft };
    try {
      for (const r of reqs) {
        const m = materials[r.slot];
        if (!m) continue;
        const up = await uploadTryMaterial(sessionId, m);
        if (!up.ok) {
          setError(`材料「${m.title}」没送到办事服务：${up.error}`);
          return;
        }
      }
      const cfg = loadLlmConfig();
      const llmConfig = isLlmConfigured(cfg) ? toProductLlmConfig(cfg) : undefined;
      const base = { skillId, query: query.trim(), sessionId, productWorkbench: needsMaterial, llmConfig };
      const a = await runSkillTry({ ...base, raw: snap.online });
      if (!a.ok) {
        setError(`线上版 v${liveVersion} 没跑起来：${a.error}`);
        return;
      }
      let b: Side | null = null;
      if (hasChanges) {
        const d = await runSkillTry({ ...base, raw: snap.draft });
        if (!d.ok) {
          setError(`草稿 v${draftVersion} 没跑起来：${d.error}`);
          return;
        }
        b = { version: draftVersion, summary: d.summary };
      }
      ranRaw.current = snap;
      setResult({ online: { version: liveVersion, summary: a.summary }, draft: b, query: base.query, at: Date.now() });
    } finally {
      setBusy("");
    }
  }

  const compared = result?.draft ? compareTryRuns(result.online.summary, result.draft.summary) : null;
  const rows = compared?.rows ?? result?.online.summary.steps.map((s) => ({ stepId: s.stepId, online: s, draft: null, changed: false })) ?? [];

  return (
    <section id="sk-try-run" className="sk-col sk-try" aria-label="用材料试跑">
      <header className="sk-col-h">
        <div className="sk-col-h-title">
          <span className="sk-col-h-tag">试跑</span>
          <h2>{inlineRun ? "输入问句，跑一遍 MCP 流水线" : "用一份真实材料跑一遍"}</h2>
        </div>
        <span className="sk-col-h-badge">
          {hasChanges ? `线上 v${liveVersion} 和草稿 v${draftVersion} 各跑一次` : `跑线上 v${liveVersion}`}
        </span>
      </header>
      <div className="sk-try-body">
        <p className="sk-try-lead">
          {inlineRun
            ? "不需要导入表格。走服务端 run-inline，逐步调用知识检索、探活、DOM、性能与 workflow 入队，和出厂 SKILL 步骤一致。"
            : "试跑和对话里办事用的是同一套计算，只是不会改动正在用的版本，也不会进客户的办理记录。"}
        </p>

        {needsMaterial ? (
          <ul className="sk-try-materials">
            {reqs.map((r) => {
              const m = materials[r.slot];
              return (
                <li key={r.slot}>
                  <span className="sk-try-mat-label">
                    {r.label}
                    {m ? <em className="is-ok">已选 · {m.title}</em> : <em>{r.hint}</em>}
                  </span>
                  <span className="sk-try-mat-actions">
                    <button
                      type="button"
                      className="own-compare-secondary-btn"
                      disabled={busy !== ""}
                      onClick={() => downloadText(r.filename, `\uFEFF${r.templateCsv}`, "text/csv;charset=utf-8")}
                    >
                      下载表头模板
                    </button>
                    {m ? (
                      <button type="button" className="own-compare-secondary-btn" disabled={busy !== ""} onClick={() => removeMaterial(r)}>
                        移除
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="own-compare-secondary-btn sk-try-pick"
                      disabled={busy !== ""}
                      onClick={() => fileRefs.current[r.slot]?.click()}
                    >
                      {busy === "file" ? "读取中…" : m ? "换一份" : "选择 CSV / Excel / PDF"}
                    </button>
                    <input
                      ref={(el) => {
                        fileRefs.current[r.slot] = el;
                      }}
                      type="file"
                      accept={PRODUCT_FILE_ACCEPT}
                      hidden
                      aria-hidden
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (f) void pickFile(r, f);
                      }}
                    />
                  </span>
                </li>
              );
            })}
          </ul>
        ) : null}

        <label className="sk-try-query">
          <span>{inlineRun ? "这次问什么" : "这次办什么"}</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              inlineRun ? "例如：综合诊断本站和 OwnAgent 项目知识" : "例如：按部门汇总，发票对不上的拦下来"
            }
          />
        </label>

        <p className={`sk-try-llm is-${model.tone}`}>{model.text}</p>

        <div className="sk-try-actions">
          <OaBtn className="sk-try-run" disabled={runDisabled} onClick={() => void run()}>
            {busy === "run" ? "正在试跑…" : result ? "再跑一次" : "开始试跑"}
          </OaBtn>
          {missing.length ? <span className="sk-try-hint">先选「{missing[0]!.label}」</span> : null}
          {stale ? <span className="sk-try-hint is-warn">内容改过了，下面是改之前的结果，再跑一次才准</span> : null}
        </div>

        {note ? <p className="sk-try-note">{note}</p> : null}
        {error ? <p className="sk-try-error" role="alert">{error}</p> : null}

        {result ? (
          <div className="sk-try-result">
            <div className={`sk-try-verdicts${result.draft ? " is-two" : ""}`}>
              <Conclusion label="线上" side={result.online} />
              {result.draft ? <Conclusion label="草稿" side={result.draft} /> : null}
            </div>
            {compared ? (
              <p className={`sk-try-diff${compared.changedCount ? " is-changed" : ""}`}>
                {compared.changedCount
                  ? `这份材料上，草稿有 ${compared.changedCount} 步的结果和线上不一样，已标黄。`
                  : "这份材料上，草稿每一步的结果都和线上一样。"}
              </p>
            ) : null}
            <div className="sk-try-table-wrap">
              <table className="sk-try-table">
                <thead>
                  <tr>
                    <th>步骤</th>
                    <th>线上 v{result.online.version}</th>
                    {result.draft ? <th>草稿 v{result.draft.version}</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.stepId} className={r.changed ? "is-changed" : undefined}>
                      <th scope="row">
                        <span>{i + 1}</span>
                        {stepLabels[r.stepId] || r.stepId}
                      </th>
                      <StepCell step={r.online} />
                      {result.draft ? <StepCell step={r.draft} /> : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
