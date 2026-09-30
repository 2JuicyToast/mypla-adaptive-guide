import { createFileRoute } from "@tanstack/react-router";

import { AiSuggestionPanel } from "@/components/mpla/AiSuggestionPanel";
import { MyPlaShell } from "@/components/mpla/MyPlaShell";
import { WeeklyReflectionPanel } from "@/components/mpla/WeeklyReflectionPanel";
import { mockProposals } from "@/lib/mpla-mock-data";

export const Route = createFileRoute("/reflect")({
  head: () => ({
    meta: [
      { title: "Weekly reflection — MyPLA" },
      { name: "description", content: "Look back on your week so MyPLA can adapt to how you work." },
      { property: "og:title", content: "Weekly reflection — MyPLA" },
      { property: "og:description", content: "Reflect once a week; approve the changes that follow." },
    ],
  }),
  component: ReflectPage,
});

function ReflectPage() {
  return (
    <MyPlaShell title="Weekly reflection" subtitle="How the week actually went, in your words.">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <WeeklyReflectionPanel />
        </div>
        <AiSuggestionPanel proposals={mockProposals} />
      </div>
    </MyPlaShell>
  );
}
