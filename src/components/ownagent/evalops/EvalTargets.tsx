import { useState } from "react";
import { evalStore } from "../../../lib/evalops/client";
import { DEFAULT_OPENAI_TARGET, HTTP_PRESETS, targetSummary } from "../../../lib/evalops/targets";
import { newId, type EvalTarget, type HttpTargetConfig, type InvokeResult, type TargetKind } from "../../../lib/evalops/types";
import { loadLlmConfig } from "../../../lib/llmConfig";
import { OaBadge, OaBtn, OaCard, OaCheck, OaEmpty, OaField, OaInput, OaSelect, OaTextarea } from "../OaUi";

const KIND_LABEL: Record<TargetKind, string> = {
  http: "接口接入",
  openai: "模型直连",
  builtin: "本系统内置",
};

const KIND_HINT: Record<TargetKind, string> = {
  http: "已经有自己的 AI 应用或知识库问答：填接口地址，我们把整个系统当黑盒调用，不用搬数据",
  openai: "想比较两个模型、或两版系统提示词：直接填 OpenAI 兼容的模型地址",
  builtin: "用本系统自带的 Agent 体验流程",
};

export function blankTarget(kind: TargetKind = "http"): EvalTarget {
  const now = new Date().toISOString();
  const preset = HTTP_PRESETS[0]!;
  return {
    id: "",
    name: "",
    kind,
    preset: kind === "http" ? preset.id : undefined,
    http: kind === "http" ? JSON.parse(JSON.stringify(preset.http)) : undefined,
    openai: kind === "openai" ? { ...DEFAULT_OPENAI_TARGET } : undefined,
    builtin: kind === "builtin" ? { variant: "full" } : undefined,
    createdAt: now,
    updatedAt: now,
  };
}

export function EvalTargets({
  targets,
  onChanged,
  notify,
}: {
  targets: EvalTarget[];
  onChanged: () => void;
  notify: (msg: string) => void;
}) {
  const [editing, setEditing] = useState<EvalTarget | null>(null);

  if (editing) {
    return (
      <TargetEditor
        initial={editing}
        onCancel={() => setEditing(null)}
        onSaved={(t) => {
          setEditing(null);
          onChanged();
          notify(`已保存「${t.name}」`);
        }}
      />
    );
  }

  return (
    <div className="eo-stack">
      <div className="eo-callout">
        <strong>已经有自己的知识库或 AI 应用？</strong>
        <span>
          不用把资料搬过来。选「接口接入」，把你的系统当成黑盒来调用。要测知识库改动，就配两个对象（比如测试环境和正式环境），或同一个接口带不同参数。
        </span>
      </div>
      <div className="eo-row-between">
        <span className="eo-muted">{targets.length ? `共 ${targets.length} 个被测对象` : ""}</span>
        <OaBtn onClick={() => setEditing(blankTarget("http"))}>+ 接入被测对象</OaBtn>
      </div>
      {!targets.length ? (
        <OaEmpty>还没有被测对象。先接入一个，才能开始评测。</OaEmpty>
      ) : (
        <div className="eo-grid">
          {targets.map((t) => (
            <OaCard key={t.id} className="eo-target-card">
              <div className="eo-row-between">
                <strong>{t.name}</strong>
                <OaBadge tone="info">{KIND_LABEL[t.kind]}</OaBadge>
              </div>
              <p className="eo-muted">{targetSummary(t)}</p>
              {t.note ? <p className="eo-note">{t.note}</p> : null}
              <div className="eo-actions">
                <OaBtn size="sm" variant="ghost" onClick={() => setEditing(t)}>
                  编辑 / 试调
                </OaBtn>
                <OaBtn
                  size="sm"
                  variant="danger"
                  onClick={async () => {
                    if (!window.confirm(`删除「${t.name}」？已跑完的实验记录不受影响。`)) return;
                    await evalStore.deleteTarget(t.id);
                    onChanged();
                  }}
                >
                  删除
                </OaBtn>
              </div>
            </OaCard>
          ))}
        </div>
      )}
    </div>
  );
}

function HeaderRows({ headers, onChange }: { headers: Record<string, string>; onChange: (h: Record<string, string>) => void }) {
  const rows = Object.entries(headers);
  const set = (list: [string, string][]) => onChange(Object.fromEntries(list));
  return (
    <div className="eo-kv">
      {rows.map(([k, v], i) => (
        <div key={i} className="eo-kv-row">
          <OaInput
            value={k}
            placeholder="名称，如 Authorization"
            onChange={(e) => set(rows.map((r, j) => (j === i ? [e.target.value, r[1]] : r)))}
          />
          <OaInput
            value={v}
            placeholder="值，如 Bearer sk-xxx"
            onChange={(e) => set(rows.map((r, j) => (j === i ? [r[0], e.target.value] : r)))}
          />
          <button type="button" className="eo-x" aria-label="删除这一行" onClick={() => set(rows.filter((_, j) => j !== i))}>
            ×
          </button>
        </div>
      ))}
      <button type="button" className="eo-link" onClick={() => set([...rows, ["", ""]])}>
        + 添加请求头
      </button>
    </div>
  );
}

