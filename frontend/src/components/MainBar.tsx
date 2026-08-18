import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Api } from '../api';
import { useAppStore } from '../store';
import { YearDropdown } from './YearDropdown';
import { DropdownMenu, DropdownItem } from './DropdownMenu';
import { SoftButton } from './SoftButton';
import { Surface } from './Surface';
import { VersionIndicator } from './VersionIndicator';

const TABS: Array<{
  id: 'expenses' | 'incomes' | 'savings' | 'reports';
  label: string;
  icon?: string;
}> = [
  { id: 'expenses', label: 'Expenses', icon: '/icons/ui/credit-card-pay.svg' },
  { id: 'incomes', label: 'Incomes', icon: '/icons/ui/wallet.svg' },
  { id: 'savings', label: 'Savings', icon: '/icons/ui/pig-money.svg' },
  { id: 'reports', label: 'Reports', icon: '/icons/ui/report-analytics.svg' },
];

export function MainBar() {
  const {
    tab,
    setTab,
    year,
    setYear,
    theme,
    setTheme,
    searchQuery,
    setSearchQuery,
    editMode,
    setEditMode,
    removeSelection,
    groupRemoveSelection,
    clearRemove,
    requestBulkRemove,
    setPinSession,
    openGoalModal,
    openAddEntry,
  } = useAppStore();

  const yearsQ = useQuery({ queryKey: ['years'], queryFn: Api.years.list });
  const years = (yearsQ.data?.years ?? []) as number[];

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
    if (!year || !years.includes(year)) {
      setYear(years[years.length - 1]);
    }
  }, [years, year, setYear]);

  const viewTitle =
    tab === 'incomes'
      ? 'Income overview'
      : tab === 'savings'
      ? 'Savings goals'
      : tab === 'reports'
      ? 'Financial story'
      : 'Expense overview';
  const scopeCaption = year
    ? `Working on year ${year}`
    : 'Pick a year to unlock entries.';

  const lockSession = () => {
    void Api.logoutPin().catch(() => {});
    sessionStorage.removeItem('pin-token');
    sessionStorage.removeItem('pin-ok');
    setPinSession(false);
  };

  const nextThemeIcon = theme === 'light' ? '/icons/ui/moon-stars.svg' : '/icons/ui/sun.svg';

  const mobileUtilityButtons = (
    <>
      <SoftButton
        variant="ghost"
        className="utility-button utility-button-sm topbar-icon-button"
        aria-label="Lock session"
        onClick={lockSession}
      >
        <img src="/icons/ui/lock.svg" alt="" className="topbar-action-icon" aria-hidden="true" />
      </SoftButton>
      <SoftButton
        variant="ghost"
        className="utility-button utility-button-sm topbar-icon-button"
        aria-label="Toggle theme"
        onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
      >
        <span key={theme} className="theme-icon inline-block">
          <img src={nextThemeIcon} alt="" className="topbar-action-icon" aria-hidden="true" />
        </span>
      </SoftButton>
    </>
  );

  const menuIconLabel = (
    <img
      src="/icons/ui/menu-2.svg"
      alt=""
      className="utility-menu-icon"
      aria-hidden="true"
    />
  );

  const menuItemLabel = (icon: string, text: string) => (
    <span className="dropdown-item-label">
      <img src={icon} alt="" className="dropdown-item-icon" aria-hidden="true" />
      <span>{text}</span>
    </span>
  );

  const actionButtonLabel = (icon: string, text: string) => (
    <span className="mainbar-action-label">
      <span
        className="mainbar-action-icon"
        aria-hidden="true"
        style={{
          WebkitMaskImage: `url("${icon}")`,
          maskImage: `url("${icon}")`,
        }}
      />
      <span>{text}</span>
    </span>
  );

  const renderUtilityControls = (
    mode: 'mobile' | 'desktop' = 'desktop',
    options: { includeMenu?: boolean } = {}
  ) => {
    const includeMenu = options.includeMenu ?? true;
    const compact = mode === 'mobile';
    return (
      <div className={`utility-cluster ${compact ? 'utility-cluster-sm' : ''}`}>
        <div className={`utility-row ${compact ? 'utility-row-sm' : ''}`}>
          <SoftButton
            variant="ghost"
            className={`utility-button ${compact ? 'utility-button-sm' : ''} topbar-icon-button`}
            aria-label="Lock session"
            onClick={lockSession}
          >
            <img src="/icons/ui/lock.svg" alt="" className="topbar-action-icon" aria-hidden="true" />
          </SoftButton>
          <SoftButton
            variant="ghost"
            className={`utility-button ${compact ? 'utility-button-sm' : ''} topbar-icon-button`}
            aria-label="Toggle theme"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          >
            <span key={theme} className="theme-icon inline-block">
              <img src={nextThemeIcon} alt="" className="topbar-action-icon" aria-hidden="true" />
            </span>
          </SoftButton>
          {includeMenu && (
            <DropdownMenu
              label={menuIconLabel}
              align="right"
              buttonClassName={`utility-menu-btn utility-menu-icon-btn ${compact ? 'utility-menu-btn-sm' : ''}`}
              buttonAriaLabel="Menu"
              buttonTooltip="Menu"
              showCaret={false}
            >
              {({ close }) => (
                <>
                  <DropdownItem onSelect={() => { openModal('yearOps'); close(); }}>
                    {menuItemLabel('/icons/ui/calendar-month.svg', 'Year operations')}
                  </DropdownItem>
                  <DropdownItem onSelect={() => { openModal('export'); close(); }}>
                    {menuItemLabel('/icons/ui/table-export.svg', 'Export data')}
                  </DropdownItem>
                  <DropdownItem onSelect={() => { openModal('import'); close(); }}>
                    {menuItemLabel('/icons/ui/table-import.svg', 'Import data')}
                  </DropdownItem>
                  <DropdownItem onSelect={() => { openModal('settings'); close(); }}>
                    {menuItemLabel('/icons/ui/settings.svg', 'Settings')}
                  </DropdownItem>
                </>
              )}
            </DropdownMenu>
          )}
        </div>
        {mode === 'desktop' && (
          <div className={`version-indicator-slot ${compact ? 'version-indicator-slot-sm' : ''}`}>
            <VersionIndicator compact={compact} />
          </div>
        )}
      </div>
    );
  };

  const exitEditMode = () => {
    if (editMode === 'remove') {
      clearRemove();
    }
    setEditMode(null);
  };

  const selectAction = (nextMode: 'order' | 'remove' | 'tag') => {
    if (searchQuery) setSearchQuery('');
    if (editMode === nextMode) {
      exitEditMode();
      return;
    }
    if (editMode === 'remove') clearRemove();
    setEditMode(nextMode);
  };

  const actionLabel =
    editMode === 'order'
      ? 'Arrange'
      : editMode === 'remove'
      ? 'Remove'
      : editMode === 'tag'
      ? 'Tags'
      : null;
  const searchDisabled = tab === 'reports';
  const searchActive = Boolean(searchQuery.trim());
  const searchPlaceholder = tab === 'expenses'
    ? 'Search expenses'
    : tab === 'incomes'
    ? 'Search incomes'
    : tab === 'savings'
    ? 'Search savings'
    : 'Search';

  const primaryActions = (
    <>
      {editMode ? (
        <SoftButton
          type="button"
          variant="warning"
          className="w-full md:w-auto mobile-primary mainbar-action-control context-finish-button"
          onClick={exitEditMode}
        >
          Close
        </SoftButton>
      ) : (
        <DropdownMenu
          label={actionButtonLabel('/icons/ui/square-plus.svg', 'New')}
          block
          buttonClassName="mobile-primary mainbar-action-control context-new-button"
        >
          {({ close }) => (
            <>
              <DropdownItem onSelect={() => { openAddEntry(null); close(); }}>
                {menuItemLabel('/icons/ui/text-plus.svg', 'Entry')}
              </DropdownItem>
              <DropdownItem onSelect={() => { openModal('addGroup'); close(); }}>
                {menuItemLabel('/icons/ui/category-plus.svg', 'Group')}
              </DropdownItem>
            </>
          )}
        </DropdownMenu>
      )}
      <DropdownMenu
        label={actionButtonLabel('/icons/ui/automation.svg', actionLabel ? `Actions · ${actionLabel}` : 'Actions')}
        align="right"
        block
        buttonClassName={`mobile-primary mainbar-action-control context-actions-button ${editMode ? 'context-action-active' : ''}`}
        showCaret={!editMode}
      >
        {({ close }) => (
          <>
            <DropdownItem onSelect={() => { selectAction('order'); close(); }}>
              {menuItemLabel('/icons/ui/arrows-sort.svg', 'Arrange')}
            </DropdownItem>
            <DropdownItem onSelect={() => { selectAction('remove'); close(); }}>
              {menuItemLabel('/icons/ui/trash.svg', 'Remove')}
            </DropdownItem>
            <DropdownItem onSelect={() => { selectAction('tag'); close(); }}>
              {menuItemLabel('/icons/ui/tag.svg', 'Tags')}
            </DropdownItem>
          </>
        )}
      </DropdownMenu>
      {editMode === 'remove' && (
        <SoftButton
          type="button"
          variant="danger"
          className="w-full md:w-auto mobile-primary mainbar-action-control context-remove-selected-button"
          disabled={removeSelection.size === 0 && groupRemoveSelection.size === 0}
          onClick={requestBulkRemove}
        >
          Remove selected
        </SoftButton>
      )}
    </>
  );

  useEffect(() => {
    if ((tab === 'reports' || tab === 'savings') && editMode) setEditMode(null);
  }, [tab, editMode, setEditMode]);

  const savingsActions = (
    <button
      type="button"
      className="btn w-full md:w-auto mobile-primary mainbar-action-control"
      onClick={() => openGoalModal()}
      disabled={!year}
    >
      {actionButtonLabel('/icons/ui/target-arrow.svg', 'Add goal')}
    </button>
  );

  const renderActions = () => {
    if (tab === 'reports') return null;
    if (tab === 'savings') return savingsActions;
    return primaryActions;
  };

  return (
    <div className="py-2">
      <Surface className="stack gap-4 mainbar-shell">
        <div className="mainbar-update-float">
          <VersionIndicator compact />
        </div>
        <div className="flex flex-col gap-3 md:grid md:grid-cols-[1fr_auto_1fr] md:items-start">
          <div className="stack-sm hidden md:flex md:flex-col md:justify-self-start mainbar-desktop-only">
            <h2 className="type-title-xl">{viewTitle}</h2>
            <p className="type-body-sm text-textSec">{scopeCaption}</p>
          </div>
          <div className="hidden md:flex items-center justify-center md:justify-self-center md:self-start mainbar-desktop-only">
            <img
              src="/icon-128x128.png"
              alt="MOPAY"
              className="mainbar-logo h-[76px] w-auto object-contain drop-shadow-lg"
            />
          </div>
          <div className="hidden md:flex items-center gap-2 justify-end md:justify-self-end utility-group mainbar-desktop-only">
            {renderUtilityControls('desktop', { includeMenu: false })}
          </div>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4 mainbar-tabs-row">
          <div className="chip-group mainbar-tabs" role="tablist" aria-label="Entries view">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                className={`chip-button ${tab === item.id ? 'active' : ''}`}
                onClick={() => {
                  if (item.id !== tab && editMode) exitEditMode();
                  setTab(item.id);
                }}
              >
                {item.icon && (
                  <span
                    className="chip-button-icon"
                    aria-hidden="true"
                    style={{
                      WebkitMaskImage: `url("${item.icon}")`,
                      maskImage: `url("${item.icon}")`,
                    }}
                  />
                )}
                <span>{item.label}</span>
              </button>
            ))}
          </div>
          <div className={`mainbar-search ${searchActive ? 'is-active' : ''} ${searchDisabled ? 'is-disabled' : ''}`}>
            <label className="sr-only" htmlFor="mainbar-search-input">
              {searchPlaceholder}
            </label>
            <span className="mainbar-search-icon" aria-hidden="true" />
            <input
              id="mainbar-search-input"
              type="search"
              className="mainbar-search-input"
              value={searchQuery}
              placeholder={searchPlaceholder}
              disabled={searchDisabled}
              autoComplete="off"
              spellCheck={false}
              maxLength={80}
              onChange={(event) => {
                if (editMode) exitEditMode();
                setSearchQuery(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  setSearchQuery('');
                  event.currentTarget.blur();
                }
              }}
            />
            {searchActive && !searchDisabled && (
              <button
                type="button"
                className="mainbar-search-clear"
                aria-label="Clear search"
                onClick={() => setSearchQuery('')}
              >
                ×
              </button>
            )}
            <span className="sr-only" aria-live="polite">
              {searchActive ? 'Current view is filtered' : 'Showing all items'}
            </span>
          </div>
          <div className="flex flex-col gap-2 w-full md:w-auto mainbar-mobile-controls">
            <div className="flex flex-col gap-2 md:hidden mainbar-mobile-only">
              <div className="flex flex-wrap items-center gap-2 mainbar-mobile-top-row">
                <YearDropdown
                  years={years}
                  value={year}
                  onChange={(y) => setYear(y)}
                  className="mainbar-year-dropdown mainbar-year-dropdown-mobile"
                  triggerClassName="utility-menu-btn utility-menu-btn-sm soft-button"
                />
                <DropdownMenu
                  label={menuIconLabel}
                  align="left"
                  buttonClassName="utility-menu-btn utility-menu-icon-btn utility-menu-btn-sm"
                  buttonAriaLabel="Menu"
                  buttonTooltip="Menu"
                  showCaret={false}
                >
                  {({ close }) => (
                    <>
                      <DropdownItem onSelect={() => { openModal('yearOps'); close(); }}>
                        {menuItemLabel('/icons/ui/calendar-month.svg', 'Year operations')}
                      </DropdownItem>
                      <DropdownItem onSelect={() => { openModal('export'); close(); }}>
                        {menuItemLabel('/icons/ui/table-export.svg', 'Export data')}
                      </DropdownItem>
                      <DropdownItem onSelect={() => { openModal('import'); close(); }}>
                        {menuItemLabel('/icons/ui/table-import.svg', 'Import data')}
                      </DropdownItem>
                      <DropdownItem onSelect={() => { openModal('settings'); close(); }}>
                        {menuItemLabel('/icons/ui/settings.svg', 'Settings')}
                      </DropdownItem>
                    </>
                  )}
                </DropdownMenu>
                <div className="mainbar-mobile-inline-utils mainbar-mobile-inline-utils-push">
                  {mobileUtilityButtons}
                </div>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-2 md:max-w-xs mainbar-desktop-only">
              <YearDropdown
                years={years}
                value={year}
                onChange={(y) => setYear(y)}
                className="w-full mainbar-year-dropdown"
              />
              <DropdownMenu
                label={menuIconLabel}
                align="right"
                buttonClassName="utility-menu-btn utility-menu-icon-btn"
                buttonAriaLabel="Menu"
                buttonTooltip="Menu"
                showCaret={false}
              >
                {({ close }) => (
                  <>
                    <DropdownItem onSelect={() => { openModal('yearOps'); close(); }}>
                      {menuItemLabel('/icons/ui/calendar-month.svg', 'Year operations')}
                    </DropdownItem>
                    <DropdownItem onSelect={() => { openModal('export'); close(); }}>
                      {menuItemLabel('/icons/ui/table-export.svg', 'Export data')}
                    </DropdownItem>
                    <DropdownItem onSelect={() => { openModal('import'); close(); }}>
                      {menuItemLabel('/icons/ui/table-import.svg', 'Import data')}
                    </DropdownItem>
                    <DropdownItem onSelect={() => { openModal('settings'); close(); }}>
                      {menuItemLabel('/icons/ui/settings.svg', 'Settings')}
                    </DropdownItem>
                  </>
                )}
              </DropdownMenu>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-2 mainbar-actions-row">
          <div className="mainbar-actions">
            {renderActions()}
          </div>
          <div className="mainbar-compact-utilities">
            <div className="mainbar-compact-icons">
              {mobileUtilityButtons}
            </div>
          </div>
        </div>
      </Surface>
    </div>
  );
}
