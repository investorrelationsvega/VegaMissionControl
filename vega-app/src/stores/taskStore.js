// ═══════════════════════════════════════════════
// VEGA MISSION CONTROL — Task Store
// CRUD operations for tasks with filtering
// ═══════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { tasks } from '../data/seedData';

const useTaskStore = create(
  persist(
    (set, get) => ({
      // State
      tasks,

      // ── Getters ─────────────────────────────────────────────────────────────
      getAll: () => get().tasks,

      getById: (id) => get().tasks.find((t) => t.id === id) || null,

      getByStatus: (status) => get().tasks.filter((t) => t.status === status),

      getByAssignee: (assignee) =>
        get().tasks.filter((t) => t.assignee === assignee),

      getByPriority: (priority) =>
        get().tasks.filter((t) => t.priority === priority),

      getByInvestor: (invId) =>
        get().tasks.filter((t) => t.linkedInvestor === invId),

      getByFund: (fundId) =>
        get().tasks.filter((t) => t.linkedFund === fundId),

      getOverdue: () => {
        const now = new Date().toISOString().slice(0, 10);
        return get().tasks.filter(
          (t) => t.status !== 'Done' && t.dueDate < now,
        );
      },

      // ── Mutations ───────────────────────────────────────────────────────────
      add: (task) =>
        set((state) => ({
          tasks: [
            ...state.tasks,
            {
              ...task,
              id: `T${String(state.tasks.length + 1).padStart(2, '0')}`,
              status: task.status || 'To Do',
            },
          ],
        })),

      update: (id, updates) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id ? { ...t, ...updates } : t,
          ),
        })),

      complete: (id) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id ? { ...t, status: 'Done' } : t,
          ),
        })),

      remove: (id) =>
        set((state) => ({
          tasks: state.tasks.filter((t) => t.id !== id),
        })),
    }),
    {
      name: 'vega-task-store',
      version: 1,
    },
  ),
);

export default useTaskStore;
