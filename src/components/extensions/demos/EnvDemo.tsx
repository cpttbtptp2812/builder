import { useEffect, useState } from "react";

type Env = "local" | "staging";

const PROFILES: Record<
  Env,
  { label: string; apiBase: string; token: string; host: string }
> = {
  local: {
    label: "本地",
    apiBase: "—",
    token: "—",
    host: "localhost:5173",
  },
  staging: {
    label: "测试",
    apiBase: "https://api.staging.example.com",
    token: "Bearer sk-test-***",
    host: "app.staging.example.com",
  },
};

/** Env — 按域名切换 API / Token */
export function EnvDemo() {
  const [env, setEnv] = useState<Env>("local");
  const [phase, setPhase] = useState<"idle" | "fetch" | "done">("idle");
  const profile = PROFILES[env];

  useEffect(() => {
    const run = () => {
      setPhase("idle");
      const t1 = window.setTimeout(() => setPhase("fetch"), 400);
      const t2 = window.setTimeout(() => setPhase("done"), 1600);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    };
    const cleanup = run();
    const loop = window.setInterval(run, 2800);
    return () => {
      cleanup();
      clearInterval(loop);
    };
  }, [env]);

  useEffect(() => {
    const flip = window.setInterval(() => {
      setEnv((e) => (e === "local" ? "staging" : "local"));
    }, 5600);
    return () => clearInterval(flip);
  }, []);

  const reqUrl =
    env === "staging" ? "https://api.staging.example.com/api/user" : "/api/user";
  const hasAuth = env === "staging";

  return (
    <div className="ext-demo ext-demo--env">
      <div className="ext-demo-env-config">
        <p className="ext-demo-env-host">
          当前页 <code>{profile.host}</code>
        </p>
        <div className="ext-demo-env-toggle">
          <button type="button" className={env === "local" ? "on" : ""} onClick={() => setEnv("local")}>
            本地
          </button>
          <button type="button" className={env === "staging" ? "on" : ""} onClick={() => setEnv("staging")}>
            测试
          </button>
        </div>
        <dl className="ext-demo-env-fields">
          <div>
            <dt>API Base</dt>
            <dd>{profile.apiBase}</dd>
          </div>
          <div>
            <dt>Token</dt>
            <dd>{profile.token}</dd>
          </div>
        </dl>
      </div>
      <div className="ext-demo-env-flow">
        <div className="ext-demo-code">
          <span>fetch(&apos;/api/user&apos;)</span>
        </div>
        <div className={`ext-demo-arrow${phase !== "idle" ? " on" : ""}`}>→</div>
        <div className={`ext-demo-request${phase === "fetch" || phase === "done" ? " on" : ""}`}>
          <div>
            <strong>GET</strong> {reqUrl}
          </div>
          {hasAuth && <div className="ext-demo-header">Authorization: Bearer sk-test-***</div>}
          {phase === "done" && <div className="ext-demo-status ok">200 OK · 42ms</div>}
        </div>
      </div>
      <p className="ext-demo-caption">
        刷新页面后，同域名下的 fetch 自动重写 Base URL 并注入 Token
      </p>
    </div>
  );
}
