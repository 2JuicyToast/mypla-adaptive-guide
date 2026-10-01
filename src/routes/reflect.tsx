import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

import { AiSuggestionPanel } from "@/components/mpla/AiSuggestionPanel";
import { MyPlaShell } from "@/components/mpla/MyPlaShell";
import { WeeklyReflectionPanel } from "@/components/mpla/WeeklyReflectionPanel";
import { useMyPlaPlanningData } from "@/hooks/use-mypla-planning-data";
import {
  getReflections,
  resolveProposal,
  saveReflection,
  type ApiReflection,
} from "@/lib/mypla-api";

export const Route = createFileRoute("/reflect")({
  head: () => ({
    meta: [
      { title: "Weekly reflection — MyPLA" },
      {
        name: "description",
        content: "Look back on your week so MyPLA can adapt to how you work.",
      },
      { property: "og:title", content: "Weekly reflection — MyPLA" },
      {
        property: "og:description",
        content: "Reflect once a week; approve the changes that follow.",
      },
    ],
  }),
  component: ReflectPage,
});

function ReflectPage() {
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeError, setNoticeError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingReflection, setLoadingReflection] = useState(true);
  const [reflectionLoadError, setReflectionLoadError] = useState<string | null>(null);
  const [hasSavedReflection, setHasSavedReflection] = useState(false);
  const [initialAnswers, setInitialAnswers] = useState<Record<string, string>>({});
  const planningData = useMyPlaPlanningData();

  const loadReflection = useCallback(async () => {
    setLoadingReflection(true);
    setReflectionLoadError(null);
    try {
      const reflections = await getReflections();
      const saved = reflections.find((reflection) => reflection.week === currentWeek());
      setHasSavedReflection(Boolean(saved));
      setInitialAnswers(saved ? reflectionToAnswers(saved) : {});
      setNotice(null);
      setNoticeError(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Your saved reflection could not be loaded.";
      setReflectionLoadError(message);
    } finally {
      setLoadingReflection(false);
    }
  }, []);

  useEffect(() => {
    void loadReflection();
  }, [loadReflection]);

  async function submitReflection(answers: Record<string, string>) {
    if (loadingReflection || reflectionLoadError) return;
    setSaving(true);
    setNotice(null);
    setNoticeError(false);
    try {
      await saveReflection({
        week: currentWeek(),
        summary: "",
        whatWentWell: answers.whatWentWell ?? "",
        challenges: answers.challenges ?? "",
        helpfulStrategies: answers.helpfulStrategies ?? "",
        thingsToRemember: answers.thingsToRemember ?? "",
      });
      setInitialAnswers(answers);
      setHasSavedReflection(true);
      setNotice("Your reflection has been saved.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Your reflection could not be saved.");
      setNoticeError(true);
    } finally {
      setSaving(false);
    }
  }

  async function decideProposal(
    proposalId: string,
    decision: "approve" | "reject" | "adjust",
    changes?: Record<string, unknown>,
  ) {
    try {
      const proposal = await resolveProposal(proposalId, decision, changes);
      await planningData.refresh();
      setNotice(`Proposal ${proposal.status}.`);
      setNoticeError(false);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The proposal could not be updated.");
      setNoticeError(true);
    }
  }

  return (
    <MyPlaShell title="Weekly reflection" subtitle="How the week actually went, in your words.">
      {notice ? (
        <p
          role={noticeError ? "alert" : "status"}
          className="mb-4 rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm"
        >
          {notice}
        </p>
      ) : null}
      {planningData.error ? (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm"
        >
          Planning suggestions could not be loaded: {planningData.error}
        </p>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <WeeklyReflectionPanel
            onSubmit={(answers) => void submitReflection(answers)}
            onRetry={() => void loadReflection()}
            saving={saving}
            loading={loadingReflection}
            loadError={reflectionLoadError}
            hasSavedReflection={hasSavedReflection}
            initialAnswers={initialAnswers}
          />
        </div>
        <AiSuggestionPanel
          proposals={planningData.proposals}
          loading={planningData.loading}
          onApprove={(proposal) => void decideProposal(proposal.id, "approve")}
          onDecline={(proposal) => void decideProposal(proposal.id, "reject")}
          onAdjust={(proposal, changes) => void decideProposal(proposal.id, "adjust", changes)}
        />
      </div>
    </MyPlaShell>
  );
}

function currentWeek() {
  const monday = new Date();
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return [
    monday.getFullYear(),
    String(monday.getMonth() + 1).padStart(2, "0"),
    String(monday.getDate()).padStart(2, "0"),
  ].join("-");
}

function reflectionToAnswers(reflection: ApiReflection) {
  return {
    challenges: reflection.challenges,
    whatWentWell: reflection.whatWentWell,
    helpfulStrategies: reflection.helpfulStrategies,
    thingsToRemember: reflection.thingsToRemember,
  };
}
