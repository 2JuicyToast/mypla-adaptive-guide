import { Check, Plus, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TaskDraft } from "@/lib/mypla-api";

type DraftAction = NonNullable<TaskDraft["actions"]>[number];

export function TaskDraftReview({
  draft,
  saving,
  onChange,
  onConfirm,
  onCancel,
}: {
  draft: TaskDraft;
  saving: boolean;
  onChange: (patch: Partial<TaskDraft>) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const actions = draft.actions ?? [];

  function updateAction(index: number, patch: Partial<DraftAction>) {
    onChange({
      actions: actions.map((action, actionIndex) =>
        actionIndex === index ? { ...action, ...patch } : action,
      ),
    });
  }

  return (
    <section className="surface-panel mt-4 border border-proposal/30 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-proposal">
        Review and edit task draft
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5 text-sm font-medium">
          Task name
          <Input
            value={draft.name}
            maxLength={240}
            onChange={(event) => onChange({ name: event.target.value })}
          />
        </label>
        <label className="space-y-1.5 text-sm font-medium">
          Description
          <Textarea
            value={draft.description ?? ""}
            rows={2}
            onChange={(event) => onChange({ description: event.target.value || null })}
          />
        </label>
        <label className="space-y-1.5 text-sm font-medium">
          Course
          <Input
            value={draft.course ?? ""}
            onChange={(event) => onChange({ course: event.target.value || null })}
          />
        </label>
        <label className="space-y-1.5 text-sm font-medium">
          Category
          <Input
            value={draft.category ?? ""}
            onChange={(event) => onChange({ category: event.target.value || null })}
          />
        </label>
        <label className="space-y-1.5 text-sm font-medium">
          Due date
          <Input
            type="date"
            value={draft.dueDate ?? ""}
            onChange={(event) => onChange({ dueDate: event.target.value || null })}
          />
        </label>
        <label className="space-y-1.5 text-sm font-medium">
          Estimated minutes
          <Input
            type="number"
            min={0}
            max={10080}
            value={draft.estimatedMinutes}
            onChange={(event) =>
              onChange({ estimatedMinutes: Math.max(0, Number(event.target.value) || 0) })
            }
          />
        </label>
        <label className="space-y-1.5 text-sm font-medium">
          Importance
          <Select
            value={draft.priority}
            onValueChange={(value) => onChange({ priority: value as TaskDraft["priority"] })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </label>
        <label className="space-y-1.5 text-sm font-medium">
          Energy needed
          <Select
            value={draft.energyRequired}
            onValueChange={(value) =>
              onChange({ energyRequired: value as TaskDraft["energyRequired"] })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </label>
      </div>
      <div className="mt-4 space-y-2">
        <h4 className="text-sm font-medium">Initial actions</h4>
        {actions.map((action, index) => (
          <div
            key={index}
            className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1fr_8rem_auto]"
          >
            <div className="space-y-2">
              <label className="sr-only" htmlFor={`draft-action-${index}`}>
                Action {index + 1}
              </label>
              <Input
                id={`draft-action-${index}`}
                value={action.label}
                maxLength={300}
                placeholder="Action description"
                onChange={(event) => updateAction(index, { label: event.target.value })}
              />
              <label className="sr-only" htmlFor={`draft-action-detail-${index}`}>
                Details for action {index + 1}
              </label>
              <Input
                id={`draft-action-detail-${index}`}
                value={action.description ?? ""}
                placeholder="Optional details"
                onChange={(event) =>
                  updateAction(index, { description: event.target.value || null })
                }
              />
            </div>
            <label className="space-y-1 text-xs text-muted-foreground">
              Minutes
              <Input
                type="number"
                min={0}
                value={action.estimatedMinutes ?? ""}
                onChange={(event) =>
                  updateAction(index, {
                    estimatedMinutes:
                      event.target.value === "" ? null : Math.max(0, Number(event.target.value)),
                  })
                }
              />
            </label>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              aria-label={`Remove action ${index + 1}`}
              onClick={() => onChange({ actions: actions.filter((_, i) => i !== index) })}
            >
              <Trash2 className="size-4" />
              Remove
            </Button>
          </div>
        ))}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onChange({ actions: [...actions, { label: "" }] })}
        >
          <Plus className="size-4" />
          Add action
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        This draft is not saved until you add it to your plan.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" disabled={saving || !draft.name.trim()} onClick={onConfirm}>
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
