import { useMemo, useState } from "react";
import type { PolicyClause } from "../../lib/policyDesk";
import {
  listTickets,
  policyEvalSummary,
  resolveTicket,
  runPolicyDesk,
  runPolicyEval,
  type PolicyDeskResult,
} from "../../lib/policyDesk";
import {
  loadPolicyHandbook,
  loadPolicySettings,
  resetPolicyHandbook,
  resetPolicySettings,
  savePolicyHandbook,
  savePolicySettings,
  type PolicySettings,
} from "../../lib/policyConfig";
import {
  OaBadge,
  OaBtn,
  OaCard,
  OaCheck,
  OaChips,
  OaField,
  OaInput,
  OaPage,
  OaSearchRow,
  OaSelect,
  OaStack,
  OaTabs,
  OaTextarea,
} from "./OaUi";

const TEST_SAMPLES = [
  "满一年年假几天",
  "有人说年假 5 天也有人说 10 天",
  "帮我开通公司 VPN",
  "公司什么时候上市",
];

const CAP_BADGE: Record<string, { label: string; tone: "ok" | "warn" | "danger" | "info" }> = {
  read: { label: "可回答", tone: "ok" },
  mutate: { label: "只出工单", tone: "warn" },
  abstain: { label: "直接拒绝", tone: "danger" },
};

type TabId = "rules" | "clauses" | "test";

function emptyClause(): PolicyClause {
  return {
    id: `KB-自定义-${Date.now().toString(36)}`,
    topic: "leave",
    status: "current",
    text: "",
  };
}

