import { useState, useEffect } from "react";
import { API_URL } from "@/lib/config";

export interface TaskHistoryEntry {
    date: string;
    action: string;
    user: string;
    comment?: string;
    attachment_url?: string;
    attachment_name?: string;
}

export interface TaskSubtask {
    id: string;
    title: string;
    completed: boolean;
}

export interface Task {
    id: string;
    title: string;
    description: string;
    assigned_to: string;
    priority: string;
    due_date: string;
    status: string;
    category?: string;
    created_at: string;
    completed_at?: string;
    history?: TaskHistoryEntry[];
    tags?: string[];
    subtasks?: TaskSubtask[];
    meeting_link?: string;
    recurrence?: string;
}

export function useTasks() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchTasks = async (background = false) => {
        if (!background) setIsLoading(true);
        try {
            const response = await fetch(`${API_URL}/api/tasks/`);
            if (!response.ok) throw new Error("Failed to fetch tasks");
            const data = await response.json();
            setTasks(data.data || []);
            setError(null);
        } catch (err: any) {
            setError(err.message);
        } finally {
            if (!background) setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchTasks();
    }, []);

    const createTask = async (taskData: Partial<Task>) => {
        try {
            const response = await fetch(`${API_URL}/api/tasks/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(taskData)
            });
            if (!response.ok) throw new Error("Failed to create task");
            await fetchTasks(true);
            return true;
        } catch (err) {
            console.error(err);
            return false;
        }
    };

    const updateTask = async (id: string, updates: Partial<Task>) => {
        // Optimistic UI update for immediate drag-and-drop feel
        setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));

        try {
            const response = await fetch(`${API_URL}/api/tasks/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updates)
            });
            if (!response.ok) throw new Error("Failed to update task");
            // Se sincroniza en background
            fetchTasks(true);
            return true;
        } catch (err) {
            console.error(err);
            // Revert changes on error
            fetchTasks(true);
            return false;
        }
    };

    const deleteTask = async (id: string) => {
        try {
            const response = await fetch(`${API_URL}/api/tasks/${id}`, {
                method: "DELETE"
            });
            if (!response.ok) throw new Error("Failed to delete task");
            await fetchTasks(true);
            return true;
        } catch (err) {
            console.error(err);
            return false;
        }
    };

    return { tasks, isLoading, error, fetchTasks, createTask, updateTask, deleteTask };
}
