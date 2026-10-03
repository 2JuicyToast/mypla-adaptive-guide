import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle2,
  ClipboardList,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Proposal, Task, TaskBreakdownAction } from "@/lib/mpla-types";

type Props = {
  open: boolean;
  task: Task;
  proposal: Proposal;
  busy: boolean;
  error: string | null;
  onApprove: () => void;
  onAdjust: (actions: TaskBreakdownAction[]) => void;
  onNotNow: () => void;
  onOpenChange: (open: boolean) => void;
};

type EnergyLevel = NonNullable<TaskBreakdownAction["energyRequired"]>;

function getProposedActions(proposal: Proposal): TaskBreakdownAction[] {
  const patch = proposal.proposedChanges["taskPatch"];
  if (!patch || typeof patch !== "object") return [];

  const actions = (patch as { actions?: unknown }).actions;
  if (!Array.isArray(actions)) return [];

  return actions.flatMap((action): TaskBreakdownAction[] => {
    if (!action || typeof action !== "object") return [];
    const candidate = action as Record<string, unknown>;
    if (typeof candidate["label"] !== "string") return [];

    return [
      {
        label: candidate["label"],
        ...(typeof candidate["description"] === "string" || candidate["description"] === null
          ? { description: candidate["description"] }
          : {}),
        ...(typeof candidate["estimatedMinutes"] === "number" ||
        candidate["estimatedMinutes"] === null
          ? { estimatedMinutes: candidate["estimatedMinutes"] }
          : {}),
        ...(candidate["energyRequired"] === "low" ||
        candidate["energyRequired"] === "medium" ||
        candidate["energyRequired"] === "high" ||
        candidate["energyRequired"] === null
          ? { energyRequired: candidate["energyRequired"] }
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

export function TaskBreakdownReviewDialog({
  open,
  task,
  proposal,
  busy,
  error,
  onApprove,
  onAdjust,
  onNotNow,
  onOpenChange,
}: Props) {
  const [adjusting, setAdjusting] = useState(false);
  const [draft, setDraft] = useState<TaskBreakdownAction[]>(() => getProposedActions(proposal));
  const proposalRef = useRef(proposal);
  proposalRef.current = proposal;

  useEffect(() => {
    if (open) {
      setAdjusting(false);
      setDraft(getProposedActions(proposalRef.current));
    }
  }, [open, proposal.id]);

  const completedActions = task.actions.filter((action) => action.done);
  const labels = draft.map((action) => actionKey(action.label));
  const completedLabels = new Set(completedActions.map((action) => actionKey(action.label)));
  const hasBlankLabel = draft.some((action) => !action.label.trim());
  const hasDuplicateLabels = new Set(labels.filter(Boolean)).size !== labels.filter(Boolean).length;
  const hasCompletedLabels = labels.some((label) => label && completedLabels.has(label));
  const hasTaskTitle = labels.includes(actionKey(task.name));
  const hasInvalidMinutes = draft.some(
    (action) =>
      action.estimatedMinutes != null &&
      (!Number.isInteger(action.estimatedMinutes) ||
        action.estimatedMinutes < 1 ||
        action.estimatedMinutes > 1440),
  );
  const cannotSave =
    busy ||
    draft.length < 1 ||
    draft.length > 20 ||
    hasBlankLabel ||
    hasDuplicateLabels ||
    hasCompletedLabels ||
    hasTaskTitle ||
    hasInvalidMinutes;

  function close() {
    onOpenChange(false);
  }

  function chooseNotNow() {
    onNotNow();
  }

  function updateAction(index: number, updates: Partial<TaskBreakdownAction>) {
    setDraft((current) =>
      current.map((action, actionIndex) =>
        actionIndex === index ? { ...action, ...updates } : action,
      ),
    );
  }

  function moveAction(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    setDraft((current) => {
      if (targetIndex < 0 || targetIndex >= current.length) return current;
      const reordered = [...current];
      const currentAction = reordered[index];
      const targetAction = reordered[targetIndex];
      if (!currentAction || !targetAction) return current;
      reordered[index] = targetAction;
      reordered[targetIndex] = currentAction;
      return reordered;
    });
  }

  function addAction() {
    setDraft((current) =>
      current.length >= 20
        ? current
        : [
            ...current,
            { label: "", description: null, estimatedMinutes: null, energyRequired: null },
          ],
    );
  }

  function removeAction(index: number) {
    setDraft((current) => current.filter((_, actionIndex) => actionIndex !== index));
  }

  function saveAdjustments() {
    if (cannotSave) return;
    onAdjust(
      draft.map((action) => ({
        ...action,
        label: action.label.trim(),
      })),
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) onOpenChange(true);
        else close();
      }}
    >
      <DialogContent className="max-h-[min(90dvh,820px)] overflow-y-auto border-border/80 bg-background p-0 shadow-[var(--shadow-lift)] sm:max-w-2xl">
        <div className="border-b border-border bg-muted/40 px-5 py-5 pr-12 sm:px-7">
          <DialogHeader className="space-y-2 text-left">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.13em] text-primary">
              <span className="grid size-7 place-items-center rounded-full bg-primary/10">
                <ClipboardList className="size-4" aria-hidden="true" />
              </span>
              Task breakdown
            </div>
            <DialogTitle className="text-xl leading-snug sm:text-2xl">{task.name}</DialogTitle>
            <DialogDescription className="leading-relaxed">{proposal.rationale}</DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-5 px-5 py-5 sm:px-7">
          <p className="rounded-lg border border-primary/20 bg-primary/[0.045] px-4 py-3 text-sm font-medium leading-relaxed text-foreground">
            Here is one way I would break this down
          </p>

          <section aria-labelledby="completed-actions-title" className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 id="completed-actions-title" className="text-sm font-semibold text-foreground">
                Already completed
              </h3>
              <span className="text-xs text-muted-foreground">
                {completedActions.length} {completedActions.length === 1 ? "step" : "steps"}
              </span>
            </div>
            {completedActions.length > 0 ? (
              <ul className="space-y-2">
                {completedActions.map((action) => (
                  <li
                    key={action.id}
                    className="flex items-start gap-3 rounded-lg border border-border/70 bg-muted/35 px-3.5 py-3"
                  >
                    <CheckCircle2
                      className="mt-0.5 size-4 shrink-0 text-primary"
                      aria-hidden="true"
                    />
                    <span className="text-sm leading-relaxed text-muted-foreground line-through decoration-border">
                      {action.label}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-lg border border-dashed border-border px-3.5 py-3 text-sm text-muted-foreground">
                No current steps have been completed yet.
              </p>
            )}
          </section>

          {adjusting ? (
            <section aria-labelledby="proposed-actions-title" className="space-y-3">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h3 id="proposed-actions-title" className="text-sm font-semibold">
                    Proposed remaining steps
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Edit the wording and details to fit what works for you.
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {draft.length} {draft.length === 1 ? "step" : "steps"}
                </span>
              </div>

              {draft.length > 0 ? (
                <ol className="space-y-3">
                  {draft.map((action, index) => {
                    const duplicate =
                      Boolean(actionKey(action.label)) &&
                      labels.filter((label) => label === actionKey(action.label)).length > 1;
                    const key = actionKey(action.label);
                    const labelError = !action.label.trim()
                      ? "Add a step name before saving."
                      : duplicate
                        ? "Each step needs a different name."
                        : key === actionKey(task.name)
                          ? "Use a concrete step rather than repeating the task name."
                          : completedLabels.has(key)
                            ? "This step matches one you have already completed."
                            : undefined;

                    return (
                      <li
                        key={index}
                        className="rounded-xl border border-border bg-card p-3.5 sm:p-4"
                      >
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Step {index + 1}
                          </p>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={`Move step ${index + 1} up`}
                              title="Move up"
                              disabled={busy || index === 0}
                              onClick={() => moveAction(index, -1)}
                            >
                              <ArrowUp aria-hidden="true" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={`Move step ${index + 1} down`}
                              title="Move down"
                              disabled={busy || index === draft.length - 1}
                              onClick={() => moveAction(index, 1)}
                            >
                              <ArrowDown aria-hidden="true" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={`Remove step ${index + 1}`}
                              title="Remove step"
                              disabled={busy}
                              onClick={() => removeAction(index)}
                            >
                              <Trash2 aria-hidden="true" />
                            </Button>
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1.5 sm:col-span-2">
                            <label
                              htmlFor={`breakdown-action-label-${index}`}
                              className="text-xs font-medium"
                            >
                              Step name
                            </label>
                            <Input
                              id={`breakdown-action-label-${index}`}
                              value={action.label}
                              maxLength={300}
                              aria-invalid={Boolean(labelError)}
                              aria-describedby={
                                labelError ? `breakdown-action-error-${index}` : undefined
                              }
                              disabled={busy}
                              onChange={(event) =>
                                updateAction(index, { label: event.target.value })
                              }
                              placeholder="For example, gather the readings"
                              className="bg-background"
                            />
                            {labelError ? (
                              <p
                                id={`breakdown-action-error-${index}`}
                                className="text-xs text-destructive"
                              >
                                {labelError}
                              </p>
                            ) : null}
                          </div>

                          <div className="space-y-1.5 sm:col-span-2">
                            <label
                              htmlFor={`breakdown-action-description-${index}`}
                              className="text-xs font-medium"
                            >
                              Description <span className="font-normal text-muted-foreground">(optional)</span>
                            </label>
                            <Input
                              id={`breakdown-action-description-${index}`}
                              value={action.description ?? ""}
                              maxLength={1000}
                              disabled={busy}
                              onChange={(event) =>
                                updateAction(index, {
                                  description: event.target.value || null,
                                })
                              }
                              placeholder="A little more context, if helpful"
                              className="bg-background"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label
                              htmlFor={`breakdown-action-minutes-${index}`}
                              className="text-xs font-medium"
                            >
                              Estimated minutes <span className="font-normal text-muted-foreground">(optional)</span>
                            </label>
                            <Input
                              id={`breakdown-action-minutes-${index}`}
                              type="number"
                              min="1"
                              max="1440"
                              step="1"
                              inputMode="numeric"
                              value={action.estimatedMinutes ?? ""}
                              aria-invalid={
                                action.estimatedMinutes != null &&
                                (!Number.isInteger(action.estimatedMinutes) ||
                                  action.estimatedMinutes < 1 ||
                                  action.estimatedMinutes > 1440)
                              }
                              disabled={busy}
                              onChange={(event) => {
                                const value = event.target.value;
                                updateAction(index, {
                                  estimatedMinutes: value === "" ? null : Number(value),
                                });
                              }}
                              placeholder="Minutes"
                              className="bg-background"
                            />
                            {action.estimatedMinutes != null &&
                            (!Number.isInteger(action.estimatedMinutes) ||
                              action.estimatedMinutes < 1 ||
                              action.estimatedMinutes > 1440) ? (
                              <p className="text-xs text-destructive">
                                Enter a whole number from 1 to 1440.
                              </p>
                            ) : null}
                          </div>

                          <div className="space-y-1.5">
                            <label
                              htmlFor={`breakdown-action-energy-${index}`}
                              className="text-xs font-medium"
                            >
                              Energy needed <span className="font-normal text-muted-foreground">(optional)</span>
                            </label>
                            <select
                              id={`breakdown-action-energy-${index}`}
                              value={action.energyRequired ?? ""}
                              disabled={busy}
                              onChange={(event) =>
                                updateAction(index, {
                                  energyRequired: (event.target.value || null) as EnergyLevel | null,
                                })
                              }
                              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <option value="">Not set</option>
                              <option value="low">Low</option>
                              <option value="medium">Medium</option>
                              <option value="high">High</option>
                            </select>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-muted/25 px-4 py-5 text-center">
                  <p className="text-sm font-medium">No remaining steps yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Add at least one remaining step before saving.
                  </p>
                </div>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy || draft.length >= 20}
                onClick={addAction}
              >
                <Plus aria-hidden="true" />
                Add a step
              </Button>

              {hasDuplicateLabels ? (
                <p role="status" className="text-xs text-destructive">
                  Step names must be unique.
                </p>
              ) : null}
              {hasCompletedLabels || hasTaskTitle ? (
                <p role="status" className="text-xs text-destructive">
                  Remove repeated task names and steps that are already completed.
                </p>
              ) : null}
              {draft.length > 20 ? (
                <p role="status" className="text-xs text-destructive">
                  A breakdown can contain at most 20 steps.
                </p>
              ) : null}
            </section>
          ) : (
            <section aria-labelledby="proposed-actions-title" className="space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <h3 id="proposed-actions-title" className="text-sm font-semibold">
                  Proposed remaining steps
                </h3>
                <span className="text-xs text-muted-foreground">
                  {draft.length} {draft.length === 1 ? "step" : "steps"}
                </span>
              </div>
              {draft.length ? (
                <ol className="space-y-2">
                  {draft.map((action, index) => (
                    <li
                      key={`${index}-${action.label}`}
                      className="flex items-start gap-3 rounded-lg border border-border bg-card px-3.5 py-3"
                    >
                      <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-relaxed">{action.label}</p>
                        {action.description ? (
                          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                            {action.description}
                          </p>
                        ) : null}
                        {(action.estimatedMinutes != null || action.energyRequired) ? (
                          <p className="mt-2 text-xs text-muted-foreground">
                            {[
                              action.estimatedMinutes != null
                                ? `${action.estimatedMinutes} min`
                                : null,
                              action.energyRequired
                                ? `${action.energyRequired} energy`
                                : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-muted/25 px-4 py-5 text-center">
                  <p className="text-sm font-medium">No remaining steps proposed</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    You can add a step in Adjust, or leave the task as it is.
                  </p>
                </div>
              )}
            </section>
          )}

          <p className="rounded-lg bg-muted/45 px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
            Nothing changes until you choose to use this breakdown. You can leave it as-is or
            adjust each step first.
          </p>

          {busy ? (
            <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="size-2 animate-pulse rounded-full bg-primary" aria-hidden="true" />
              Saving your choice…
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <DialogFooter className="gap-2 border-t border-border pt-4 sm:items-center">
            {adjusting ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    setDraft(getProposedActions(proposalRef.current));
                    setAdjusting(false);
                  }}
                >
                  <RotateCcw aria-hidden="true" />
                  Discard edits
                </Button>
                <Button type="button" variant="ghost" disabled={busy} onClick={chooseNotNow}>
                  Not now
                </Button>
                <Button type="button" disabled={cannotSave} onClick={saveAdjustments}>
                  <Check aria-hidden="true" />
                  {busy ? "Saving…" : "Save adjustments"}
                </Button>
              </>
            ) : (
              <>
                <Button type="button" variant="ghost" disabled={busy} onClick={chooseNotNow}>
                  Not now
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setAdjusting(true)}
                >
                  Adjust
                </Button>
                <Button type="button" disabled={busy} onClick={onApprove}>
                  <Check aria-hidden="true" />
                  {busy ? "Saving…" : "Use this breakdown"}
                </Button>
              </>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}