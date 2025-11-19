import { create } from 'zustand';
import type { ReportId } from './reports/config';

function load<T>(k: string, fallback: T): T {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save(k: string, v: any) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
}

type Tab = 'expenses' | 'incomes' | 'savings' | 'reports';

type State = {
  tab: Tab;
  year: number | null;
  theme: 'light' | 'dark';
  editMode: null | 'name' | 'order' | 'remove';
  pinSession: boolean;
  removeSelection: Set<number>;
  selectedReports: ReportId[];
  modals: {
    add: boolean;
    comment: { open: boolean; id: number | null; text: string };
    yearOps: boolean;
    export: boolean;
    settings: boolean;
    initiateYear: boolean;
  };
  goalModal: { open: boolean; goalId: number | null };
  setTab: (t: Tab) => void;
  setYear: (y: number | null) => void;
  setTheme: (m: 'light' | 'dark') => void;
  setEditMode: (m: State['editMode']) => void;
  setPinSession: (ok: boolean) => void;
  toggleRemoveId: (id: number) => void;
  clearRemove: () => void;
  toggleReport: (id: ReportId) => void;
  clearReports: () => void;
  openModal: (k: keyof State['modals']) => void;
  closeModal: (k: keyof State['modals']) => void;
  setComment: (id: number | null, text: string) => void;
  openGoalModal: (goalId?: number | null) => void;
  closeGoalModal: () => void;
};

export const useAppStore = create<State>((set, get) => ({
  tab: load<Tab>('tab', 'expenses'),
  year: load<number | null>('year', null),
  theme: load<'light' | 'dark'>('theme', 'light'),
  editMode: null,
  pinSession: false,
  removeSelection: new Set<number>(),
  selectedReports: load<ReportId[]>('selectedReports', []),
  modals: {
    add: false,
    comment: { open: false, id: null, text: '' },
    yearOps: false,
    export: false,
    settings: false,
    initiateYear: false,
  },
  goalModal: { open: false, goalId: null },

  setTab: (tab) => {
    save('tab', tab);
    set({ tab });
  },

  setYear: (year) => {
    save('year', year);
    set({ year });
  },

  setTheme: (theme) => {
    save('theme', theme);
    set({ theme });
  },

  setEditMode: (editMode) => set({ editMode }),

  setPinSession: (pinSession) => set({ pinSession }),

  toggleRemoveId: (id) => {
    const s = new Set(get().removeSelection);
    s.has(id) ? s.delete(id) : s.add(id);
    set({ removeSelection: s });
  },

  clearRemove: () => set({ removeSelection: new Set<number>() }),

  toggleReport: (id) => {
    const current = new Set(get().selectedReports);
    current.has(id) ? current.delete(id) : current.add(id);
    const arr = Array.from(current);
    save('selectedReports', arr);
    set({ selectedReports: arr });
  },

  clearReports: () => {
    save('selectedReports', []);
    set({ selectedReports: [] });
  },

  openModal: (k) =>
    set({
      modals: {
        ...get().modals,
        [k]:
          k === 'comment'
            ? { ...get().modals.comment, open: true }
            : true,
      } as any,
    }),

  closeModal: (k) =>
    set({
      modals: {
        ...get().modals,
        [k]:
          k === 'comment'
            ? { open: false, id: null, text: '' }
            : false,
      } as any,
    }),

  setComment: (id, text) =>
    set({
      modals: { ...get().modals, comment: { open: true, id, text } },
    }),

  openGoalModal: (goalId = null) =>
    set({
      goalModal: { open: true, goalId: goalId ?? null },
    }),

  closeGoalModal: () =>
    set({
      goalModal: { open: false, goalId: null },
    }),
}));
