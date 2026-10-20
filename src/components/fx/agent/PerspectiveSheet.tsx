import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { ArtifactTable } from "../../../lib/chatArtifacts";
import { loadLlmConfig } from "../../../lib/llmConfig";
import "@perspective-dev/viewer/themes";
import "@perspective-dev/viewer/themes/intl/zh.css";
import "./perspective-sheet.css";

type Viewer = HTMLElement & {
  load: (table: unknown) => Promise<void>;
  delete: () => Promise<void>;
  download: (options?: unknown) => Promise<void>;
  restore: (config: unknown) => Promise<void>;
  agentConfig: (config: unknown) => void;
  agentPrompt: (prompt: string) => Promise<unknown>;
};

type Live = {
  viewer?: Viewer;
  table?: { delete?: () => Promise<void> };
  worker?: { terminate?: () => Promise<void> };
};

type AskModel = { url: string; apiKey: string; model: string };

type PerspectiveClient = {
  worker: () => Promise<{
    table: (rows: Record<string, unknown>[]) => Promise<{ delete?: () => Promise<void> }>;
    terminate?: () => Promise<void>;
  }>;
  init_server: (wasm: Promise<Response>) => void;
};

let boot: Promise<PerspectiveClient> | null = null;

function perspectiveReady() {
  if (!boot) {
    boot = (async () => {
      const [{ default: perspective }, viewer] = await Promise.all([
        import("@perspective-dev/client"),
        import("@perspective-dev/viewer"),
      ]);
      const viewerWasm = (await import("@perspective-dev/viewer/dist/wasm/perspective-viewer.wasm?url")).default;
      const serverWasm = (await import("@perspective-dev/server/dist/wasm/perspective-server.wasm?url")).default;
      perspective.init_server(fetch(serverWasm));
      await viewer.init_client(fetch(viewerWasm));
      await import("@perspective-dev/viewer-datagrid");
      await customElements.whenDefined("perspective-viewer-datagrid");
      await new Promise((resolve) => setTimeout(resolve, 50));
      return perspective;
    })();
  }
  return boot;
}

function readAskModel(): AskModel | null {
  try {
    const apiKey = localStorage.getItem("uniagent-llm-key")?.trim() ?? "";
    if (!apiKey) return null;
    const config = loadLlmConfig();
    if (!config.enabled) return null;
    const base = config.baseUrl.trim().replace(/\/$/, "");
    if (!base.startsWith("https://")) return null;
    const model = config.model.trim();
    if (!model) return null;
    const url = base.endsWith("/chat/completions") ? base : `${base}/chat/completions`;
    return { url, apiKey, model };
  } catch {
    return null;
  }
}

const VIEWER_THEME: Record<string, string> = {
  "--psp--color": "#1a2332",
  "--psp--background-color": "#ffffff",
  "--psp-active--color": "#0f6e6a",
  "--psp-active--background": "#e7f3f1",
  "--psp-inactive--color": "#7d8b9c",
  "--psp-inactive--border-color": "#e3eaf1",
  "--psp-sidebar--background": "#f7f9fb",
  "--psp-placeholder--background": "#eef2f6",
  "--psp-select--background-color": "#ffffff",
  "--psp-dropdown--box-shadow": "0 8px 20px rgba(26, 35, 50, 0.08)",
  "--psp-button--font-size": "13px",
  "--psp-button--min-width": "28px",
  "--psp-column-selector--font-size": "12px",
  "--psp-datagrid--row--height": "30px",
  "--psp-datagrid--border-color": "#e3eaf1",
  "--psp-datagrid--hover--border-color": "#c5ddd9",
  "--psp-datagrid--pos-cell--color": "#0f6e6a",
  "--psp-datagrid--neg-cell--color": "#9f2d2d",
  "--psp-interface-monospace--font-family": '"Segoe UI", "PingFang SC", sans-serif',
};

const VIEW_LABELS: Record<string, string> = {
  EDIT: "可改字",
  READ_ONLY: "只读",
  SELECT_ROW: "选中一行",
  SELECT_COLUMN: "选中一列",
  SELECT_REGION: "选中一块",
  SELECT_ROW_TREE: "按组选中",
  Rollup: "汇总",
  rollup: "汇总",
  Flat: "平铺",
  flat: "平铺",
  Total: "只看合计",
  total: "只看合计",
  inherit: "默认字体",
  monospace: "等宽",
  "sans-serif": "黑体",
  serif: "宋体",
  "system-ui": "系统字体",
  "Pro Light": "浅色",
  "Pro Dark": "深色",
  "==": "等于",
  "!=": "不等于",
  ">": "大于",
  "<": "小于",
  ">=": "不小于",
  "<=": "不大于",
  contains: "包含",
  "not contains": "不包含",
  "begins with": "开头是",
  "ends with": "结尾是",
  in: "是其中之一",
  "not in": "不是其中之一",
  "is null": "是空的",
  "is not null": "不是空的",
  "top-left": "左上",
  top: "靠上",
  "top-right": "右上",
  left: "靠左",
  center: "居中",
  right: "靠右",
  "bottom-left": "左下",
  bottom: "靠下",
  "bottom-right": "右下",
};

