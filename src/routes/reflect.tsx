import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

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
  const [saving, setSaving] = useState(false);
  const [loadingReflection, setLoadingReflection] = useState(true);
  const [initialAnswers, setInitialAnswers] = useState<Record<string, string>>({});
  const planningData = useMyPlaPlanningData();

  useEffect(() => {
    let active = true;
    void getReflections().then(
      (reflections) => {
        if (!active) return;
        const saved = reflections.find((reflection) => reflection.week === currentWeek());
        if (saved) setInitialAnswers(reflectionToAnswers(saved));
        setLoadingReflection(false);
      },
      (error: unknown) => {
        if (!active) return;
        setNotice(
          error instanceof Error ? error.message : "Your saved reflection could not be loaded.",
        );
        setLoadingReflection(false);
      },
    );
    return () => {
      active = false;
    };
  }, []);

  async function submitReflection(answers: Record<string, string>) {
    setSaving(true);
    setNotice(null);
    try {
      await saveReflection({
        week: currentWeek(),
        summary: "",
        whatWentWell: answers["w2"] ?? "",
        challenges: answers["w1"] ?? "",
        helpfulStrategies: "",
        thingsToRemember: answers["w3"] ?? "",
      });
      setInitialAnswers(answers);
      setNotice("Your reflection has been saved.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Your reflection could not be saved.");
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
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The proposal could not be updated.");
    }
  }

  return (
    <MyPlaShell title="Weekly reflection" subtitle="How the week actually went, in your words.">
      {notice ? (
        <p
          role="status"
          className="mb-4 rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm"
        >
          {notice}
        </p>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <WeeklyReflectionPanel
            onSubmit={(answers) => void submitReflection(answers)}
            saving={saving}
            loading={loadingReflection}
            initialAnswers={initialAnswers}
          />
        </div>
        <AiSuggestionPanel
          proposals={planningData.proposals}
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
    w1: reflection.challenges,
    w2: reflection.whatWentWell,
    w3: reflection.thingsToRemember,
  };
}
