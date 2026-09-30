import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { AiSuggestionPanel } from "@/components/mpla/AiSuggestionPanel";
import { AssumptionCheckDialog } from "@/components/mpla/AssumptionCheckDialog";
import { GuidedTaskEntry } from "@/components/mpla/GuidedTaskEntry";
import { MyPlaShell } from "@/components/mpla/MyPlaShell";
import { ResourceRecommendations } from "@/components/mpla/ResourceRecommendations";
import { ScheduleNotificationCard } from "@/components/mpla/ScheduleNotificationCard";
import { StuckDialog } from "@/components/mpla/StuckDialog";
import { TaskCard } from "@/components/mpla/TaskCard";
import { Button } from "@/components/ui/button";
import {
  mockAssumptions,
  mockNotifications,
  mockProposals,
  mockResources,
  mockTasks,
} from "@/lib/mpla-mock-data";
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
  const current = mockTasks.filter((task) => task.status === "current");

  return (
    <MyPlaShell
      title="Good afternoon, Josh"
      subtitle="Three tasks in play today. Here's what I'd start with — your call."
    >
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
                <TaskCard key={task.id} task={task} onStuck={setStuckTask} />
              ))}
            </div>
          </section>

          <GuidedTaskEntry />
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
      />
      <AssumptionCheckDialog
        assumption={mockAssumptions[0]}
        open={assumptionOpen}
        onOpenChange={setAssumptionOpen}
      />
    </MyPlaShell>
  );
}
