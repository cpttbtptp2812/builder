import { memo, useEffect, useRef, useState, type ChangeEvent, type PointerEvent, type ReactNode } from "react";
import type { FlowUiValidation } from "../../lib/creditFlowUiGate";
import type { CreditFlowUi, FlowActionDef } from "../../lib/creditFlowUi";
import { useDebouncedValidation } from "../../lib/useDebouncedValidation";

type Props = {
  ui: CreditFlowUi;
  disabled?: boolean;
  panel?: boolean;
  onAutoAdvance: (sendAs: string) => void;
  onValidationChange?: (v: FlowUiValidation) => void;
};

function PhotoGrid({
  slots,
  disabled,
  onValidationChange,
}: {
  slots: string[];
  disabled?: boolean;
  onValidationChange?: Props["onValidationChange"];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [files, setFiles] = useState<Record<number, { name: string; preview?: string; size: number }>>({});

  const doneCount = slots.filter((_, i) => files[i]).length;
  const allDone = doneCount === slots.length;
  const report = useDebouncedValidation(onValidationChange);

  useEffect(() => {
    return () => {
      Object.values(files).forEach((f) => {
        if (f.preview) URL.revokeObjectURL(f.preview);
      });
    };
  }, [files]);

  useEffect(() => {
    report(
      allDone,
      allDone ? "" : `还需上传 ${slots.length - doneCount} 项材料（每项需选择真实文件）`,
    );
  }, [allDone, doneCount, slots.length, report]);

  const onPick = (index: number) => {
    if (disabled || files[index]) return;
    setActiveIndex(index);
    inputRef.current?.click();
  };

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (activeIndex == null || !file) return;
    if (file.size < 1) return;
    const preview = file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;
    setFiles((prev) => ({
      ...prev,
      [activeIndex]: { name: file.name, preview, size: file.size },
    }));
    setActiveIndex(null);
  };

  return (
    <div className="oa-flow-photo-grid">
      <input
        ref={inputRef}
        type="file"
        className="oa-flow-file-input"
        accept="image/*,.pdf,application/pdf"
        tabIndex={-1}
        aria-hidden
        onChange={onFile}
      />
      {slots.map((label, i) => {
        const f = files[i];
        return (
          <button
            key={`${label}-${i}`}
            type="button"
            className={`oa-flow-photo-slot${f ? " is-done" : ""}`}
            disabled={disabled}
            onClick={() => onPick(i)}
          >
            {f?.preview ? (
              <img className="oa-flow-photo-preview" src={f.preview} alt="" loading="lazy" decoding="async" />
            ) : (
              <span className="oa-flow-photo-icon" aria-hidden>
                {f ? "✓" : "+"}
              </span>
            )}
            <span className="oa-flow-photo-label">{f ? f.name.slice(0, 20) : label}</span>
            {f ? (
              <span className="oa-flow-photo-cta">{(f.size / 1024).toFixed(0)} KB</span>
            ) : (
              <span className="oa-flow-photo-cta">选择文件</span>
            )}
          </button>
        );
      })}
      <p className="oa-flow-photo-hint">
        已上传 {doneCount}/{slots.length} · 须逐项选择本机文件，不支持空点通过。
      </p>
    </div>
  );
}

function SignaturePanel({
  disabled,
  onValidationChange,
}: {
  disabled?: boolean;
  onValidationChange?: Props["onValidationChange"];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const strokesRef = useRef(0);
  const [signed, setSigned] = useState(false);
  const [strokes, setStrokes] = useState(0);
  const report = useDebouncedValidation(onValidationChange);

  useEffect(() => {
    report(
      signed,
      signed ? "" : strokes >= 8 ? "请点击「确认签名」" : "请在签名区手写姓名",
    );
  }, [signed, strokes, report]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0f172a";
  }, []);

  const pointer = (e: PointerEvent<HTMLCanvasElement>) => {
    if (disabled || signed) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (e.type === "pointerdown") {
      drawing.current = true;
      ctx.beginPath();
      ctx.moveTo(x, y);
    } else if (e.type === "pointermove" && drawing.current) {
      ctx.lineTo(x, y);
      ctx.stroke();
      strokesRef.current += 1;
    } else if (e.type === "pointerup" || e.type === "pointerleave") {
      drawing.current = false;
      setStrokes(strokesRef.current);
    }
  };

  return (
    <div className="oa-flow-sign-wrap">
      <canvas
        ref={canvasRef}
        className={`oa-flow-sign-canvas${signed ? " is-done" : ""}`}
        onPointerDown={pointer}
        onPointerMove={pointer}
        onPointerUp={pointer}
        onPointerLeave={pointer}
      />
      {!signed && <p className="oa-flow-sign-hint">手写签名后点击确认（至少若干笔迹，不可一键跳过）</p>}
      <button
        type="button"
        className="oa-flow-action primary"
        disabled={disabled || signed || strokes < 8}
        onClick={() => setSigned(true)}
      >
        {signed ? "签名已确认" : "确认签名"}
      </button>
    </div>
  );
}

