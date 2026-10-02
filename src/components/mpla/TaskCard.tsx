import { ArrowRight, CheckCircle2, LifeBuoy, Play, Sparkle } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { PriorityBadge, TaskMetaRow, formatMinutes } from "@/components/mpla/TaskMeta";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/mpla-types";

export function nextUnfinishedAction(task: Task) {
  return task.actions.find((action) => !action.done) ?? null;
}

/**
 * Single task card. Shows only the next unfinished action by design —
 * the full action list stays with the backend.
 */
export function TaskCard({
  task,
  onStart,
  onComplete,
  onCompleteAction,
  onStuck,
  readOnly = false,
  compact = false,
}: {
  task: Task;
  onStart?: (task: Task) => void;
  onComplete?: (task: Task) => void;
  onCompleteAction?: (task: Task, actionId: string) => Promise<void>;
  onStuck?: (task: Task) => void;
  readOnly?: boolean;
  compact?: boolean;
}) {
  const next = nextUnfinishedAction(task);
  const [completingAction, setCompletingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function completeNextAction() {
    if (!next || !onCompleteAction) return;
    setCompletingAction(true);
    setActionError(null);
    try {
      await onCompleteAction(task, next.id);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "The action could not be completed.");
    } finally {
      setCompletingAction(false);
    }
  }

  return (
    <article className="surface-panel flex flex-col gap-4 p-5 transition-shadow hover:shadow-[var(--shadow-lift)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold">{task.name}</h3>
          {task.course ? (
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{task.course}</p>
          ) : null}
        </div>
        <PriorityBadge priority={task.priority} />
      </div>

      <TaskMetaRow
        dueDate={task.dueDate ?? null}
        estimatedMinutes={task.estimatedMinutes}
        energyRequired={task.energyRequired}
      />

      <div className="rounded-lg border border-border bg-muted/50 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Next action
        </p>
        <p className="mt-1 flex items-start gap-2 text-sm">
          <ArrowRight className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>{next ? next.label : "All actions done — ready to complete."}</span>
        </p>
        {next?.estimatedMinutes ? (
          <p className="mt-1 pl-6 text-xs text-muted-foreground">
            about {formatMinutes(next.estimatedMinutes)}
          </p>
        ) : null}
        {actionError ? (
          <p role="alert" className="mt-2 text-xs text-destructive">
            {actionError}
          </p>
        ) : null}
      </div>

      {task.assistantNote && !compact ? (
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Sparkle className="mt-0.5 size-3.5 shrink-0 text-proposal" />
          {task.assistantNote}
        </p>
      ) : null}

      <div className={cn("flex flex-wrap gap-2", compact && "pt-1")}>
        <Button size="sm" disabled={readOnly || !onStart} onClick={() => onStart?.(task)}>
          <Play className="size-4" />
          Start
        </Button>
        {next ? (
          <Button
            size="sm"
            variant="outline"
            disabled={readOnly || completingAction || !onCompleteAction}
            onClick={() => void completeNextAction()}
          >
            <CheckCircle2 className="size-4" />
            {completingAction ? "Saving…" : "Complete next action"}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            disabled={readOnly}
            onClick={() => onComplete?.(task)}
          >
            <CheckCircle2 className="size-4" />
            Complete task
          </Button>
        )}
        <Button size="sm" variant="ghost" disabled={readOnly} onClick={() => onStuck?.(task)}>
          <LifeBuoy className="size-4" />
          I'm stuck
        </Button>
      </div>
    </article>
  );
}
