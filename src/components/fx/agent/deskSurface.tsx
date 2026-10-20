import { defineCatalog } from "@json-render/core";
import { defineRegistry, JSONUIProvider, Renderer, type Spec } from "@json-render/react";
import { schema } from "@json-render/react/schema";
import { useState, type ReactNode } from "react";
import { z } from "zod";
import type { ChatArtifact } from "../../../lib/chatArtifacts";
import type { ProductRunImportPart, ProductRunView } from "../../../lib/productRun/types";
import { routeKeyLabel } from "../../../lib/skillRouter";
import "./desk-surface.css";

const deskCatalog = defineCatalog(schema, {
  components: {
    Stack: {
      props: z.object({}),
      description: "竖着排开一块界面",
    },
    Heading: {
      props: z.object({ text: z.string() }),
      description: "标题",
    },
    Text: {
      props: z.object({ text: z.string() }),
      description: "一段说明",
    },
    Callout: {
      props: z.object({
        tone: z.enum(["wait", "ok", "bad"]),
        title: z.string(),
        text: z.string(),
      }),
      description: "需要人看一眼的提示。wait 是停住等人，ok 是通过，bad 是拦住",
    },
    Metric: {
      props: z.object({
        label: z.string(),
        value: z.string(),
        tone: z.enum(["ok", "warn", "mute"]),
      }),
      description: "一个已经算好的数字",
    },
    Trace: {
      props: z.object({
        title: z.string(),
        compact: z.boolean().optional(),
        steps: z.array(
          z.object({
            label: z.string(),
            detail: z.string(),
            state: z.enum(["ok", "bad", "run"]),
          }),
        ),
      }),
      description: "按顺序排列的办理步骤，每一步有结果",
    },
  },
  actions: {},
});

const { registry } = defineRegistry(deskCatalog, {
  components: {
    Stack: ({ children }) => <div className="jr-stack">{children}</div>,
    Heading: ({ props }) => <h3 className="jr-heading">{props.text}</h3>,
    Text: ({ props }) => <p className="jr-text">{props.text}</p>,
    Callout: ({ props }) => (
      <div className={`jr-callout is-${props.tone}`}>
        <strong>{props.title}</strong>
        <p>{props.text}</p>
      </div>
    ),
    Metric: ({ props }) => (
      <div className={`jr-metric is-${props.tone}`}>
        <em>{props.label}</em>
        <strong>{props.value}</strong>
      </div>
    ),
    Trace: ({ props }) => <TraceView title={props.title} steps={props.steps} compact={props.compact} />,
  },
});

