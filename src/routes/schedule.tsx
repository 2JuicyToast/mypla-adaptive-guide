import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { MyPlaShell } from "@/components/mpla/MyPlaShell";
import { ScheduleNotificationCard } from "@/components/mpla/ScheduleNotificationCard";
import { ScheduleTimeline } from "@/components/mpla/ScheduleTimeline";
import { mockNotifications, mockSchedule } from "@/lib/mpla-mock-data";
import { getSchedule, suggestSchedule } from "@/lib/mypla-api";
import type { ScheduleBlock } from "@/lib/mpla-types";

export const Route = createFileRoute("/schedule")({
  head: () => ({
    meta: [
      { title: "Schedule — MyPLA" },
      { name: "description", content: "Your typical weekday, with free gaps MyPLA can help fill." },
      { property: "og:title", content: "Schedule — MyPLA" },
      { property: "og:description", content: "Classes, study blocks, and free gaps in one view." },
    ],
  }),
  component: SchedulePage,
});

function SchedulePage() {
  const [blocks, setBlocks] = useState<ScheduleBlock[]>(mockSchedule);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getSchedule().then(
      (saved) => {
        if (!active) return;
        setBlocks(
          saved.map((block) => ({
            id: block.id,
            label: block.title,
            start: new Date(block.start).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            }),
            end: new Date(block.end).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            }),
            kind:
              block.kind === "fixed"
                ? "class"
                : block.kind === "flexible"
                  ? "free"
                  : block.kind === "break"
                    ? "break"
                    : block.kind === "transition"
                      ? "commute"
                      : "personal",
            ...(block.taskId ? { taskId: block.taskId } : {}),
            startAt: block.start,
            endAt: block.end,
          })),
        );
      },
      (error: unknown) => {
        if (active) {
          setNotice(error instanceof Error ? error.message : "The schedule could not be loaded.");
        }
      },
    );
    return () => {
      active = false;
    };
  }, []);

  async function requestSuggestion(block: ScheduleBlock) {
    const start = new Date(block.startAt ?? "");
    const end = new Date(block.endAt ?? "");
    const minutes = Math.max(5, Math.round((end.getTime() - start.getTime()) / 60_000));
    try {
      await suggestSchedule({
        minutes,
        energy: "medium",
        ...(block.startAt ? { start: new Date(block.startAt).toISOString() } : {}),
      });
      setNotice("A schedule suggestion is ready. Review it before approving.");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "A schedule suggestion could not be created.",
      );
    }
  }

  return (
    <MyPlaShell title="Schedule" subtitle="Your typical weekday, and where the gaps are.">
      {notice ? (
        <p
          role="status"
          className="mb-4 rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm"
        >
          {notice}{" "}
          {notice.includes("suggestion") ? (
            <Link to="/upcoming" className="underline">
              View proposals
            </Link>
          ) : null}
        </p>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ScheduleTimeline blocks={blocks} onFillGap={(block) => void requestSuggestion(block)} />
        </div>
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Check-ins</h2>
          {mockNotifications.map((notification) => (
            <ScheduleNotificationCard key={notification.id} notification={notification} />
          ))}
        </div>
      </div>
    </MyPlaShell>
  );
}
