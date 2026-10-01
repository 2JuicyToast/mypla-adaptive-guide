import { Bell } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ScheduleNotification } from "@/lib/mpla-types";

/**
 * Interactive schedule notification placeholder.
 * Choosing an option sends intent to the assistant; it never commits a change.
 */
export function ScheduleNotificationCard({
  notification,
  onRespond,
  onDismiss,
  isExample = false,
}: {
  notification: ScheduleNotification;
  onRespond?: (notification: ScheduleNotification, option: string) => void;
  onDismiss?: (notification: ScheduleNotification) => void;
  isExample?: boolean;
}) {
  return (
    <article className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-start gap-3">
        <Bell className="mt-0.5 size-4 shrink-0 text-accent-foreground" />
        <div className="min-w-0 flex-1">
          {isExample ? (
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Example check-in — replies are not saved
            </p>
          ) : null}
          <p className="text-sm">{notification.message}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{notification.time}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {notification.options.map((option) => (
              <Button
                key={option}
                size="sm"
                variant="outline"
                disabled={isExample}
                onClick={() => onRespond?.(notification, option)}
              >
                {option}
              </Button>
            ))}
            <Button
              size="sm"
              variant="ghost"
              disabled={isExample}
              onClick={() => onDismiss?.(notification)}
            >
              Dismiss
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}