function TraceView({
  title,
  steps,
  compact = false,
}: {
  title: string;
  steps: Array<{ label: string; detail: string; state: "ok" | "bad" | "run" }>;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(!compact && steps.length <= 6);
  const failed = steps.filter((step) => step.state === "bad").length;
  const summary = failed ? `${steps.length} 步，${failed} 步未通过` : `${steps.length} 步`;
  return (
    <div className={compact ? "jr-trace is-row" : "jr-trace"}>
      <button type="button" className="jr-trace-toggle" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <span>{title}</span>
        <em>{compact ? summary : open ? "收起" : summary}</em>
        {compact ? <b>{open ? "收起" : "展开"}</b> : null}
      </button>
      {open ? (
        <ol>
          {steps.map((step, index) => (
            <li key={`${step.label}-${index}`} className={`is-${step.state}`}>
              <span>{step.state === "bad" ? "未通过" : step.state === "run" ? "进行中" : "通过"}</span>
              <div>
                <strong>{step.label}</strong>
                {step.detail && step.detail.replace(/。$/, "") !== step.label.replace(/。$/, "") ? <p>{step.detail}</p> : null}
              </div>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

function specFromRun(run: ProductRunView, artifacts?: ChatArtifact[], mode: "full" | "trace" = "full"): Spec | null {
  const elements: Spec["elements"] = {};
  const children: string[] = [];
  const add = (key: string, type: string, props: Record<string, unknown>, kids: string[] = []) => {
    elements[key] = { type, props, children: kids };
    children.push(key);
  };

  const steps = run.parts
    .filter((part) => part.kind === "process")
    .map((part) => ({
      label: part.label,
      detail: part.detail,
      state: part.ok ? "ok" as const : "bad" as const,
    }));

  if (mode === "trace") {
    if (!steps.length) return null;
    const failed = steps.filter((step) => step.state === "bad").length;
    add("trace", "Trace", {
      title: failed ? "办理过程里有未通过的步骤" : "办理过程",
      compact: true,
      steps,
    });
    elements.root = { type: "Stack", props: {}, children };
    return { root: "root", elements };
  }

  add("title", "Heading", { text: routeKeyLabel(run.skillId) });

  if (run.status === "waiting_import") {
    const waiting = run.parts.filter((part): part is ProductRunImportPart => part.kind === "import" && !part.ready);
    const names = waiting.map((part) => part.label).filter(Boolean);
    add("gate", "Callout", {
      tone: "wait",
      title: "先停在这里",
      text: names.length ? `还缺：${names.join("、")}。文件放好再继续。` : "材料还没齐，补上再继续。",
    });
  }

  const finish = run.parts.find((part) => part.kind === "finish");
  if (finish?.summary) add("summary", "Text", { text: finish.summary });

  const metrics = (artifacts ?? []).filter((item) => item.kind === "metric");
  metrics.forEach((metric, metricIndex) => {
    metric.items.forEach((item, itemIndex) => {
      add(`metric-${metricIndex}-${itemIndex}`, "Metric", {
        label: item.label,
        value: item.value,
        tone: item.tone ?? "mute",
      });
    });
  });

  if (steps.length) {
    const failed = steps.filter((step) => step.state === "bad").length;
    add("trace", "Trace", {
      title: run.status === "running" ? "正在办" : failed ? "办理过程里有未通过的步骤" : "办理过程",
      steps,
    });
  }

  if (children.length <= 1 && run.status !== "waiting_import") return null;
  elements.root = { type: "Stack", props: {}, children };
  return { root: "root", elements };
}

export function GenerativeBlocks({
  text,
  streaming = false,
  renderText,
}: {
  text: string;
  streaming?: boolean;
  renderText: (text: string, streaming?: boolean) => ReactNode;
}) {
  const parts = splitGenerative(text);
  if (!parts.some((part) => part.kind === "ui")) return renderText(text, streaming);
  return (
    <>
      {parts.map((part, index) =>
        part.kind === "md" ? (
          <div key={index}>{renderText(part.text, streaming && index === parts.length - 1)}</div>
        ) : (
          <div key={index} className="jr-surface">
            <JSONUIProvider registry={registry}>
              <Renderer spec={part.spec} registry={registry} />
            </JSONUIProvider>
          </div>
        ),
      )}
    </>
  );
}

export function DeskSurface({
  run,
  artifacts,
  mode = "full",
}: {
  run: ProductRunView;
  artifacts?: ChatArtifact[];
  mode?: "full" | "trace";
}) {
  const spec = specFromRun(run, artifacts, mode);
  const checked = spec ? deskCatalog.validate(spec) : null;
  if (!checked?.success || !checked.data) return null;
  return (
    <div className="jr-surface">
      <JSONUIProvider registry={registry}>
        <Renderer spec={checked.data} registry={registry} />
      </JSONUIProvider>
    </div>
  );
}

const FENCE = /```json-render\s*([\s\S]*?)```/g;

export function splitGenerative(text: string): Array<{ kind: "md"; text: string } | { kind: "ui"; spec: Spec }> {
  const out: Array<{ kind: "md"; text: string } | { kind: "ui"; spec: Spec }> = [];
  let cursor = 0;
  for (const match of text.matchAll(FENCE)) {
    const start = match.index ?? 0;
    const before = text.slice(cursor, start).trim();
    if (before) out.push({ kind: "md", text: before });
    const checked = deskCatalog.validate(parseSpec(match[1] ?? ""));
    if (checked.success && checked.data) out.push({ kind: "ui", spec: checked.data });
    else if ((match[1] ?? "").trim()) out.push({ kind: "md", text: match[0] });
    cursor = start + match[0].length;
  }
  const after = text.slice(cursor).trim();
  if (after) out.push({ kind: "md", text: after });
  if (!out.length && text.trim()) out.push({ kind: "md", text });
  return out;
}

function parseSpec(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function generativeSystemPrompt(): string {
  return deskCatalog.prompt({
    system: "你是管理端的模型对话。用户要清单、对比、步骤或表格时，在普通说明之外再输出一个 ```json-render 代码块。可见文字用中文。数字和结论必须来自用户刚说的内容，不要编造业务数字。",
    customRules: ["代码块语言标记必须是 json-render。", "不要输出目录里没有的组件。"],
  });
}
