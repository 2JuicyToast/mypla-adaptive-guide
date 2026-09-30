import { ArrowRight, Check, Pencil, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Proposal } from "@/lib/mpla-types";

const kindLabels: Record<Proposal["kind"], string> = {
  reschedule: "Reschedule",
  "priority-change": "Priority change",
  "task-breakdown": "Task breakdown",
  "new-task": "New task",
  "schedule-block": "Schedule block",
};

/**
 * Every assistant-generated change arrives as a Proposal.
 * Approve / decline / adjust — nothing is committed without the user.
 */
export function ProposalCard({
  proposal,
  onApprove,
  onDecline,
  onAdjust,
}: {
  proposal: Proposal;
  onApprove?: (proposal: Proposal) => void;
  onDecline?: (proposal: Proposal) => void;
  onAdjust?: (proposal: Proposal) => void;
}) {
  return (
    <article className="proposal-gradient rounded-xl border border-proposal/25 p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-proposal" />
        <span className="rounded-full bg-proposal/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-proposal">
          {kindLabels[proposal.kind]} · proposal
        </span>
      </div>

      <h4 className="mt-2 text-sm font-semibold">{proposal.title}</h4>
      <p className="mt-1 text-xs text-muted-foreground">{proposal.rationale}</p>

      <ul className="mt-3 space-y-1.5">
        {proposal.changes.map((change) => (
          <li
            key={change.field}
            className="flex flex-wrap items-center gap-2 rounded-md bg-card/70 px-2.5 py-1.5 text-xs"
          >
            <span className="font-medium">{change.field}</span>
            <span className="text-muted-foreground line-through">{change.from}</span>
            <ArrowRight className="size-3 text-muted-foreground" />
            <span className="font-medium text-proposal">{change.to}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => onApprove?.(proposal)}>
          <Check className="size-4" />
          Approve
        </Button>
        <Button size="sm" variant="outline" onClick={() => onAdjust?.(proposal)}>
          <Pencil className="size-4" />
          Adjust
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onDecline?.(proposal)}>
          <X className="size-4" />
          Not now
        </Button>
      </div>
    </article>
  );
}
