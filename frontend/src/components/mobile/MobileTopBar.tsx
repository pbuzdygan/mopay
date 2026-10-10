import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../store';
import { Button, Icon, IconButton, Menu, type MenuItem } from '../ui';
import { SECTIONS, useShellActions } from '../shell/useShell';

// Top bar below 960 px (plan Phase 8): title, search behind an icon (D13) and
// the page actions menu (D14). Navigation lives in the bottom tab bar.
export function MobileTopBar() {
  const demo = useAppStore((s) => s.demo);
  const year = useAppStore((s) => s.year);
  const settingsOpen = useAppStore((s) => s.settingsOpen);
  const openAddEntry = useAppStore((s) => s.openAddEntry);
  const openModal = useAppStore((s) => s.openModal);
  const openGoalModal = useAppStore((s) => s.openGoalModal);
  const { tab, editMode, selectEditMode, exitEditMode, searchQuery, changeSearch, setSearchQuery, searchPlaceholder } = useShellActions();
  const [searchOpen, setSearchOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchable = !settingsOpen && tab !== 'reports';
  const table = !settingsOpen && (tab === 'expenses' || tab === 'incomes');
  const title = settingsOpen ? 'Settings' : SECTIONS.find((section) => section.id === tab)?.label ?? '';
  const showSearch = searchable && (searchOpen || Boolean(searchQuery));

  useEffect(() => {
    if (!searchable) setSearchOpen(false);
  }, [searchable]);

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  const closeSearch = () => {
    setSearchQuery('');
    setSearchOpen(false);
  };

  const actions: MenuItem[] = [
    { label: 'New entry', icon: 'square-plus', onSelect: () => openAddEntry(null), disabled: !year },
    { label: 'New group', icon: 'folder', onSelect: () => openModal('addGroup') },
    { label: 'Arrange', icon: 'arrows-sort', onSelect: () => selectEditMode('order'), separatorBefore: true },
    { label: 'Remove', icon: 'trash', onSelect: () => selectEditMode('remove') },
  ];

  if (showSearch) {
    return (
      <div className="mtop is-search">
        <div className="mtop-search">
          <Icon name="list-search" size="sm" />
          <label className="sr-only" htmlFor="mobile-search-input">{searchPlaceholder}</label>
          <input
            ref={inputRef}
            id="mobile-search-input"
            data-app-search
            type="search"
            value={searchQuery}
            placeholder={searchPlaceholder}
            aria-keyshortcuts="/ Control+k Meta+k"
            autoComplete="off"
            spellCheck={false}
            maxLength={80}
            onChange={(event) => changeSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                closeSearch();
              }
            }}
          />
          <span className="sr-only" aria-live="polite">{searchQuery.trim() ? 'Current view is filtered' : 'Showing all items'}</span>
        </div>
        <IconButton icon="x" label="Close search" tooltip={false} onClick={closeSearch} />
      </div>
    );
  }

  return (
    <div className="mtop">
      <h1 className="mtop-title">
        {title} {!settingsOpen && year && <span>{year}</span>}
      </h1>
      <div className="mtop-actions">
        {searchable && (
          <IconButton icon="list-search" label="Search" tooltip={false} data-app-search-toggle onClick={() => setSearchOpen(true)} />
        )}
        {table && !demo && (editMode ? (
          <Button size="sm" variant="primary" icon="check" onClick={exitEditMode}>Done</Button>
        ) : (
          <Menu label="Actions" ariaLabel="Actions" icon="dots" iconOnly caret={false} variant="ghost" items={actions} />
        ))}
        {!settingsOpen && tab === 'savings' && !demo && (
          <IconButton icon="target-arrow" label="New goal" tooltip={false} disabled={!year} onClick={() => openGoalModal()} />
        )}
      </div>
    </div>
  );
}
