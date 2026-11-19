# OwnAgent — AI Agent Observability & Debugging

OwnAgent is a developer workbench for understanding what an AI Agent actually did. Use the built-in Agent for your own tasks, or connect an Agent you already built and inspect its real execution without moving it into OwnAgent or routing model traffic through OwnAgent.

## Two ways to use one observation system

- **Built-in Agent:** chat in the OwnAgent workbench. The existing conversation and execution inspector stay together.
- **External Agent:** add the OwnAgent Python SDK or export OpenTelemetry spans. Your Agent continues to run in its own application; OwnAgent receives telemetry as a side channel.

Both paths are designed to converge on the same concepts: Project → Agent → Conversation / Session → Run → model calls, tool calls, events, and errors.

## What you can inspect

- Every recorded Run and its parent/child span relationships.
- Actual model requests and responses when the integration explicitly captures them.
- Tool calls, arguments, and returned results when instrumented.
- Provider-reported token usage, timestamps, duration, status, and errors.
- Historical traces and live updates for an in-progress trace.
- Action Runtime lifecycle events when an Agent delegates tool execution to OwnAgent.

Missing data stays missing. OwnAgent does not invent prompts, token counts, confidence scores, or execution stages. Prompt/response capture is opt-in; hidden model chain-of-thought is not collected or displayed.

## Connect an external Python Agent

The backend and SDK live in [cpttbtptp2812/ownsudo](https://github.com/cpttbtptp2812/ownsudo). Start with the [Python SDK guide](https://github.com/cpttbtptp2812/ownsudo/tree/main/sdk/python).

```bash
git clone https://github.com/cpttbtptp2812/ownsudo.git
cd ownsudo/sdk/python
python -m pip install -e .
```

Configure `OWNAGENT_BASE_URL` and an Agent API key. In this early preview, the first Agent API key is provisioned by the backend bootstrap settings; self-service key management in Studio is not yet available. The SDK guide documents the setup.

```bash
export OWNAGENT_BASE_URL=http://localhost:8080
export OWNAGENT_AGENT_API_KEY=oa_live_...
```

Run the external Agent example:

```bash
export OPENAI_API_KEY=...
export OPENAI_MODEL=...
python examples/observability_agent.py
```

The example sends model traffic directly to an OpenAI-compatible provider and separately reports spans to OwnAgent. It records actual provider usage when present. To persist exact prompt messages, model responses, tool arguments, and tool results, explicitly opt in with `OWNAGENT_TRACE_CAPTURE_CONTENT=1` and review/redact sensitive data.

## Where to find external runs in Studio

Open the **智能工作台** and select **外部 Agent** in its toolbar. Enter the Agent API key and load the persisted traces. The panel is part of the existing workbench rather than a separate top-level workspace. External traces are scoped to the Agent identity represented by that key; they are not automatically merged into the built-in chat history unless the integration supplies matching session identifiers.

## Local Studio development

Requirements: Node.js 20+.

```bash
npm install
npm run dev
```

Set `VITE_API_BASE` if the backend is not served from the same origin.

```bash
npm run test:timeline
npm run check:production
```

## Current preview boundaries

- External Agent instrumentation is explicit. OwnAgent does not automatically intercept arbitrary provider traffic.
- The current Studio preview uses an Agent API key to read external traces; self-service project/key provisioning is future work.
- Prompt and response bodies are disabled by default.
- The Python SDK is synchronous and the current OTLP receiver accepts HTTP JSON; broader protocol/framework compatibility is future work.
- Replay, safe side-effect-aware retry, async SDK, and additional framework auto-instrumentation remain future work.

## Repositories

- [Studio frontend](https://github.com/cpttbtptp2812/builder)
- [Backend, Python SDK, and examples](https://github.com/cpttbtptp2812/ownsudo)