function translateViewerLabels(root: ParentNode) {
  if (!("querySelectorAll" in root)) return;
  for (const select of root.querySelectorAll("select")) {
    for (const option of Array.from(select.options)) {
      const label = VIEW_LABELS[option.value] ?? VIEW_LABELS[option.text];
      if (label && option.text !== label) option.text = label;
    }
  }
  for (const button of root.querySelectorAll("[data-align]")) {
    const label = VIEW_LABELS[button.getAttribute("data-align") ?? ""];
    if (label && button.getAttribute("aria-label") !== label) button.setAttribute("aria-label", label);
  }
}

function paintShadow(root: ShadowRoot | null) {
  if (!root || root.querySelector("[data-psp-paint]")) return;
  const style = document.createElement("style");
  style.dataset.pspPaint = "1";
  style.textContent = `
    #debug_tabbar_tab { display: none; }
    #settings_panel, #side_panel, .scroll-panel-container {
      background: #f7f9fb;
      background-image: none;
    }
    select, input, button {
      font-family: "Segoe UI", "PingFang SC", sans-serif;
    }
    th.psp-menu-enabled > span:first-child {
      color: #5e6b7c;
      font-size: 11px;
      font-weight: 400;
    }
  `;
  root.appendChild(style);
}

function paintViewer(viewer: HTMLElement) {
  paintShadow(viewer.shadowRoot);
  viewer.querySelectorAll("*").forEach((node) => {
    if (node instanceof HTMLElement && node.shadowRoot) paintShadow(node.shadowRoot);
  });
}

function watchViewerLabels(viewer: HTMLElement) {
  const observers: MutationObserver[] = [];
  const watched = new WeakSet<ParentNode>();
  const arm = (root: ParentNode) => {
    if (watched.has(root)) return;
    watched.add(root);
    translateViewerLabels(root);
    const discover = () => {
      paintViewer(viewer);
      translateViewerLabels(root);
      if (!("querySelectorAll" in root)) return;
      for (const el of root.querySelectorAll("*")) {
        if (el.shadowRoot) arm(el.shadowRoot);
      }
    };
    discover();
    const observer = new MutationObserver(discover);
    observer.observe(root, { subtree: true, childList: true, characterData: true });
    observers.push(observer);
  };
  arm(viewer);
  if (viewer.shadowRoot) arm(viewer.shadowRoot);
  return () => observers.forEach((observer) => observer.disconnect());
}

function uniqueNames(columns: string[]): string[] {
  const seen = new Map<string, number>();
  return columns.map((column, index) => {
    const base = column.trim() || `列${index + 1}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base} ${count + 1}`;
  });
}

