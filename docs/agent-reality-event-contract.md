# Agent Reality event contract

Agent Reality renders only facts present in emitted events. It does not infer hidden reasoning, fabricate tool results, or estimate token usage.

## Accepted event envelopes

The timeline accepts the existing `agent_step` / `trace_step` events and OpenTelemetry-style `span` / `otel_span` / `gen_ai` events. MCP tool lifecycle events can be sent as `tool` or `mcp_tool`.

A span envelope can use the following shape:

~~~json
{
  "spanId": "span-123",
  "parentSpanId": "span-parent",
  "traceId": "trace-456",
  "name": "chat",
  "startTimeUnixNano": "1700000000000000000",
  "durationNs": 250000000,
  "status": { "code": 1 },
  "attributes": {
    "gen_ai.operation.name": "chat",
    "gen_ai.system": "openai",
    "gen_ai.request.model": "gpt-example",
    "gen_ai.usage.input_tokens": 80,
    "gen_ai.usage.output_tokens": 24,
    "gen_ai.input.messages": "[{\"role\":\"user\",\"content\":\"Summarize this repository\"}]",
    "gen_ai.output.messages": "[{\"role\":\"assistant\",\"content\":\"I will inspect the repository.\"}]"
  }
}
~~~

For MCP tool events, include a stable `toolCallId` / `call_id` / `spanId`, `mcp.tool.name`, lifecycle status, and captured arguments/results. A stable call ID is required to safely join start and finish events; same-name concurrent calls are never guessed to be the same invocation.

## Semantic attributes currently rendered

- GenAI: `gen_ai.operation.name`, `gen_ai.system`, `gen_ai.request.model`, `gen_ai.input.messages`, `gen_ai.output.messages`, `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`, `gen_ai.usage.total_tokens`
- Tool/MCP: `gen_ai.tool.name`, `gen_ai.tool.call.arguments`, `gen_ai.tool.call.result`, `mcp.tool.name`, `mcp.method.name`, `mcp.tool.arguments`, `mcp.tool.result`
- Retrieval and action-specific payloads: `gen_ai.retrieval.documents`, `sources`, `documents`, `citations`, `files`, `diff`, `url`, `screenshotUrl`, approval and explicit action-summary fields.

Attributes may be sent as flattened dotted keys or nested objects. JSON-encoded message arrays and single message objects are both accepted.

## Status and time

- OpenTelemetry status code `1` maps to completed; `2` maps to failed. `0` remains unknown unless another lifecycle event supplies a status.
- `startTimeUnixNano` / `start_time_unix_nano` are converted to milliseconds for the timeline.
- `durationNs` / `duration_ns` are converted to milliseconds.
- Existing millisecond timestamps and duration fields remain supported.
- Missing values remain explicitly unknown / not reported.

## Privacy

Prompt and completion content can contain secrets or personal data. Producers should explicitly opt in to content capture, apply redaction before export, and avoid collecting hidden chain-of-thought. The UI displays captured messages and explicit action summaries only; it does not attempt to reveal private model reasoning.
