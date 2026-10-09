import { useAppStore } from '../store';
import { YearDropdown } from './YearDropdown';
import { DropdownMenu, DropdownItem } from './DropdownMenu';
import { SoftButton } from './SoftButton';
import { Surface } from './Surface';
import { VersionIndicator } from './VersionIndicator';
import { SECTIONS, useShellActions, useYears } from './shell/useShell';

// Mobile toolbar (<960 px) until the mobile layout replaces it (plan Phase 8).
// App-wide effects and the search shortcut live in shell/useShell.
export function MainBar() {
  const {
    year,
    setYear,
    theme,
    setTheme,
    openGoalModal,
    openAddEntry,
  } = useAppStore();
  const {
    tab,
    editMode,
    exitEditMode,
    selectEditMode: selectAction,
    goTo,
    searchQuery,
    changeSearch,
    setSearchQuery,
    lockSession,
    searchPlaceholder,
  } = useShellActions();

  const demo = useAppStore((s) => s.demo);
  const { years } = useYears();
  const openModal = useAppStore((s) => s.openModal);
  const settingsOpen = useAppStore((s) => s.settingsOpen);
  const openSettings = useAppStore((s) => s.openSettings);

  const viewTitle =
    settingsOpen
      ? 'Settings'
      : tab === 'incomes'
      ? 'Income overview'
      : tab === 'savings'
      ? 'Savings goals'
      : tab === 'reports'
      ? 'Overview'
      : 'Expense overview';
  const scopeCaption = year
    ? `Working on year ${year}`
    : 'Pick a year to unlock entries.';

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

  // Settings page (plan Phase 7) replaces the former menu with its dialogs.
  const settingsIconLabel = (
    <img
      src="/icons/ui/settings.svg"
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

  const renderUtilityControls = (mode: 'mobile' | 'desktop' = 'desktop') => {
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
        </div>
        {mode === 'desktop' && (
          <div className={`version-indicator-slot ${compact ? 'version-indicator-slot-sm' : ''}`}>
            <VersionIndicator compact={compact} />
          </div>
        )}
      </div>
    );
  };

  const actionLabel =
    editMode === 'order'
      ? 'Arrange'
      : editMode === 'remove'
      ? 'Remove'
      : null;
  const searchDisabled = tab === 'reports' || settingsOpen;
  const searchActive = Boolean(searchQuery.trim());

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
          </>
        )}
      </DropdownMenu>
    </>
  );

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
    if (demo || tab === 'reports' || settingsOpen) return null;
    if (tab === 'savings') return savingsActions;
    return primaryActions;
  };

  const renderSearch = (location: 'desktop' | 'mobile') => (
    <div className={`mainbar-search mainbar-search-${location} ${location === 'desktop' ? 'mainbar-desktop-only' : ''} ${searchActive ? 'is-active' : ''} ${searchDisabled ? 'is-disabled' : ''}`}>
      <label className="sr-only" htmlFor={`mainbar-search-${location}`}>
        {searchPlaceholder}
      </label>
      <span className="mainbar-search-icon" aria-hidden="true" />
      <input
        id={`mainbar-search-${location}`}
        data-app-search
        aria-keyshortcuts="/ Control+k Meta+k"
        title="Search (/ or Ctrl/Cmd+K)"
        type="search"
        className="mainbar-search-input"
        value={searchQuery}
        placeholder={searchPlaceholder}
        disabled={searchDisabled}
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
  );

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
            {renderUtilityControls('desktop')}
          </div>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4 mainbar-tabs-row">
          <div className="chip-group mainbar-tabs" role="tablist" aria-label="Entries view">
            {SECTIONS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={!settingsOpen && tab === item.id}
                className={`chip-button ${!settingsOpen && tab === item.id ? 'active' : ''}`}
                onClick={() => goTo(item.id)}
              >
                <span
                  className="chip-button-icon"
                  aria-hidden="true"
                  style={{
                    WebkitMaskImage: `url("${item.maskIcon}")`,
                    maskImage: `url("${item.maskIcon}")`,
                  }}
                />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
          {renderSearch('desktop')}
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
                <button
                  type="button"
                  className="utility-menu-btn utility-menu-icon-btn utility-menu-btn-sm"
                  aria-label="Settings"
                  title="Settings"
                  aria-current={settingsOpen ? 'page' : undefined}
                  onClick={openSettings}
                >
                  {settingsIconLabel}
                </button>
                {renderSearch('mobile')}
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
              <button
                type="button"
                className="utility-menu-btn utility-menu-icon-btn"
                aria-label="Settings"
                title="Settings"
                aria-current={settingsOpen ? 'page' : undefined}
                onClick={openSettings}
              >
                {settingsIconLabel}
              </button>
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
