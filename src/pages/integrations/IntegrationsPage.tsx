import React, { useState } from "react";
import {
  Activity, ArrowUpRight, Check, Code2, Copy, ExternalLink, GitBranch,
  Layers3, PlugZap, Radio, ShieldCheck, Terminal, Workflow
} from "lucide-react";

type GuideKey = "sdk" | "otel" | "frameworks";

const guides: Record<GuideKey, { title: string; subtitle: string; install: string; code: string }> = {
  sdk: {
    title: "OwnAgent Python SDK",
    subtitle: "适合自己编写 Agent、需要显式记录模型调用和工具执行的场景",
    install: "pip install ownagent-sdk",
    code: `import os
from ownagent import OwnAgentClient

BASE_URL = os.environ["OWNAGENT_BASE_URL"]
API_KEY = os.environ["OWNAGENT_AGENT_API_KEY"]

with OwnAgentClient(BASE_URL, API_KEY) as ownagent:
    with ownagent.agent_run("research-agent", session_id="session-001") as run:
        # 模型调用：把 Provider 实际返回的 usage 写入 Span
        with run.span(
            "chat.completions",
            span_kind="CLIENT",
            attributes={"provider": "openai", "model": "gpt-4.1"},
        ) as span:
            response = call_your_model()
            usage = response.usage
            if usage:
                span.set_usage(
                    input_tokens=usage.prompt_tokens,
                    output_tokens=usage.completion_tokens,
                )

        # 工具执行：记录真实参数、结果和异常
        with run.span("tool.search", attributes={"tool.name": "search"}) as span:
            result = search_documents("query")
`,
  },
  otel: {
    title: "OpenTelemetry / 任意 Agent 框架",
    subtitle: "适合已经使用 OpenTelemetry、LangChain、LangGraph 或自建埋点的项目",
    install: "pip install opentelemetry-sdk opentelemetry-exporter-otlp-proto-http",
    code: `import os
from opentelemetry import trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter

provider = TracerProvider(resource=Resource.create({
    "service.name": "my-agent",
}))
provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(
    endpoint=os.environ["OWNAGENT_OTLP_ENDPOINT"],
    headers={"Authorization": f"Bearer {os.environ['OWNAGENT_AGENT_API_KEY']}"},
)))
trace.set_tracer_provider(provider)
tracer = trace.get_tracer("my-agent")

with tracer.start_as_current_span("invoke_agent") as span:
    span.set_attribute("gen_ai.operation.name", "invoke_agent")
    span.set_attribute("gen_ai.agent.name", "my-agent")
    # 在模型调用与工具执行处继续创建子 Span`,
  },
  frameworks: {
    title: "Langfuse / Phoenix 等现有观测平台",
    subtitle: "保留现有平台，通过 OTLP 将 Trace 同步到 OwnAgent；具体双写配置需按部署版本验证",
    install: "# 保留你现有的 OpenTelemetry / OTLP exporter",
    code: `# OwnAgent OTLP/HTTP traces endpoint
OWNAGENT_OTLP_ENDPOINT=https://your-ownagent-host/api/v1/otlp/v1/traces

# Python SDK / Agent 运行身份
OWNAGENT_BASE_URL=https://your-ownagent-host
OWNAGENT_AGENT_API_KEY=oa_live_...

# 内容采集默认关闭。仅在脱敏后的测试环境显式开启
OWNAGENT_TRACE_CAPTURE_CONTENT=1
`,
  },
};

const statusItems = [
  { name: "OpenTelemetry OTLP 接收", detail: "接收标准 OTLP/HTTP JSON Trace，并保留 GenAI 属性", status: "已实现", icon: Radio },
  { name: "OwnAgent Python SDK", detail: "Run / Span、父子关系、Provider Token Usage", status: "已实现", icon: Code2 },
  { name: "Langfuse / Phoenix 转发", detail: "后端已有可配置 OTLP 导出路径；需按实际部署完成端到端验证", status: "可配置", icon: GitBranch },
  { name: "Promptfoo / DeepEval", detail: "评估引擎适配候选，尚未接入当前运行链路", status: "待集成", icon: Workflow },
  { name: "MCP Inspector", detail: "MCP 工具调试 UI 候选，尚未嵌入工作台", status: "待集成", icon: PlugZap },
];

