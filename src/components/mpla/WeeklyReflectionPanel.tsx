import { useEffect, useState } from "react";
import { NotebookPen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const reflectionPrompts = [
  {
    id: "whatWentWell",
    question: "What went well this week?",
    placeholder: "Describe something that worked for you.",
  },
  {
    id: "challenges",
    question: "What challenges or difficulties came up?",
    placeholder: "Note what made the week harder.",
  },
  {
    id: "helpfulStrategies",
    question: "What strategies or supports were helpful?",
    placeholder: "Include routines, tools, or people that helped.",
  },
  {
    id: "thingsToRemember",
    question: "What is worth remembering for next week?",
    placeholder: "Write down anything you want to carry forward.",
  },
];

export function WeeklyReflectionPanel({
  onSubmit,
  onRetry,
  saving = false,
  loading = false,
  loadError = null,
  hasSavedReflection = false,
  initialAnswers = {},
}: {
  onSubmit?: (answers: Record<string, string>) => void;
  onRetry?: () => void;
  saving?: boolean;
  loading?: boolean;
  loadError?: string | null;
  hasSavedReflection?: boolean;
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
      {loadError ? (
        <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <p role="alert" className="text-sm">
            {loadError}
          </p>
          <Button className="mt-2" size="sm" variant="outline" onClick={onRetry}>
            Retry loading
          </Button>
        </div>
      ) : null}
      {!loading && !loadError && !hasSavedReflection ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No reflection has been saved for this week yet.
        </p>
      ) : null}

      <div className="mt-4 space-y-4">
        {reflectionPrompts.map((prompt) => (
          <div key={prompt.id} className="space-y-1.5">
            <label htmlFor={`reflection-${prompt.id}`} className="text-sm font-medium">
              {prompt.question}
            </label>
            <Textarea
              id={`reflection-${prompt.id}`}
              rows={2}
              placeholder={prompt.placeholder}
              value={answers[prompt.id] ?? ""}
              disabled={loading || Boolean(loadError)}
              onChange={(event) =>
                setAnswers((prev) => ({ ...prev, [prompt.id]: event.target.value }))
              }
            />
          </div>
        ))}
      </div>

      <Button
        className="mt-4"
        disabled={saving || loading || Boolean(loadError)}
        onClick={() => onSubmit?.(answers)}
      >
        {saving ? "Saving…" : "Save reflection"}
      </Button>
    </section>
  );
}
