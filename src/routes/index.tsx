import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { AiSuggestionPanel } from "@/components/mpla/AiSuggestionPanel";
import { AssumptionCheckDialog } from "@/components/mpla/AssumptionCheckDialog";
import { BackendStatusNotice } from "@/components/mpla/BackendStatusNotice";
import { GuidedTaskEntry } from "@/components/mpla/GuidedTaskEntry";
import { MyPlaShell } from "@/components/mpla/MyPlaShell";
import { ResourceRecommendations } from "@/components/mpla/ResourceRecommendations";
import { ScheduleNotificationCard } from "@/components/mpla/ScheduleNotificationCard";
import { StuckDialog } from "@/components/mpla/StuckDialog";
import { TaskDraftReview } from "@/components/mpla/TaskDraftReview";
import { TaskCard } from "@/components/mpla/TaskCard";
import { Button } from "@/components/ui/button";
import {
  mockAssumptions,
  mockNotifications,
  mockProposals,
  mockResources,
} from "@/lib/mpla-mock-data";
import { useMyPlaTasks } from "@/hooks/use-mpla-tasks";
import { nextUnfinishedAction } from "@/components/mpla/TaskCard";
import { parseTask, respondToAssumption, submitStuck, type TaskDraft } from "@/lib/mypla-api";
import type { Task } from "@/lib/mpla-types";

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
  const [assumptionOpen, setAssumptionOpen] = useState(false);
  const [draft, setDraft] = useState<TaskDraft | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const { tasks, mode, notice, setNotice, addTask, finishTask } = useMyPlaTasks();
  const current = tasks.filter((task) => task.status === "current");

  async function confirmDraft() {
    if (!draft) return;
    setSavingDraft(true);
    try {
      const task = await addTask(draft);
      setDraft(null);
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
        actionId: action?.id,
        reason: payload.reasonId,
        detail: payload.detail,
      });
      setNotice(result.message);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Your note could not be saved.");
    }
  }

  return (
    <MyPlaShell
      title="Good afternoon, Josh"
      subtitle="Three tasks in play today. Here's what I'd start with — your call."
    >
      <BackendStatusNotice mode={mode} notice={notice} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Today's focus</h2>
              <Button variant="ghost" size="sm" onClick={() => setAssumptionOpen(true)}>
                Answer a quick check
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {current.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onStuck={setStuckTask}
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
          </section>

          <GuidedTaskEntry
            onSubmitGuided={(taskDraft) => {
              setNotice(null);
              setDraft({
                ...taskDraft,
                dueDate: taskDraft.dueDate || null,
                actions: taskDraft.firstAction ? [{ label: taskDraft.firstAction }] : [],
              });
            }}
            onSubmitNaturalLanguage={(text) => {
              void parseTask(text).then(
                (result) => {
                  setDraft(result.draft);
                  setNotice(result.message);
                },
                (error: unknown) =>
                  setNotice(error instanceof Error ? error.message : "The planning draft could not be prepared."),
              );
            }}
          />
          {draft ? (
            <TaskDraftReview
              draft={draft}
              saving={savingDraft}
              onConfirm={() => void confirmDraft()}
              onCancel={() => setDraft(null)}
            />
          ) : null}
        </div>

        <div className="space-y-6">
          <AiSuggestionPanel proposals={mockProposals} />
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Notifications</h2>
            {mockNotifications.map((notification) => (
              <ScheduleNotificationCard key={notification.id} notification={notification} />
            ))}
          </section>
          <ResourceRecommendations resources={mockResources} />
        </div>
      </div>

      <StuckDialog
        task={stuckTask}
        open={stuckTask !== null}
        onOpenChange={(open) => !open && setStuckTask(null)}
        onSubmit={(payload) => void recordStuck(payload)}
      />
      <AssumptionCheckDialog
        assumption={mockAssumptions[0]}
        open={assumptionOpen}
        onOpenChange={setAssumptionOpen}
        onRespond={(response) => {
          void respondToAssumption(response.assumptionId, response).then(
            () => setNotice("Thanks. I’ve recorded your answer."),
            (error: unknown) =>
              setNotice(error instanceof Error ? error.message : "Your answer could not be saved."),
          );
        }}
      />
    </MyPlaShell>
  );
}