export default function IntegrationsPage() {
  const [active, setActive] = useState<GuideKey>("sdk");
  const [copied, setCopied] = useState<"install" | "code" | null>(null);
  const guide = guides[active];

  const copy = async (value: string, target: "install" | "code") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(target);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setCopied(null);
    }
  };

  return (
    <div className="h-full min-h-0 overflow-auto bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-6 p-5 lg:p-8">
        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 p-6 text-white shadow-sm lg:p-8">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-300/20 bg-indigo-400/10 px-3 py-1 text-xs font-medium text-indigo-200">
                <PlugZap size={13} /> Agent Integration Hub
              </div>
              <h1 className="mt-4 text-2xl font-semibold tracking-tight lg:text-3xl">让任何 Agent 的真实执行过程进入 OwnAgent</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                不要求你重写 Agent。可以通过 Python SDK 显式埋点，也可以把已有 OpenTelemetry Trace 直接发送到 OwnAgent。
                模型请求、工具调用、错误和 Token 使用都以实际采集数据为准。
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-2 text-sm font-medium"><ShieldCheck size={16} className="text-emerald-300" /> 隐私默认保护</div>
              <p className="mt-2 max-w-56 text-xs leading-5 text-slate-400">Prompt / Response 内容默认不采集。仅在测试环境显式开启，并先完成脱敏。</p>
            </div>
          </div>
          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            {[
              ["01", "接入", "SDK 或 OTLP，不绑定 Agent 框架"],
              ["02", "采集", "Run、Span、工具 I/O、错误与真实 Token"],
              ["03", "排查", "在运行观测中查看瀑布流和原始属性"],
            ].map(([n, title, desc]) => (
              <div key={n} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                <div className="text-xs font-mono text-indigo-300">{n}</div>
                <div className="mt-2 text-sm font-semibold">{title}</div>
                <div className="mt-1 text-xs text-slate-400">{desc}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,.8fr)]">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 p-5">
              <div className="flex items-center gap-2 text-sm font-semibold"><Terminal size={16} className="text-indigo-600" /> 接入指南</div>
              <p className="mt-1 text-xs text-slate-500">选择最适合当前项目的接入方式。</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {([
                  ["sdk", "Python SDK"],
                  ["otel", "OpenTelemetry"],
                  ["frameworks", "现有平台 / 环境变量"],
                ] as [GuideKey, string][]).map(([key, label]) => (
                  <button key={key} onClick={() => setActive(key)} className={`rounded-lg px-3 py-2 text-xs font-medium transition ${active === key ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{label}</button>
                ))}
              </div>
            </div>
            <div className="space-y-4 p-5">
              <div>
                <h2 className="text-sm font-semibold">{guide.title}</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">{guide.subtitle}</p>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-500">安装依赖</span>
                  <button onClick={() => void copy(guide.install, "install")} className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-700">{copied === "install" ? <Check size={12} /> : <Copy size={12} />}{copied === "install" ? "已复制" : "复制"}</button>
                </div>
                <pre className="overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-200">{guide.install}</pre>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-500">接入示例</span>
                  <button onClick={() => void copy(guide.code, "code")} className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-700">{copied === "code" ? <Check size={12} /> : <Copy size={12} />}{copied === "code" ? "已复制" : "复制代码"}</button>
                </div>
                <pre className="max-h-[440px] overflow-auto rounded-lg bg-slate-950 p-4 text-[11px] leading-5 text-slate-200"><code>{guide.code}</code></pre>
              </div>
              <a href="https://github.com/cpttbtptp2812/ownsudo/tree/main/sdk/python" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700">完整 SDK 文档 <ExternalLink size={12} /></a>
            </div>
          </div>

          <div className="space-y-5">
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2 text-sm font-semibold"><Activity size={16} className="text-indigo-600" /> 集成能力状态</div>
              <div className="mt-4 space-y-4">
                {statusItems.map((item) => {
                  const Icon = item.icon;
                  return <div key={item.name} className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-lg bg-slate-100 p-2 text-slate-600"><Icon size={15} /></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-800">{item.name}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] ${item.status === "已实现" ? "bg-emerald-50 text-emerald-700" : item.status === "可配置" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"}`}>{item.status}</span>
                      </div>
                      <p className="mt-1 text-[11px] leading-5 text-slate-500">{item.detail}</p>
                    </div>
                  </div>;
                })}
              </div>
            </section>
            <section className="rounded-xl border border-amber-200 bg-amber-50/70 p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-900"><Layers3 size={16} /> 重要说明</div>
              <ul className="mt-3 list-disc space-y-2 pl-4 text-xs leading-5 text-amber-900/80">
                <li>OTLP 接入需要 Agent API Key；密钥由现有后端 bootstrap 配置提供。</li>
                <li>Token 只有在 Provider Usage 或标准 GenAI Usage 属性实际上报时才会显示。</li>
                <li>没有采集到的 Prompt、工具结果或结束时间会明确显示缺失，不会补造。</li>
                <li>Langfuse / Phoenix 当前是 OTLP 转发路径，不代表已嵌入完整第三方 UI。</li>
              </ul>
            </section>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4">
          <div>
            <div className="text-sm font-semibold text-slate-800">接入完成后，去运行观测查看真实 Trace</div>
            <p className="mt-1 text-xs text-slate-500">按 Run、Session、Trace 搜索；展开每个 Span 查看属性、请求内容和错误。</p>
          </div>
          <button onClick={() => window.dispatchEvent(new CustomEvent("ownagent:navigate", { detail: "runs" }))} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-indigo-700">打开运行观测 <ArrowUpRight size={14} /></button>
        </div>
      </div>
    </div>
  );
}
