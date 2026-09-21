import { resolveTicket, commitTicket, type TicketDraft } from "../../../lib/policyDesk";

const STATUS_LABEL: Record<TicketDraft["status"], string> = {
  draft: "待审批",
  allowed: "已通过",
  denied: "已驳回",
};

/** 权限变更工单 — 人工审批 */
export function HitlTicketCard({
  ticket,
  onUpdate,
}: {
  ticket: TicketDraft;
  onUpdate: (next: TicketDraft, note: string) => void;
}) {
  const locked = ticket.status !== "draft";

  function allow() {
    const t = resolveTicket(ticket.id, "allowed");
    if (!t) return;
    const committed = commitTicket(t.id);
    onUpdate(
      committed.ticket ?? t,
      committed.ok
        ? `工单 ${t.id} 已通过并登记。当前环境不会实际开通权限，仅完成审批流程。`
        : `已通过，但提交失败：${committed.error}`,
    );
  }

  function deny() {
    const t = resolveTicket(ticket.id, "denied");
    if (!t) return;
    onUpdate(t, `工单 ${t.id} 已驳回，不会执行权限变更。`);
  }

  return (
    <div className={`ua-hitl ${ticket.status}`}>
      <header>
        <strong>权限申请</strong>
        <span>{STATUS_LABEL[ticket.status]}</span>
      </header>
      <p>
        <code>{ticket.id}</code>
        <span> · {ticket.title}</span>
      </p>
      <p className="ua-hitl-action">申请事项：{ticket.action}</p>
      {!locked ? (
        <div className="ua-hitl-actions">
          <button type="button" className="allow" onClick={allow}>
            通过
          </button>
          <button type="button" className="deny" onClick={deny}>
            驳回
          </button>
        </div>
      ) : (
        <p className="ua-hitl-done">{STATUS_LABEL[ticket.status]}</p>
      )}
    </div>
  );
}
