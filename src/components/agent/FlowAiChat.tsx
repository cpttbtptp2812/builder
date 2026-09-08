import { useRef, useState } from "react";
import { isLlmConfigured, loadLlmConfig, resolveLlmBaseUrl } from "../../lib/llmConfig";
import {
  coerceDraft,
  draftToPretty,
  hydrateDraft,
  proposeFlowFromPrompt,
  slimFlow,
  type HubAiDraft,
  type HubNodeData,
} from "../../lib/hubFlow";
import { STEP_IDS, STEP_REGISTRY } from "./steps/registry";
import type { Edge, Node } from "@xyflow/react";

type ChatItem = {
  role: "user" | "assistant";
  text: string;
  story?: boolean;
  hintMeta?: Hint;
  draft?: HubAiDraft;
  showJson?: boolean;
};

type Hint = {
  id: string;
  label: string;
  prompt: string;
  does: string;
  why: string;
  problem: string;
  talkOnly?: boolean;
};

const HINTS: Hint[] = [
  {
    id: "story",
    label: "讲讲这套流程",
    prompt: "讲讲这套流程每一步做什么",
    does: "按 14 步把整张图讲一遍，不改图。",
    why: "对外展示时先讲清楚链路，再动手改。",
    problem: "只丢一堆节点名，听的人不知道每步解决什么。",
    talkOnly: true,
  },
  {
    id: "release",
    label: "发布前检查",
    prompt: "做成发布前检查的一条线",
    does: "理解问句 → 意图 → 实体 → 规划 → 浏览器探活 → 管控。",
    why: "上线前先确认站点还能访问。",
    problem: "不问就部署，挂了才发现。",
  },
  {
    id: "link",
    label: "规划接到知识",
    prompt: "从规划任务连到知识检索",
    does: "在现有图上加一条：规划任务 → 知识检索。",
    why: "拆完任务单就能去站内说明里找依据。",
    problem: "计划和知识库断开，答案没有出处。",
  },
  {
    id: "parallel",
    label: "能力三路并行",
    prompt: "能力三路并行",
    does: "管控之后同时走浏览器、协议、知识三条。",
    why: "三路互不依赖，一起跑更快。",
    problem: "一个完再打下一个，体感会慢三倍。",
  },
  {
    id: "reset",
    label: "恢复默认四列",
    prompt: "恢复默认四列",
    does: "回到理解 / 编排 / 运行 / 能力四列。",
    why: "改乱了要能一键回到讲解用的默认图。",
    problem: "演示到一半图已经不是原来那张。",
  },
];

function isStoryPrompt(prompt: string) {
  return /讲讲|介绍|这套流程|每一步做什么/.test(prompt);
}

function matchHint(prompt: string): Hint | undefined {
  return HINTS.find((h) => h.prompt === prompt || prompt.includes(h.label));
}

async function askLlm(prompt: string, currentJson: string): Promise<HubAiDraft | null> {
  const config = loadLlmConfig();
  if (!isLlmConfigured(config)) return null;
  const baseUrl = resolveLlmBaseUrl(config.baseUrl);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.apiKey.trim()) headers.Authorization = `Bearer ${config.apiKey.trim()}`;
  const ac = new AbortController();
  const timer = window.setTimeout(() => ac.abort(), 5000);
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      signal: ac.signal,
      body: JSON.stringify({
        model: config.model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: `你是工作流编排助手。只输出一段 JSON，不要 markdown。格式：
{"summary":"一句话","nodes":[{"id":"nlu","bind":"nlu","label":"理解问句"}],"edges":[{"from":"nlu","to":"intent"}]}
bind 只能是：nlu,intent,entity,plan,context,dsl,manage,pattern,engine,mech,ctrl,browser,mcp,kb。`,
          },
          { role: "user", content: `当前图：\n${currentJson}\n\n要求：${prompt}` },
        ],
      }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = body.choices?.[0]?.message?.content?.trim() ?? "";
    try {
      return coerceDraft(JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, "")));
    } catch {
      return null;
    }
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

function StoryCards() {
  return (
    <ol className="hub-ai-story">
      {STEP_IDS.map((id, i) => {
        const s = STEP_REGISTRY[id];
        return (
          <li key={id}>
            <b>
              {i + 1}. {s.label}
            </b>
            <span>做什么：{s.job}</span>
            <span>为了：{s.why}</span>
            <em>解决：{s.problem}</em>
          </li>
        );
      })}
    </ol>
  );
}

