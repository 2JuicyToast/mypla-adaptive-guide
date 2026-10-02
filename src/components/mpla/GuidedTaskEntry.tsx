import { useRef, useState } from "react";
import { MessageSquarePlus, Send, Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { taskParseFailureStatus, type TaskParseStatus } from "@/lib/task-parse-status";
import type { EnergyLevel, Priority } from "@/lib/mpla-types";
import { TaskParseStatusCard } from "./TaskParseStatusCard";

const conversationalPrompts = [
  "Essay draft for HIST 145 by Friday, maybe two hours",
  "Lab quiz sometime this week, quick one",
  "Prep slides with my group before the 9th",
];

/**
 * Task entry surface with two modes:
 * - Conversational: free text, parsed by the backend later.
 * - Guided: explicit fields for people who'd rather fill a form.
 *
 * Both modes end in a preview the user confirms — the assistant never
 * creates a task silently.
 */
export function GuidedTaskEntry({
  onSubmitNaturalLanguage,
  onSubmitGuided,
  onReviewDraft,
  parseStatus = "idle",
  onParseStatusChange,
}: {
  onSubmitNaturalLanguage?: (text: string, signal: AbortSignal) => Promise<void>;
  onSubmitGuided?: (draft: {
    name: string;
    course: string;
    dueDate: string;
    estimatedMinutes: number;
    priority: Priority;
    energyRequired: EnergyLevel;
    firstAction: string;
  }) => void;
  onReviewDraft?: () => void;
  parseStatus?: TaskParseStatus;
  onParseStatusChange?: (status: TaskParseStatus) => void;
}) {
  const [text, setText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [activeTab, setActiveTab] = useState("conversational");
  const activeRequest = useRef<AbortController | null>(null);
  const [name, setName] = useState("");
  const [course, setCourse] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [estimate, setEstimate] = useState("45");
  const [priority, setPriority] = useState<Priority>("medium");
  const [energy, setEnergy] = useState<EnergyLevel>("medium");
  const [firstAction, setFirstAction] = useState("");

  async function prepareDraft(value = text) {
    const taskText = value.trim();
    if (!taskText || activeRequest.current) return;
    if (!onSubmitNaturalLanguage) {
      onParseStatusChange?.("unavailable");
      return;
    }

    const controller = new AbortController();
    activeRequest.current = controller;
    setParsing(true);
    onParseStatusChange?.("preparing");

    try {
      await onSubmitNaturalLanguage(taskText, controller.signal);
      if (controller.signal.aborted) return;
      setText("");
      onParseStatusChange?.("ready");
    } catch (error) {
      if (controller.signal.aborted) return;
      onParseStatusChange?.(taskParseFailureStatus(error));
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        setParsing(false);
      }
    }
  }

  function changeTab(value: string) {
    if (value === "guided" && parsing) {
      activeRequest.current?.abort();
      activeRequest.current = null;
      setParsing(false);
      onParseStatusChange?.("idle");
    }
    setActiveTab(value);
  }

  return (
    <section className="surface-panel p-5">
      <div className="flex items-center gap-2">
        <MessageSquarePlus className="size-5 text-primary" />
        <h2 className="text-lg font-semibold">Add something to your plan</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Describe it in your own words, or fill in the details yourself. You'll see what I understood
        before anything is saved.
      </p>

      <Tabs value={activeTab} onValueChange={changeTab} className="mt-4">
        <TabsList>
          <TabsTrigger value="conversational">Just tell me</TabsTrigger>
          <TabsTrigger value="guided">Fill in details</TabsTrigger>
        </TabsList>

        <TabsContent value="conversational" className="mt-4 space-y-3">
          <Textarea
            value={text}
            disabled={parsing}
            onChange={(event) => {
              setText(event.target.value);
              onParseStatusChange?.("idle");
            }}
            rows={3}
            placeholder="e.g. I need to finish my stats problem set before Friday, it usually takes me about an hour and a half"
          />
          <div className="flex flex-wrap gap-2">
            {conversationalPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                disabled={parsing}
                onClick={() => {
                  setText(prompt);
                  onParseStatusChange?.("idle");
                }}
                className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>
          <div className="rounded-lg border border-dashed border-proposal/40 bg-proposal-muted/40 p-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 font-medium text-proposal">
              <Wand2 className="size-3.5" />
              AI task draft
            </span>{" "}
            — only this task text is sent to OpenRouter to prepare an unsaved draft. Avoid including
            sensitive details; you can review and edit the result before saving.
          </div>
          <Button disabled={!text.trim() || parsing} onClick={() => void prepareDraft()}>
            <Send className="size-4" />
            {parsing ? "Preparing draft…" : "Prepare task draft"}
          </Button>
        </TabsContent>

        <TabsContent value="guided" className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Task name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Problem set 4"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Course (optional)</label>
              <Input
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                placeholder="STAT 210"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Due date</label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Estimated minutes</label>
              <Input
                type="number"
                min={5}
                step={5}
                value={estimate}
                onChange={(e) => setEstimate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Priority</label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Energy needed</label>
              <Select value={energy} onValueChange={(v) => setEnergy(v as EnergyLevel)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">First action</label>
            <Input
              value={firstAction}
              onChange={(e) => setFirstAction(e.target.value)}
              placeholder="Re-read the lecture notes"
            />
          </div>
          <Button
            disabled={!name.trim()}
            onClick={() => {
              onParseStatusChange?.("idle");
              onSubmitGuided?.({
                name: name.trim(),
                course: course.trim(),
                dueDate,
                estimatedMinutes: Number(estimate) || 0,
                priority,
                energyRequired: energy,
                firstAction: firstAction.trim(),
              });
            }}
          >
            Review this task
          </Button>
        </TabsContent>
      </Tabs>
      <TaskParseStatusCard
        status={parseStatus}
        onRetry={() => void prepareDraft()}
        onUseGuidedEntry={() => changeTab("guided")}
        onReviewDraft={() => onReviewDraft?.()}
      />
    </section>
  );
}
