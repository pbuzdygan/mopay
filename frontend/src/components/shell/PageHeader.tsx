import { useQuery } from '@tanstack/react-query';
import { Api } from '../../api';
import { useAppStore } from '../../store';
import { Button, Icon, Menu, type MenuItem } from '../ui';
import { SECTIONS, useShellActions, type EditMode } from './useShell';

const MODE_LABELS: Record<EditMode, string> = { order: 'Arrange', remove: 'Remove' };

function SearchField() {
  const { searchQuery, changeSearch, setSearchQuery, searchPlaceholder } = useShellActions();
  const active = Boolean(searchQuery.trim());
  return (
    <div className={`page-search ${active ? 'is-active' : ''}`}>
      <label className="sr-only" htmlFor="page-search-input">{searchPlaceholder}</label>
      <Icon name="list-search" size="sm" />
      <input
        id="page-search-input"
        data-app-search
        type="search"
        value={searchQuery}
        placeholder={searchPlaceholder}
        title="Search (/ or Ctrl/Cmd+K)"
        aria-keyshortcuts="/ Control+k Meta+k"
        autoComplete="off"
        spellCheck={false}
        maxLength={80}
        onChange={(event) => changeSearch(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            setSearchQuery('');
            event.currentTarget.blur();
          }
        }}
      />
      {active
        ? <button type="button" className="page-search-clear" aria-label="Clear search" onClick={() => setSearchQuery('')}><Icon name="x" size="sm" /></button>
        : <kbd className="page-search-kbd" aria-hidden="true">/</kbd>}
      <span className="sr-only" aria-live="polite">{active ? 'Current view is filtered' : 'Showing all items'}</span>
    </div>
  );
}

function useSubtitle(tab: string, year: number | null) {
  const enabled = Boolean(year) && (tab === 'expenses' || tab === 'incomes');
  const type = tab === 'incomes' ? 'income' : 'expense';
  const entries = useQuery({ enabled, queryKey: ['entries', type, year], queryFn: () => Api.entries.list(type, year!) });
  const groups = useQuery({ enabled, queryKey: ['entry-groups', type, year], queryFn: () => Api.entryGroups.list(type, year!) });
  const savings = useQuery({ enabled: Boolean(year) && tab === 'savings', queryKey: ['savings', year], queryFn: () => Api.savings.list(year!) });
  if (!year) return 'Select a working year to start.';
  if (tab === 'reports') return `Your year at a glance, compared with ${year - 1}.`;
  if (tab === 'savings') {
    const count = savings.data?.goals?.length;
    return count === undefined ? 'Savings goals for the working year.' : `${count} ${count === 1 ? 'goal' : 'goals'}`;
  }
  const entryCount = entries.data?.entries?.length;
  const groupCount = groups.data?.groups?.length;
  if (entryCount === undefined || groupCount === undefined) return tab === 'incomes' ? 'Monthly incomes.' : 'Monthly expenses.';
  return `${entryCount} ${entryCount === 1 ? 'entry' : 'entries'} in ${groupCount} ${groupCount === 1 ? 'group' : 'groups'}`;
}

export function PageHeader() {
  const demo = useAppStore((s) => s.demo);
  const year = useAppStore((s) => s.year);
  const openAddEntry = useAppStore((s) => s.openAddEntry);
  const openModal = useAppStore((s) => s.openModal);
  const openGoalModal = useAppStore((s) => s.openGoalModal);
  const { tab, editMode, selectEditMode, exitEditMode } = useShellActions();
  const title = SECTIONS.find((section) => section.id === tab)?.label ?? '';
  const subtitle = useSubtitle(tab, year);
  const table = tab === 'expenses' || tab === 'incomes';
  const settingsOpen = useAppStore((s) => s.settingsOpen);

  const editItems: MenuItem[] = [
    { label: 'Arrange', icon: 'arrows-sort', onSelect: () => selectEditMode('order') },
    { label: 'Remove', icon: 'trash', onSelect: () => selectEditMode('remove') },
  ];

  if (settingsOpen) {
    return (
      <div className="page-head">
        <div className="page-title">
          <h1>Settings</h1>
          <p>Preferences, data and security for this MOPAY installation.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-head">
      <div className="page-title">
        <h1>{title} {year && <span>{year}</span>}</h1>
        <p>{subtitle}</p>
      </div>
      {tab !== 'reports' && (
        <div className="page-toolbar">
          <SearchField />
          {!demo && table && (
            <>
              <Menu
                label={editMode ? `Edit · ${MODE_LABELS[editMode]}` : 'Edit'}
                icon="edit"
                items={editItems}
              />
              {editMode ? (
                <Button variant="primary" icon="check" onClick={exitEditMode}>Done</Button>
              ) : (
                <div className="ui-split">
                  <Button variant="primary" icon="square-plus" disabled={!year} onClick={() => openAddEntry(null)}>New entry</Button>
                  <Menu
                    label="More create options"
                    ariaLabel="More create options"
                    icon="chevron-down"
                    iconOnly
                    caret={false}
                    variant="primary"
                    items={[{ label: 'New group', icon: 'folder', onSelect: () => openModal('addGroup') }]}
                  />
                </div>
              )}
            </>
          )}
          {!demo && tab === 'savings' && (
            <Button variant="primary" icon="target-arrow" disabled={!year} onClick={() => openGoalModal()}>New goal</Button>
          )}
        </div>
      )}
    </div>
  );
}