/** 回答规则 — 可配置的分流规则 + 制度条款 + 测试 */
export function GuardPanel() {
  const [tab, setTab] = useState<TabId>("rules");
  const [settings, setSettings] = useState<PolicySettings>(() => loadPolicySettings());
  const [clauses, setClauses] = useState<PolicyClause[]>(() => loadPolicyHandbook());
  const [draftClause, setDraftClause] = useState<PolicyClause | null>(null);
  const [savedHint, setSavedHint] = useState<string | null>(null);
  const [testQuery, setTestQuery] = useState(TEST_SAMPLES[0]!);
  const [testResult, setTestResult] = useState<PolicyDeskResult | null>(() => runPolicyDesk(TEST_SAMPLES[0]!));
  const [tickets, setTickets] = useState(() => listTickets());

  const evalRows = useMemo(() => runPolicyEval(), [settings, clauses, testResult]);
  const summary = useMemo(() => policyEvalSummary(evalRows), [evalRows]);

  function flash(msg: string) {
    setSavedHint(msg);
    window.setTimeout(() => setSavedHint(null), 2200);
  }

  function persistSettings(next: PolicySettings) {
    setSettings(next);
    savePolicySettings(next);
    flash("已保存，对话中立即生效");
  }

  function persistClauses(next: PolicyClause[]) {
    setClauses(next);
    savePolicyHandbook(next);
    flash("制度条款已保存");
  }

  function updateRuleEnabled(id: string, enabled: boolean) {
    persistSettings({
      ...settings,
      rules: settings.rules.map((r) => (r.id === id ? { ...r, enabled } : r)),
    });
  }

  function patchSettings(patch: Partial<PolicySettings>) {
    persistSettings({ ...settings, ...patch });
  }

  function patchRuleKeywords(id: string, keywords: string) {
    const next = {
      ...settings,
      rules: settings.rules.map((r) => (r.id === id ? { ...r, keywords } : r)),
    };
    setSettings(next);
  }

  function patchRuleReason(id: string, reason: string) {
    const next = {
      ...settings,
      rules: settings.rules.map((r) => (r.id === id ? { ...r, reason } : r)),
    };
    setSettings(next);
  }

  function runTest(q: string) {
    const text = q.trim();
    if (!text) return;
    setTestQuery(text);
    setTestResult(runPolicyDesk(text));
    setTickets(listTickets());
  }

  function decide(id: string, status: "allowed" | "denied") {
    resolveTicket(id, status);
    setTickets(listTickets());
    if (testResult?.ticket?.id === id) {
      setTestResult({
        ...testResult,
        ticket: { ...testResult.ticket, status },
        outcome: status === "allowed" ? "COMMITTED" : "NEEDS_HITL",
      });
    }
  }

  function saveClauseDraft() {
    if (!draftClause?.text.trim()) return;
    const row = { ...draftClause, text: draftClause.text.trim() };
    const exists = clauses.some((c) => c.id === row.id);
    persistClauses(exists ? clauses.map((c) => (c.id === row.id ? row : c)) : [row, ...clauses]);
    setDraftClause(null);
  }

  return (
    <OaPage
      title="回答规则"
      desc="配置 AI 遇到不同类型问题时的处理方式。保存后，在「问 AI」对话中立即生效。"
      toast={savedHint}
    >
      <OaTabs
        label="回答规则"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "rules", label: "分流规则" },
          { id: "clauses", label: "制度条款" },
          { id: "test", label: "测试效果" },
        ]}
      />

      {tab === "rules" ? (
        <OaStack>
          <OaCard muted>
            <OaStack>
              <OaCheck
                checked={settings.requireCitation}
                onChange={(v) => patchSettings({ requireCitation: v })}
                label="制度问题必须引用条款"
                hint="找不到条款时不生成答案，避免 AI 编造"
              />
              <OaCheck
                checked={settings.requireHitlForMutate}
                onChange={(v) => patchSettings({ requireHitlForMutate: v })}
                label="敏感操作必须人工批准"
                hint="如开通 VPN，只生成工单，不直接执行"
              />
              <OaField label="拒绝时的提示语">
                <OaTextarea
                  rows={2}
                  value={settings.refuseMessage}
                  onChange={(e) => setSettings({ ...settings, refuseMessage: e.target.value })}
                  onBlur={() => persistSettings(settings)}
                />
              </OaField>
            </OaStack>
          </OaCard>

          {settings.rules.map((rule) => {
            const badge = CAP_BADGE[rule.cap] ?? { label: rule.cap, tone: "neutral" as const };
            return (
              <OaCard key={rule.id} muted={!rule.enabled}>
                <div className="oa-card-head">
                  <OaCheck
                    compact
                    checked={rule.enabled}
                    onChange={(v) => updateRuleEnabled(rule.id, v)}
                    label={rule.label}
                  />
                  <OaBadge tone={badge.tone}>{badge.label}</OaBadge>
                </div>
                <OaStack>
                  <OaField label="触发关键词" hint="每行一个，匹配到即触发此规则">
                    <OaTextarea
                      rows={3}
                      value={rule.keywords}
                      onChange={(e) => patchRuleKeywords(rule.id, e.target.value)}
                      onBlur={() => persistSettings(settings)}
                    />
                  </OaField>
                  <OaField label="命中后说明">
                    <OaInput
                      value={rule.reason}
                      onChange={(e) => patchRuleReason(rule.id, e.target.value)}
                      onBlur={() => persistSettings(settings)}
                    />
                  </OaField>
                </OaStack>
              </OaCard>
            );
          })}

          <div>
            <OaBtn
              variant="ghost"
              onClick={() => {
                resetPolicySettings();
                setSettings(loadPolicySettings());
                flash("已恢复默认规则");
              }}
            >
              恢复默认规则
            </OaBtn>
          </div>
        </OaStack>
      ) : null}

      {tab === "clauses" ? (
        <OaStack>
          <div className="oa-toolbar">
            <p className="oa-toolbar-lead">AI 回答制度类问题时会引用这里的条款。可新增、编辑或废止旧条款。</p>
            <OaBtn onClick={() => setDraftClause(emptyClause())}>新建条款</OaBtn>
          </div>

          {draftClause ? (
            <div className="oa-form-grid">
              <OaField label="条款 ID">
                <OaInput
                  value={draftClause.id}
                  onChange={(e) => setDraftClause({ ...draftClause, id: e.target.value })}
                />
              </OaField>
              <OaField label="主题">
                <OaSelect
                  value={draftClause.topic}
                  onChange={(e) =>
                    setDraftClause({ ...draftClause, topic: e.target.value as PolicyClause["topic"] })
                  }
                >
                  <option value="leave">休假</option>
                  <option value="overtime">加班</option>
                  <option value="vpn">VPN / 权限</option>
                  <option value="reimburse">报销</option>
                </OaSelect>
              </OaField>
              <OaField label="状态">
                <OaSelect
                  value={draftClause.status}
                  onChange={(e) =>
                    setDraftClause({ ...draftClause, status: e.target.value as PolicyClause["status"] })
                  }
                >
                  <option value="current">现行</option>
                  <option value="abolished">已废止</option>
                </OaSelect>
              </OaField>
              <OaField label="条款正文" className="full">
                <OaTextarea
                  rows={3}
                  value={draftClause.text}
                  onChange={(e) => setDraftClause({ ...draftClause, text: e.target.value })}
                  placeholder="例如：员工司龄满 1 年，年假 10 天。"
                />
              </OaField>
              <div className="oa-form-actions">
                <OaBtn onClick={saveClauseDraft}>保存条款</OaBtn>
                <OaBtn variant="ghost" onClick={() => setDraftClause(null)}>
                  取消
                </OaBtn>
              </div>
            </div>
          ) : null}

          <ul className="oa-list">
            {clauses.map((c) => (
              <li key={c.id} className="oa-list-item">
                <div>
                  <code>{c.id}</code>
                  <OaBadge tone={c.status === "current" ? "ok" : "danger"}>
                    {c.status === "current" ? "现行" : "废止"}
                  </OaBadge>
                  <p>{c.text}</p>
                </div>
                <div className="oa-list-actions">
                  <OaBtn size="sm" variant="ghost" onClick={() => setDraftClause({ ...c })}>
                    编辑
                  </OaBtn>
                  <OaBtn
                    size="sm"
                    variant="danger"
                    onClick={() => persistClauses(clauses.filter((x) => x.id !== c.id))}
                  >
                    删除
                  </OaBtn>
                </div>
              </li>
            ))}
          </ul>

          <OaBtn
            variant="ghost"
            onClick={() => {
              resetPolicyHandbook();
              setClauses(loadPolicyHandbook());
              flash("已恢复默认条款");
            }}
          >
            恢复默认条款
          </OaBtn>
        </OaStack>
      ) : null}

      {tab === "test" ? (
        <OaStack>
          <p className="oa-toolbar-lead">输入一个问题，预览当前规则下的处理结果。</p>
          <OaSearchRow
            value={testQuery}
            onChange={setTestQuery}
            onSubmit={() => runTest(testQuery)}
            placeholder="例如：满一年年假几天"
            buttonLabel="测试"
          />
          <OaChips items={TEST_SAMPLES} onPick={runTest} />

          {testResult ? (
            <div className="oa-result">
              <OaBadge tone={CAP_BADGE[testResult.capability.cap]?.tone ?? "neutral"}>
                {CAP_BADGE[testResult.capability.cap]?.label ?? testResult.capability.cap}
              </OaBadge>
              <span style={{ marginLeft: "0.5rem", fontSize: "0.8125rem", color: "#71717a" }}>
                {testResult.capability.reason}
              </span>
              <pre>{testResult.markdown}</pre>
              {testResult.ticket?.status === "draft" && settings.requireHitlForMutate ? (
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.65rem" }}>
                  <OaBtn size="sm" onClick={() => decide(testResult.ticket!.id, "allowed")}>
                    模拟：允许
                  </OaBtn>
                  <OaBtn size="sm" variant="ghost" onClick={() => decide(testResult.ticket!.id, "denied")}>
                    模拟：拒绝
                  </OaBtn>
                </div>
              ) : null}
            </div>
          ) : null}

          <details className="oa-details">
            <summary>内置自检 {summary.pass}/{summary.total} 通过</summary>
            <div className="oa-details-body">
              <ul className="oa-list">
                {evalRows.map((row) => (
                  <li key={row.id} className="oa-list-item">
                    <strong style={{ fontSize: "0.8125rem" }}>{row.query}</strong>
                    <OaBadge tone={row.pass ? "ok" : "danger"}>{row.pass ? "通过" : "未通过"}</OaBadge>
                  </li>
                ))}
              </ul>
            </div>
          </details>

          {tickets.filter((t) => t.status === "draft").length > 0 ? (
            <p style={{ fontSize: "0.75rem", color: "#71717a", margin: 0 }}>
              待处理工单：{tickets.filter((t) => t.status === "draft").length} 条
            </p>
          ) : null}
        </OaStack>
      ) : null}
    </OaPage>
  );
}
