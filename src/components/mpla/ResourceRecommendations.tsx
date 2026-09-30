import { BookOpen, FileText, PlayCircle, Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ResourceRecommendation } from "@/lib/mpla-types";

const icons = {
  tool: Wrench,
  reading: BookOpen,
  video: PlayCircle,
  template: FileText,
} as const;

/** Placeholder list of resource / tool recommendations from the assistant. */
export function ResourceRecommendations({
  resources,
  onOpen,
  onDismiss,
}: {
  resources: ResourceRecommendation[];
  onOpen?: (resource: ResourceRecommendation) => void;
  onDismiss?: (resource: ResourceRecommendation) => void;
}) {
  return (
    <section className="surface-panel p-5">
      <h2 className="text-lg font-semibold">Might help right now</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Suggested tools and resources. Open them if useful, dismiss if not.
      </p>
      <ul className="mt-4 space-y-3">
        {resources.map((resource) => {
          const Icon = icons[resource.type];
          return (
            <li
              key={resource.id}
              className="flex items-start gap-3 rounded-lg border border-border p-3"
            >
              <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{resource.title}</p>
                <p className="text-xs text-muted-foreground">{resource.reason}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button size="sm" variant="outline" onClick={() => onOpen?.(resource)}>
                  Open
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onDismiss?.(resource)}>
                  Hide
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
