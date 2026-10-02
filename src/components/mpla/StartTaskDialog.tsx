import { useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  CircleHelp,
  LifeBuoy,
  Pause,
  Play,
  Sparkles,
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
import { Textarea } from "@/components/ui/textarea";
import { TaskMetaRow } from "@/components/mpla/TaskMeta";
import {
  advanceTaskSession,
  chooseTaskSessionContext,
  startWithCurrentAction,
  updateTaskSessionNote,
  type TaskSession,
  type TaskSessionContext,
} from "@/lib/task-session";
import type { Task } from "@/lib/mpla-types";
import { cn } from "@/lib/utils";

const contextChoices: { value: TaskSessionContext; label: string; acknowledgement?: string }[] = [
  { value: "ready", label: "I'm ready to start" },
  {
    value: "less-time",
    label: "I have less time than expected",
    acknowledgement: "Thanks for the heads-up. Your task estimate stays as it is.",
  },
  {
    value: "low-energy",
    label: "I'm low on energy",
    acknowledgement: "That makes sense. Your task's energy setting hasn't changed.",
  },
  { value: "unsure", label: "I'm not sure how to start" },
  {
    value: "in-the-way",
    label: "Something is getting in the way",
    acknowledgement: "Got it. Nothing in your plan has been changed.",
  },
];

export function StartTaskDialog({
  session,
  task,
  onSessionChange,
  onOpenChange,
  onCompleteAction,
  onStuck,
}: {
  session: TaskSession | null;
  task: Task | null;
  onSessionChange: (session: TaskSession | null) => void;
  onOpenChange: (open: boolean) => void;
  onCompleteAction: (taskId: string, actionId: string) => Promise<Task>;
  onStuck: (task: Task) => void;
}) {
  const [savingAction, setSavingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [breakdownNotice, setBreakdownNotice] = useState(false);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const open = session !== null;

  function close() {
    setBreakdownNotice(false);
    setActionError(null);
    sessionRef.current = null;
    onSessionChange(null);
    onOpenChange(false);
  }

  function openStuckFlow() {
    if (!task) return;
    setBreakdownNotice(false);
    setActionError(null);
    sessionRef.current = null;
    onStuck(task);
  }

  async function completeCurrentAction() {
    if (!session?.currentActionId) return;
    const actionId = session.currentActionId;
    setSavingAction(true);
    setActionError(null);
    try {
      const updatedTask = await onCompleteAction(session.taskId, actionId);
      const latestSession = sessionRef.current;
      if (
        latestSession?.taskId !== session.taskId ||
        latestSession.startedAt !== session.startedAt ||
        latestSession.currentActionId !== actionId
      ) {
        return;
      }
      onSessionChange(advanceTaskSession(latestSession, updatedTask));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "The action could not be completed.");
    } finally {
      setSavingAction(false);
    }
  }

  const selectedChoice = contextChoices.find((choice) => choice.value === session?.context);

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="max-h-[min(90dvh,760px)] overflow-y-auto border-border/80 bg-background p-0 shadow-[var(--shadow-lift)] sm:max-w-xl">
        {session ? (
          <>
            <div className="border-b border-border bg-muted/40 px-5 py-5 pr-12 sm:px-7">
              <DialogHeader className="space-y-2 text-left">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.13em] text-primary">
                  <span className="grid size-7 place-items-center rounded-full bg-primary/10">
                    <Play className="size-3.5" />
                  </span>
                  {session.status === "active" ? "Focus session" : "Start task"}
                </div>
                <DialogTitle className="text-xl leading-snug sm:text-2xl">
                  {session.taskName}
                </DialogTitle>
                <DialogDescription>
                  {session.status === "active"
                    ? "One step at a time. You decide what happens next."
                    : "Before you begin, take a moment to check in with yourself."}
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="space-y-5 px-5 py-5 sm:px-7">
              <TaskMetaRow
                dueDate={session.dueDate ?? null}
                estimatedMinutes={session.estimatedMinutes}
                energyRequired={session.energyRequired}
              />

              <section
                aria-label="Current next action"
                className="rounded-xl border border-primary/20 bg-primary/[0.045] p-4 sm:p-5"
              >
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
                  <ArrowRight className="size-4" />
                  Your next action
                </p>
                <p className="mt-2 text-base font-medium leading-relaxed">
                  {session.currentActionText ?? "There are no unfinished actions for this task."}
                </p>
              </section>

              {session.status === "active" ? (
                <div className="space-y-4">
                  <p className="flex items-start gap-2 rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">
                    <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
                    Your check-in is just for this session. It hasn't changed your task or plan.
                  </p>
                  {session.note ? (
                    <p className="rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">Your note: </span>
                      {session.note}
                    </p>
                  ) : null}
                  {actionError ? (
                    <p role="alert" className="text-sm text-destructive">
                      {actionError}
                    </p>
                  ) : null}
                  <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-between">
                    <Button variant="ghost" onClick={close}>
                      <Pause className="size-4" />
                      End session
                    </Button>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button variant="outline" onClick={openStuckFlow}>
                        <LifeBuoy className="size-4" />
                        I'm stuck
                      </Button>
                      {session.currentActionId ? (
                        <Button
                          disabled={savingAction}
                          onClick={() => void completeCurrentAction()}
                        >
                          <CheckCircle2 className="size-4" />
                          {savingAction ? "Saving…" : "Complete next action"}
                        </Button>
                      ) : (
                        <Button variant="outline" disabled>
                          No action to complete
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ) : session.status === "unsure" ? (
                <div className="space-y-4">
                  <div
                    role="status"
                    className="flex gap-3 rounded-xl border border-border bg-muted/50 p-4"
                  >
                    <CircleHelp className="mt-0.5 size-5 shrink-0 text-primary" />
                    <p className="text-sm font-medium leading-relaxed">
                      Got it. MyPLA can help you figure out the first step
                    </p>
                  </div>
                  {breakdownNotice ? (
                    <p
                      role="status"
                      className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground"
                    >
                      Breaking this down isn't available here yet. Your task hasn't been changed.
                    </p>
                  ) : null}
                  <div className="grid gap-2 sm:grid-cols-3">
                    <Button onClick={() => onSessionChange(startWithCurrentAction(session))}>
                      Start with the current action
                    </Button>
                    <Button variant="outline" onClick={() => setBreakdownNotice(true)}>
                      Break this down
                    </Button>
                    <Button variant="ghost" onClick={openStuckFlow}>
                      I'm still stuck
                    </Button>
                  </div>
                  <SessionNote session={session} onChange={onSessionChange} />
                  <div className="border-t border-border pt-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        onSessionChange({
                          ...session,
                          context: null,
                          status: "check-in",
                        })
                      }
                    >
                      Back to check-in choices
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <fieldset>
                    <legend className="mb-2 text-sm font-semibold">
                      How are you feeling about starting?
                    </legend>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {contextChoices.map((choice) => (
                        <button
                          key={choice.value}
                          type="button"
                          aria-pressed={session.context === choice.value}
                          onClick={() =>
                            onSessionChange(chooseTaskSessionContext(session, choice.value))
                          }
                          className={cn(
                            "min-h-11 rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                            session.context === choice.value
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-background hover:bg-muted/70",
                          )}
                        >
                          {choice.label}
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  {session.context &&
                  session.context !== "ready" &&
                  session.context !== "unsure" ? (
                    <p
                      role="status"
                      className="rounded-lg border border-border bg-muted/45 px-3 py-2.5 text-sm text-muted-foreground"
                    >
                      {selectedChoice?.acknowledgement}
                    </p>
                  ) : null}

                  <SessionNote session={session} onChange={onSessionChange} />
                  {session.context && session.context !== "unsure" ? (
                    <DialogFooter className="border-t border-border pt-4">
                      <Button variant="ghost" onClick={close}>
                        Not now
                      </Button>
                      <Button onClick={() => onSessionChange(startWithCurrentAction(session))}>
                        <Play className="size-4" />
                        Start with the current action
                      </Button>
                    </DialogFooter>
                  ) : (
                    <DialogFooter className="border-t border-border pt-4">
                      <Button variant="ghost" onClick={close}>
                        Not now
                      </Button>
                    </DialogFooter>
                  )}
                </div>
              )}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function SessionNote({
  session,
  onChange,
}: {
  session: TaskSession;
  onChange: (session: TaskSession | null) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor="task-session-note" className="text-sm font-medium">
        A note for this session{" "}
        <span className="font-normal text-muted-foreground">(optional)</span>
      </label>
      <Textarea
        id="task-session-note"
        value={session.note ?? ""}
        onChange={(event) => onChange(updateTaskSessionNote(session, event.target.value))}
        placeholder="Anything I want MyPLA to know right now…"
        rows={2}
        className="min-h-20 resize-y bg-background text-sm"
      />
    </div>
  );
}
