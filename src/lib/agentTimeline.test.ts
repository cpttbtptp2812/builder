import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applySseToTimeline, finalizeTimeline } from "./agentTimeline";

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

  it("does not guess which concurrent same-name tool call a result belongs to", () => {
    let timeline = applySseToTimeline([], "tool", { tool: "lookup", status: "running" });
    timeline = applySseToTimeline(timeline, "tool", { tool: "lookup", status: "running" });
    timeline = applySseToTimeline(timeline, "tool", { tool: "lookup", status: "success", result: "ok" });

    assert.equal(timeline.length, 3);
    assert.equal(timeline[0].status, "running");
    assert.equal(timeline[1].status, "running");
    assert.equal(timeline[2].status, "done");
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
