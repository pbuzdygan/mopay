import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Api } from '../api';
import { useAppStore } from '../store';
import { YearDropdown } from './YearDropdown';
import { DropdownMenu, DropdownItem } from './DropdownMenu';
import { SoftButton } from './SoftButton';
import { Surface } from './Surface';
import { REPORT_DEFINITIONS } from '../reports/config';
import { VersionIndicator } from './VersionIndicator';

const TABS: Array<{ id: 'expenses' | 'incomes' | 'savings' | 'reports'; label: string }> = [
  { id: 'expenses', label: 'Expenses' },
  { id: 'incomes', label: 'Incomes' },
  { id: 'savings', label: 'Savings' },
  { id: 'reports', label: 'Reports' },
];

export function MainBar() {
  const {
    tab,
    setTab,
    year,
    setYear,
    theme,
    setTheme,
    editMode,
    setEditMode,
    removeSelection,
    groupRemoveSelection,
    clearRemove,
    setPinSession,
    selectedReports,
    toggleReport,
    openGoalModal,
  } = useAppStore();
  const [tagHintVisible, setTagHintVisible] = useState(false);

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

  const mobileUtilityButtons = (
    <>
      <SoftButton
        variant="ghost"
        className="utility-button utility-button-sm"
        aria-label="Lock session"
        onClick={lockSession}
      >
        🔒
      </SoftButton>
      <SoftButton
        variant="ghost"
        className="utility-button utility-button-sm"
        aria-label="Toggle theme"
        onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
      >
        <span key={theme} className="theme-icon inline-block">
          {theme === 'light' ? '🌙' : '☀️'}
        </span>
      </SoftButton>
    </>
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
            className={`utility-button ${compact ? 'utility-button-sm' : ''}`}
            aria-label="Lock session"
            onClick={lockSession}
          >
            🔒
          </SoftButton>
          <SoftButton
            variant="ghost"
            className={`utility-button ${compact ? 'utility-button-sm' : ''}`}
            aria-label="Toggle theme"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          >
            <span key={theme} className="theme-icon inline-block">
              {theme === 'light' ? '🌙' : '☀️'}
            </span>
          </SoftButton>
          {includeMenu && (
            <DropdownMenu
              label="Menu"
              align="right"
              buttonClassName={`utility-menu-btn ${compact ? 'utility-menu-btn-sm' : ''}`}
            >
              {({ close }) => (
                <>
                  <DropdownItem onSelect={() => { openModal('yearOps'); close(); }}>
                    Year operations
                  </DropdownItem>
                  <DropdownItem onSelect={() => { openModal('export'); close(); }}>
                    Export data
                  </DropdownItem>
                  <DropdownItem onSelect={() => { openModal('import'); close(); }}>
                    Import data
                  </DropdownItem>
                  <DropdownItem onSelect={() => { openModal('settings'); close(); }}>
                    Settings
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

  const editLabelMap: Record<string, string> = {
    name: 'Change name',
    group: 'Change group',
    order: 'Change order',
    remove: 'Remove entry',
    tag: 'Tags',
  } as any;
  const editMenuLabel = editMode ? (editLabelMap[editMode] ?? 'Edit mode') : 'Edit mode';

  const exitEditMode = () => {
    if (editMode === 'remove') {
      clearRemove();
    }
    setEditMode(null);
  };

  const primaryActions = (
    <>
      <div className="edit-actions-wrap w-full md:w-auto">
        <div className={`grid grid-cols-2 gap-2 w-full ${editMode ? 'edit-actions-hidden' : ''}`}>
          <button
            type="button"
            className="btn px-5 py-2 rounded-2xl w-full mobile-primary"
            onClick={() => useAppStore.getState().openModal('add')}
          >
            Add entry
          </button>
          {(tab === 'expenses' || tab === 'incomes') ? (
            <SoftButton
              type="button"
              className="w-full mobile-primary"
              disabled={!year}
              onClick={() => useAppStore.getState().openModal('addGroup')}
            >
              Add group
            </SoftButton>
          ) : (
            <div className="w-full" aria-hidden="true" />
          )}
        </div>
        {editMode && (
          <SoftButton
            type="button"
            variant="warning"
            className="edit-actions-overlay w-full mobile-primary"
            onClick={exitEditMode}
          >
            Exit mode
          </SoftButton>
        )}
      </div>
      {editMode === 'remove' ? (
        <SoftButton
          type="button"
          variant="danger"
          className="w-full md:w-auto mobile-primary"
          disabled={removeSelection.size === 0 && groupRemoveSelection.size === 0}
          onClick={() => window.dispatchEvent(new CustomEvent('bulk:remove'))}
        >
          Remove selected
        </SoftButton>
      ) : (
        <div className="relative w-full md:w-auto mainbar-edit-menu">
          <DropdownMenu
            label={editMenuLabel}
            block
            buttonClassName={`mobile-primary ${editMode ? 'tag-menu-active' : ''}`}
          >
            {({ close }) => (
              <>
                <DropdownItem onSelect={() => { setEditMode('name'); close(); }}>
                  Change name
                </DropdownItem>
                <DropdownItem onSelect={() => { setEditMode('group'); close(); }}>
                  Change group
                </DropdownItem>
                <DropdownItem onSelect={() => { setEditMode('order'); close(); }}>
                  Change order
                </DropdownItem>
                <DropdownItem onSelect={() => { setEditMode('tag'); close(); }}>
                  Tags
                </DropdownItem>
              <DropdownItem onSelect={() => { setEditMode('remove'); close(); }}>
                Remove entry
              </DropdownItem>
              </>
            )}
          </DropdownMenu>
          {editMode === 'tag' && tagHintVisible && (
            <span className="feedback-badge ok tag-mode-hint">
              Tag months by clicking a month cell
            </span>
          )}
        </div>
      )}
    </>
  );

  useEffect(() => {
    if ((tab === 'reports' || tab === 'savings') && editMode) setEditMode(null);
  }, [tab, editMode, setEditMode]);

  useEffect(() => {
    if (editMode !== 'tag') {
      setTagHintVisible(false);
      return;
    }
    const onHint = () => {
      setTagHintVisible(true);
      window.clearTimeout((onHint as any)._tm);
      (onHint as any)._tm = window.setTimeout(() => setTagHintVisible(false), 2800);
    };
    window.addEventListener('tags:hint', onHint as EventListener);
    return () => {
      window.removeEventListener('tags:hint', onHint as EventListener);
      window.clearTimeout((onHint as any)._tm);
    };
  }, [editMode]);

  const reportActions = (
    <div className="report-toggle-group" role="group" aria-label="Reports">
      {REPORT_DEFINITIONS.map((report) => {
        const active = selectedReports.includes(report.id);
        return (
          <button
            key={report.id}
            type="button"
            className={`report-toggle ui-tooltip ${active ? 'active' : ''}`}
            onClick={() => toggleReport(report.id)}
            aria-pressed={active}
            data-tooltip={report.tooltip}
          >
            <span className="report-icon">{report.icon}</span>
            <span className="report-title">{report.label}</span>
          </button>
        );
      })}
    </div>
  );

  const savingsActions = (
    <button
      type="button"
      className="btn px-5 py-2 rounded-2xl w-full md:w-auto mobile-primary"
      onClick={() => openGoalModal()}
      disabled={!year}
    >
      Add goal
    </button>
  );

  const renderActions = () => {
    if (tab === 'reports') return reportActions;
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
              className="h-[76px] w-auto object-contain drop-shadow-lg"
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
                onClick={() => setTab(item.id)}
              >
                {item.label}
              </button>
            ))}
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
                  label="Menu"
                  align="right"
                  buttonClassName="utility-menu-btn utility-menu-btn-sm"
                >
                  {({ close }) => (
                    <>
                      <DropdownItem onSelect={() => { openModal('yearOps'); close(); }}>
                        Year operations
                      </DropdownItem>
                      <DropdownItem onSelect={() => { openModal('export'); close(); }}>
                        Export data
                      </DropdownItem>
                      <DropdownItem onSelect={() => { openModal('import'); close(); }}>
                        Import data
                      </DropdownItem>
                      <DropdownItem onSelect={() => { openModal('settings'); close(); }}>
                        Settings
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
                label="Menu"
                align="right"
                buttonClassName="utility-menu-btn"
              >
                {({ close }) => (
                  <>
                    <DropdownItem onSelect={() => { openModal('yearOps'); close(); }}>
                      Year operations
                    </DropdownItem>
                    <DropdownItem onSelect={() => { openModal('export'); close(); }}>
                      Export data
                    </DropdownItem>
                    <DropdownItem onSelect={() => { openModal('import'); close(); }}>
                      Import data
                    </DropdownItem>
                    <DropdownItem onSelect={() => { openModal('settings'); close(); }}>
                      Settings
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
