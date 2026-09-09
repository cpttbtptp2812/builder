(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.SkillTapClean = api;
})(typeof self !== "undefined" ? self : globalThis, function () {
  const DROP = new Set(["hover", "mousemove", "mouseover", "mouseout", "pointerenter", "pointerleave", "scroll"]);

  function sameTarget(a, b) {
    if (!a || !b) return false;
    if (a.selector && b.selector && a.selector === b.selector) return true;
    if (a.role && a.name && a.role === b.role && a.name === b.name) return true;
    return false;
  }

  function originOf(step) {
    if (step?.url) {
      try {
        return new URL(step.url).origin + new URL(step.url).pathname;
      } catch {
        return step.url;
      }
    }
    return "";
  }

  function isNoiseClick(step) {
    if (step.action !== "click") return false;
    if (step.tag === "html" || step.tag === "body") return true;
    if ((step.selector === "body > a" || step.selector === "body > a:nth-of-type(1)") && !step.name) return true;
    if (step.tag === "div" && !step.role && !step.id && (!step.name || step.name.length > 48)) return true;
    return false;
  }

  function cleanSteps(steps) {
    const list = Array.isArray(steps) ? steps.slice() : [];
    const out = [];

    for (const raw of list) {
      if (!raw || DROP.has(raw.action)) continue;
      const step = { ...raw };
      let last = out[out.length - 1];

      if (isNoiseClick(step)) continue;

      if (step.action === "fill" && last?.action === "click" && sameTarget(last, step)) {
        out.pop();
        last = out[out.length - 1];
      }

      if (step.action === "fill" && last?.action === "fill" && sameTarget(last, step)) {
        last.value = step.value;
        last.secret = Boolean(step.secret);
        last.ts = step.ts;
        continue;
      }

      if (
        step.action === "click" &&
        last?.action === "click" &&
        sameTarget(last, step) &&
        typeof step.ts === "number" &&
        typeof last.ts === "number" &&
        step.ts - last.ts < 450
      ) {
        continue;
      }

      if (step.action === "goto") {
        if (last?.action === "goto" && last.url === step.url) continue;
        if (last?.action === "click" && last.href && last.href === step.url) continue;
        if (last && originOf(last) === step.url) continue;
      }

      if (
        step.action === "submit" &&
        last?.action === "click" &&
        (last.type === "submit" || last.tag === "button" || last.role === "button")
      ) {
        continue;
      }

      out.push(step);
    }

    if (out.length && out[0].action !== "goto") {
      const url = out.find((s) => s.url)?.url;
      if (url) {
        out.unshift({
          action: "goto",
          url,
          ts: (out[0].ts || Date.now()) - 1,
        });
      }
    }

    return out;
  }

  function fileTitle(name) {
    const s = String(name || "操作手册")
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 40);
    return `${s || "操作手册"}.html`;
  }

  function instruct(step) {
    if (step.action === "goto") {
      return {
        title: "打开网页",
        body: "用浏览器打开下面这个地址。",
        link: step.url || "",
      };
    }
    if (step.action === "pause") {
      return {
        title: "这一步请你自己做",
        body: step.reason || "例如登录、验证码、选择文件。做完再看下一步。",
        link: "",
      };
    }
    if (step.action === "fill") {
      const field = step.name || "这个输入框";
      if (step.secret) {
        return { title: "填写（需你自己输入）", body: `在「${field}」里输入。密码不会写进手册。`, link: "" };
      }
      return { title: "填写", body: `在「${field}」里输入：${String(step.value ?? "")}`, link: "" };
    }
    if (step.action === "select") {
      return {
        title: "选择",
        body: `在「${step.name || "下拉框"}」里选：${step.value || ""}`,
        link: "",
      };
    }
    if (step.action === "submit") {
      return { title: "提交", body: `提交表单${step.name ? `「${step.name}」` : ""}。`, link: "" };
    }
    if (step.action === "click") {
      if (step.name) return { title: "点击", body: `点击「${step.name}」。`, link: step.href || "" };
      return { title: "点击", body: "点击图中红点标出的位置。", link: step.href || "" };
    }
    return { title: "操作", body: String(step.action || ""), link: "" };
  }

  function summarize(step) {
    const { title, body } = instruct(step);
    return `${title}：${body}`;
  }

  function packStem(name) {
    return fileTitle(name).replace(/\.html$/i, "") || "操作手册";
  }

  function slugify(name) {
    return packStem(name);
  }

  return { cleanSteps, fileTitle, packStem, instruct, summarize, slugify, DROP };
});
