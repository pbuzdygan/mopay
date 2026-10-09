import { useQuery } from '@tanstack/react-query';
import { Api } from '../../api';
import { useAppStore } from '../../store';
import { formatCurrencyWhole } from '../../utils/currency';
import { MONTHS } from '../../utils/months';
import { buildReleaseInfo } from '../../utils/release';
import { Icon, Segmented } from '../ui';
import { YearSwitch } from './YearSwitch';
import { SECTIONS, useShellActions, useYears, type Section } from './useShell';

type EntryValues = Record<string, number | null | undefined>;

const yearTotal = (entries: EntryValues[]) =>
  entries.reduce((sum, entry) => sum + MONTHS.reduce((acc, month) => acc + Number((month === 'Dec' ? entry.Decm ?? entry.Dec : entry[month]) ?? 0), 0), 0);

function useSectionMeta(): Partial<Record<Section, string>> {
  const year = useAppStore((s) => s.year);
  const enabled = useAppStore((s) => s.pinSession && s.financialReady) && Boolean(year);
  // Same query keys as the views, so the sidebar reuses their cached data.
  const expenses = useQuery({ enabled, queryKey: ['entries', 'expense', year], queryFn: () => Api.entries.list('expense', year!) });
  const incomes = useQuery({ enabled, queryKey: ['entries', 'income', year], queryFn: () => Api.entries.list('income', year!) });
  const savings = useQuery({ enabled, queryKey: ['savings', year], queryFn: () => Api.savings.list(year!) });
  const goals = savings.data?.goals?.length;
  return {
    expenses: expenses.data ? formatCurrencyWhole(yearTotal(expenses.data.entries ?? [])) : undefined,
    incomes: incomes.data ? formatCurrencyWhole(yearTotal(incomes.data.entries ?? [])) : undefined,
    savings: goals === undefined ? undefined : `${goals} ${goals === 1 ? 'goal' : 'goals'}`,
  };
}

function SidebarVersion() {
  const appVersion = useAppStore((s) => s.appVersion);
  const latestVersion = useAppStore((s) => s.latestVersion);
  const latestReleaseUrl = useAppStore((s) => s.latestReleaseUrl);
  const updateAvailable = useAppStore((s) => s.updateAvailable);
  const info = buildReleaseInfo({ appVersion, latestVersion, latestReleaseUrl, updateAvailable });
  if (!info) return null;
  const upToDate = !info.isUpdate && Boolean(latestVersion);
  const label = upToDate ? `${info.label} · up to date` : info.label;
  const body = (
    <>
      <span className={`sidebar-version-dot ${info.isUpdate ? 'is-update' : upToDate ? 'is-current' : ''}`} aria-hidden="true" />
      <span>{label}</span>
    </>
  );
  return info.isUpdate && info.href
    ? <a className="sidebar-version is-update" href={info.href} target="_blank" rel="noreferrer">{body}</a>
    : <div className="sidebar-version">{body}</div>;
}

export function Sidebar() {
  const year = useAppStore((s) => s.year);
  const setYear = useAppStore((s) => s.setYear);
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const settingsOpen = useAppStore((s) => s.settingsOpen);
  const openSettings = useAppStore((s) => s.openSettings);
  const { years } = useYears();
  const { tab, goTo, lockSession } = useShellActions();
  const meta = useSectionMeta();

  return (
    <aside className="sidebar" aria-label="Sidebar">
      <div className="sidebar-brand">
        <img src="/icon-128x128.png" alt="" className="sidebar-brand-mark" />
        <span>MOPAY</span>
      </div>
      <YearSwitch years={years} value={year} onChange={setYear} />
      <nav aria-label="Primary" className="sidebar-nav">
        {SECTIONS.map((section) => (
          <button
            key={section.id}
            type="button"
            className="sidebar-item"
            aria-current={!settingsOpen && tab === section.id ? 'page' : undefined}
            // The total is a description, so the accessible name stays the section name.
            aria-label={section.label}
            aria-describedby={meta[section.id] ? `sidebar-meta-${section.id}` : undefined}
            onClick={() => goTo(section.id)}
          >
            <Icon name={section.icon} />
            <span className="sidebar-item-label">{section.label}</span>
            {meta[section.id] && <span id={`sidebar-meta-${section.id}`} className="sidebar-item-meta">{meta[section.id]}</span>}
          </button>
        ))}
      </nav>
      <div className="sidebar-foot">
        <button type="button" className="sidebar-item" aria-current={settingsOpen ? 'page' : undefined} onClick={openSettings}>
          <Icon name="settings" />
          <span className="sidebar-item-label">Settings</span>
        </button>
        <button type="button" className="sidebar-item" onClick={lockSession}>
          <Icon name="lock" />
          <span className="sidebar-item-label">Lock session</span>
        </button>
        <Segmented
          label="Theme"
          className="sidebar-theme"
          iconOnly
          value={theme}
          onChange={setTheme}
          options={[
            { value: 'light', label: 'Light theme', icon: 'sun' },
            { value: 'dark', label: 'Dark theme', icon: 'moon-stars' },
          ]}
        />
        <SidebarVersion />
      </div>
    </aside>
  );
}
