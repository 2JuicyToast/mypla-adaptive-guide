import { Compass } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EnergyBadge, formatMinutes } from "@/components/mpla/TaskMeta";
import type { ExploreOpportunity } from "@/lib/mpla-types";

const categoryLabels: Record<ExploreOpportunity["category"], string> = {
  skill: "Skill",
  wellbeing: "Wellbeing",
  career: "Career",
  social: "Social",
  admin: "Admin",
};

/** Non-urgent, productive opportunity shown in the Explore area. */
export function ExploreCard({
  opportunity,
  onAddToPlan,
  onStartNow,
}: {
  opportunity: ExploreOpportunity;
  onAddToPlan?: (opportunity: ExploreOpportunity) => void;
  onStartNow?: (opportunity: ExploreOpportunity) => void;
}) {
  return (
    <article className="surface-panel flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-explore/12 px-2.5 py-0.5 text-xs font-medium text-explore">
          <Compass className="size-3.5" />
          {categoryLabels[opportunity.category]}
        </span>
        <span className="text-xs text-muted-foreground">
          {formatMinutes(opportunity.estimatedMinutes)}
        </span>
      </div>
      <div>
        <h3 className="text-base font-semibold">{opportunity.title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{opportunity.description}</p>
      </div>
      <EnergyBadge energy={opportunity.energyRequired} />
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => onAddToPlan?.(opportunity)}>
          Add to plan
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onStartNow?.(opportunity)}>
          Do it now
        </Button>
      </div>
    </article>
  );
}
