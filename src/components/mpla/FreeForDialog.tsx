import { useState } from "react";
import { Timer } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatMinutes } from "@/components/mpla/TaskMeta";
import type { EnergyLevel } from "@/lib/mpla-types";

const durations = [15, 30, 45, 60, 90, 120];
const energies: EnergyLevel[] = ["low", "medium", "high"];

/**
 * "I'm free for X" quick action. Collects a window and current energy,
 * then shows what the assistant would suggest (placeholder for now).
 */
export function FreeForDialog({
  trigger,
  onRequestSuggestion,
}: {
  trigger?: React.ReactNode;
  onRequestSuggestion?: (input: { minutes: number; energy: EnergyLevel }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [minutes, setMinutes] = useState(30);
  const [energy, setEnergy] = useState<EnergyLevel>("medium");
  const [asked, setAsked] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setAsked(false);
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="secondary">
            <Timer className="size-4" />
            I'm free for…
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>I'm free for…</DialogTitle>
          <DialogDescription>
            Tell me how long you've got and how you're feeling. I'll suggest something you
            can accept or skip.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">How long?</p>
          <div className="flex flex-wrap gap-2">
            {durations.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setMinutes(value)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm transition-colors",
                  minutes === value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:bg-muted",
                )}
              >
                {formatMinutes(value)}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Energy right now?</p>
          <div className="flex gap-2">
            {energies.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setEnergy(value)}
                className={cn(
                  "flex-1 rounded-lg border px-3 py-2 text-sm capitalize transition-colors",
                  energy === value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:bg-muted",
                )}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        {asked ? (
          <div className="rounded-lg border border-dashed border-proposal/40 bg-proposal-muted/40 p-3 text-sm text-muted-foreground">
            Suggestions for a {formatMinutes(minutes)} / {energy}-energy window will appear
            here as proposals once the planning engine is connected.
          </div>
        ) : null}

        <Button
          onClick={() => {
            setAsked(true);
            onRequestSuggestion?.({ minutes, energy });
          }}
        >
          Show me options
        </Button>
      </DialogContent>
    </Dialog>
  );
}