function asNumber(raw: string): number | null {
  const text = raw.replace(/,/g, "").trim();
  if (!/^-?\d+(\.\d+)?$/.test(text)) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

function toRecords(table: ArtifactTable): Record<string, unknown>[] {
  const names = uniqueNames(table.columns);
  const numeric = names.map((_, index) => {
    const filled = table.rows.some((row) => (row[index] ?? "").trim());
    return filled && table.rows.every((row) => {
      const cell = (row[index] ?? "").trim();
      return !cell || asNumber(cell) !== null;
    });
  });
  return table.rows.map((row) => {
    const record: Record<string, unknown> = {};
    names.forEach((name, index) => {
      const raw = row[index] ?? "";
      record[name] = numeric[index] ? asNumber(raw) : raw;
    });
    return record;
  });
}

function TableIcon() {
  return (
    <svg className="psp-entry-icon" viewBox="0 0 18 18" aria-hidden="true">
      <rect x="1.5" y="2.5" width="15" height="13" rx="2" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M1.5 7h15M1.5 11.2h15M6.8 2.5v13" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function PerspectiveDrawer({
  title,
  detail,
  onClose,
  children,
}: {
  title: string;
  detail: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="psp-drawer-back" onClick={onClose} role="presentation">
      <aside className="psp-drawer" onClick={(event) => event.stopPropagation()} aria-label={title} role="dialog">
        <header className="psp-drawer-head">
          <div>
            <strong>{title}</strong>
            {detail ? <p title={detail}>{detail}</p> : null}
          </div>
          <button type="button" className="psp-drawer-close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </header>
        <div className="psp-drawer-body">{children}</div>
      </aside>
    </div>,
    document.body,
  );
}

function PerspectiveBody({ table, embedded = false }: { table: ArtifactTable; embedded?: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const liveRef = useRef<Live>({});
  const [status, setStatus] = useState("正在打开这张表…");
  const [fault, setFault] = useState("");
  const [modelReady, setModelReady] = useState(false);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState("");
  const records = useMemo(() => toRecords(table), [table]);
  const signature = `${table.id}|${table.title}|${table.columns.join("\u0001")}|${table.rows.length}|${table.rows[0]?.join("\u0001") ?? ""}|${table.rows.at(-1)?.join("\u0001") ?? ""}`;

  useEffect(() => {
    const host = hostRef.current;
    if (!host || records.length === 0) return;
    let cancelled = false;
    let stopWatch = () => {};
    setStatus("正在打开这张表…");
    setFault("");
    setAnswer("");
    setModelReady(false);
    void (async () => {
      try {
        const perspective = await perspectiveReady();
        if (cancelled || !hostRef.current) return;
        const viewer = document.createElement("perspective-viewer") as Viewer;
        viewer.setAttribute("theme", "Pro Light");
        viewer.setAttribute("plugin", "Datagrid");
        for (const [name, value] of Object.entries(VIEWER_THEME)) viewer.style.setProperty(name, value);
        liveRef.current.viewer = viewer;
        host.replaceChildren(viewer);
        const worker = await perspective.worker();
        liveRef.current.worker = worker;
        if (cancelled) return;
        const loaded = await worker.table(records, { name: "结果" });
        liveRef.current.table = loaded;
        if (cancelled) return;
        await viewer.load(loaded);
        await viewer.restore({ title: "结果" });
        if (!cancelled) stopWatch = watchViewerLabels(viewer);
        const model = readAskModel();
        if (model) {
          viewer.agentConfig({
            url: model.url,
            apiKey: model.apiKey,
            model: model.model,
            name: "这张表",
            systemPrompt: "你只能根据当前这张表里的列和行来筛选、分组、汇总。不要编造表里没有的数字。回答用中文。",
            entitlements: ["read_view", "configure_view", "read_docs", "read_data"],
            maxTurns: 8,
          });
          if (!cancelled) setModelReady(true);
        }
        if (!cancelled) setStatus("");
      } catch (err) {
        if (!cancelled) {
          setStatus("");
          setFault(err instanceof Error ? err.message : "这张表没打开。");
        }
      }
    })();
    return () => {
      cancelled = true;
      stopWatch();
      const live = liveRef.current;
      liveRef.current = {};
      void live.viewer?.delete?.();
      void live.table?.delete?.();
      void live.worker?.terminate?.();
      host.replaceChildren();
    };
  }, [records, signature]);

  async function downloadView() {
    const viewer = liveRef.current.viewer;
    if (!viewer) return;
    try {
      await viewer.download();
    } catch (err) {
      setFault(err instanceof Error ? err.message : "当前视图没下载下来。");
    }
  }

  async function askTable() {
    const viewer = liveRef.current.viewer;
    const text = question.trim();
    if (!viewer || !text || !modelReady || asking) return;
    setAsking(true);
    setAnswer("");
    setFault("");
    try {
      const reply = await viewer.agentPrompt(text);
      setAnswer(typeof reply === "string" && reply.trim() ? reply.trim() : "已经按这张表改了上面的视图。");
    } catch (err) {
      setFault(err instanceof Error ? err.message : "这张表没问成。");
    } finally {
      setAsking(false);
    }
  }

  return (
    <section className={embedded ? "psp-sheet in-drawer in-detail" : "psp-sheet in-drawer"} aria-label={table.title || "办理结果"}>
      <header className="psp-head">
        <span>{table.rows.length} 行</span>
        <button type="button" onClick={() => void downloadView()} disabled={Boolean(status || fault)}>
          下载当前视图
        </button>
      </header>
      <div className="psp-host" ref={hostRef} />
      {status ? <p className="psp-note">{status}</p> : null}
      {fault ? <p className="psp-fault">{fault}</p> : null}
      {!status && !fault && modelReady ? (
        <form
          className="psp-ask"
          onSubmit={(event) => {
            event.preventDefault();
            void askTable();
          }}
        >
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="按这张表问，例如：按部门汇总金额"
            aria-label="按这张表问"
            disabled={asking}
          />
          <button type="submit" disabled={asking || !question.trim()}>
            {asking ? "正在看这张表…" : "问这张表"}
          </button>
        </form>
      ) : !status && !fault ? (
        <p className="psp-note">接入里启用你的模型后，可以直接问这张表。筛选、分组和下载现在就能用。</p>
      ) : null}
      {answer ? <p className="psp-answer">{answer}</p> : null}
    </section>
  );
}

export function PerspectiveSheet({ table, embedded = false }: { table: ArtifactTable; embedded?: boolean }) {
  const [open, setOpen] = useState(false);
  const title = "结果表";
  const detail = table.title?.trim() ?? "";
  if (embedded) return <PerspectiveBody table={table} embedded />;
  return (
    <>
      <button
        type="button"
        className={open ? "psp-entry is-open" : "psp-entry"}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <TableIcon />
        <span className="psp-entry-name">{title}</span>
        <span className="psp-entry-count">{table.rows.length} 行</span>
        <span className="psp-entry-go">{open ? "收起" : "打开"}</span>
      </button>
      {open ? (
        <PerspectiveDrawer title={title} detail={detail} onClose={() => setOpen(false)}>
          <PerspectiveBody table={table} />
        </PerspectiveDrawer>
      ) : null}
    </>
  );
}
