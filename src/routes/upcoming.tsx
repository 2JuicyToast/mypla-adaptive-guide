import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { MyPlaShell } from "@/components/mpla/MyPlaShell";
import { ProposalCard } from "@/components/mpla/ProposalCard";
import { BackendStatusNotice } from "@/components/mpla/BackendStatusNotice";
import { StuckDialog } from "@/components/mpla/StuckDialog";
import { TaskCard } from "@/components/mpla/TaskCard";
import { useMyPlaTasks } from "@/hooks/use-mpla-tasks";
import { useMyPlaPlanningData } from "@/hooks/use-mypla-planning-data";
import { nextUnfinishedAction } from "@/components/mpla/TaskCard";
import { resolveProposal, submitStuck } from "@/lib/mypla-api";
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
  const { tasks, mode, notice, setNotice, finishTask, refresh: refreshTasks } = useMyPlaTasks();
  const planningData = useMyPlaPlanningData();
  const upcoming = tasks.filter((task) => task.status === "upcoming");

  async function decideProposal(
    proposalId: string,
    decision: "approve" | "reject" | "adjust",
    changes?: Record<string, unknown>,
  ) {
    try {
      const proposal = await resolveProposal(proposalId, decision, changes);
      await Promise.all([
        planningData.refresh(),
        decision === "reject" ? Promise.resolve() : refreshTasks(),
      ]);
      setNotice(`Proposal ${proposal.status}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The proposal could not be updated.");
    }
  }

  return (
    <MyPlaShell title="Upcoming" subtitle="Nothing urgent yet — here's what's forming.">
      <BackendStatusNotice mode={mode} notice={notice ?? planningData.error} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
          {upcoming.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onStuck={setStuckTask}
              compact
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
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Planning proposals</h2>
          {planningData.proposals.length ? (
            planningData.proposals.map((proposal) => (
              <ProposalCard
                key={proposal.id}
                proposal={proposal}
                onApprove={(item) => void decideProposal(item.id, "approve")}
                onDecline={(item) => void decideProposal(item.id, "reject")}
                onAdjust={(item, changes) => void decideProposal(item.id, "adjust", changes)}
              />
            ))
          ) : (
            <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              No pending proposals.
            </p>
          )}
        </div>
      </div>

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
    </MyPlaShell>
  );
}
