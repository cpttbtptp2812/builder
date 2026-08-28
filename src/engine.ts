import { id, matchWorkflows, replyFor, RUN_STEPS } from "./data/demo";
import { useStore } from "./store";

export function streamReply(sid: string, userText: string) {
  const push = useStore.getState().push;
  const patch = useStore.getState().patch;

  push(sid, { id: id(), kind: "user", text: userText, t: Date.now() });

  const aid = id();
  push(sid, { id: aid, kind: "assistant", text: "", t: Date.now(), streaming: true });

  const full = replyFor(userText);
  let i = 0;
  const type = () => {
    i += 2;
    patch(sid, aid, { text: full.slice(0, i), streaming: i < full.length });
    if (i < full.length) window.setTimeout(type, 22);
    else onDone(sid, userText);
  };
  window.setTimeout(type, 60);
}

function onDone(sid: string, userText: string) {
  const push = useStore.getState().push;
  if (/知识|文档|RAG/.test(userText)) {
    push(sid, {
      id: id(),
      kind: "tool",
      t: Date.now(),
      name: "Knowledge / MCP",
      output: "命中 3 条：① 部署规范 v2.1  ② API 限流说明  ③ 工作流权限模型",
    });
  }
  const matched = matchWorkflows(userText);
  if (matched.length) {
    push(sid, { id: id(), kind: "workflows", t: Date.now(), items: matched });
  }
}

export function runProcess(sid: string, workflowTitle: string) {
  const push = useStore.getState().push;
  const patch = useStore.getState().patch;
  const pid = id();
  push(sid, {
    id: pid,
    kind: "process",
    t: Date.now(),
    title: workflowTitle,
    status: "running",
    step: 0,
    total: RUN_STEPS.length,
    label: RUN_STEPS[0]!,
  });

  let step = 0;
  const timer = window.setInterval(() => {
    step += 1;
    if (step >= RUN_STEPS.length) {
      window.clearInterval(timer);
      patch(sid, pid, { status: "done", step: RUN_STEPS.length - 1, label: "完成" });
      push(sid, { id: id(), kind: "rating", t: Date.now() });
      return;
    }
    patch(sid, pid, { step, label: RUN_STEPS[step]! });
  }, 850);
}
