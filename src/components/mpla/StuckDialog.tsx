import { useState } from "react";
import { LifeBuoy } from "lucide-react";

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
import { stuckReasons } from "@/lib/mpla-mock-data";
import type { Task } from "@/lib/mpla-types";

/**
 * "I'm stuck" surface. Collects a reason and optional detail.
 * The backend will later turn this into proposals; nothing changes here yet.
 */
export function StuckDialog({
  task,
  open,
  onOpenChange,
  onSubmit,
}: {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit?: (payload: { taskId: string; reasonId: string; detail: string }) => void;
}) {
  const [reasonId, setReasonId] = useState<string | null>(null);
  const [detail, setDetail] = useState("");

  function close() {
    setReasonId(null);
    setDetail("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LifeBuoy className="size-5 text-primary" />
            What's getting in the way?
          </DialogTitle>
          <DialogDescription>
            {task ? `For "${task.name}".` : ""} Pick what fits — you'll get suggestions to
            approve, nothing changes on its own.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          {stuckReasons.map((reason) => (
            <button
              key={reason.id}
              type="button"
              onClick={() => setReasonId(reason.id)}
              className={cn(
                "rounded-lg border p-3 text-left transition-colors",
                reasonId === reason.id
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted",
              )}
            >
              <p className="text-sm font-medium">{reason.label}</p>
              <p className="text-xs text-muted-foreground">{reason.description}</p>
            </button>
          ))}
        </div>

        <Textarea
          value={detail}
          onChange={(event) => setDetail(event.target.value)}
          placeholder="Anything else worth knowing? (optional)"
          rows={3}
        />

        <DialogFooter>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button
            disabled={!reasonId}
            onClick={() => {
              if (task && reasonId) onSubmit?.({ taskId: task.id, reasonId, detail });
              close();
            }}
          >
            Ask for help
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
