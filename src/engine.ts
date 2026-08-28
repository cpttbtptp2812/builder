import { id, matchWorkflows, reasoningFor, replyFor, RUN_STEPS, WORKFLOWS } from "./data/demo";
import { getProjectById, matchProject, PROJECT_DETAILS } from "./data/knowledge";
import { SCENARIOS } from "./data/scenarios";
import { useStore } from "./store";

export function burstConfetti() {
  const colors = ["#5eead4", "#f0b429", "#818cf8", "#f472b6"];
  for (let i = 0; i < 48; i++) {
    const el = document.createElement("span");
    el.className = "confetti-bit";
    el.style.left = `${40 + Math.random() * 20}%`;
    el.style.background = colors[i % colors.length]!;
    el.style.animationDelay = `${Math.random() * 0.35}s`;
    el.style.setProperty("--x", `${(Math.random() - 0.5) * 280}px`);
    document.body.appendChild(el);
    window.setTimeout(() => el.remove(), 2200);
  }
}

type ReplyOpts = {
  think?: boolean;
  onComplete?: () => void;
};

export function streamReply(sid: string, userText: string, opts: ReplyOpts = {}) {
  const push = useStore.getState().push;
  const patch = useStore.getState().patch;
  const removeMsg = useStore.getState().removeMsg;

  push(sid, { id: id(), kind: "user", text: userText, t: Date.now() });

  const searchId = id();
  push(sid, {
    id: searchId,
    kind: "searching",
    t: Date.now(),
    text: /工作流|自动化|流程|运行|改价/.test(userText)
      ? "正在匹配工作流…"
      : /知识|文档|RAG/.test(userText)
        ? "正在检索知识库…"
        : /项目|介绍|架构|难点|简历|做过/.test(userText)
          ? "正在检索项目经历…"
          : "正在思考…",
  });

  window.setTimeout(() => {
    removeMsg(sid, searchId);

    const runAssistant = () => {
      const aid = id();
      push(sid, { id: aid, kind: "assistant", text: "", t: Date.now(), streaming: true });
      const full = replyFor(userText);
      let i = 0;
      const type = () => {
        i += 2;
        patch(sid, aid, { text: full.slice(0, i), streaming: i < full.length });
        if (i < full.length) window.setTimeout(type, 18);
        else onDone(sid, userText, opts);
      };
      window.setTimeout(type, 40);
    };

    if (opts.think) {
      const rid = id();
      push(sid, {
        id: rid,
        kind: "reasoning",
        t: Date.now(),
        text: "",
        streaming: true,
      });
      const reasoning = reasoningFor(userText);
      let j = 0;
      const typeReason = () => {
        j += 3;
        patch(sid, rid, { text: reasoning.slice(0, j), streaming: j < reasoning.length });
        if (j < reasoning.length) window.setTimeout(typeReason, 12);
        else {
          patch(sid, rid, { streaming: false, collapsed: true });
          runAssistant();
        }
      };
      window.setTimeout(typeReason, 80);
    } else {
      runAssistant();
    }
  }, 720);
}

function onDone(sid: string, userText: string, opts: ReplyOpts) {
  const push = useStore.getState().push;
  const patch = useStore.getState().patch;

  if (/知识|文档|RAG/.test(userText)) {
    const tid = id();
    push(sid, {
      id: tid,
      kind: "tool",
      t: Date.now(),
      name: "Knowledge / MCP",
      output: "",
      status: "loading",
    });
    window.setTimeout(() => {
      patch(sid, tid, {
        status: "done",
        output: "命中 3 条：① 部署规范 v2.1  ② API 限流说明  ③ 工作流权限模型",
      });
    }, 900);
  }

  const matched = matchWorkflows(userText);
  if (matched.length) {
    push(sid, { id: id(), kind: "workflows", t: Date.now(), items: matched });
  }

  if (/运行|改价|上架|执行|发布前检查/.test(userText)) {
    const title =
      WORKFLOWS.find((w) => /改价|发布/.test(w.title))?.title ?? matched[0]?.title ?? "批量改价上架";
    window.setTimeout(() => runProcess(sid, title), 600);
  }

  const project = matchProject(userText);
  const multiIds = /我想了解这些项目/.test(userText)
    ? PROJECT_DETAILS.filter((p) => userText.includes(p.name)).map((p) => p.id)
    : [];

  if (multiIds.length > 1) {
    push(sid, {
      id: id(),
      kind: "topics",
      t: Date.now(),
      title: "继续深入某个项目",
      items: multiIds.flatMap((pid) => {
        const p = getProjectById(pid);
        return p
          ? [`${p.name}的架构`, `${p.name}的技术难点`, `${p.name}的成果亮点`]
          : [];
      }).slice(0, 8),
    });
  } else if (project) {
    push(sid, {
      id: id(),
      kind: "topics",
      t: Date.now(),
      title: `继续聊「${project.name.replace(/ · .+$/, "")}」`,
      items: [
        ...project.interviewTopics,
        `${project.name}的架构设计`,
        `${project.name}的技术难点`,
      ],
    });
  } else if (/全部项目|自我介绍|项目列表/.test(userText)) {
    push(sid, {
      id: id(),
      kind: "topics",
      t: Date.now(),
      title: "选一个项目深入聊",
      items: [
        "详细介绍 iMean AI 平台",
        "Agent 对话系统架构",
        "剑池重构怎么做的",
        "招行微前端实践",
        "性能优化实战",
        "团队管理经验",
      ],
    });
  }

  opts.onComplete?.();
}

export function runProcess(sid: string, workflowTitle: string) {
  const push = useStore.getState().push;
  const patch = useStore.getState().patch;
  const pid = id();

  useStore.getState().setReplayActive(true);

  push(sid, {
    id: pid,
    kind: "process",
    t: Date.now(),
    title: workflowTitle,
    status: "planning",
    step: 0,
    total: RUN_STEPS.length,
    label: "流程规划中 🚀",
  });

  window.setTimeout(() => {
    patch(sid, pid, { status: "running", label: RUN_STEPS[0]! });
  }, 900);

  let step = 0;
  const timer = window.setInterval(() => {
    step += 1;
    useStore.getState().setReplayStep(Math.min(step - 1, 3));
    if (step >= RUN_STEPS.length) {
      window.clearInterval(timer);
      patch(sid, pid, { status: "done", step: RUN_STEPS.length - 1, label: "完成 ✓" });
      burstConfetti();
      push(sid, { id: id(), kind: "rating", t: Date.now() });
      useStore.getState().setReplayActive(false);
      return;
    }
    patch(sid, pid, { step, label: RUN_STEPS[step]! });
  }, 850);
}

export function runScenario(sid: string, scenarioId: string, think = false) {
  const scenario = SCENARIOS.find((s) => s.id === scenarioId);
  if (!scenario) return;

  if (scenarioId === "agent") {
    useStore.getState().switchAgent(sid, "ops");
    streamReply(sid, "帮我做发布前检查", { think });
    return;
  }

  streamReply(sid, scenario.prompt, { think });
}
