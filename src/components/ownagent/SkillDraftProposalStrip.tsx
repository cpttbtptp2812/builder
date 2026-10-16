import { buildSkillDraftProposal, skillDraftProposalSummary } from "../../lib/skillDraftProposal";
import type { ParsedSkillDoc } from "../../lib/skillMarkdown";

export function SkillDraftProposalStrip({
  online,
  draft,
  hasChanges,
}: {
  online: ParsedSkillDoc;
  draft: ParsedSkillDoc;
  hasChanges: boolean;
}) {
  if (!hasChanges) return null;
  const proposal = buildSkillDraftProposal(online, draft);
  const summary = skillDraftProposalSummary(proposal);
  const empty =
    !proposal.triggersAdded.length &&
    !proposal.triggersRemoved.length &&
    !proposal.stepsAdded.length &&
    !proposal.stepsRemoved.length &&
    !proposal.stepsRetooled.length;

  return (
    <div className="sk-draft-proposal" role="status">
      <strong>变更摘要</strong>
      <span>{summary}</span>
      {!empty ? (
        <ul className="sk-draft-proposal-list">
          {proposal.triggersAdded.slice(0, 4).map((t) => (
            <li key={`+t-${t}`}>触发 +「{t}」</li>
          ))}
          {proposal.triggersRemoved.slice(0, 4).map((t) => (
            <li key={`-t-${t}`}>触发 −「{t}」</li>
          ))}
          {proposal.stepsAdded.slice(0, 3).map((s) => (
            <li key={`+s-${s.id}`}>
              步骤 + {s.label}（{s.tool}）
            </li>
          ))}
          {proposal.stepsRemoved.slice(0, 3).map((s) => (
            <li key={`-s-${s.id}`}>
              步骤 − {s.label}
            </li>
          ))}
          {proposal.stepsRetooled.slice(0, 3).map((s) => (
            <li key={`~s-${s.id}`}>
              {s.id}：{s.fromTool} → {s.toTool}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
