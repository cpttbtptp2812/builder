import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/apiClient";

type Suggestion = {
  id: string;
  skillId: string;
  query: string;
  fingerprint: string;
  createdAt: string;
};

export function TraceFeedbackPanel({ onToast }: { onToast: (message: string) => void }) {
  const [rows, setRows] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);

  async function refresh() {
    const result = await apiFetch<{ suggestions: Suggestion[] }>("/skill-gate/trace-suggestions?status=pending");
    setRows(result?.suggestions ?? []);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function review(id: string, decision: "accept" | "reject") {
    const result = await apiFetch<{ ok: boolean }>(`/skill-gate/trace-suggestions/${encodeURIComponent(id)}/review`, {
      method: "POST",
      body: JSON.stringify({ decision }),
    });
    if (!result?.ok) {
      onToast("处理失败，请确认本地服务已启动");
      return;
    }
    onToast(decision === "accept" ? "已加入回归集" : "已忽略建议");
    await refresh();
  }

  if (!rows.length) return null;
  return (
    <section className="oa-trace-feedback">
      <button type="button" className="own-skm-batch-btn" onClick={() => setOpen((value) => !value)}>
        生产失败建议 {rows.length}
      </button>
      {open ? (
        <ul>
          {rows.map((row) => (
            <li key={row.id}>
              <div>
                <strong>{row.skillId}</strong>
                <span>{row.query}</span>
              </div>
              <div>
                <button type="button" className="own-skill-inline-btn" onClick={() => void review(row.id, "accept")}>
                  加入回归集
                </button>
                <button type="button" className="own-skill-inline-btn" onClick={() => void review(row.id, "reject")}>
                  忽略
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
