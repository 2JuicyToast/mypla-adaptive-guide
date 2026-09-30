import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { AssumptionCheckDialog } from "@/components/mpla/AssumptionCheckDialog";
import { MyPlaShell } from "@/components/mpla/MyPlaShell";
import { StuckDialog } from "@/components/mpla/StuckDialog";
import { TaskCard } from "@/components/mpla/TaskCard";
import { mockAssumptions, mockTasks } from "@/lib/mpla-mock-data";
import type { Task } from "@/lib/mpla-types";

export const Route = createFileRoute("/current")({
  head: () => ({
    meta: [
      { title: "Current tasks — MyPLA" },
      { name: "description", content: "The tasks MyPLA thinks deserve your attention now." },
      { property: "og:title", content: "Current tasks — MyPLA" },
      { property: "og:description", content: "What to work on now, with one clear next action each." },
    ],
  }),
  component: CurrentTasks,
});

function CurrentTasks() {
  const [stuckTask, setStuckTask] = useState<Task | null>(null);
  const [checkTask, setCheckTask] = useState<Task | null>(null);
  const current = mockTasks.filter((task) => task.status === "current");

  return (
    <MyPlaShell
      title="Current tasks"
      subtitle="One next action each — the rest stays out of your way."
    >
      <div className="grid gap-4 md:grid-cols-2">
        {current.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onStuck={setStuckTask}
            onStart={setCheckTask}
          />
        ))}
      </div>

      <StuckDialog
        task={stuckTask}
        open={stuckTask !== null}
        onOpenChange={(open) => !open && setStuckTask(null)}
      />
      <AssumptionCheckDialog
        assumption={mockAssumptions[0]}
        open={checkTask !== null}
        onOpenChange={(open) => !open && setCheckTask(null)}
      />
    </MyPlaShell>
  );
}
