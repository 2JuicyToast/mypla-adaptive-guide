import { Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { TaskDraft } from "@/lib/mypla-api";

export function TaskDraftReview({
  draft,
  saving,
  onConfirm,
  onCancel,
}: {
  draft: TaskDraft;
  saving: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <section className="surface-panel mt-4 border border-proposal/30 p-4" aria-live="polite">
      <p className="text-xs font-semibold uppercase tracking-wide text-proposal">Review task draft</p>
      <h3 className="mt-1 font-semibold">{draft.name}</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {draft.course ? `${draft.course} · ` : ""}
        {draft.dueDate ? `Due ${draft.dueDate} · ` : ""}
        {draft.estimatedMinutes} minutes · {draft.priority} priority · {draft.energyRequired} energy
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        This draft is not saved until you add it to your plan.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" disabled={saving} onClick={onConfirm}>
          <Check className="size-4" />
          {saving ? "Saving…" : "Add to my plan"}
        </Button>
        <Button size="sm" variant="ghost" disabled={saving} onClick={onCancel}>
          <X className="size-4" />
          Discard
        </Button>
      </div>
    </section>
  );
}