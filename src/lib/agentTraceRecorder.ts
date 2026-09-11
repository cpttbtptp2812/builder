/** 运行中实时追加 TraceSpan（供 Agent Trace 页 live 展示） */

import type { AgentStreamEvent } from "./agentRuntime";
import type { TraceSpan } from "../data/agentTraceDemo";

export class AgentTraceRecorder {
  private spans: TraceSpan[] = [];
  private last = performance.now();
  private toolRow = new Map<string, string>();
  /** trace-sync 会带着同一份 reasoning 反复触发，只记第一次 */
  private seenIntent = new Set<string>();

  constructor(query: string) {
    this.spans.push({
      id: "user",
      kind: "user",
      label: "用户输入",
      detail: query,
      ms: 0,
      status: "ok",
    });
  }

  private tick() {
    const now = performance.now();
    const ms = Math.max(1, Math.round(now - this.last));
    this.last = now;
    return ms;
  }

  private push(span: Omit<TraceSpan, "ms"> & { ms?: number }) {
    this.spans.push({ ...span, ms: span.ms ?? this.tick() });
  }

  onEvent(ev: AgentStreamEvent) {
    switch (ev.type) {
      case "iteration":
        this.push({
          id: `plan-${ev.n}`,
          kind: "plan",
          label: "Agent 迭代",
          detail: `第 ${ev.n} 轮`,
          status: "ok",
        });
        break;
      case "trace-sync":
        for (const t of ev.traces) {
          if (t.reasoning?.trim()) {
            const key = `${t.iteration}:${t.label}:${t.reasoning}`;
            if (this.seenIntent.has(key)) continue;
            this.seenIntent.add(key);
            this.push({
              id: `intent-${t.iteration}`,
              kind: "intent",
              label: t.label || "路由 / 推理",
              detail: t.reasoning.split("\n")[0]!.slice(0, 100),
              status: "ok",
              payload: { reasoning: t.reasoning },
            });
          }
        }
        break;
      case "tool-start":
        this.push({
          id: `tool-start-${ev.tool.id}`,
          kind: "tool",
          label: `tool · ${ev.tool.name}`,
          detail: "执行中…",
          status: "ok",
          payload: { args: ev.tool.args },
        });
        this.toolRow.set(ev.tool.id, ev.tool.name);
        break;
      case "tool-end": {
        const idx = this.spans.findIndex(
          (s) => s.kind === "tool" && s.label === `tool · ${ev.tool.name}` && s.detail === "执行中…",
        );
        const row: TraceSpan = {
          id: ev.tool.id,
          kind: "tool",
          label: `tool · ${ev.tool.name}`,
          detail: ev.tool.ok === false ? "失败" : `完成 · ${ev.tool.ms ?? "?"}ms`,
          ms: ev.tool.ms ?? this.tick(),
          status: ev.tool.ok === false ? "err" : "ok",
          payload: { args: ev.tool.args, result: ev.tool.result },
        };
        if (idx >= 0) this.spans[idx] = row;
        else this.spans.push(row);
        break;
      }
      case "error":
        this.push({
          id: `err-${Date.now()}`,
          kind: "error",
          label: "错误",
          detail: ev.message,
          status: "err",
        });
        break;
      case "done":
        this.push({
          id: "done",
          kind: "reply",
          label: "运行完成",
          detail: `${ev.iterations} 轮 · ${ev.toolCount} 个 tool`,
          status: "ok",
        });
        break;
      default:
        break;
    }
  }

  getSpans() {
    return [...this.spans];
  }
}
