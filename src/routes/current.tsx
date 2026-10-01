import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { AssumptionCheckDialog } from "@/components/mpla/AssumptionCheckDialog";
import { BackendStatusNotice } from "@/components/mpla/BackendStatusNotice";
import { MyPlaShell } from "@/components/mpla/MyPlaShell";
import { StuckDialog } from "@/components/mpla/StuckDialog";
import { TaskCard } from "@/components/mpla/TaskCard";
import { useMyPlaTasks } from "@/hooks/use-mpla-tasks";
import { useMyPlaPlanningData } from "@/hooks/use-mypla-planning-data";
import { nextUnfinishedAction } from "@/components/mpla/TaskCard";
import { respondToAssumption, submitStuck } from "@/lib/mypla-api";
import type { Task } from "@/lib/mpla-types";

export const Route = createFileRoute("/current")({
  head: () => ({
    meta: [
      { title: "Current tasks — MyPLA" },
      { name: "description", content: "The tasks MyPLA thinks deserve your attention now." },
      { property: "og:title", content: "Current tasks — MyPLA" },
      {
        property: "og:description",
        content: "What to work on now, with one clear next action each.",
      },
    ],
  }),
  component: CurrentTasks,
});

function CurrentTasks() {
  const [stuckTask, setStuckTask] = useState<Task | null>(null);
  const [checkTask, setCheckTask] = useState<Task | null>(null);
  const { tasks, mode, notice, setNotice, finishTask, finishAction } = useMyPlaTasks();
  const planningData = useMyPlaPlanningData();
  const current = tasks.filter((task) => task.status === "current");

  return (
    <MyPlaShell
      title="Current tasks"
      subtitle="One next action each — the rest stays out of your way."
    >
      <BackendStatusNotice mode={mode} notice={notice ?? planningData.error} />
      {mode === "connecting" ? (
        <p
          role="status"
          className="rounded-lg border border-border p-4 text-sm text-muted-foreground"
        >
          Loading your current tasks…
        </p>
      ) : current.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          No current tasks yet.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {current.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              readOnly={mode === "sample"}
              onStuck={setStuckTask}
              {...(planningData.assumptions.length > 0 ? { onStart: setCheckTask } : {})}
              onCompleteAction={(item, actionId) =>
                finishAction(item.id, actionId).then(() =>
                  setNotice(`Completed the next action for "${item.name}".`),
                )
              }
              onComplete={(completed) => {
                void finishTask(completed.id).then(
                  () => setNotice(`Completed "${completed.name}".`),
                  (error: unknown) =>
                    setNotice(error instanceof Error ? error.message : "Task completion failed."),
                );
              }}
            />
          ))}
        </div>
      )}

      <StuckDialog
        task={stuckTask}
        open={stuckTask !== null}
        onOpenChange={(open) => !open && setStuckTask(null)}
        onSubmit={(payload) => {
          const action = stuckTask ? nextUnfinishedAction(stuckTask) : null;
          void submitStuck({
            taskId: payload.taskId,
            ...(action?.id ? { actionId: action.id } : {}),
            reason: payload.reasonId,
            detail: payload.detail,
          }).then(
            (result) => setNotice(result.message),
            (error: unknown) =>
              setNotice(error instanceof Error ? error.message : "Your note could not be saved."),
          );
        }}
      />
      <AssumptionCheckDialog
        assumption={planningData.assumptions[0] ?? null}
        open={checkTask !== null && planningData.assumptions.length > 0}
        onOpenChange={(open) => !open && setCheckTask(null)}
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