function VoicePanel({
  defaultText,
  disabled,
  onValidationChange,
}: {
  defaultText?: string;
  disabled?: boolean;
  onValidationChange?: Props["onValidationChange"];
}) {
  const [state, setState] = useState<"idle" | "rec" | "done">("idle");
  const [sec, setSec] = useState(0);

  useEffect(() => {
    if (state !== "rec") return;
    const t = window.setInterval(() => setSec((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [state]);

  const report = useDebouncedValidation(onValidationChange);
  useEffect(() => {
    report(
      state === "done",
      state === "done" ? "" : state === "rec" ? "录音中，结束后点「智能解析」" : "请先开始录音",
    );
  }, [state, report]);

  const mm = String(Math.floor(sec / 60)).padStart(2, "0");
  const ss = String(sec % 60).padStart(2, "0");

  return (
    <div className="oa-flow-voice">
      <div className={`oa-flow-voice-panel${state === "rec" ? " is-recording" : ""}`}>
        <div className="oa-flow-voice-mic" aria-hidden>
          <span className="oa-flow-voice-ring" />
          🎙
        </div>
        <div className="oa-flow-voice-meta">
          <strong>{state === "idle" ? "客户访谈录音" : state === "rec" ? "正在采集…" : "解析完成"}</strong>
          <span>{state === "rec" ? `${mm}:${ss}` : "经营情况 · 资金用途 · 还款来源"}</span>
        </div>
        {state === "rec" && (
          <div className="oa-flow-voice-bars" aria-hidden>
            {Array.from({ length: 5 }).map((_, i) => (
              <span key={i} style={{ animationDelay: `${i * 0.12}s` }} />
            ))}
          </div>
        )}
      </div>
      {state === "idle" && (
        <button type="button" className="oa-flow-action" disabled={disabled} onClick={() => setState("rec")}>
          开始录音
        </button>
      )}
      {state === "rec" && (
        <button
          type="button"
          className="oa-flow-action primary"
          disabled={disabled || sec < 2}
          onClick={() => setState("done")}
        >
          结束并智能解析
        </button>
      )}
      {state === "done" && (
        <div className="oa-flow-voice-transcript">
          <span className="oa-flow-voice-tag">ASR · 摘要</span>
          <p>{defaultText ?? "客户经营稳定，本次备货约 80 万，主要还款来源为批发回款与账户流水。"}</p>
        </div>
      )}
    </div>
  );
}

function AnimatedChecks({
  items,
  onDone,
  disabled,
}: {
  items: { title: string; status: string }[];
  onDone: () => void;
  disabled?: boolean;
}) {
  const [step, setStep] = useState(0);
  const fired = useRef(false);
  useEffect(() => {
    if (disabled) return;
    if (step < items.length) {
      const t = window.setTimeout(() => setStep((s) => s + 1), 620);
      return () => window.clearTimeout(t);
    }
    if (!fired.current) {
      fired.current = true;
      const t = window.setTimeout(onDone, 500);
      return () => window.clearTimeout(t);
    }
  }, [step, items.length, onDone, disabled]);
  return (
    <ul className="oa-flow-check-list">
      {items.map((item, i) => {
        if (i > step) return null;
        const checking = i === step && step < items.length;
        return (
          <li key={item.title} className={checking ? "is-checking" : "is-done"}>
            <span className="oa-flow-check-icon">{checking ? "◌" : "✓"}</span>
            <div>
              <strong>{item.title}</strong>
              <span>{checking ? "正在校验…" : item.status}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function ThinkingLines({ lines, onDone, disabled }: { lines: string[]; onDone: () => void; disabled?: boolean }) {
  const [step, setStep] = useState(0);
  const fired = useRef(false);
  useEffect(() => {
    if (disabled) return;
    if (step < lines.length) {
      const t = window.setTimeout(() => setStep((s) => s + 1), 700);
      return () => window.clearTimeout(t);
    }
    if (!fired.current) {
      fired.current = true;
      const t = window.setTimeout(onDone, 400);
      return () => window.clearTimeout(t);
    }
  }, [step, lines.length, onDone, disabled]);
  return (
    <ul className="oa-flow-think-list">
      {lines.map((line, i) =>
        i <= step ? (
          <li key={line}>{line}</li>
        ) : null,
      )}
    </ul>
  );
}

function FlowForm({
  ui,
  disabled,
  onAutoAdvance,
  onValidationChange,
}: {
  ui: Extract<CreditFlowUi, { kind: "form" }>;
  disabled?: boolean;
  onAutoAdvance: (sendAs: string) => void;
  onValidationChange?: Props["onValidationChange"];
}) {
  const [vals, setVals] = useState<Record<string, string>>(() =>
    Object.fromEntries(ui.fields.map((f) => [f.id, f.defaultValue ?? ""])),
  );

  const ready = ui.fields.every((f) => (vals[f.id] ?? "").trim().length > 0);
  const report = useDebouncedValidation(onValidationChange);

  useEffect(() => {
    report(ready, ready ? "" : "请填写全部字段");
  }, [ready, report]);

  return (
    <div className="oa-flow-form">
      {ui.fields.map((f) => (
        <label key={f.id}>
          <span>{f.label}</span>
          <input
            value={vals[f.id] ?? ""}
            placeholder={f.placeholder}
            disabled={disabled}
            onChange={(e) => setVals((prev) => ({ ...prev, [f.id]: e.target.value }))}
          />
        </label>
      ))}
      <button
        type="button"
        className="oa-flow-action primary"
        disabled={disabled || !ready}
        onClick={() => onAutoAdvance(ui.submitSendAs)}
      >
        {ui.submitLabel}
      </button>
    </div>
  );
}

function SubmissionSuccessPanel({
  ui,
}: {
  ui: Extract<CreditFlowUi, { kind: "submission_success" }>;
}) {
  return (
    <div className="oa-flow-submit-success" role="status">
      <div className="oa-flow-submit-success-ring" aria-hidden>
        <span className="oa-flow-submit-success-check">✓</span>
      </div>
      <strong>{ui.title}</strong>
      <p className="oa-flow-submit-ticket">
        受理单号 <code>{ui.ticket}</code>
      </p>
      <ul className="oa-flow-submit-lines">
        {ui.lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

function ContractEditPanel({
  ui,
  disabled,
  onValidationChange,
}: {
  ui: Extract<CreditFlowUi, { kind: "contract_edit" }>;
  disabled?: boolean;
  onValidationChange?: Props["onValidationChange"];
}) {
  const [ack, setAck] = useState(false);
  const report = useDebouncedValidation(onValidationChange);
  useEffect(() => {
    report(ack, ack ? "" : "请勾选「已核对修订内容」");
  }, [ack, report]);

  return (
    <div className="oa-flow-contract-edit">
      {ui.rows.map((row) => (
        <div key={row.id} className="oa-flow-contract-row">
          <span>{row.label}</span>
          <del>{row.before}</del>
          <span className="oa-flow-contract-arrow">→</span>
          <strong>{row.after}</strong>
        </div>
      ))}
      <label className="oa-flow-contract-ack">
        <input type="checkbox" checked={ack} disabled={disabled} onChange={(e) => setAck(e.target.checked)} />
        已核对修订内容，与客户经理审批口径一致
      </label>
      <p className="oa-flow-contract-ack-hint">勾选后，点击下方「确认修正并继续」提交本步。</p>
    </div>
  );
}

export function CreditFlowInteractive({ ui, disabled, panel, onAutoAdvance, onValidationChange }: Props) {
  const wrap = panel ? "oa-flow-panel" : "";
  const inner = (node: ReactNode) => (wrap ? <div className={wrap}>{node}</div> : node);

  if (ui.kind === "photo_grid") {
    return inner(
      <PhotoGrid slots={ui.slots} disabled={disabled} onValidationChange={onValidationChange} />,
    );
  }
  if (ui.kind === "signature") {
    return inner(<SignaturePanel disabled={disabled} onValidationChange={onValidationChange} />);
  }
  if (ui.kind === "voice") {
    return inner(
      <VoicePanel defaultText={ui.defaultText} disabled={disabled} onValidationChange={onValidationChange} />,
    );
  }
  if (ui.kind === "animated_checks") {
    return inner(
      <AnimatedChecks
        items={ui.items}
        disabled={disabled}
        onDone={() => onAutoAdvance(ui.autoAdvanceSendAs)}
      />,
    );
  }
  if (ui.kind === "thinking") {
    return inner(
      <ThinkingLines
        lines={ui.lines}
        disabled={disabled}
        onDone={() => onAutoAdvance(ui.autoAdvanceSendAs)}
      />,
    );
  }
  if (ui.kind === "form") {
    return inner(
      <FlowForm
        ui={ui}
        disabled={disabled}
        onAutoAdvance={onAutoAdvance}
        onValidationChange={onValidationChange}
      />,
    );
  }
  if (ui.kind === "contract_edit") {
    return inner(<ContractEditPanel ui={ui} disabled={disabled} onValidationChange={onValidationChange} />);
  }
  if (ui.kind === "submission_success") {
    return inner(<SubmissionSuccessPanel ui={ui} />);
  }
  return null;
}

export const CreditFlowActions = memo(function CreditFlowActions({
  actions,
  disabled,
  onPick,
}: {
  actions: FlowActionDef[];
  disabled?: boolean;
  onPick: (sendAs: string) => void;
}) {
  if (!actions.length) return null;
  return (
    <div className="oa-flow-actions">
      {actions.map((a) => (
        <button
          key={a.id}
          type="button"
          className={`oa-flow-action${a.primary ? " primary" : ""}`}
          disabled={disabled}
          onClick={() => onPick(a.sendAs)}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
});
