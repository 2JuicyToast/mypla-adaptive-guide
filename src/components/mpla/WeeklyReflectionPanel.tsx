import { useState } from "react";
import { NotebookPen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { mockReflectionPrompts } from "@/lib/mpla-mock-data";

/**
 * Weekly reflection placeholder. Answers will later feed the adaptive model,
 * which will respond with proposals the user approves.
 */
export function WeeklyReflectionPanel({
  onSubmit,
}: {
  onSubmit?: (answers: Record<string, string>) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});

  return (
    <section className="surface-panel p-5">
      <div className="flex items-center gap-2">
        <NotebookPen className="size-5 text-primary" />
        <h2 className="text-lg font-semibold">Weekly reflection</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        A few minutes on how the week actually went. I'll turn your answers into
        suggestions you can accept or reject.
      </p>

      <div className="mt-4 space-y-4">
        {mockReflectionPrompts.map((prompt) => (
          <div key={prompt.id} className="space-y-1.5">
            <label className="text-sm font-medium">{prompt.question}</label>
            <Textarea
              rows={2}
              placeholder={prompt.placeholder}
              value={answers[prompt.id] ?? ""}
              onChange={(event) =>
                setAnswers((prev) => ({ ...prev, [prompt.id]: event.target.value }))
              }
            />
          </div>
        ))}
      </div>

      <Button className="mt-4" onClick={() => onSubmit?.(answers)}>
        Save reflection
      </Button>
    </section>
  );
}
