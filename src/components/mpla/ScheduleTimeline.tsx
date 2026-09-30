import { CalendarClock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ScheduleBlock } from "@/lib/mpla-types";

const kindStyles: Record<ScheduleBlock["kind"], string> = {
  class: "border-l-primary bg-primary/5",
  study: "border-l-proposal bg-proposal/5",
  commute: "border-l-muted-foreground/40 bg-muted/40",
  break: "border-l-accent bg-accent/10",
  personal: "border-l-explore bg-explore/5",
  free: "border-l-dashed border-l-border bg-background",
};

/** Typical weekday schedule view. Read-only at this stage. */
export function ScheduleTimeline({
  blocks,
  onFillGap,
  title = "Your typical weekday",
}: {
  blocks: ScheduleBlock[];
  onFillGap?: (block: ScheduleBlock) => void;
  title?: string;
}) {
  return (
    <section className="surface-panel p-5">
      <div className="flex items-center gap-2">
        <CalendarClock className="size-5 text-primary" />
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>

      <ol className="mt-4 space-y-2">
        {blocks.map((block) => (
          <li
            key={block.id}
            className={cn(
              "flex flex-wrap items-center gap-3 rounded-r-lg border border-border border-l-4 p-3",
              kindStyles[block.kind],
            )}
          >
            <span className="w-24 shrink-0 font-mono text-xs text-muted-foreground">
              {block.start}–{block.end}
            </span>
            <span className="min-w-0 flex-1 text-sm font-medium">{block.label}</span>
            {block.kind === "free" ? (
              <Button size="sm" variant="outline" onClick={() => onFillGap?.(block)}>
                Suggest something
              </Button>
            ) : (
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                {block.kind}
              </span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
