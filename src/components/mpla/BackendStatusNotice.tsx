import type { TaskDataMode } from "@/hooks/use-mpla-tasks";

export function BackendStatusNotice({
  mode,
  notice,
}: {
  mode: TaskDataMode;
  notice?: string | null;
}) {
  if (notice) {
    return (
      <p
        role="alert"
        className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-foreground"
      >
        {notice}
      </p>
    );
  }

  if (mode === "connecting") {
    return (
      <p
        role="status"
        className="mb-4 rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground"
      >
        Connecting to the MyPLA API…
      </p>
    );
  }

  const connected = mode === "memory" || mode === "supabase";
  const text =
    mode === "supabase"
      ? "Connected to your user-scoped Supabase database. MyPLA API storage mode: supabase; persistent: true."
      : mode === "memory"
        ? "Using temporary demo data in memory. Sample tasks are not persistent; changes reset when the API restarts."
        : "The API is unavailable. Showing read-only sample tasks; these are not your saved tasks.";

  return (
    <p
      role="status"
      className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
        connected
          ? "border-primary/20 bg-primary/5 text-foreground"
          : "border-destructive/30 bg-destructive/5 text-foreground"
      }`}
    >
      {text}
    </p>
  );
}
