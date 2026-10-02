import { AlertCircle, CheckCircle2, LoaderCircle, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { TaskParseStatus } from "@/lib/task-parse-status";

export function TaskParseStatusCard({
  status,
  onRetry,
  onUseGuidedEntry,
}: {
  status: TaskParseStatus;
  onRetry: () => void;
  onUseGuidedEntry: () => void;
}) {
  if (status === "idle") return null;

  const isFailure = status === "unavailable" || status === "rate-limited";
  const heading =
    status === "preparing"
      ? "Preparing your task…"
      : status === "ready"
        ? "Draft ready"
        : status === "rate-limited"
          ? "MyPLA is temporarily rate limited."
          : "MyPLA couldn’t prepare that task right now.";
  const description =
    status === "preparing"
      ? "Your request is in progress. Nothing is saved until you review and confirm the draft."
      : status === "ready"
        ? "Review or edit the details below. Nothing is saved until you choose Add to my plan."
        : status === "rate-limited"
          ? "Your task was not saved. Please try again shortly or use guided entry."
          : "Your task was not saved. Try again or use guided entry.";
  const tone =
    status === "ready"
      ? "border-primary/25 bg-primary/5"
      : status === "unavailable"
        ? "border-destructive/25 bg-destructive/5"
        : status === "rate-limited"
          ? "border-amber-500/25 bg-amber-500/5"
          : "border-proposal/25 bg-proposal-muted/40";
  const iconTone =
    status === "ready"
      ? "bg-primary/10 text-primary"
      : status === "unavailable"
        ? "bg-destructive/10 text-destructive"
        : status === "rate-limited"
          ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
          : "bg-proposal/10 text-proposal";

  return (
    <section
      role="status"
      aria-live={isFailure ? "assertive" : "polite"}
      aria-atomic="true"
      className={`mt-4 rounded-xl border p-4 shadow-sm ${tone}`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`grid size-10 shrink-0 place-items-center rounded-xl ${iconTone}`}
          aria-hidden="true"
        >
          {status === "preparing" ? (
            <LoaderCircle className="size-5 motion-safe:animate-spin" />
          ) : status === "ready" ? (
            <CheckCircle2 className="size-5" />
          ) : isFailure ? (
            <AlertCircle className="size-5" />
          ) : (
            <Sparkles className="size-5" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-proposal">
              MyPLA AI
            </p>
            {status === "preparing" ? (
              <span className="rounded-full bg-proposal/10 px-2 py-0.5 text-[11px] font-medium text-proposal">
                In progress
              </span>
            ) : null}
          </div>
          <h3 className="mt-1.5 text-sm font-semibold text-foreground">{heading}</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>

          {status === "preparing" ? (
            <div
              className="mt-3 h-1.5 overflow-hidden rounded-full bg-proposal/10"
              aria-hidden="true"
            >
              <div className="h-full w-1/3 motion-safe:animate-pulse rounded-full bg-proposal" />
            </div>
          ) : null}

          {isFailure ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={onRetry}>
                Try again
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={onUseGuidedEntry}>
                Use guided entry
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}