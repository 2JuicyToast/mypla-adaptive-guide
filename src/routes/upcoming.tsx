import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { MyPlaShell } from "@/components/mpla/MyPlaShell";
import { ProposalCard } from "@/components/mpla/ProposalCard";
import { StuckDialog } from "@/components/mpla/StuckDialog";
import { TaskCard } from "@/components/mpla/TaskCard";
import { mockProposals, mockTasks } from "@/lib/mpla-mock-data";
import type { Task } from "@/lib/mpla-types";

export const Route = createFileRoute("/upcoming")({
  head: () => ({
    meta: [
      { title: "Upcoming tasks — MyPLA" },
      { name: "description", content: "What's coming up later this week and next, in MyPLA." },
      { property: "og:title", content: "Upcoming tasks — MyPLA" },
      { property: "og:description", content: "Plan ahead with proposals you approve." },
    ],
  }),
  component: UpcomingTasks,
});

function UpcomingTasks() {
  const [stuckTask, setStuckTask] = useState<Task | null>(null);
  const upcoming = mockTasks.filter((task) => task.status === "upcoming");

  return (
    <MyPlaShell title="Upcoming" subtitle="Nothing urgent yet — here's what's forming.">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
          {upcoming.map((task) => (
            <TaskCard key={task.id} task={task} onStuck={setStuckTask} compact />
          ))}
        </div>
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Planning proposals</h2>
          {mockProposals.map((proposal) => (
            <ProposalCard key={proposal.id} proposal={proposal} />
          ))}
        </div>
      </div>

      <StuckDialog
        task={stuckTask}
        open={stuckTask !== null}
        onOpenChange={(open) => !open && setStuckTask(null)}
      />
    </MyPlaShell>
  );
}
