import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Api } from '../../api';
import { useAppStore } from '../../store';

export type Section = 'expenses' | 'incomes' | 'savings' | 'reports';
export type EditMode = 'order' | 'remove';

// 'reports' stays the internal key of Overview (plan D2).
export const SECTIONS: Array<{ id: Section; label: string; icon: string; maskIcon: string }> = [
  { id: 'reports', label: 'Overview', icon: 'home', maskIcon: '/icons/ui/home.svg' },
  { id: 'expenses', label: 'Expenses', icon: 'credit-card-pay', maskIcon: '/icons/ui/credit-card-pay.svg' },
  { id: 'incomes', label: 'Incomes', icon: 'wallet', maskIcon: '/icons/ui/wallet.svg' },
  { id: 'savings', label: 'Savings', icon: 'pig-money', maskIcon: '/icons/ui/pig-money.svg' },
];

export function useYears() {
  const pinSession = useAppStore((s) => s.pinSession);
  const yearsQ = useQuery({ queryKey: ['years'], queryFn: Api.years.list, enabled: pinSession });
  return { yearsQ, years: (yearsQ.data?.years ?? []) as number[] };
}

/** App-wide effects that used to live in MainBar: first-run year, year guard, mode reset. */
export function useShellEffects() {
  const { yearsQ, years } = useYears();
  const year = useAppStore((s) => s.year);
  const setYear = useAppStore((s) => s.setYear);
  const tab = useAppStore((s) => s.tab);
  const editMode = useAppStore((s) => s.editMode);
  const setEditMode = useAppStore((s) => s.setEditMode);
  const openModal = useAppStore((s) => s.openModal);
  const closeModal = useAppStore((s) => s.closeModal);
  const initiateYear = useAppStore((s) => s.modals.initiateYear);

  useEffect(() => {
    if (!yearsQ.isSuccess) return;
    if (years.length === 0 && !initiateYear) openModal('initiateYear');
    if (years.length > 0 && initiateYear) closeModal('initiateYear');
  }, [yearsQ.isSuccess, years, initiateYear, openModal, closeModal]);

  useEffect(() => {
    if (!years.length) return;
    if (!year || !years.includes(year)) setYear(years[years.length - 1]);
  }, [years, year, setYear]);

  useEffect(() => {
    if ((tab === 'reports' || tab === 'savings') && editMode) setEditMode(null);
  }, [tab, editMode, setEditMode]);

  useSearchShortcut();
}

/** `/` and Ctrl/Cmd+K focus the visible search field, never stealing focus from editors or dialogs. */
function useSearchShortcut() {
  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      const shortcut = (!event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && event.key === '/')
        || ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'k');
      if (!shortcut || event.defaultPrevented || event.isComposing || event.repeat) return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')) return;
      // Dialogs, entry details and the PIN overlay are all aria-modal.
      if (!useAppStore.getState().pinSession || document.querySelector('[aria-modal="true"]')) return;
      const input = [...document.querySelectorAll<HTMLInputElement>('input[data-app-search]')]
        .find((node) => node.getClientRects().length && !node.disabled);
      if (!input) {
        // Below 960 px search sits behind an icon (plan D13): open it, it takes focus.
        const toggle = [...document.querySelectorAll<HTMLButtonElement>('button[data-app-search-toggle]')]
          .find((node) => node.getClientRects().length && !node.disabled);
        if (!toggle) return;
        event.preventDefault();
        toggle.click();
        return;
      }
      event.preventDefault();
      input.focus();
      input.select();
    };
    document.addEventListener('keydown', focusSearch);
    return () => document.removeEventListener('keydown', focusSearch);
  }, []);
}

/** Navigation, edit modes, search and session actions shared by the sidebar shell and the mobile bar. */
export function useShellActions() {
  const tab = useAppStore((s) => s.tab);
  const setTab = useAppStore((s) => s.setTab);
  const editMode = useAppStore((s) => s.editMode);
  const setEditMode = useAppStore((s) => s.setEditMode);
  const clearRemove = useAppStore((s) => s.clearRemove);
  const searchQuery = useAppStore((s) => s.searchQuery);
  const setSearchQuery = useAppStore((s) => s.setSearchQuery);
  const setPinSession = useAppStore((s) => s.setPinSession);

  const exitEditMode = () => {
    if (editMode === 'remove') clearRemove();
    setEditMode(null);
  };

  const selectEditMode = (next: EditMode) => {
    if (searchQuery) setSearchQuery('');
    if (editMode === next) {
      exitEditMode();
      return;
    }
    if (editMode === 'remove') clearRemove();
    setEditMode(next);
  };

  const goTo = (next: Section) => {
    if (next !== tab && editMode) exitEditMode();
    setTab(next);
  };

  const changeSearch = (value: string) => {
    if (editMode) exitEditMode();
    setSearchQuery(value);
  };

  const lockSession = () => {
    void Api.logoutPin().catch(() => {});
    sessionStorage.removeItem('pin-token');
    sessionStorage.removeItem('pin-ok');
    setPinSession(false);
  };

  const searchPlaceholder = tab === 'expenses'
    ? 'Search expenses'
    : tab === 'incomes'
    ? 'Search incomes'
    : tab === 'savings'
    ? 'Search savings'
    : 'Search';

  return { tab, editMode, exitEditMode, selectEditMode, goTo, searchQuery, changeSearch, setSearchQuery, lockSession, searchPlaceholder };
}
