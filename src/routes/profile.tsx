import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, Clock3, Mail, RotateCcw, ShieldCheck, UserRound } from "lucide-react";
import { useState } from "react";

import { MyPlaShell } from "@/components/mpla/MyPlaShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useMyPlaAuth } from "@/hooks/use-mypla-auth";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — MyPLA" },
      { name: "description", content: "Preview your MyPLA profile and study preferences." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { enabled, user } = useMyPlaAuth();
  const accountName = getAccountName(user?.user_metadata?.full_name, user?.email);
  const [displayName, setDisplayName] = useState(accountName);
  const [program, setProgram] = useState("General Studies");
  const [weeklyHours, setWeeklyHours] = useState("6");
  const [focus, setFocus] = useState("Build a steady study routine");

  const initials =
    displayName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase() || "MP";
  const goal = Number(weeklyHours);
  const weeklyProgress = Number.isFinite(goal) ? Math.min(100, (goal / 12) * 100) : 0;

  function resetSample() {
    setDisplayName(accountName);
    setProgram("General Studies");
    setWeeklyHours("6");
    setFocus("Build a steady study routine");
  }

  return (
    <MyPlaShell
      title="Your profile"
      subtitle="A sample profile for your MyPLA account and study preferences."
    >
      <div className="space-y-5">
        <Card className="overflow-hidden">
          <div className="h-2 bg-gradient-to-r from-primary via-teal-500 to-sky-400" />
          <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
            <div
              aria-hidden="true"
              className="grid size-16 shrink-0 place-items-center rounded-2xl bg-secondary text-xl font-semibold text-secondary-foreground"
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant="secondary">Profile preview</Badge>
                <Badge variant={enabled ? "default" : "outline"}>
                  {enabled ? "Account connected" : "Demo mode"}
                </Badge>
              </div>
              <h2 className="truncate text-xl font-semibold">{displayName || "Your name"}</h2>
              <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="size-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{user?.email ?? "Local demo account"}</span>
              </p>
            </div>
            <div className="rounded-xl bg-muted/70 px-4 py-3 text-sm">
              <p className="text-xs text-muted-foreground">Study program</p>
              <p className="mt-1 font-medium">{program || "Not set"}</p>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <UserRound className="size-5 text-primary" aria-hidden="true" />
                    Profile details
                  </CardTitle>
                  <CardDescription className="mt-2">
                    Edit these sample details to preview your profile.
                  </CardDescription>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={resetSample}>
                  <RotateCcw className="mr-2 size-4" aria-hidden="true" />
                  Reset sample
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="profile-name" className="text-sm font-medium">
                  Display name
                </label>
                <Input
                  id="profile-name"
                  autoComplete="name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Your name"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="profile-program" className="text-sm font-medium">
                  Program or area of study
                </label>
                <Input
                  id="profile-program"
                  value={program}
                  onChange={(event) => setProgram(event.target.value)}
                  placeholder="For example, Biology"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="profile-focus" className="text-sm font-medium">
                  Current study focus
                </label>
                <Input
                  id="profile-focus"
                  value={focus}
                  onChange={(event) => setFocus(event.target.value)}
                  placeholder="What are you working toward?"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="profile-weekly-hours" className="text-sm font-medium">
                  Weekly study goal
                </label>
                <div className="flex items-center gap-3">
                  <Input
                    id="profile-weekly-hours"
                    type="number"
                    min={0}
                    max={40}
                    value={weeklyHours}
                    onChange={(event) => setWeeklyHours(event.target.value)}
                    className="max-w-32"
                  />
                  <span className="text-sm text-muted-foreground">hours per week</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="size-5 text-primary" aria-hidden="true" />
                  Study snapshot
                </CardTitle>
                <CardDescription>A live preview of the sample preferences above.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock3 className="size-4" aria-hidden="true" />
                      Weekly goal
                    </span>
                    <span className="font-semibold">
                      {weeklyHours || "0"} {weeklyHours === "1" ? "hour" : "hours"}
                    </span>
                  </div>
                  <Progress
                    value={weeklyProgress}
                    aria-label="Weekly study goal compared with a 12-hour sample target"
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    Compared with a 12-hour sample target.
                  </p>
                </div>
                <div className="rounded-xl border bg-muted/40 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Current focus
                  </p>
                  <p className="mt-2 font-medium">{focus || "Add a focus to see it here."}</p>
                </div>
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <div className="flex gap-3">
                    <ShieldCheck
                      className="mt-0.5 size-5 shrink-0 text-primary"
                      aria-hidden="true"
                    />
                    <p className="text-sm text-muted-foreground">
                      Profile fields are preview-only. They stay in this page’s state and reset
                      when you leave or refresh; they are not saved to Supabase.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MyPlaShell>
  );
}

function getAccountName(metadataName: unknown, email: string | undefined) {
  if (typeof metadataName === "string" && metadataName.trim()) return metadataName.trim();
  return email?.split("@")[0] || "MyPLA Student";
}