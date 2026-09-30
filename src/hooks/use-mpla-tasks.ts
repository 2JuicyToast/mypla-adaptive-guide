import { useEffect, useState } from "react";

import { mockTasks } from "@/lib/mpla-mock-data";
import {
  completeTask as completeTaskRequest,
  createTask as createTaskRequest,
  getApiHealth,
  getTasks,
  type TaskDraft,
} from "@/lib/mypla-api";
import type { Task } from "@/lib/mpla-types";

export type TaskDataMode = "connecting" | "memory" | "supabase" | "sample";

export function useMyPlaTasks() {
  const [tasks, setTasks] = useState<Task[]>(mockTasks);
  const [mode, setMode] = useState<TaskDataMode>("connecting");
  const [notice, setNotice] = useState<string | null>(null);

  async function refresh() {
    try {
      const [health, latestTasks] = await Promise.all([getApiHealth(), getTasks()]);
      setTasks(latestTasks);
      setMode(health.storageMode);
      setNotice(null);
    } catch (error) {
      setMode("sample");
      setNotice(
        error instanceof Error
          ? `The API is unavailable, so sample tasks are shown. ${error.message}`
          : "The API is unavailable, so sample tasks are shown.",
      );
    }
  }

  useEffect(() => {
    let active = true;
    void Promise.all([getApiHealth(), getTasks()])
      .then(([health, latestTasks]) => {
        if (!active) return;
        setTasks(latestTasks);
        setMode(health.storageMode);
        setNotice(null);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setMode("sample");
        setNotice(
          error instanceof Error
            ? `The API is unavailable, so sample tasks are shown. ${error.message}`
            : "The API is unavailable, so sample tasks are shown.",
        );
      });
    return () => {
      active = false;
    };
  }, []);

  async function addTask(draft: TaskDraft) {
    const task = await createTaskRequest(draft);
    setTasks((current) => [task, ...current.filter((item) => item.id !== task.id)]);
    setMode((current) => current === "connecting" ? "memory" : current);
    return task;
  }

  async function finishTask(taskId: string) {
    const updated = await completeTaskRequest(taskId);
    setTasks((current) => current.map((item) => item.id === taskId ? updated : item));
    return updated;
  }

  return { tasks, mode, notice, setNotice, refresh, addTask, finishTask };
}