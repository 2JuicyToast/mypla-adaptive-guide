/**
 * Placeholder data for the UI framework stage.
 * Replace each export with a call to the Python backend later.
 */
import type {
  AssumptionCheck,
  ExploreOpportunity,
  Proposal,
  ResourceRecommendation,
  ScheduleBlock,
  ScheduleNotification,
  StuckReason,
  Task,
  WeeklyReflectionPrompt,
} from "./mpla-types";

export const mockTasks: Task[] = [
  {
    id: "t1",
    name: "Statistics problem set 4",
    course: "STAT 210",
    priority: "high",
    dueDate: "2026-10-02",
    estimatedMinutes: 90,
    energyRequired: "high",
    status: "current",
    assistantNote: "Due in 2 days and it's your highest-effort open task.",
    actions: [
      { id: "t1a1", label: "Re-read lecture notes on confidence intervals", done: true },
      { id: "t1a2", label: "Work through questions 1–3", done: false, estimatedMinutes: 40 },
      { id: "t1a3", label: "Check answers with the study group", done: false },
    ],
  },
  {
    id: "t2",
    name: "Draft intro for research essay",
    course: "HIST 145",
    priority: "medium",
    dueDate: "2026-10-05",
    estimatedMinutes: 45,
    energyRequired: "medium",
    status: "current",
    assistantNote: "Small first step keeps the essay from piling up next week.",
    actions: [
      { id: "t2a1", label: "Pick the three sources you'll lean on", done: false, estimatedMinutes: 15 },
      { id: "t2a2", label: "Write a rough thesis sentence", done: false },
    ],
  },
  {
    id: "t3",
    name: "Lab safety quiz",
    course: "CHEM 120",
    priority: "low",
    dueDate: "2026-10-01",
    estimatedMinutes: 20,
    energyRequired: "low",
    status: "current",
    assistantNote: "Low energy — good filler for a gap between classes.",
    actions: [{ id: "t3a1", label: "Skim the safety handout, then take the quiz", done: false }],
  },
  {
    id: "t4",
    name: "Group project: slide deck",
    course: "BUS 230",
    priority: "high",
    dueDate: "2026-10-09",
    estimatedMinutes: 120,
    energyRequired: "medium",
    status: "upcoming",
    actions: [{ id: "t4a1", label: "Agree on the section split with your group", done: false }],
  },
  {
    id: "t5",
    name: "Reading: chapters 7–8",
    course: "HIST 145",
    priority: "medium",
    dueDate: "2026-10-11",
    estimatedMinutes: 60,
    energyRequired: "low",
    status: "upcoming",
    actions: [{ id: "t5a1", label: "Read chapter 7 and note two arguments", done: false }],
  },
  {
    id: "t6",
    name: "Book advisor meeting",
    priority: "medium",
    dueDate: "2026-10-14",
    estimatedMinutes: 10,
    energyRequired: "low",
    status: "upcoming",
    actions: [{ id: "t6a1", label: "Send the availability email", done: false }],
  },
];

export const mockProposals: Proposal[] = [
  {
    id: "p1",
    kind: "reschedule",
    title: "Move the essay draft to Thursday morning",
    rationale:
      "Wednesday evening already holds the statistics set, and mornings are when you usually finish writing tasks.",
    relatedTaskId: "t2",
    createdAt: "2026-09-30T08:10:00Z",
    changes: [{ field: "Planned slot", from: "Wed 19:00", to: "Thu 09:30" }],
  },
  {
    id: "p2",
    kind: "task-breakdown",
    title: "Split the slide deck into three smaller actions",
    rationale: "Two hours in one block rarely fits your weekday gaps.",
    relatedTaskId: "t4",
    createdAt: "2026-09-30T08:12:00Z",
    changes: [
      { field: "Actions", from: "1 action (120 min)", to: "3 actions (40 min each)" },
    ],
  },
];

export const mockAssumptions: AssumptionCheck[] = [
  {
    id: "a1",
    question: "Is the statistics problem set graded individually?",
    context: "That would change how much time I set aside for the study group step.",
    relatedTaskId: "t1",
  },
  {
    id: "a2",
    question: "Do you usually have energy for heavy reading after 20:00?",
    context: "I've been scheduling reading late in the evening.",
  },
];

