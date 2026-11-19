import test from "node:test";
import assert from "node:assert/strict";
import { toAgentPrismTraceTree } from "./agentPrismAdapter";
import type { AgentStep } from "./agentTimeline";

const step = (overrides: Partial<AgentStep> = {}): AgentStep => ({
  stepId: "event-1", seq: 1, phase: "llm", status: "done",
  leftTitle: "model", leftSummary: "", rightTitle: "chat",
  rightSubtitle: "", rightDetail: {}, timestamp: 1_700_000_000_000,
  ...overrides,
});

test("builds a parent-child tree only from real OTLP identifiers", () => {
  const root = step({ stepId: "root", rightDetail: {
    traceId: "trace-1", spanId: "span-root", name: "Agent",
    startTimeUnixNano: "1700000000000000000", endTimeUnixNano: "1700000000100000000",
  }});
  const child = step({ stepId: "child", rightDetail: {
    traceId: "trace-1", spanId: "span-child", parentSpanId: "span-root",
    name: "Model", startTimeUnixNano: "1700000000010000000",
    endTimeUnixNano: "1700000000090000000",
    attributes: [{ key: "gen_ai.usage.input_tokens", value: { intValue: "12" } }],
  }});
  const tree = toAgentPrismTraceTree([root, child]);
  assert.equal(tree.length, 1);
  assert.equal(tree[0].id, "span-root");
  assert.equal(tree[0].children?.[0].id, "span-child");
  assert.equal(tree[0].children?.[0].tokenUsage?.input?.tokens, 12);
});

test("does not invent trace IDs, span IDs, or timestamps", () => {
  const tree = toAgentPrismTraceTree([step()]);
  assert.equal(tree.length, 0);
});
