import { useState } from "react";
import { ArrowDown, ArrowRight, ArrowUp, Check, Pencil, Plus, Sparkles, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Proposal, TaskBreakdownAction } from "@/lib/mpla-types";

const kindLabels: Record<Proposal["kind"], string> = {
  reschedule: "Reschedule",
  "priority-change": "Priority change",
  "task-breakdown": "Task breakdown",
  "new-task": "New task",
  "schedule-block": "Schedule block",
};

function getBreakdownActions(proposal: Proposal): TaskBreakdownAction[] {
  const patch = proposal.proposedChanges["taskPatch"];
  if (!patch || typeof patch !== "object") return [];
  const actions = (patch as { actions?: unknown }).actions;
  if (!Array.isArray(actions)) return [];

  return actions.flatMap((item): TaskBreakdownAction[] => {
    if (!item || typeof item !== "object") return [];
    const action = item as Record<string, unknown>;
    if (typeof action["label"] !== "string") return [];
    return [
      {
        label: action["label"],
        ...(typeof action["description"] === "string" || action["description"] === null
          ? { description: action["description"] }
          : {}),
        ...(typeof action["estimatedMinutes"] === "number" ||
        action["estimatedMinutes"] === null
          ? { estimatedMinutes: action["estimatedMinutes"] }
          : {}),
        ...(action["energyRequired"] === "low" ||
        action["energyRequired"] === "medium" ||
        action["energyRequired"] === "high" ||
        action["energyRequired"] === null
          ? { energyRequired: action["energyRequired"] }
          : {}),
      },
    ];
  });
}

function actionKey(label: string) {
  return label
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

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
  onAdjust?: (
    proposal: Proposal,
    changes: Record<string, unknown>,
  ) => void | boolean | Promise<void | boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [changesText, setChangesText] = useState(
    JSON.stringify(proposal.proposedChanges ?? {}, null, 2),
  );
  const [changesError, setChangesError] = useState<string | null>(null);
  const [breakdownActions, setBreakdownActions] = useState(() =>
    getBreakdownActions(proposal),
  );
  const [breakdownError, setBreakdownError] = useState<string | null>(null);
  const breakdownLabels = breakdownActions.map((action) => actionKey(action.label));
  const breakdownCanSave =
    breakdownActions.length > 0 &&
    breakdownActions.length <= 20 &&
    breakdownActions.every((action) => action.label.trim()) &&
    new Set(breakdownLabels).size === breakdownLabels.length;

  function updateBreakdownAction(index: number, label: string) {
    setBreakdownActions((current) =>
      current.map((action, actionIndex) =>
        actionIndex === index ? { ...action, label } : action,
      ),
    );
  }

  function moveBreakdownAction(index: number, direction: -1 | 1) {
    setBreakdownActions((current) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= current.length) return current;
      const reordered = [...current];
      [reordered[index], reordered[targetIndex]] = [
        reordered[targetIndex]!,
        reordered[index]!,
      ];
      return reordered;
    });
  }

  async function saveBreakdownActions() {
    if (!breakdownCanSave) {
      setBreakdownError("Add at least one step and give each step a different name.");
      return;
    }
    const saved = await onAdjust?.(proposal, {
      taskPatch: {
        actions: breakdownActions.map((action) => ({
          ...action,
          label: action.label.trim(),
        })),
      },
    });
    if (saved === false) {
      setBreakdownError("The adjustment could not be saved. Review the message above and try again.");
      return;
    }
    setEditing(false);
    setBreakdownError(null);
  }

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

      {proposal.kind === "task-breakdown" && !editing ? (
        <ol className="mt-3 space-y-2">
          {breakdownActions.map((action, index) => (
            <li
              key={`${index}-${action.label}`}
              className="flex items-start gap-2 rounded-md border border-border/70 bg-card/70 px-3 py-2.5 text-sm"
            >
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-secondary text-[11px] font-semibold text-secondary-foreground">
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="font-medium">{action.label}</p>
                {action.description ? (
                  <p className="mt-1 text-xs text-muted-foreground">{action.description}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      ) : null}

      {editing ? (
        proposal.kind === "task-breakdown" ? (
          <div className="mt-3 space-y-3">
            <ol className="space-y-2">
              {breakdownActions.map((action, index) => {
                const labelKey = actionKey(action.label);
                const duplicate =
                  Boolean(labelKey) &&
                  breakdownLabels.filter((label) => label === labelKey).length > 1;
                return (
                  <li
                    key={index}
                    className="flex items-center gap-2 rounded-lg border border-border p-2"
                  >
                    <span className="w-5 shrink-0 text-center text-xs text-muted-foreground">
                      {index + 1}
                    </span>
                    <Input
                      value={action.label}
                      maxLength={300}
                      aria-label={`Step ${index + 1}`}
                      aria-invalid={!action.label.trim() || duplicate}
                      onChange={(event) => updateBreakdownAction(index, event.target.value)}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Move step ${index + 1} up`}
                      disabled={index === 0}
                      onClick={() => moveBreakdownAction(index, -1)}
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Move step ${index + 1} down`}
                      disabled={index === breakdownActions.length - 1}
                      onClick={() => moveBreakdownAction(index, 1)}
                    >
                      <ArrowDown />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Remove step ${index + 1}`}
                      onClick={() =>
                        setBreakdownActions((current) =>
                          current.filter((_, actionIndex) => actionIndex !== index),
                        )
                      }
                    >
                      <Trash2 />
                    </Button>
                  </li>
                );
              })}
            </ol>
            <Button
              size="sm"
              variant="outline"
              disabled={breakdownActions.length >= 20}
              onClick={() =>
                setBreakdownActions((current) => [
                  ...current,
                  { label: "", description: null, estimatedMinutes: null, energyRequired: null },
                ])
              }
            >
              <Plus />
              Add a step
            </Button>
            {breakdownError ? (
              <p role="alert" className="text-xs text-destructive">
                {breakdownError}
              </p>
            ) : null}
            <div className="flex gap-2">
              <Button size="sm" disabled={!breakdownCanSave} onClick={saveBreakdownActions}>
                Save changes
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setBreakdownActions(getBreakdownActions(proposal));
                  setEditing(false);
                  setBreakdownError(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
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
                  void (async () => {
                  try {
                    const parsed: unknown = JSON.parse(changesText);
                    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
                      throw new Error("Enter a JSON object.");
                    }
                    const saved = await onAdjust?.(proposal, parsed as Record<string, unknown>);
                    if (saved === false) {
                      setChangesError("The adjustment could not be saved. Review the message above and try again.");
                      return;
                    }
                    setEditing(false);
                    setChangesError(null);
                  } catch (error) {
                    setChangesError(error instanceof Error ? error.message : "Invalid JSON.");
                  }
                  })();
                }}
              >
                Save changes
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )
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
