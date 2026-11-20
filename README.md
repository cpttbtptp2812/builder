# OwnAgent — AI Agent Observability & Debugging

OwnAgent is a practical workbench for running an Agent, inspecting what it actually did, and debugging failed executions.

The Studio is intentionally organized around three entry points:

1. **智能工作台** — run the built-in Agent and inspect its live execution.
2. **运行观测** — review persisted built-in runs or inspect traces sent by an external Agent.
3. **接入中心** — connect an existing Agent using the Python SDK or OpenTelemetry.

## Core workflow

Send a task in the built-in workbench → watch the real Run and Span data arrive → inspect model and tool evidence → open the saved Run later to investigate it.

The built-in chat Run API and external Agent Trace API remain separate data sources. They are presented in one Run Explorer, but OwnAgent does not fabricate IDs or merge unrelated sessions.

## What is recorded

- Run status, start/end timestamps, and measured duration.
- Model/provider metadata and provider-reported token usage, when supplied.
- Model request/response payloads when content capture is explicitly enabled.
- Tool names, arguments, results, and errors when the integration reports them.
- Span parent/child relationships and persisted execution events.

Missing evidence stays missing: unavailable token counts, prompt bodies, or timestamps are shown as not reported rather than estimated. Hidden model chain-of-thought is not collected or displayed.

**Privacy:** prompt/response capture is disabled by default. Enable `OWNAGENT_TRACE_CAPTURE_CONTENT=1` only in a controlled debugging environment, review/redact traces before sharing, and turn it off afterwards.

## Run the Studio locally

Requirements: Node.js 20+.

```bash
npm install
npm run dev
```

If the backend is not served from the same origin, set `VITE_API_BASE` to its base URL.

Run the frontend checks:

```bash
npm run test:timeline
npm run check:production
```

## Start the backend

The backend, database migrations, Python SDK, and runnable examples live in [cpttbtptp2812/ownsudo](https://github.com/cpttbtptp2812/ownsudo).

Follow its [backend setup guide](https://github.com/cpttbtptp2812/ownsudo#local-development) to configure Java, Maven, MySQL, database credentials, and model-provider settings. Do not put real credentials in source control.

## Connect an external Agent

External Agent model traffic continues to go directly to its existing provider. OwnAgent receives telemetry as a side channel; it does not proxy or replace the Agent's model client.

Start with the [Python SDK guide](https://github.com/cpttbtptp2812/ownsudo/tree/main/sdk/python):

```bash
git clone https://github.com/cpttbtptp2812/ownsudo.git
cd ownsudo/sdk/python
python -m pip install -e .
```

The current preview provisions an Agent API key through backend bootstrap configuration; self-service key management is not yet available. See the SDK guide for the exact setup and key handling.

Run the included example:

```bash
export OWNAGENT_BASE_URL=http://localhost:8080
export OWNAGENT_AGENT_API_KEY=oa_live_...
export OPENAI_API_KEY=...
export OPENAI_MODEL=...
python examples/observability_agent.py
```

To view the resulting external Runs, open **运行观测 → 外部 Agent Runs**, enter the Agent API key, and load the records.

## Honest preview boundaries

- External Agent instrumentation is explicit; arbitrary provider traffic is not intercepted automatically.
- The built-in chat records its own persisted Run / Span / Event data. Older chat messages created before Run recording are not retroactively converted into synthetic Runs.
- Prompt and response bodies are opt-in; tool evidence appears only when the execution path records it.
- The Python SDK is synchronous. Framework-specific automatic instrumentation is provided by upstream OpenTelemetry/OpenInference packages where supported.
- Replay, safe side-effect-aware retry, and self-service project/API-key management are not part of the current core workflow.

## Repositories

- [Studio frontend](https://github.com/cpttbtptp2812/builder)
- [Backend, Python SDK, and examples](https://github.com/cpttbtptp2812/ownsudo)
