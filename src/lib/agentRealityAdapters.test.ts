import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  classifyRealityAdapter,
  formatRealityActionLabel,
  parseRealityPayload,
  readRealityAttribute,
  realityMessageText,
  toRealityMessageList,
} from "./agentRealityAdapters";

describe("Agent Reality semantic adapters", () => {
  it("reads flattened and nested OpenTelemetry semantic attributes", () => {
    const event = {
      attributes: {
        "gen_ai.request.model": "gpt-test",
        "gen_ai.usage.input_tokens": 120,
      },
      rightDetail: {
        attributes: {
          gen_ai: { output: { messages: [{ role: "assistant", content: "done" }] } },
        },
      },
    };
    assert.equal(readRealityAttribute(event, ["gen_ai.request.model"]), "gpt-test");
    assert.equal(readRealityAttribute(event, ["gen_ai.usage.input_tokens"]), 120);
    assert.deepEqual(
      readRealityAttribute(event, ["gen_ai.output.messages"]),
      [{ role: "assistant", content: "done" }],
    );
  });

  it("parses structured JSON payloads and accepts one message or many", () => {
    assert.deepEqual(parseRealityPayload('[{"role":"user","content":"hello"}]'), [
      { role: "user", content: "hello" },
    ]);
    assert.deepEqual(toRealityMessageList('{"role":"assistant","content":"world"}'), [
      { role: "assistant", content: "world" },
    ]);
    assert.equal(toRealityMessageList("not json"), undefined);
  });

  it("renders text and multimodal text parts without dumping wrapper JSON", () => {
    assert.equal(realityMessageText({ role: "user", content: "hello" }), "hello");
    assert.equal(realityMessageText({ content: [{ type: "text", text: "first" }, { type: "text", text: "second" }] }), "first\nsecond");
  });

  it("classifies concrete actions before broad retrieval terms", () => {
    assert.equal(classifyRealityAdapter({ tool: "search_code", phase: "skill" }), "code");
    assert.equal(classifyRealityAdapter({ tool: "search_knowledge_base", phase: "skill" }), "retrieval");
    assert.equal(classifyRealityAdapter({ operation: "chat", phase: "llm" }), "model");
    assert.equal(classifyRealityAdapter({ tool: "browser.navigate", phase: "skill" }), "browser");
  });

  it("turns common tool verbs into readable action labels", () => {
    assert.equal(formatRealityActionLabel("get_git_repo_status"), "检查仓库状态");
    assert.equal(formatRealityActionLabel("create_pull_request"), "创建pull request");
    assert.equal(formatRealityActionLabel("unknown_operation"), "Unknown operation");
  });
});