export const mockExplore: ExploreOpportunity[] = [
  {
    id: "e1",
    title: "Practice a 5-minute presentation opener",
    category: "skill",
    description: "Useful before the BUS 230 group presentation later this month.",
    estimatedMinutes: 15,
    energyRequired: "medium",
  },
  {
    id: "e2",
    title: "Walk and clear your head",
    category: "wellbeing",
    description: "You've had three deep-focus blocks back to back today.",
    estimatedMinutes: 20,
    energyRequired: "low",
  },
  {
    id: "e3",
    title: "Tidy up your reference manager",
    category: "admin",
    description: "Makes the history essay citations quicker next week.",
    estimatedMinutes: 25,
    energyRequired: "low",
  },
  {
    id: "e4",
    title: "Browse summer internship listings",
    category: "career",
    description: "Applications for two programmes you saved open next month.",
    estimatedMinutes: 30,
    energyRequired: "medium",
  },
];

export const mockResources: ResourceRecommendation[] = [
  {
    id: "r1",
    title: "Confidence interval walkthrough (12 min)",
    type: "video",
    reason: "Matches the part of the problem set you paused on last time.",
    relatedTaskId: "t1",
  },
  {
    id: "r2",
    title: "Essay outline template",
    type: "template",
    reason: "You said outlines help you start writing faster.",
    relatedTaskId: "t2",
  },
  {
    id: "r3",
    title: "Focus timer with a 25/5 preset",
    type: "tool",
    reason: "Your completed sessions cluster around 25 minutes.",
  },
];

export const mockSchedule: ScheduleBlock[] = [
  { id: "s1", label: "Commute", start: "08:15", end: "08:45", kind: "commute" },
  { id: "s2", label: "STAT 210 lecture", start: "09:00", end: "10:30", kind: "class" },
  { id: "s3", label: "Free gap", start: "10:30", end: "11:30", kind: "free" },
  { id: "s4", label: "HIST 145 seminar", start: "11:30", end: "13:00", kind: "class" },
  { id: "s5", label: "Lunch", start: "13:00", end: "13:45", kind: "break" },
  {
    id: "s6",
    label: "Study: statistics problem set",
    start: "14:00",
    end: "15:30",
    kind: "study",
    taskId: "t1",
  },
  { id: "s7", label: "CHEM 120 lab", start: "15:45", end: "17:30", kind: "class" },
  { id: "s8", label: "Dinner & downtime", start: "18:00", end: "19:30", kind: "personal" },
  { id: "s9", label: "Free gap", start: "19:30", end: "21:00", kind: "free" },
];

export const mockReflectionPrompts: WeeklyReflectionPrompt[] = [
  {
    id: "w1",
    question: "Which task felt heavier than you expected this week?",
    placeholder: "The statistics set took two sittings instead of one…",
  },
  {
    id: "w2",
    question: "When did you actually get your best focused work done?",
    placeholder: "Mornings before my first class…",
  },
  {
    id: "w3",
    question: "Anything the assistant got wrong that you'd like changed?",
    placeholder: "Stop scheduling reading after 20:00…",
  },
];

export const mockNotifications: ScheduleNotification[] = [
  {
    id: "n1",
    message: "Your 14:00 study block starts in 15 minutes. Still a good time?",
    time: "13:45",
    relatedTaskId: "t1",
    options: ["Start now", "Push 30 min", "Not today"],
  },
  {
    id: "n2",
    message: "You have a free gap at 19:30. Want a suggestion for it?",
    time: "19:15",
    options: ["Suggest something", "Keep it free"],
  },
];

export const stuckReasons: StuckReason[] = [
  {
    id: "sr1",
    label: "I don't know where to start",
    description: "The task feels too big or vague right now.",
  },
  {
    id: "sr2",
    label: "I'm missing something",
    description: "Notes, a file, an answer from someone else.",
  },
  {
    id: "sr3",
    label: "It's harder than expected",
    description: "The estimate or difficulty seems off.",
  },
  {
    id: "sr4",
    label: "I don't have the energy",
    description: "Right task, wrong moment.",
  },
];
