/** 按声明登记一个外部 HTTP 工具。调用时只带登记的权限和超时。 */

import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/apiClient";
import { OaBtn, OaField, OaStack } from "./OaUi";

type Tool = { name: string; title: string; endpoint: string; capability: string; timeoutMs: number };

export function ExternalToolBox() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const load = async () => {
    const res = await apiFetch<{ tools: Tool[] }>("/api/tools/external");
    if (res) setTools(res.tools);
    else setNote("现在读不到已登记的工具。团队口令不对时登记会被拒绝。");
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <OaStack>
      <p className="oa-toolbar-lead">登记一个外部地址。办理走到同名步骤时，只按这里写的权限和超时去访问，不会在本机执行对方的代码。</p>
      {tools.map((tool) => (
        <p key={tool.name} className="oa-toolbar-lead">
          {tool.title} · {tool.name} · {tool.capability} · {Math.round(tool.timeoutMs / 1000)} 秒
          <OaBtn
            variant="ghost"
            onClick={() => {
              void apiFetch(`/api/tools/external/${encodeURIComponent(tool.name)}`, { method: "DELETE" }).then(() => load());
            }}
          >
            移除
          </OaBtn>
        </p>
      ))}
      <OaField label="工具名">
        <input className="oa-input" value={name} placeholder="lookup" onChange={(e) => setName(e.target.value)} />
      </OaField>
      <OaField label="显示名">
        <input className="oa-input" value={title} onChange={(e) => setTitle(e.target.value)} />
      </OaField>
      <OaField label="地址">
        <input className="oa-input" value={endpoint} placeholder="https://example.com/tool" onChange={(e) => setEndpoint(e.target.value)} />
      </OaField>
      <OaBtn
        onClick={() => {
          void (async () => {
            const res = await apiFetch<{ ok?: boolean; error?: string }>("/api/tools/external", {
              method: "POST",
              body: JSON.stringify({ name, title, endpoint, capability: "network", timeoutMs: 15000 }),
            });
            setNote(res?.ok ? "已登记" : "没有登记上。名字用小写字母开头，地址必须是外网 https。");
            if (res?.ok) void load();
          })();
        }}
      >
        登记
      </OaBtn>
      {note ? <p className="oa-toolbar-lead">{note}</p> : null}
    </OaStack>
  );
}
