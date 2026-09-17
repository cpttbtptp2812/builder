import { useEffect, useState, type CSSProperties } from "react";
import { getStep, type StepId } from "./registry";

type ParseBeat = { label: string; out: string };

const STEP_PARSE: Record<StepId, ParseBeat[]> = {
  nlu: [
    { label: "收原句", out: "对本站做发布前检查，探活并确认关键页面可访问" },
    { label: "NFKC", out: "全角/半角归一 · 22 字" },
    { label: "按空格切", out: "1 块（中文无空格）→ 后面对不上任何 trigger" },
    { label: "按标点切", out: "对本站 · 做 · 发布前检查 · 探活 · 并确认关键页面可访问" },
    { label: "计字种", out: "CJK 21 · Latin 0 · digit 0 → 后面按中文触发词加分" },
    { label: "交出", out: "tokens[] → 辨认意图" },
  ],
  intent: [
    { label: "吃进词表", out: "对本站 / 发布前检查 / 探活 / …" },
    { label: "扫触发词", out: "长词 ≥4 字 +2 · 短词 +1 · 技能名命中 +3" },
    { label: "site-analyzer", out: "探活 +1 · 检查 +1 → 2 分（长词未整段命中）" },
    { label: "其余技能", out: "workflow / policy-desk / knowledge 全 0" },
    { label: "截断", out: "只留 Top-1 = site-analyzer，零分不兜底" },
    { label: "交出", out: "skillId + breakdown → 抽出实体" },
  ],
  entity: [
    { label: "扫网址", out: "问句无 http → url 暂空" },
    { label: "认「本站」", out: "target = site:self" },
    { label: "回落地址", out: "url = 当前页 origin（你正在看的这个站）" },
    { label: "抠动作", out: "检查 · 探活 · 分析 → actions[]" },
    { label: "写入变量", out: "{ url, target, actions } 供后面填 ${url}" },
  ],
  plan: [
    { label: "接到技能", out: "site-analyzer（上一口 Top-1）" },
    { label: "Planner", out: "拆：探活 → 三页并行看 → 汇总" },
    { label: "Executor 位", out: "占位，还不调 http_probe" },
    { label: "Reviewer 位", out: "收口：ok / fail / 引用" },
    { label: "交出任务单", out: "还没开跑 · 失败时能指到哪一步" },
  ],
  context: [
    { label: "拣页面", out: "origin / hash / title / readyState" },
    { label: "估占用", out: "JSON.stringify(picked).length 当 token 近似" },
    { label: "留空位", out: "reservedForTools = 512，给后面回包" },
    { label: "裁掉", out: "整页 HTML、旧轮对话不进窗口" },
    { label: "交出", out: "working set + 剩余额度" },
  ],
  dsl: [
    { label: "读 SKILL.md", out: "src/skills/site-analyzer/SKILL.md" },
    { label: "frontmatter", out: "name / triggers / tools 白名单" },
    { label: "steps[]", out: "每步 { id, tool, label, args 模板 }" },
    { label: "出入参", out: "in: url · out: { ok, pages[] } 给下一步读" },
    { label: "钉住", out: "内核只认这些字段，不认口头步骤名" },
  ],
  manage: [
    { label: "接说明书", out: "site-analyzer @ 钉住的版本" },
    { label: "去重", out: "同一 query hash 已有排队单 → 合并" },
    { label: "开单", out: "workflowId + status=queued + version" },
    { label: "状态机", out: "queued → running → done | failed" },
    { label: "失败隔离", out: "只改这张单，不改 SKILL.md" },
  ],
  pattern: [
    { label: "看依赖", out: "三页探活互不依赖" },
    { label: "seq", out: "一页完再打下页 · 体感 ×3" },
    { label: "par", out: "fan-out 同时打 · fan-in 再汇总" },
    { label: "branch", out: "失败走重试边，成功边继续" },
    { label: "交出图", out: "谁等谁 · 此处仍不执行" },
  ],
  engine: [
    { label: "pc=0", out: "读 steps[0].tool" },
    { label: "对白名单", out: "probe 对不上 http_probe → 停住" },
    { label: "映射后", out: "dispatch(http_probe, args)" },
    { label: "写回", out: "vars.last = result · pc++" },
    { label: "step()", out: "一次只走一步，能看见卡在哪" },
  ],
  mech: [
    { label: "扫模板", out: "${origin} ${path} ${title}" },
    { label: "注入", out: "换成当前页真实值，禁止把字面量打出去" },
    { label: "沙箱", out: "只准备参数，不发请求" },
    { label: "危险写入", out: "停在 HITL，等人点允许" },
    { label: "放行后", out: "才进入真正的 tools/call" },
  ],
  ctrl: [
    { label: "对照路由", out: "expectedSkillId vs predicted" },
    { label: "分步成败", out: "ok 留下 · timeout 标红" },
    { label: "局部重试", out: "只重试坏的那一页，最多 N 次" },
    { label: "改哪里", out: "优先改 trigger，不先调温度" },
    { label: "验收", out: "命中率 + 误开通次数" },
  ],
  browser: [
    { label: "HEAD 探活", out: "真实 fetch · status / latencyMs" },
    { label: "等 idle", out: "readyState complete，避免骨架屏" },
    { label: "走 DOM", out: "role / name / tag → 可交互节点" },
    { label: "计时", out: "TTFB / load / resourceCount" },
    { label: "回包", out: "给内核，不在这一步写答案" },
  ],
  mcp: [
    { label: "tools/list", out: "http_probe · browser_snapshot · knowledge_search · …" },
    { label: "组信封", out: "{ jsonrpc:2.0, method: tools/call, params }" },
    { label: "Schema", out: "入参不合格不进 execute" },
    { label: "调用", out: "进程内 MCP，不另起宿主" },
    { label: "回包", out: "result 或 isError，单工具失败不白屏" },
  ],
  kb: [
    { label: "切问句", out: "CJK 块 / 英文词 → query terms" },
    { label: "扫语料", out: "作品集段落 chunkId，不是外网" },
    { label: "混合打分", out: "词重叠 + 项目名直匹配 + 段落类型加权" },
    { label: "截断", out: "只留 topK，带 matchedTerms" },
    { label: "出处", out: "chunkId 交回去，写答案能引用" },
  ],
};

/** 点开节点后，按拍摊开这一步内部怎么走 */
export function StepParseTrace({ stepId, playTick = 0 }: { stepId: StepId; playTick?: number }) {
  const beats = STEP_PARSE[stepId] ?? [];
  const color = getStep(stepId).color;
  const [at, setAt] = useState(0);

  useEffect(() => {
    setAt(0);
    if (beats.length <= 1) return;
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setAt(Math.min(i, beats.length - 1));
      if (i >= beats.length - 1) window.clearInterval(id);
    }, 420);
    return () => window.clearInterval(id);
  }, [stepId, playTick, beats.length]);

  return (
    <ol className="step-parse" style={{ "--parse": color } as CSSProperties} aria-label="这一步怎么走">
      {beats.map((b, i) => (
        <li key={b.label} className={i === at ? "on" : i < at ? "done" : ""}>
          <button type="button" onClick={() => setAt(i)}>
            <em>{String(i + 1).padStart(2, "0")}</em>
            <span>
              <strong>{b.label}</strong>
              <code>{b.out}</code>
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}
