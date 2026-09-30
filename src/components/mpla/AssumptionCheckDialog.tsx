import { useState } from "react";
import { HelpCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { AssumptionAnswer, AssumptionCheck, AssumptionResponse } from "@/lib/mpla-types";

const answers: { value: AssumptionAnswer; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "not-sure", label: "Not sure" },
];

/**
 * Assumption check popup: Yes / No / Not sure, plus a correction box.
 * The answer is returned to the caller; no state is committed here.
 */
export function AssumptionCheckDialog({
  assumption,
  open,
  onOpenChange,
  onRespond,
}: {
  assumption: AssumptionCheck | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRespond?: (response: AssumptionResponse) => void;
}) {
  const [answer, setAnswer] = useState<AssumptionAnswer | null>(null);
  const [correction, setCorrection] = useState("");

  function close() {
    setAnswer(null);
    setCorrection("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="size-5 text-proposal" />
            Quick check
          </DialogTitle>
          <DialogDescription>
            {assumption?.context ?? "Helping me plan this better."}
          </DialogDescription>
        </DialogHeader>

        <p className="text-sm font-medium">{assumption?.question}</p>

        <div className="grid grid-cols-3 gap-2">
          {answers.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setAnswer(option.value)}
              className={cn(
                "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                answer === option.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:bg-muted",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <Textarea
          value={correction}
          onChange={(event) => setCorrection(event.target.value)}
          placeholder="Correct me here if I've got it wrong (optional)"
          rows={3}
        />

        <DialogFooter>
          <Button variant="ghost" onClick={close}>
            Skip
          </Button>
          <Button
            disabled={!answer}
            onClick={() => {
              if (assumption && answer) {
                onRespond?.({ assumptionId: assumption.id, answer, correction });
              }
              close();
            }}
          >
            Send answer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
