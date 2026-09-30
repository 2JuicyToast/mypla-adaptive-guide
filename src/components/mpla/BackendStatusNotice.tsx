import type { TaskDataMode } from "@/hooks/use-mpla-tasks";

export function BackendStatusNotice({
  mode,
  notice,
}: {
  mode: TaskDataMode;
  notice?: string | null;
}) {
  if (mode === "connecting") {
    return (
      <p className="mb-4 rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
        Connecting to the MyPLA API…
      </p>
    );
  }

  const connected = mode === "memory" || mode === "supabase";
  const text = notice
    ?? (mode === "supabase"
      ? "Connected to your user-scoped Supabase database."
      : mode === "memory"
        ? "Using temporary Replit memory storage. Changes reset when the API restarts."
        : "Showing the original sample tasks.");

  return (
    <p
      role={notice ? "alert" : "status"}
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