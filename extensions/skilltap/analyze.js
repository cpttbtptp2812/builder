(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.SkillTapAnalyze = api;
})(typeof self !== "undefined" ? self : globalThis, function () {
  const LEVEL = { high: "高", med: "中", info: "低" };

  function analyze({ steps, logs, issue }) {
    const findings = [];
    const list = Array.isArray(steps) ? steps : [];
    const seen = new Set();

    function push(item) {
      const key = `${item.level}|${item.title}|${item.detail}`;
      if (seen.has(key)) return;
      seen.add(key);
      findings.push(item);
    }

    const note = String(issue || "").trim();
    if (note) {
      push({ level: "high", step: 0, title: "测试描述的问题", detail: note });
    }

    list.forEach((step, i) => {
      const n = i + 1;
      const sel = String(step.selector || "");
      if (sel && /nth-of-type|nth-child|> div > div|> div:nth/i.test(sel)) {
        push({
          level: "high",
          step: n,
          title: "选择器不稳定",
          detail: `第 ${n} 步依赖「${sel}」。页面结构一变就会点错，建议给该控件加稳定 id 或 data-testid。`,
        });
      }
      if (step.id && /\d{4,}/.test(String(step.id))) {
        push({
          level: "high",
          step: n,
          title: "像动态生成的 id",
          detail: `第 ${n} 步的 id「${step.id}」含长数字，下次运行可能对不上，不要把它当定位依据。`,
        });
      }
      if (step.action === "click" && step.tag === "div" && !step.role) {
        push({
          level: "med",
          step: n,
          title: "点在无语义节点上",
          detail: `第 ${n} 步点的是 div，不是 button/link。交互区域不明确，也更难写测试。`,
        });
      }
      if (step.action === "click" && !step.name) {
        push({
          level: "med",
          step: n,
          title: "这一步没有可读名称",
          detail: `第 ${n} 步没有按钮文案，开发只能靠选择器猜点了哪里。`,
        });
      }
      if (step.secret) {
        push({
          level: "info",
          step: n,
          title: "密文未收录",
          detail: `第 ${n} 步是密码类输入，包里没有明文。复现时需要开发自己登录。`,
        });
      }
    });

    (Array.isArray(logs) ? logs : []).forEach((log) => {
      if (log.kind === "net" || log.status) {
        push({
          level: "high",
          step: 0,
          title: `接口返回 ${log.status || "错误"}`,
          detail: `${log.status || ""} ${log.url || log.message || ""}`.trim(),
        });
        return;
      }
      if (log.message) {
        push({
          level: "high",
          step: 0,
          title: "录制时控制台报错",
          detail: String(log.message).slice(0, 400),
        });
      }
    });

    if (!findings.length) {
      push({
        level: "info",
        step: 0,
        title: "未自动扫到明显异常",
        detail: "仍请对照截图和步骤看业务是否符合预期。选择器在 DOM 变更后仍可能失效。",
      });
    }

    const order = { high: 0, med: 1, info: 2 };
    findings.sort((a, b) => (order[a.level] ?? 9) - (order[b.level] ?? 9));
    return findings.slice(0, 24);
  }

  function levelLabel(level) {
    return LEVEL[level] || level;
  }

  return { analyze, levelLabel };
});
