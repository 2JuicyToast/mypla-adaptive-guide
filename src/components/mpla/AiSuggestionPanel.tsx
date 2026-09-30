import { Sparkles } from "lucide-react";

import { ProposalCard } from "@/components/mpla/ProposalCard";
import type { Proposal } from "@/lib/mpla-types";

/**
 * Placeholder inbox for assistant proposals.
 * Nothing here changes the plan until the user approves it.
 */
export function AiSuggestionPanel({
  proposals,
  onApprove,
  onDecline,
  onAdjust,
}: {
  proposals: Proposal[];
  onApprove?: (proposal: Proposal) => void;
  onDecline?: (proposal: Proposal) => void;
  onAdjust?: (proposal: Proposal) => void;
}) {
  return (
    <section className="surface-panel p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-proposal" />
          <h2 className="text-lg font-semibold">Suggestions for you</h2>
        </div>
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
          {proposals.length} waiting
        </span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        I suggest, you decide. Nothing moves in your plan until you approve it.
      </p>

      <div className="mt-4 space-y-3">
        {proposals.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No suggestions right now.
          </p>
        ) : (
          proposals.map((proposal) => (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              onApprove={onApprove}
              onDecline={onDecline}
              onAdjust={onAdjust}
            />
          ))
        )}
      </div>
    </section>
  );
}
