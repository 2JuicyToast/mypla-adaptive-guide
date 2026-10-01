import { useState } from "react";
import { ArrowRight, Check, Pencil, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
  onAdjust?: (proposal: Proposal, changes: Record<string, unknown>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [changesText, setChangesText] = useState(
    JSON.stringify(proposal.proposedChanges ?? {}, null, 2),
  );
  const [changesError, setChangesError] = useState<string | null>(null);

  return (
    <article className="proposal-gradient rounded-xl border border-proposal/25 p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-proposal" />
        <span className="rounded-full bg-proposal/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-proposal">
          {kindLabels[proposal.kind] ?? "Planning"} · proposal
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
            <span className="text-muted-foreground line-through">{change.before}</span>
            <ArrowRight className="size-3 text-muted-foreground" />
            <span className="font-medium text-proposal">{change.after}</span>
          </li>
        ))}
      </ul>

      {editing ? (
        <div className="mt-3 space-y-2">
          <label className="text-xs font-medium" htmlFor={`proposal-changes-${proposal.id}`}>
            Edit the proposed changes (JSON)
          </label>
          <Textarea
            id={`proposal-changes-${proposal.id}`}
            value={changesText}
            onChange={(event) => setChangesText(event.target.value)}
            rows={6}
            spellCheck={false}
            className="font-mono text-xs"
          />
          {changesError ? <p className="text-xs text-destructive">{changesError}</p> : null}
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                try {
                  const parsed: unknown = JSON.parse(changesText);
                  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
                    throw new Error("Enter a JSON object.");
                  }
                  onAdjust?.(proposal, parsed as Record<string, unknown>);
                  setEditing(false);
                  setChangesError(null);
                } catch (error) {
                  setChangesError(error instanceof Error ? error.message : "Invalid JSON.");
                }
              }}
            >
              Save changes
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {onApprove ? (
          <Button size="sm" onClick={() => onApprove(proposal)}>
            <Check className="size-4" />
            Approve
          </Button>
        ) : null}
        {onAdjust ? (
          <Button size="sm" variant="outline" onClick={() => setEditing((value) => !value)}>
            <Pencil className="size-4" />
            Adjust
          </Button>
        ) : null}
        {onDecline ? (
          <Button size="sm" variant="ghost" onClick={() => onDecline(proposal)}>
            <X className="size-4" />
            Not now
          </Button>
        ) : null}
      </div>
    </article>
  );
}