export function FlowAiChat({
  nodes,
  edges,
  onApply,
  embedded = false,
}: {
  nodes: Node<HubNodeData>[];
  edges: Edge[];
  onApply: (next: { nodes: Node<HubNodeData>[]; edges: Edge[] }) => void;
  embedded?: boolean;
}) {
  const [items, setItems] = useState<ChatItem[]>([
    {
      role: "assistant",
      text: "这套图是「一个问题怎么被做完」。从左到右四列：理解 → 编排 → 运行 → 能力。理解列只认字和意图，不跑工具；编排列写成说明书和工单；运行列才真正一步一步调；能力列是被调用的手。下面按节点把每一步说清楚。",
      story: true,
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  function pushAssistant(item: ChatItem) {
    setItems((curr) => [...curr, item]);
    window.requestAnimationFrame(() => {
      boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight, behavior: "smooth" });
    });
  }

  function replyNow(prompt: string) {
    if (isStoryPrompt(prompt)) {
      pushAssistant({
        role: "assistant",
        text: "再讲一遍。点上方其它标签才会生成 JSON；「应用」才写到图上。",
        story: true,
        hintMeta: HINTS[0],
      });
      return;
    }

    const hint = matchHint(prompt);
    const current = slimFlow(nodes, edges);
    const draft = proposeFlowFromPrompt(prompt, current);
    const ok = hydrateDraft(draft, nodes);
    pushAssistant({
      role: "assistant",
      text: ok
        ? `${draft.summary}\n点「应用」才写到图上，「不用」丢掉。`
        : "这版对不上节点。换「讲讲这套流程」或「恢复默认四列」试试。",
      hintMeta: hint,
      draft: ok ? draft : undefined,
      showJson: false,
    });
  }

  function send(text: string) {
    const prompt = text.trim();
    if (!prompt) return;
    setInput("");
    setItems((curr) => [...curr, { role: "user", text: prompt }]);
    try {
      replyNow(prompt);
    } catch {
      pushAssistant({
        role: "assistant",
        text: "规则引擎没写出这版。换「讲讲这套流程」或「恢复默认四列」。",
      });
      return;
    }
    if (isStoryPrompt(prompt) || !isLlmConfigured(loadLlmConfig())) return;
    const current = slimFlow(nodes, edges);
    setBusy(true);
    void askLlm(prompt, JSON.stringify(current))
      .then((llm) => {
        if (!llm || !hydrateDraft(llm, nodes)) return;
        pushAssistant({
          role: "assistant",
          text: `${llm.summary}\n这是模型另给的一版，同样要你点「应用」才生效。`,
          draft: llm,
          showJson: false,
        });
      })
      .finally(() => setBusy(false));
  }

  function applyDraft(draft: HubAiDraft) {
    const next = hydrateDraft(draft, nodes);
    if (!next) return;
    onApply(next);
    pushAssistant({ role: "assistant", text: "已写到画布。再点图上的「保存」，刷新后还在。" });
  }

  return (
    <aside className={`hub-ai${embedded ? " is-embedded" : ""}`} aria-label="AI 改图">
      {!embedded && (
        <header>
          <strong>AI 改图</strong>
          <span>先讲清楚，再决定改不改图</span>
        </header>
      )}
      <p className="hub-ai-lead">
        标签是改图口令，不是聊天记录。点「讲讲这套流程」听每一步；其它标签马上回一版 JSON，「应用」才改图。
      </p>
      <div className="hub-ai-hints">
        {HINTS.map((h) => (
          <button
            key={h.id}
            type="button"
            className="hub-ai-hint"
            title={`${h.does} ${h.why} ${h.problem}`}
            onClick={() => send(h.prompt)}
          >
            {h.label}
          </button>
        ))}
      </div>
      <div className="hub-ai-log" ref={boxRef}>
        {items.map((item, i) => (
          <article key={`${item.role}-${i}`} className={item.role}>
            {item.hintMeta && item.role === "assistant" && !item.story && (
              <div className="hub-ai-why">
                <b>{item.hintMeta.label}</b>
                <span>做什么：{item.hintMeta.does}</span>
                <span>为了：{item.hintMeta.why}</span>
                <em>解决：{item.hintMeta.problem}</em>
              </div>
            )}
            <p>{item.text}</p>
            {item.story && <StoryCards />}
            {item.draft && (
              <div className="hub-ai-draft">
                <div className="hub-ai-actions">
                  <button type="button" className="apply" onClick={() => applyDraft(item.draft!)}>
                    应用
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setItems((curr) => curr.map((row, j) => (j === i ? { ...row, draft: undefined, text: `${row.text} · 已不用` } : row)));
                    }}
                  >
                    不用
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setItems((curr) => curr.map((row, j) => (j === i ? { ...row, showJson: !row.showJson } : row)));
                    }}
                  >
                    {item.showJson ? "收起 JSON" : "查看 JSON"}
                  </button>
                </div>
                {item.showJson && <pre>{draftToPretty(item.draft)}</pre>}
              </div>
            )}
          </article>
        ))}
        {busy && <p className="hub-ai-busy">模型还在给另一版，规则那版已经在上面了。</p>}
      </div>
      <form
        className="hub-ai-form"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <textarea
          rows={2}
          value={input}
          placeholder="例如：讲讲这套流程 / 从整理上下文连到流程定义"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          onChange={(e) => setInput(e.target.value)}
        />
        <button type="submit" disabled={!input.trim()}>
          生成
        </button>
      </form>
    </aside>
  );
}
