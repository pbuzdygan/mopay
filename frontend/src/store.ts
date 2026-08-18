import { create } from 'zustand';

function normalizeVersion(value: string | null | undefined) {
  if (!value) return null;
  return value.trim().replace(/^v/i, '');
}

function isDevVersion(value: string | null) {
  if (!value) return false;
  return /^dev/i.test(value);
}

function parseVersionParts(value: string | null) {
  if (!value) return [];
  return value
    .split(/[^0-9]+/g)
    .filter(Boolean)
    .map((part) => Number(part) || 0);
}

function parseDevVersionParts(value: string | null) {
  if (!value) return [];
  const normalized = value.replace(/^dev[-_]?/i, '');
  return parseVersionParts(normalized);
}

function compareNumericParts(leftParts: number[], rightParts: number[]) {
  const len = Math.max(leftParts.length, rightParts.length);
  for (let i = 0; i < len; i++) {
    const left = leftParts[i] ?? 0;
    const right = rightParts[i] ?? 0;
    if (left > right) return 1;
    if (left < right) return -1;
  }
  return 0;
}

export function compareVersions(a: string | null, b: string | null) {
  const left = normalizeVersion(a);
  const right = normalizeVersion(b);
  const leftIsDev = isDevVersion(left);
  const rightIsDev = isDevVersion(right);

  if (leftIsDev || rightIsDev) {
    if (leftIsDev && !rightIsDev) return -1;
    if (!leftIsDev && rightIsDev) return 1;
    const diff = compareNumericParts(parseDevVersionParts(left), parseDevVersionParts(right));
    if (diff !== 0) return diff;
    return (left || '').localeCompare(right || '');
  }

  if (!left && !right) return 0;
  if (!left) return -1;
  if (!right) return 1;
  return compareNumericParts(parseVersionParts(left), parseVersionParts(right));
}

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
type ViewMode = 'normal' | 'compact';

type State = {
  tab: Tab;
  year: number | null;
  theme: 'light' | 'dark';
  viewMode: ViewMode;
  searchQuery: string;
  showGroupTotals: boolean;
  editMode: null | 'order' | 'remove' | 'tag';
  addEntryGroupId: number | null;
  pinSession: boolean;
  removeSelection: Set<number>;
  groupRemoveSelection: Set<number>;
  bulkRemoveRequestId: number;
  modals: {
    add: boolean;
    comment: { open: boolean; id: number | null; text: string };
    yearOps: boolean;
    export: boolean;
    import: boolean;
    settings: boolean;
    addGroup: boolean;
    initiateYear: boolean;
  };
  goalModal: { open: boolean; goalId: number | null };
  migrationNotice: { open: boolean; message: string };
  keyMismatch: boolean;
  appVersion: string | null;
  latestVersion: string | null;
  latestReleaseUrl: string | null;
  releaseChannel: string;
  updateAvailable: boolean;
  setTab: (t: Tab) => void;
  setYear: (y: number | null) => void;
  setTheme: (m: 'light' | 'dark') => void;
  setViewMode: (mode: ViewMode) => void;
  setSearchQuery: (query: string) => void;
  setEditMode: (m: State['editMode']) => void;
  setPinSession: (ok: boolean) => void;
  toggleRemoveId: (id: number) => void;
  toggleRemoveGroupId: (id: number) => void;
  clearRemove: () => void;
  requestBulkRemove: () => void;
  openModal: (k: keyof State['modals']) => void;
  openAddEntry: (groupId?: number | null) => void;
  closeModal: (k: keyof State['modals']) => void;
  setComment: (id: number | null, text: string) => void;
  openGoalModal: (goalId?: number | null) => void;
  closeGoalModal: () => void;
  setMigrationNotice: (open: boolean, message?: string) => void;
  setKeyMismatch: (active: boolean) => void;
  setAppVersion: (version: string | null) => void;
  setLatestVersion: (version: string | null) => void;
  setLatestReleaseUrl: (url: string | null) => void;
  setReleaseChannel: (channel: string | null) => void;
  setShowGroupTotals: (active: boolean) => void;
};

export const useAppStore = create<State>((set, get) => ({
  tab: load<Tab>('tab', 'expenses'),
  year: load<number | null>('year', null),
  theme: load<'light' | 'dark'>('theme', 'light'),
  viewMode: load<ViewMode>('viewMode', 'normal'),
  searchQuery: '',
  showGroupTotals: load<boolean>('showGroupTotals', false),
  editMode: null,
  addEntryGroupId: null,
  pinSession: false,
  removeSelection: new Set<number>(),
  groupRemoveSelection: new Set<number>(),
  bulkRemoveRequestId: 0,
  modals: {
    add: false,
    comment: { open: false, id: null, text: '' },
    yearOps: false,
    export: false,
    import: false,
    settings: false,
    addGroup: false,
    initiateYear: false,
  },
  goalModal: { open: false, goalId: null },
  migrationNotice: { open: false, message: '' },
  keyMismatch: false,
  appVersion: null,
  latestVersion: null,
  latestReleaseUrl: null,
  releaseChannel: 'main',
  updateAvailable: false,

  setTab: (tab) => {
    save('tab', tab);
    set((state) => state.tab === tab ? { tab } : { tab, searchQuery: '' });
  },

  setYear: (year) => {
    save('year', year);
    set({ year });
  },

  setTheme: (theme) => {
    save('theme', theme);
    set({ theme });
  },

  setViewMode: (viewMode) => {
    save('viewMode', viewMode);
    set({ viewMode });
  },

  setSearchQuery: (searchQuery) => set({ searchQuery }),

  setShowGroupTotals: (showGroupTotals) => {
    save('showGroupTotals', showGroupTotals);
    set({ showGroupTotals });
  },

  setEditMode: (editMode) => set({ editMode }),

  setPinSession: (pinSession) => set({ pinSession }),

  toggleRemoveId: (id) => {
    const s = new Set(get().removeSelection);
    s.has(id) ? s.delete(id) : s.add(id);
    set({ removeSelection: s });
  },

  toggleRemoveGroupId: (id) => {
    const s = new Set(get().groupRemoveSelection);
    s.has(id) ? s.delete(id) : s.add(id);
    set({ groupRemoveSelection: s });
  },

  clearRemove: () => set({ removeSelection: new Set<number>(), groupRemoveSelection: new Set<number>() }),

  requestBulkRemove: () =>
    set((state) => ({
      bulkRemoveRequestId: state.bulkRemoveRequestId + 1,
    })),

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

  openAddEntry: (groupId = null) =>
    set({
      addEntryGroupId: groupId,
      modals: { ...get().modals, add: true },
    }),

  closeModal: (k) =>
    set({
      ...(k === 'add' ? { addEntryGroupId: null } : {}),
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

  setMigrationNotice: (open, message = '') =>
    set({
      migrationNotice: { open, message },
    }),

  setKeyMismatch: (active) => set({ keyMismatch: active }),

  setAppVersion: (version) =>
    set((state) => ({
      appVersion: version,
      updateAvailable: compareVersions(version, state.latestVersion) < 0,
    })),

  setLatestVersion: (version) =>
    set((state) => ({
      latestVersion: version,
      updateAvailable: compareVersions(state.appVersion, version) < 0,
    })),

  setLatestReleaseUrl: (url) => set({ latestReleaseUrl: url }),

  setReleaseChannel: (channel) =>
    set((state) => {
      const normalized = channel ?? 'main';
      if (state.releaseChannel === normalized) {
        return {};
      }
      return {
        releaseChannel: normalized,
        latestVersion: null,
        latestReleaseUrl: null,
        updateAvailable: false,
      };
    }),
}));
