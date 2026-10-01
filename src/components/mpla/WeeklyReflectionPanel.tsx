import { useEffect, useState } from "react";
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
  saving = false,
  loading = false,
  initialAnswers = {},
}: {
  onSubmit?: (answers: Record<string, string>) => void;
  saving?: boolean;
  loading?: boolean;
  initialAnswers?: Record<string, string>;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    setAnswers(initialAnswers);
  }, [initialAnswers]);

  return (
    <section className="surface-panel p-5">
      <div className="flex items-center gap-2">
        <NotebookPen className="size-5 text-primary" />
        <h2 className="text-lg font-semibold">Weekly reflection</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        A few minutes on how the week actually went. I'll turn your answers into suggestions you can
        accept or reject.
      </p>
      {loading ? (
        <p role="status" className="mt-2 text-sm text-muted-foreground">
          Loading your saved reflection…
        </p>
      ) : null}

      <div className="mt-4 space-y-4">
        {mockReflectionPrompts.map((prompt) => (
          <div key={prompt.id} className="space-y-1.5">
            <label className="text-sm font-medium">{prompt.question}</label>
            <Textarea
              rows={2}
              placeholder={prompt.placeholder}
              value={answers[prompt.id] ?? ""}
              disabled={loading}
              onChange={(event) =>
                setAnswers((prev) => ({ ...prev, [prompt.id]: event.target.value }))
              }
            />
          </div>
        ))}
      </div>

      <Button className="mt-4" disabled={saving || loading} onClick={() => onSubmit?.(answers)}>
        {saving ? "Saving…" : "Save reflection"}
      </Button>
    </section>
  );
}
