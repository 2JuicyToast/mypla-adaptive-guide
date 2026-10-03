import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";

import { AiSuggestionPanel } from "@/components/mpla/AiSuggestionPanel";
import { AssumptionCheckDialog } from "@/components/mpla/AssumptionCheckDialog";
import { BackendStatusNotice } from "@/components/mpla/BackendStatusNotice";
import { GuidedTaskEntry } from "@/components/mpla/GuidedTaskEntry";
import { MyPlaShell } from "@/components/mpla/MyPlaShell";
import { ResourceLibrary } from "@/components/mpla/ResourceLibrary";
import { ScheduleNotificationCard } from "@/components/mpla/ScheduleNotificationCard";
import { StartTaskDialog } from "@/components/mpla/StartTaskDialog";
import { StuckDialog } from "@/components/mpla/StuckDialog";
import { TaskDraftReview } from "@/components/mpla/TaskDraftReview";
import { TaskCard } from "@/components/mpla/TaskCard";
import { Button } from "@/components/ui/button";
import { mockNotifications } from "@/lib/mpla-mock-data";
import { useMyPlaTasks } from "@/hooks/use-mpla-tasks";
import { useMyPlaPlanningData } from "@/hooks/use-mypla-planning-data";
import { nextUnfinishedAction } from "@/components/mpla/TaskCard";
import {
  createTaskBreakdown,
  parseTask,
  resolveProposal,
  respondToAssumption,
  submitStuck,
  type TaskDraft,
} from "@/lib/mypla-api";
import type { TaskParseStatus } from "@/lib/task-parse-status";
import type { Task, TaskBreakdownAction } from "@/lib/mpla-types";
import { createTaskSession, endTaskSession, type TaskSession } from "@/lib/task-session";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MyPLA — Your adaptive planning assistant" },
      {
        name: "description",
        content:
          "MyPLA is an adaptive personal planning assistant for students: current tasks, upcoming work, and productive ways to spend free time.",
      },
      { property: "og:title", content: "MyPLA — Your adaptive planning assistant" },
      {
        property: "og:description",
        content:
          "A student planning assistant that suggests — you decide. Tasks, schedule, and guided task entry.",
      },
    ],
  }),
  component: HomeDashboard,
});

