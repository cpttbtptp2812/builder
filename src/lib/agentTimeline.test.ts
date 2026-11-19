import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applySseToTimeline, finalizeTimeline, rebuildTimelineFromMessage, sortTimeline } from "./agentTimeline";

describe("Agent execution timeline event handling", () => {
  it("preserves known fields when a later SSE event is sparse", () => {
    const started = applySseToTimeline([], "agent_step", {
      stepId: "model-1",
      seq: 4,
      phase: "llm",
      status: "running",
      title: "Choose next action",
      description: "Comparing available tools",
      timestamp: 1234,
      rightDetail: { input: { goal: "find docs" } },
    });

    const finished = applySseToTimeline(started, "agent_step", {
      stepId: "model-1",
      status: "done",
    });

    assert.equal(finished.length, 1);
    assert.equal(finished[0].seq, 4);
    assert.equal(finished[0].timestamp, 1234);
    assert.equal(finished[0].rightTitle, "Choose next action");
    assert.equal(finished[0].rightSubtitle, "Comparing available tools");
    assert.equal(finished[0].status, "done");
    assert.deepEqual(finished[0].rightDetail?.input, { goal: "find docs" });
  });

  it("orders events by real timestamps instead of misleading phase sequence numbers", () => {
    let timeline = applySseToTimeline([], "agent_step", {
      stepId: "model-round-1",
      seq: 44,
      phase: "llm",
      status: "done",
      title: "模型请求",
      timestamp: 2000,
    });
    timeline = applySseToTimeline(timeline, "agent_step", {
      stepId: "tool-call-1",
      seq: 5,
      phase: "skill",
      status: "done",
      title: "工具执行",
      timestamp: 3000,
    });

    assert.deepEqual(timeline.map((step) => step.stepId), ["model-round-1", "tool-call-1"]);
  });

  it("preserves captured payloads from the event envelope and nested rightDetail", () => {
    const timeline = applySseToTimeline([], "agent_step", {
      stepId: "llm-42",
      seq: 42,
      title: "Model request",
      attributes: {
        prompt_messages: [{ role: "system", content: "Use the registered tools only." }],
        model: "test-model",
      },
      rightDetail: {
        model_response: { role: "assistant", content: "I will call search." },
        tool_schema: [{ name: "search" }],
      },
    });

    assert.equal(timeline.length, 1);
    assert.deepEqual(timeline[0].rightDetail?.attributes?.prompt_messages, [
      { role: "system", content: "Use the registered tools only." },
    ]);
    assert.equal(timeline[0].rightDetail?.attributes?.model, "test-model");
    assert.deepEqual(timeline[0].rightDetail?.model_response, {
      role: "assistant",
      content: "I will call search.",
    });
    assert.deepEqual(timeline[0].rightDetail?.tool_schema, [{ name: "search" }]);
  });

  it("joins tool lifecycle events when a stable call ID is supplied", () => {
    const started = applySseToTimeline([], "tool", {
      tool: "search_docs",
      toolCallId: "call-1",
      status: "running",
      arguments: { query: "lease heartbeat" },
    });
    const finished = applySseToTimeline(started, "tool", {
      tool: "search_docs",
      toolCallId: "call-1",
      status: "success",
      result: ["doc-1"],
    });

    assert.equal(finished.length, 1);
    assert.equal(finished[0].status, "done");
    assert.deepEqual(finished[0].rightDetail?.arguments, { query: "lease heartbeat" });
    assert.deepEqual(finished[0].rightDetail?.result, ["doc-1"]);
  });

  it("merges tool and agent_step notifications for the same stable call ID", () => {
    const fromToolEvent = applySseToTimeline([], "tool", {
      tool: "search_docs",
      toolCallId: "call-stable-7",
      status: "success",
      parameters: JSON.stringify({ query: "lease" }),
      result: ["doc-1"],
    });
    const fromAgentStep = applySseToTimeline(fromToolEvent, "agent_step", {
      stepId: "call-stable-7",
      seq: 5,
      phase: "skill",
      status: "done",
      title: "Search documents",
      rightDetail: {
        toolCallId: "call-stable-7",
        tool_arguments: { query: "lease" },
        tool_result: ["doc-1"],
      },
    });

    assert.equal(fromAgentStep.length, 1);
    assert.equal(fromAgentStep[0].stepId, "call-stable-7");
    assert.deepEqual(fromAgentStep[0].rightDetail?.tool_arguments, { query: "lease" });
    assert.deepEqual(fromAgentStep[0].rightDetail?.tool_result, ["doc-1"]);
    assert.deepEqual(fromAgentStep[0].rightDetail?.result, ["doc-1"]);
  });

  it("does not guess which concurrent same-name tool call a result belongs to", () => {
    let timeline = applySseToTimeline([], "tool", { tool: "lookup", status: "running" });
    timeline = applySseToTimeline(timeline, "tool", { tool: "lookup", status: "running" });
    timeline = applySseToTimeline(timeline, "tool", { tool: "lookup", status: "success", result: "ok" });

    assert.equal(timeline.length, 3);
    assert.equal(timeline[0].status, "running");
    assert.equal(timeline[1].status, "running");
    assert.equal(timeline[2].status, "done");
  });

  it("rebuilds saved tool arguments and results after refreshing the chat", () => {
    const timeline = rebuildTimelineFromMessage({
      toolCalls: [{
        tool: "search_docs",
        id: "call-history-9",
        toolCallId: "call-history-9",
        modelStep: 2,
        status: "success",
        parameters: { query: "heartbeat" },
        result: ["doc-1"],
        tool_arguments: { query: "heartbeat" },
        tool_result: { success: true, data: ["doc-1"] },
      }],
    });

    assert.equal(timeline.length, 1);
    assert.equal(timeline[0].stepId, "call-history-9");
    assert.deepEqual(timeline[0].rightDetail?.tool_arguments, { query: "heartbeat" });
    assert.deepEqual(timeline[0].rightDetail?.tool_result, { success: true, data: ["doc-1"] });
  });

  it("uses timestamp ordering in the same sorter consumed by the observer", () => {
    const sorted = sortTimeline([
      { stepId: "tool", seq: 5, phase: "skill", status: "done", leftTitle: "Tool", leftSummary: "", rightTitle: "Tool", rightSubtitle: "", rightDetail: {}, timestamp: 3000 },
      { stepId: "model", seq: 44, phase: "llm", status: "done", leftTitle: "Model", leftSummary: "", rightTitle: "Model", rightSubtitle: "", rightDetail: {}, timestamp: 2000 },
    ]);
    assert.deepEqual(sorted.map((step) => step.stepId), ["model", "tool"]);
  });

  it("rebuilds the persisted tool step in timestamp order and deduplicates legacy toolCalls", () => {
    const timeline = rebuildTimelineFromMessage({
      traceSteps: {
        "41": {
          stepId: "model-call-round-1",
          seq: 41,
          phase: "llm",
          status: "done",
          title: "Model request",
          timestamp: 1000,
          rightDetail: { prompt_messages: [{ role: "system", content: "Use tools." }] },
        },
        "1001": {
          stepId: "call-history-9",
          seq: 5,
          phase: "skill",
          status: "done",
          title: "Search documents",
          timestamp: 2000,
          rightDetail: { tool_arguments: { query: "heartbeat" }, tool_result: { success: true } },
        },
      },
      toolCalls: [{
        tool: "search_docs",
        id: "call-history-9",
        toolCallId: "call-history-9",
        status: "success",
        parameters: { query: "heartbeat" },
        result: ["doc-1"],
      }],
    });

    assert.deepEqual(timeline.map((step) => step.stepId), ["model-call-round-1", "call-history-9"]);
    assert.equal(timeline[1].seq, 5);
    assert.deepEqual(timeline[1].rightDetail?.tool_arguments, { query: "heartbeat" });
  });

  it("normalizes OpenTelemetry GenAI spans into readable model steps", () => {
    const timeline = applySseToTimeline([], "otel_span", {
      spanId: "otel-model-1",
      name: "chat",
      startTimeUnixNano: "1700000000000000000",
      durationNs: 250000000,
      status: { code: 1 },
      attributes: {
        "gen_ai.operation.name": "chat",
        "gen_ai.request.model": "gpt-test",
        "gen_ai.usage.input_tokens": 80,
        "gen_ai.usage.output_tokens": 24,
      },
    });
    assert.equal(timeline.length, 1);
    assert.equal(timeline[0].stepId, "otel-model-1");
    assert.equal(timeline[0].phase, "llm");
    assert.equal(timeline[0].status, "done");
    assert.equal(timeline[0].durationMs, 250);
    assert.equal(timeline[0].timestamp, 1700000000000);
    assert.equal(timeline[0].rightDetail?.attributes?.["gen_ai.request.model"], "gpt-test");
  });

  it("normalizes MCP tool events using their semantic tool name", () => {
    const timeline = applySseToTimeline([], "mcp_tool", {
      spanId: "mcp-call-1",
      status: { code: 2, message: "permission denied" },
      attributes: { "mcp.tool.name": "read_file" },
      start_time_unix_nano: "1700000001000000000",
      duration_ns: 12000000,
    });
    assert.equal(timeline.length, 1);
    assert.equal(timeline[0].stepId, "mcp-call-1");
    assert.equal(timeline[0].phase, "skill");
    assert.equal(timeline[0].status, "failed");
    assert.equal(timeline[0].rightTitle, "read_file");
    assert.equal(timeline[0].durationMs, 12);
    assert.equal(timeline[0].timestamp, 1700000001000);
  });

  it("keeps missing execution status unknown after the stream ends", () => {
    const timeline = applySseToTimeline([], "agent_step", {
      stepId: "step-without-status",
      title: "External operation",
    });
    const finalized = finalizeTimeline(timeline);

    assert.equal(finalized[0].status, "unknown");
  });
});
