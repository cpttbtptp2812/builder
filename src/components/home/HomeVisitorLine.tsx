import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/apiClient";

const VID_KEY = "builder-visitor-id";
const CACHE_KEY = "builder-site-uv";
/** 展示起点。本地库直接写成这个数；线上把真实访问叠在上面。 */
const START_AT = 164;

function fromRemoteHits(raw: number) {
  return START_AT + Math.max(0, raw - 1);
}

type BusuanziPayload = {
  site_uv?: number;
  site_pv?: number;
};

function visitorId() {
  try {
    const existed = localStorage.getItem(VID_KEY);
    if (existed) return existed;
    const id = crypto.randomUUID();
    localStorage.setItem(VID_KEY, id);
    return id;
  } catch {
    return "";
  }
}

function readBusuanzi(): Promise<number> {
  return new Promise((resolve, reject) => {
    const name = `BusuanziCb_${Date.now().toString(36)}`;
    const script = document.createElement("script");
    const timer = window.setTimeout(() => finish(undefined, new Error("timeout")), 4000);

    function finish(n?: number, err?: Error) {
      window.clearTimeout(timer);
      script.remove();
      delete (window as unknown as Record<string, unknown>)[name];
      if (typeof n === "number" && n > 0) resolve(n);
      else reject(err ?? new Error("empty"));
    }

    (window as unknown as Record<string, (data: BusuanziPayload) => void>)[name] = (data) => {
      finish(Number(data?.site_uv) || Number(data?.site_pv) || 0);
    };
    script.src = `https://busuanzi.ibruce.info/busuanzi?jsonpCallback=${name}`;
    script.onerror = () => finish(undefined, new Error("script"));
    document.body.appendChild(script);
  });
}

async function bumpFallback(): Promise<number> {
  const cached = Number(sessionStorage.getItem(CACHE_KEY) || 0);
  if (cached > 0) return cached;
  const res = await fetch("https://api.counterapi.dev/v1/wangxu-builder/home-uv/up");
  if (!res.ok) throw new Error(String(res.status));
  const json = (await res.json()) as { count?: number; Count?: number };
  const n = Number(json.count ?? json.Count ?? 0);
  if (n > 0) sessionStorage.setItem(CACHE_KEY, String(n));
  return n;
}

/** 主页访客序号。有后端走 SQLite UV；GitHub Pages 走不蒜子，再降级公共计数。 */
export function HomeVisitorLine() {
  const [n, setN] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const local = await apiFetch<{ uv: number }>("/api/visits", {
        method: "POST",
        body: JSON.stringify({ vid: visitorId() }),
      });
      if (alive && local && local.uv > 0) {
        setN(Math.max(START_AT, local.uv));
        return;
      }
      try {
        const uv = await readBusuanzi();
        if (alive) setN(fromRemoteHits(uv));
      } catch {
        try {
          const uv = await bumpFallback();
          if (alive && uv > 0) setN(fromRemoteHits(uv));
        } catch {
          /* 统计失败就不占主页 */
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!n) return null;

  return (
    <p className="site-home-visitor">
      欢迎您，是第 <strong>{n.toLocaleString("zh-CN")}</strong> 位访问本站的朋友
    </p>
  );
}
