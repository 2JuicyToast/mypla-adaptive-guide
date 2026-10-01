import { useCallback, useEffect, useState } from "react";

import { mockTasks } from "@/lib/mpla-mock-data";
import {
  completeTaskAction as completeTaskActionRequest,
  completeTask as completeTaskRequest,
  createTask as createTaskRequest,
  getApiHealth,
  getTasks,
  type ApiHealth,
  type TaskDraft,
} from "@/lib/mypla-api";
import type { Task } from "@/lib/mpla-types";

export type TaskDataMode = "connecting" | "memory" | "supabase" | "sample";

export function useMyPlaTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [mode, setMode] = useState<TaskDataMode>("connecting");
  const [notice, setNotice] = useState<string | null>(null);

  const loadTasks = useCallback(async (isActive: () => boolean = () => true) => {
    let health: ApiHealth;
    try {
      health = await getApiHealth();
      if (!isActive()) return;
      setMode(health.storageMode);
    } catch (error) {
      if (!isActive()) return;
      setMode("sample");
      setTasks(mockTasks);
      setNotice(
        `The API is unavailable, so sample tasks are shown. ${
          error instanceof Error ? error.message : "The request failed."
        }`,
      );
      return;
    }

    try {
      const latestTasks = await getTasks();
      if (!isActive()) return;
      setTasks(latestTasks);
      setNotice(null);
    } catch (error) {
      if (!isActive()) return;
      setTasks(mockTasks);
      setNotice(
        health.persistent
          ? `MyPLA API storage mode: supabase; persistent: true. Saved tasks could not be loaded. ${
              error instanceof Error ? error.message : "The request failed."
            }`
          : `The API is unavailable, so sample tasks are shown. ${
              error instanceof Error ? error.message : "The request failed."
            }`,
      );
    }
  }, []);

  async function refresh() {
    await loadTasks();
  }

  useEffect(() => {
    let active = true;
    void loadTasks(() => active);
    return () => {
      active = false;
    };
  }, [loadTasks]);

  async function addTask(draft: TaskDraft) {
    const task = await createTaskRequest(draft);
    setTasks((current) => [task, ...current.filter((item) => item.id !== task.id)]);
    setMode((current) => (current === "connecting" ? "memory" : current));
    return task;
  }

  async function finishTask(taskId: string) {
    const updated = await completeTaskRequest(taskId);
    setTasks((current) => current.map((item) => (item.id === taskId ? updated : item)));
    return updated;
  }

  async function finishAction(taskId: string, actionId: string) {
    const updated = await completeTaskActionRequest(taskId, actionId);
    setTasks((current) => current.map((item) => (item.id === taskId ? updated : item)));
    return updated;
  }

  return { tasks, mode, notice, setNotice, refresh, addTask, finishTask, finishAction };
}
