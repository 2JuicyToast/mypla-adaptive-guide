import { CalendarDays, Clock, Gauge } from "lucide-react";

import { cn } from "@/lib/utils";
import type { EnergyLevel, Priority } from "@/lib/mpla-types";

export function formatDueDate(iso?: string | null) {
  if (!iso) return "No date";
  const date = new Date(`${iso}T00:00:00`);
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

const priorityStyles: Record<Priority, string> = {
  high: "bg-priority-high/15 text-priority-high border-priority-high/30",
  medium: "bg-priority-medium/20 text-priority-medium-foreground border-priority-medium/40",
  low: "bg-priority-low/20 text-priority-low-foreground border-priority-low/40",
};

const priorityLabels: Record<Priority, string> = {
  high: "High priority",
  medium: "Medium priority",
  low: "Low priority",
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        priorityStyles[priority],
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {priorityLabels[priority]}
    </span>
  );
}

const energyStyles: Record<EnergyLevel, string> = {
  high: "text-energy-high",
  medium: "text-energy-medium",
  low: "text-energy-low",
};

export function EnergyBadge({ energy }: { energy: EnergyLevel }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium",
        energyStyles[energy],
      )}
    >
      <Gauge className="size-3.5" />
      {energy} energy
    </span>
  );
}

export function TaskMetaRow({
  dueDate,
  estimatedMinutes,
  energyRequired,
}: {
  dueDate?: string | null;
  estimatedMinutes: number;
  energyRequired: EnergyLevel;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <CalendarDays className="size-3.5" />
        Due {formatDueDate(dueDate)}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Clock className="size-3.5" />
        {formatMinutes(estimatedMinutes)}
      </span>
      <EnergyBadge energy={energyRequired} />
    </div>
  );
}
