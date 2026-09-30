import { createFileRoute } from "@tanstack/react-router";

import { ExploreCard } from "@/components/mpla/ExploreCard";
import { FreeForDialog } from "@/components/mpla/FreeForDialog";
import { MyPlaShell } from "@/components/mpla/MyPlaShell";
import { mockExplore } from "@/lib/mpla-mock-data";

export const Route = createFileRoute("/explore")({
  head: () => ({
    meta: [
      { title: "Explore — MyPLA" },
      {
        name: "description",
        content: "Non-urgent, productive things worth doing when you have spare time.",
      },
      { property: "og:title", content: "Explore — MyPLA" },
      { property: "og:description", content: "Good uses of a free hour, suggested by MyPLA." },
    ],
  }),
  component: ExplorePage,
});

function ExplorePage() {
  return (
    <MyPlaShell
      title="Explore"
      subtitle="Nothing due here. Just useful ways to spend time you already have."
    >
      <div className="mb-6">
        <FreeForDialog />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {mockExplore.map((opportunity) => (
          <ExploreCard key={opportunity.id} opportunity={opportunity} />
        ))}
      </div>
    </MyPlaShell>
  );
}
