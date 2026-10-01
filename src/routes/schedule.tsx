import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

import { MyPlaShell } from "@/components/mpla/MyPlaShell";
import { ScheduleNotificationCard } from "@/components/mpla/ScheduleNotificationCard";
import { ScheduleTimeline } from "@/components/mpla/ScheduleTimeline";
import { Button } from "@/components/ui/button";
import { mockNotifications } from "@/lib/mpla-mock-data";
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
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadingSchedule, setLoadingSchedule] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadSchedule = useCallback(async () => {
    setLoadingSchedule(true);
    setLoadError(null);
    try {
      const saved = await getSchedule();
      setBlocks(saved.map(toScheduleBlock));
      setNotice(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "The schedule could not be loaded.");
    } finally {
      setLoadingSchedule(false);
    }
  }, []);

  useEffect(() => {
    void loadSchedule();
  }, [loadSchedule]);

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
    <MyPlaShell title="Schedule" subtitle="Your saved blocks and available time.">
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
          {loadingSchedule ? (
            <p
              role="status"
              className="rounded-lg border border-border p-4 text-sm text-muted-foreground"
            >
              Loading your schedule…
            </p>
          ) : loadError ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <p role="alert" className="text-sm">
                Your schedule could not be loaded: {loadError}
              </p>
              <Button
                className="mt-3"
                size="sm"
                variant="outline"
                onClick={() => void loadSchedule()}
              >
                Retry
              </Button>
            </div>
          ) : blocks.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              No schedule blocks are saved for today.
            </p>
          ) : (
            <>
              <p className="mb-3 text-sm text-muted-foreground">
                {blocks.some((block) => block.id.startsWith("weekday-"))
                  ? "Typical weekday template — example timing, not saved personal events."
                  : "These schedule blocks are saved to your account."}
              </p>
              <ScheduleTimeline
                blocks={blocks}
                onFillGap={(block) => void requestSuggestion(block)}
              />
            </>
          )}
        </div>
        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">Example check-ins</h2>
            <p className="text-xs text-muted-foreground">
              Preview content only. Replies are not saved.
            </p>
          </div>
          {mockNotifications.map((notification) => (
            <ScheduleNotificationCard key={notification.id} notification={notification} isExample />
          ))}
        </div>
      </div>
    </MyPlaShell>
  );
}

function toScheduleBlock(block: Awaited<ReturnType<typeof getSchedule>>[number]): ScheduleBlock {
  return {
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
  };
}