function TargetEditor({
  initial,
  onCancel,
  onSaved,
}: {
  initial: EvalTarget;
  onCancel: () => void;
  onSaved: (t: EvalTarget) => void;
}) {
  const [t, setT] = useState<EvalTarget>(initial);
  const [question, setQuestion] = useState("年假有几天？");
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<InvokeResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const setHttp = (patch: Partial<HttpTargetConfig>) => setT((x) => ({ ...x, http: { ...x.http!, ...patch } }));

  function switchKind(kind: TargetKind) {
    const fresh = blankTarget(kind);
    setT((x) => ({ ...fresh, id: x.id, name: x.name, note: x.note, createdAt: x.createdAt }));
    setResult(null);
  }

  function applyPreset(id: string) {
    const p = HTTP_PRESETS.find((x) => x.id === id);
    if (!p) return;
    setT((x) => ({ ...x, preset: id, http: JSON.parse(JSON.stringify(p.http)) }));
    setResult(null);
  }

  async function test() {
    setTesting(true);
    setResult(null);
    try {
      setResult(await evalStore.testTarget(t, question));
    } catch (e) {
      setResult({ answer: "", citations: [], latencyMs: 0, error: e instanceof Error ? e.message : String(e) });
    } finally {
      setTesting(false);
    }
  }

  async function save() {
    if (!t.name.trim()) {
      setErr("给它起个名字，比如「线上版」「测试环境」「换模型后」");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      onSaved(await evalStore.saveTarget({ ...t, id: t.id || newId("tgt"), name: t.name.trim() }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const preset = HTTP_PRESETS.find((p) => p.id === t.preset);

  return (
    <OaCard className="eo-editor">
      <div className="eo-row-between">
        <h3>{initial.id ? `编辑「${initial.name}」` : "接入被测对象"}</h3>
        <button type="button" className="eo-link" onClick={onCancel}>
          ← 返回列表
        </button>
      </div>

      <OaField label="名称" hint="实验报告里会用这个名字区分两边">
        <OaInput value={t.name} placeholder="如：线上版 / 测试环境 / 换 GPT-4o 后" onChange={(e) => setT({ ...t, name: e.target.value })} />
      </OaField>

      <div className="eo-seg" role="radiogroup" aria-label="接入方式">
        {(Object.keys(KIND_LABEL) as TargetKind[]).map((k) => (
          <button key={k} type="button" role="radio" aria-checked={t.kind === k} className={t.kind === k ? "on" : ""} onClick={() => switchKind(k)}>
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>
      <p className="eo-muted">{KIND_HINT[t.kind]}</p>

      {t.kind === "http" && t.http ? (
        <div className="eo-stack">
          <div className="eo-presets">
            {HTTP_PRESETS.map((p) => (
              <button key={p.id} type="button" className={t.preset === p.id ? "on" : ""} onClick={() => applyPreset(p.id)}>
                {p.label}
              </button>
            ))}
          </div>
          {preset ? <p className="eo-muted">{preset.hint}</p> : null}
          <div className="eo-cols">
            <OaField label="请求方式" className="eo-w-sm">
              <OaSelect value={t.http.method} onChange={(e) => setHttp({ method: e.target.value as "POST" | "GET" })}>
                <option value="POST">POST</option>
                <option value="GET">GET</option>
              </OaSelect>
            </OaField>
            <OaField label="接口地址" hint={t.http.method === "GET" ? "地址里可用 {{question}} 代表问题" : undefined}>
              <OaInput value={t.http.url} onChange={(e) => setHttp({ url: e.target.value })} />
            </OaField>
          </div>
          <div className="oa-field">
            <span className="oa-field-label">请求头</span>
            <span className="oa-field-hint">密钥保存后只显示后 4 位，不会回传到页面</span>
            <HeaderRows headers={t.http.headers} onChange={(headers) => setHttp({ headers })} />
          </div>
          {t.http.method === "POST" ? (
            <OaField label="请求体模板" hint="{{question}} 会替换成测试题">
              <OaTextarea rows={6} className="eo-mono" value={t.http.bodyTemplate} onChange={(e) => setHttp({ bodyTemplate: e.target.value })} />
            </OaField>
          ) : null}
          <div className="eo-cols">
            <OaField label="答案在返回里的位置" hint="如 answer、data.reply、choices.0.message.content">
              <OaInput className="eo-mono" value={t.http.answerPath} onChange={(e) => setHttp({ answerPath: e.target.value })} />
            </OaField>
            <OaField label="引用列表的位置（可选）" hint="有引用时裁判能检查回答有没有依据">
              <OaInput className="eo-mono" value={t.http.citationsPath ?? ""} onChange={(e) => setHttp({ citationsPath: e.target.value || undefined })} />
            </OaField>
            <OaField label="引用里的文本字段（可选）" className="eo-w-md">
              <OaInput className="eo-mono" value={t.http.citationField ?? ""} placeholder="content" onChange={(e) => setHttp({ citationField: e.target.value || undefined })} />
            </OaField>
          </div>
          <details className="eo-details">
            <summary>流式返回设置（接口按 SSE 一段段返回时才需要）</summary>
            <div className="eo-cols">
              <OaCheck compact checked={Boolean(t.http.stream)} onChange={(stream) => setHttp({ stream })} label="接口是流式返回" />
              <OaField label="拼接方式" className="eo-w-md">
                <OaSelect value={t.http.streamMode ?? "delta"} onChange={(e) => setHttp({ streamMode: e.target.value as "delta" | "final" })}>
                  <option value="delta">逐段拼接</option>
                  <option value="final">只取最后一段</option>
                </OaSelect>
              </OaField>
              <OaField label="只读取此事件（可选）">
                <OaInput className="eo-mono" value={t.http.streamEvent ?? ""} placeholder="如 conversation.message.delta" onChange={(e) => setHttp({ streamEvent: e.target.value || undefined })} />
              </OaField>
            </div>
          </details>
        </div>
      ) : null}

      {t.kind === "openai" && t.openai ? (
        <div className="eo-stack">
          <div className="eo-row-between">
            <span className="eo-muted">OpenAI 兼容：DeepSeek、通义、Kimi、Ollama、vLLM 等都可以</span>
            <button
              type="button"
              className="eo-link"
              onClick={() => {
                const c = loadLlmConfig();
                setT({ ...t, openai: { ...t.openai!, baseUrl: c.baseUrl, model: c.model, apiKey: c.apiKey } });
              }}
            >
              从「接入配置」带入
            </button>
          </div>
          <div className="eo-cols">
            <OaField label="Base URL">
              <OaInput value={t.openai.baseUrl} onChange={(e) => setT({ ...t, openai: { ...t.openai!, baseUrl: e.target.value } })} />
            </OaField>
            <OaField label="模型" className="eo-w-md">
              <OaInput value={t.openai.model} onChange={(e) => setT({ ...t, openai: { ...t.openai!, model: e.target.value } })} />
            </OaField>
            <OaField label="温度" className="eo-w-sm">
              <OaInput
                type="number"
                min={0}
                max={2}
                step={0.1}
                value={t.openai.temperature}
                onChange={(e) => setT({ ...t, openai: { ...t.openai!, temperature: Number(e.target.value) } })}
              />
            </OaField>
          </div>
          <OaField label="API Key">
            <OaInput type="password" value={t.openai.apiKey} placeholder="sk-..." onChange={(e) => setT({ ...t, openai: { ...t.openai!, apiKey: e.target.value } })} />
          </OaField>
          <OaField label="系统提示词" hint="想比较两版提示词，就建两个对象，只改这里">
            <OaTextarea rows={4} value={t.openai.systemPrompt} onChange={(e) => setT({ ...t, openai: { ...t.openai!, systemPrompt: e.target.value } })} />
          </OaField>
        </div>
      ) : null}

      {t.kind === "builtin" ? (
        <div className="eo-seg" role="radiogroup" aria-label="内置模式">
          {(
            [
              ["full", "技能 + 资料库（线上完整流程）"],
              ["kb-only", "只查资料库（不走技能）"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={t.builtin?.variant === v}
              className={t.builtin?.variant === v ? "on" : ""}
              onClick={() => setT({ ...t, builtin: { variant: v } })}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      <OaField label="备注（可选）">
        <OaInput value={t.note ?? ""} placeholder="如：知识库 9 月版、换了新的切分方式" onChange={(e) => setT({ ...t, note: e.target.value || undefined })} />
      </OaField>

      <div className="eo-test">
        <div className="eo-test-row">
          <OaInput value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="输入一个问题试调" />
          <OaBtn variant="ghost" onClick={() => void test()} disabled={testing}>
            {testing ? "调用中…" : "试调一次"}
          </OaBtn>
        </div>
        {result ? (
          <div className={`eo-test-result${result.error ? " is-err" : ""}`}>
            {result.error ? (
              <p>✗ {result.error}</p>
            ) : (
              <>
                <p className="eo-muted">✓ 调用成功 · {result.latencyMs}ms · 取到 {result.citations.length} 条引用</p>
                <div className="eo-answer">{result.answer.slice(0, 800)}</div>
                {result.citations.length ? (
                  <details className="eo-details">
                    <summary>引用（{result.citations.length}）</summary>
                    <ol>
                      {result.citations.slice(0, 5).map((c, i) => (
                        <li key={i}>{c.slice(0, 200)}</li>
                      ))}
                    </ol>
                  </details>
                ) : null}
              </>
            )}
          </div>
        ) : (
          <p className="eo-muted">保存前建议先试调，确认能取到答案。</p>
        )}
      </div>

      {err ? <p className="eo-err">{err}</p> : null}
      <div className="eo-actions">
        <OaBtn onClick={() => void save()} disabled={saving}>
          {saving ? "保存中…" : "保存"}
        </OaBtn>
        <OaBtn variant="ghost" onClick={onCancel}>
          取消
        </OaBtn>
      </div>
    </OaCard>
  );
}