function HomeDashboard() {
  const [stuckTask, setStuckTask] = useState<Task | null>(null);
  const [taskSession, setTaskSession] = useState<TaskSession | null>(null);
  const [assumptionOpen, setAssumptionOpen] = useState(false);
  const [draft, setDraft] = useState<TaskDraft | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [parseStatus, setParseStatus] = useState<TaskParseStatus>("idle");
  const draftReviewRef = useRef<HTMLElement | null>(null);
  const {
    tasks,
    mode,
    notice,
    setNotice,
    addTask,
    finishTask,
    finishAction,
    refresh: refreshTasks,
  } = useMyPlaTasks();
  const planningData = useMyPlaPlanningData();
  const current = tasks.filter((task) => task.status === "current");

  async function confirmDraft() {
    if (!draft) return;
    setSavingDraft(true);
    try {
      const task = await addTask({
        ...draft,
        name: draft.name.trim(),
        actions: (draft.actions ?? [])
          .filter((action) => action.label.trim())
          .map((action) => ({ ...action, label: action.label.trim() })),
      });
      setDraft(null);
      setParseStatus("idle");
      setNotice(`Added "${task.name}" to your plan.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The task could not be saved.");
    } finally {
      setSavingDraft(false);
    }
  }

  async function recordStuck(payload: { taskId: string; reasonId: string; detail: string }) {
    const action = stuckTask ? nextUnfinishedAction(stuckTask) : null;
    try {
      const result = await submitStuck({
        taskId: payload.taskId,
        ...(action?.id ? { actionId: action.id } : {}),
        reason: payload.reasonId,
        detail: payload.detail,
      });
      setNotice(result.message);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Your note could not be saved.");
    }
  }

  async function decideProposal(
    proposalId: string,
    decision: "approve" | "reject" | "adjust",
    changes?: Record<string, unknown>,
  ): Promise<boolean> {
    try {
      const proposal = await resolveProposal(proposalId, decision, changes);
      if (proposal.kind === "task-breakdown") {
        const refreshedTasks =
          decision === "reject" ? [] : await refreshTasks();
        await planningData.refresh().catch(() => undefined);
        if (decision === "reject") {
          setNotice("Breakdown set aside. Your task was not changed.");
          return true;
        }
        const updatedTask = refreshedTasks.find(
          (task) => task.id === proposal.relatedTaskId,
        );
        const nextAction = updatedTask?.actions.find((action) => !action.done);
        setNotice(
          nextAction
            ? `Breakdown ${proposal.status}. Your next action is “${nextAction.label}”.`
            : `Proposal ${proposal.status}; reload your plan if the task does not update.`,
        );
        return true;
      }
      await planningData.refresh();
      setNotice(`Proposal ${proposal.status}.`);
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The proposal could not be updated.");
      return false;
    }
  }

  async function resolveTaskBreakdown(
    proposalId: string,
    decision: "approve" | "adjust" | "reject",
    changes?: Record<string, unknown>,
  ): Promise<Task | null> {
    const proposal = await resolveProposal(proposalId, decision, changes);
    if (decision === "reject") {
      await planningData.refresh().catch(() => undefined);
      setNotice("Breakdown set aside. Your task was not changed.");
      return null;
    }

    const [latestTasks] = await Promise.all([
      refreshTasks(),
      planningData.refresh().catch(() => undefined),
    ]);
    const updatedTask = latestTasks.find(
      (task) => task.id === proposal.relatedTaskId,
    );
    if (!updatedTask) {
      setNotice(
        `Breakdown ${proposal.status}, but MyPLA could not refresh the task. Reload your plan to see its new next action.`,
      );
      return null;
    }

    const nextAction = updatedTask.actions.find((action) => !action.done);
    setNotice(
      nextAction
        ? `Breakdown ${proposal.status}. Your next action is “${nextAction.label}”.`
        : `Breakdown ${proposal.status}.`,
    );
    return updatedTask;
  }

  return (
    <MyPlaShell
      title="Your MyPLA plan"
      subtitle="A clear view of your current focus, with you in control of every decision."
    >
      <BackendStatusNotice mode={mode} notice={notice ?? planningData.error} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Today's focus</h2>
              <Button
                variant="ghost"
                size="sm"
                disabled={planningData.assumptions.length === 0}
                onClick={() => setAssumptionOpen(true)}
              >
                Answer a quick check
              </Button>
            </div>
            {mode === "connecting" ? (
              <p
                role="status"
                className="rounded-lg border border-border p-4 text-sm text-muted-foreground"
              >
                Loading your current tasks…
              </p>
            ) : current.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                No current tasks yet. Add a task below when you’re ready.
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {current.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    readOnly={mode === "sample"}
                    onStart={(item) => setTaskSession(createTaskSession(item))}
                    onStuck={setStuckTask}
                    onCompleteAction={(item, actionId) =>
                      finishAction(item.id, actionId).then(() =>
                        setNotice(`Completed the next action for "${item.name}".`),
                      )
                    }
                    onComplete={(completed) => {
                      void finishTask(completed.id).then(
                        () => setNotice(`Completed "${completed.name}".`),
                        (error: unknown) =>
                          setNotice(
                            error instanceof Error ? error.message : "Task completion failed.",
                          ),
                      );
                    }}
                  />
                ))}
              </div>
            )}
          </section>

          <GuidedTaskEntry
            parseStatus={parseStatus}
            onReviewDraft={() => {
              const review = draftReviewRef.current;
              if (!review) return;
              const prefersReducedMotion = window.matchMedia(
                "(prefers-reduced-motion: reduce)",
              ).matches;
              review.scrollIntoView({
                behavior: prefersReducedMotion ? "auto" : "smooth",
                block: "start",
              });
              review.focus({ preventScroll: true });
            }}
            onParseStatusChange={(status) => {
              setParseStatus(status);
              if (status === "preparing") setDraft(null);
            }}
            onSubmitGuided={(taskDraft) => {
              setNotice(null);
              setDraft({
                ...taskDraft,
                dueDate: taskDraft.dueDate || null,
                actions: taskDraft.firstAction ? [{ label: taskDraft.firstAction }] : [],
              });
            }}
            onSubmitNaturalLanguage={async (text, signal) => {
              setNotice(null);
              const result = await parseTask(text, signal);
              if (signal.aborted) return;
              setDraft(result.draft);
            }}
          />
          {draft ? (
            <TaskDraftReview
              sectionRef={draftReviewRef}
              draft={draft}
              saving={savingDraft}
              onChange={(patch) =>
                setDraft((current) => (current ? { ...current, ...patch } : current))
              }
              onConfirm={() => void confirmDraft()}
              onCancel={() => {
                setDraft(null);
                setParseStatus("idle");
              }}
            />
          ) : null}
        </div>

        <div className="space-y-6">
          <AiSuggestionPanel
            proposals={planningData.proposals}
            loading={planningData.loading}
            onApprove={(proposal) => void decideProposal(proposal.id, "approve")}
            onDecline={(proposal) => void decideProposal(proposal.id, "reject")}
            onAdjust={(proposal, changes) =>
              decideProposal(proposal.id, "adjust", changes)
            }
          />
          <section className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold">Example notifications</h2>
              <p className="text-xs text-muted-foreground">
                Preview content only. These check-ins are not generated from your activity, and
                replies are not saved.
              </p>
            </div>
            {mockNotifications.map((notification) => (
              <ScheduleNotificationCard
                key={notification.id}
                notification={notification}
                isExample
              />
            ))}
          </section>
          <ResourceLibrary />
        </div>
      </div>

      <StuckDialog
        task={stuckTask}
        open={stuckTask !== null}
        onOpenChange={(open) => !open && setStuckTask(null)}
        onSubmit={(payload) => void recordStuck(payload)}
      />
      <StartTaskDialog
        session={taskSession}
        task={taskSession ? (tasks.find((item) => item.id === taskSession.taskId) ?? null) : null}
        onSessionChange={(session) => {
          if (session === null) {
            setTaskSession((current) => (current ? endTaskSession(current) : null));
          } else {
            setTaskSession(session);
          }
        }}
        onOpenChange={(open) => {
          if (!open) setTaskSession((current) => (current ? endTaskSession(current) : null));
        }}
        onCompleteAction={async (taskId, actionId) => {
          const updated = await finishAction(taskId, actionId);
          setNotice(`Completed the next action for "${updated.name}".`);
          return updated;
        }}
        onStuck={(task) => {
          const latest = tasks.find((item) => item.id === task.id) ?? task;
          setTaskSession(null);
          setStuckTask(latest);
        }}
        onRequestBreakdown={createTaskBreakdown}
        onApproveBreakdown={(proposalId) =>
          resolveTaskBreakdown(proposalId, "approve")
        }
        onAdjustBreakdown={(proposalId, actions: TaskBreakdownAction[]) =>
          resolveTaskBreakdown(proposalId, "adjust", {
            taskPatch: {
              actions,
            },
          })
        }
        onRejectBreakdown={async (proposalId) => {
          await resolveTaskBreakdown(proposalId, "reject");
        }}
      />
      <AssumptionCheckDialog
        assumption={planningData.assumptions[0] ?? null}
        open={assumptionOpen && planningData.assumptions.length > 0}
        onOpenChange={setAssumptionOpen}
        onRespond={(response) => {
          void respondToAssumption(response.assumptionId, response).then(
            () => {
              setNotice("Thanks. I’ve recorded your answer.");
              void planningData.refresh();
            },
            (error: unknown) =>
              setNotice(error instanceof Error ? error.message : "Your answer could not be saved."),
          );
        }}
      />
    </MyPlaShell>
  );
}
