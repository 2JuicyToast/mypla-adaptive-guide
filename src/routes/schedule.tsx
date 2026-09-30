import { createFileRoute } from "@tanstack/react-router";

import { MyPlaShell } from "@/components/mpla/MyPlaShell";
import { ScheduleNotificationCard } from "@/components/mpla/ScheduleNotificationCard";
import { ScheduleTimeline } from "@/components/mpla/ScheduleTimeline";
import { mockNotifications, mockSchedule } from "@/lib/mpla-mock-data";

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
  return (
    <MyPlaShell title="Schedule" subtitle="Your typical weekday, and where the gaps are.">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ScheduleTimeline blocks={mockSchedule} />
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
