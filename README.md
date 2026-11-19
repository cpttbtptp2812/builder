# OwnAgent — AI Agent Observability & Debugging

OwnAgent helps developers inspect what their AI Agents actually did: model calls, tool calls, returned results, errors, timing, and provider-reported token usage.

It is an engineering tool for Agents you build elsewhere. You do not need to move your Agent into OwnAgent or use OwnAgent as your model gateway.

## What you can inspect

- **Runs:** group persisted spans by trace ID and inspect each run.
- **Execution timeline:** see model and tool spans in start-time order.
- **Span details:** inspect trace/span IDs, parent relationships, status, timestamps, duration, token counts, and attributes.
- **Live updates:** subscribe to trace events while a run is in progress.
- **Action lifecycle:** when using the OwnAgent Action Runtime, inspect persisted Action events and outcomes.

The Studio reads backend data. It does not create sample runs or fill missing fields with estimated values.

## Connect an Agent

The backend and Python SDK live in [cpttbtptp2812/ownsudo](https://github.com/cpttbtptp2812/ownsudo).

~~~bash
git clone https://github.com/cpttbtptp2812/ownsudo.git
cd ownsudo/sdk/python
python -m pip install -e .
~~~

Configure your OwnAgent backend URL and an Agent API key issued by your OwnAgent installation:

~~~bash
export OWNAGENT_BASE_URL="http://localhost:8080"
export OWNAGENT_AGENT_API_KEY="your-agent-api-key"
~~~

For the complete model-driven Agent example, also configure an OpenAI-compatible provider key and model:

~~~bash
export OPENAI_API_KEY="your-provider-key"
export OPENAI_MODEL="your-tool-calling-model"
# Optional: export OPENAI_BASE_URL="https://api.openai.com/v1"
python examples/demo_agent.py
~~~

The example sends model requests directly to the configured provider, executes its registered Python tool through OwnAgent, and submits trace spans separately. It uses provider-returned token usage; it does not estimate token counts.

To capture exact prompt messages, tool schemas, model responses, arguments, and results, explicitly opt in:

~~~bash
export OWNAGENT_TRACE_CAPTURE_CONTENT=1
python examples/demo_agent.py
~~~

Content capture is disabled by default because prompts and tool results may contain sensitive data. Review the SDK guide before enabling it.

For your own synchronous Python Agent, use the context-managed trace helper and attach token counts returned by your provider. For framework instrumentation and OTLP/HTTP JSON ingestion, see the [backend Python SDK and trace documentation](https://github.com/cpttbtptp2812/ownsudo/tree/main/sdk/python).

## Open the Runs view

1. Start the OwnAgent backend and Studio.
2. Open **运行记录** in the Studio navigation.
3. Enter the Agent API key used by your Agent and select **读取记录**.

The key is held in page memory only; this page does not persist it to browser storage. The Runs view calls the authenticated GET /api/v1/traces endpoint and groups the returned spans by trace ID. It shows only records stored by the backend.

If the list is empty, run an instrumented Agent with the same Agent identity. The Studio will not insert a demo trace.

## Local Studio development

Requirements: Node.js 20+.

~~~bash
npm install
npm run dev
~~~

Set VITE_API_BASE if the backend is not served from the same origin. Then open the Vite URL shown in the terminal.

~~~bash
npm run test:timeline
npm run build
~~~

## Data and privacy boundaries

- OwnAgent does not automatically intercept arbitrary provider calls. Your Agent or framework integration must submit trace spans.
- Token usage is displayed only when supplied by the provider/instrumentation. Missing values stay missing.
- Prompt and response bodies are not captured by default. Enable content capture only when you understand the data-retention implications.
- The Studio displays explicit request/response and tool I/O attributes. It does not expose or fabricate hidden model chain-of-thought.
- A trace ID groups spans; parent span IDs express causal relationships. Missing IDs are not invented.
- This project is an early developer preview. Framework-specific automatic instrumentation, async SDK support, replay, and side-effect-safe retries are not complete.

## Repositories

- [Studio frontend](https://github.com/cpttbtptp2812/builder)
- [Backend, Python SDK, and examples](https://github.com/cpttbtptp2812/ownsudo)
