import { useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Api } from '../../api';
import { useAppStore, type ThemeMode } from '../../store';
import { buildReleaseInfo, formatVersionLabel, REPO_SLUG } from '../../utils/release';
import { useShellActions, useYears } from '../shell/useShell';
import { Button, Callout, Icon, Input, Segmented, Switch } from '../ui';

// Settings page (plan Phase 7, D7: view state, not a persisted tab). Replaces
// the Settings and Year operations dialogs and the data menu.

const SECTIONS = [
  { id: 'display', label: 'Display' },
  { id: 'security', label: 'Security' },
  { id: 'years', label: 'Years' },
  { id: 'data', label: 'Import & export' },
  { id: 'about', label: 'About' },
  { id: 'danger', label: 'Danger zone' },
] as const;

export function SettingsView() {
  const jumpTo = (id: string) => {
    const heading = document.getElementById(`settings-${id}`);
    heading?.scrollIntoView({ block: 'start' });
    heading?.focus({ preventScroll: true });
  };

  return (
    <div className="prefs mode-enter">
      <div className="prefs-layout">
        <nav className="prefs-nav" aria-label="Settings sections">
          {SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              className={section.id === 'danger' ? 'is-danger' : undefined}
              onClick={() => jumpTo(section.id)}
            >
              {section.label}
            </button>
          ))}
        </nav>
        <div className="prefs-sections">
          <DisplaySection />
          <SecuritySection />
          <YearsSection />
          <DataSection />
          <AboutSection />
          <DangerSection />
        </div>
      </div>
    </div>
  );
}

function Section({ id, title, intro, danger = false, children }: {
  id: string;
  title: string;
  intro?: string;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={`prefs-section ${danger ? 'is-danger' : ''}`} aria-labelledby={`settings-${id}`}>
      <h2 id={`settings-${id}`} tabIndex={-1}>{title}</h2>
      {intro && <p className="prefs-intro">{intro}</p>}
      {children}
    </section>
  );
}

function Row({ title, description, stack = false, children }: {
  title: string;
  description?: ReactNode;
  stack?: boolean;
  children: (titleId: string) => ReactNode;
}) {
  const titleId = useId();
  return (
    <div className={`prefs-row ${stack ? 'is-stack' : ''}`}>
      <div className="prefs-row-text">
        <span id={titleId} className="prefs-row-title">{title}</span>
        {description && <span className="prefs-row-description">{description}</span>}
      </div>
      <div className="prefs-row-control">{children(titleId)}</div>
    </div>
  );
}

function DisplaySection() {
  const themeMode = useAppStore((s) => s.themeMode);
  const setThemeMode = useAppStore((s) => s.setThemeMode);
  const viewMode = useAppStore((s) => s.viewMode);
  const setViewMode = useAppStore((s) => s.setViewMode);
  const showGroupTotals = useAppStore((s) => s.showGroupTotals);
  const setShowGroupTotals = useAppStore((s) => s.setShowGroupTotals);

  return (
    <Section id="display" title="Display">
      <Row title="Theme" description="Applies to this browser only. System follows the device setting.">
        {() => (
          <Segmented<ThemeMode>
            label="Theme mode"
            value={themeMode}
            onChange={setThemeMode}
            options={[
              { value: 'light', label: 'Light', icon: 'sun' },
              { value: 'dark', label: 'Dark', icon: 'moon-stars' },
              { value: 'system', label: 'System' },
            ]}
          />
        )}
      </Row>
      <Row title="Table density" description="Compact shows more rows on screen.">
        {() => (
          <Segmented
            label="Table density"
            value={viewMode}
            onChange={setViewMode}
            options={[
              { value: 'normal', label: 'Normal' },
              { value: 'compact', label: 'Compact' },
            ]}
          />
        )}
      </Row>
      <Row title="Show group totals" description="Subtotals in group rows of Expenses and Incomes.">
        {(titleId) => <Switch checked={showGroupTotals} onChange={setShowGroupTotals} labelledBy={titleId} />}
      </Row>
    </Section>
  );
}

function SecuritySection() {
  const { lockSession } = useShellActions();
  const status = useQuery({ queryKey: ['encryption-status'], queryFn: Api.encryption.status });
  const data = status.data as { encryptionEnabled?: boolean; keyMismatch?: boolean } | undefined;
  const encryption = status.isError
    ? { tone: 'muted', icon: 'alert-triangle', text: 'Status unavailable' }
    : !data
    ? { tone: 'muted', icon: 'shield', text: 'Checking…' }
    : data.keyMismatch
    ? { tone: 'danger', icon: 'alert-triangle', text: 'Key mismatch' }
    : data.encryptionEnabled
    ? { tone: 'success', icon: 'shield', text: 'Active' }
    : { tone: 'muted', icon: 'shield', text: 'Not enabled' };

  return (
    <Section id="security" title="Security">
      <Row title="Lock session" description="Ends the current session. The PIN is required to open MOPAY again.">
        {() => <Button icon="lock" onClick={lockSession}>Lock now</Button>}
      </Row>
      <Row title="Encryption" description="Monetary values are stored encrypted with the server key.">
        {() => <span className={`prefs-state is-${encryption.tone}`}><Icon name={encryption.icon} size="sm" />{encryption.text}</span>}
      </Row>
    </Section>
  );
}

function YearsSection() {
  const demo = useAppStore((s) => s.demo);
  const setYear = useAppStore((s) => s.setYear);
  const qc = useQueryClient();
  const { years } = useYears();
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<null | { tone: 'success' | 'danger'; text: string }>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function add(event: FormEvent) {
    event.preventDefault();
    const year = Number(draft);
    if (draft.length !== 4 || !Number.isInteger(year) || busy) return;
    if (years.includes(year)) {
      setMessage({ tone: 'danger', text: `Year ${year} already exists.` });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await Api.years.add(year);
    } catch {
      setMessage({ tone: 'danger', text: `Could not add ${year}. Try again.` });
      setBusy(false);
      return;
    }
    // F29 fix: refresh the year list before switching, otherwise the year
    // guard sees an unknown year and switches back (Phase 0 finding).
    await qc.refetchQueries({ queryKey: ['years'] });
    setYear(year);
    setDraft('');
    setBusy(false);
    setMessage({ tone: 'success', text: `Year ${year} added and selected as the working year.` });
    inputRef.current?.focus();
  }

  return (
    <Section id="years" title="Years" intro="The working year is chosen with the year selector.">
      <Row title="Existing years" description={years.length ? years.join(', ') : 'No years yet.'}>
        {() => null}
      </Row>
      {demo ? (
        <div className="prefs-note"><Callout>Demo data is read only. Years cannot be created or deleted.</Callout></div>
      ) : (
        <Row title="Create year" description="Start a new year for entries and savings. It becomes the working year." stack>
          {() => (
            <form className="prefs-inline-form" onSubmit={(event) => void add(event)}>
              <Input
                ref={inputRef}
                label="Year"
                inputMode="numeric"
                placeholder="YYYY"
                maxLength={4}
                value={draft}
                className="prefs-year-input"
                onChange={(event) => {
                  setDraft(event.target.value.replace(/[^0-9]/g, ''));
                  setMessage(null);
                }}
              />
              <Button type="submit" variant="primary" icon="square-plus" disabled={draft.length !== 4} loading={busy}>Add year</Button>
              {message && (
                <p className={`prefs-message is-${message.tone}`} role={message.tone === 'danger' ? 'alert' : 'status'}>{message.text}</p>
              )}
            </form>
          )}
        </Row>
      )}
    </Section>
  );
}

function DataSection() {
  const demo = useAppStore((s) => s.demo);
  const openModal = useAppStore((s) => s.openModal);
  const [templateError, setTemplateError] = useState(false);

  async function downloadTemplate() {
    setTemplateError(false);
    try {
      await Api.downloadImportTemplate();
    } catch {
      setTemplateError(true);
    }
  }

  return (
    <Section id="data" title="Import & export">
      <Row title="Export data" description="Download selected years as an XLSX workbook.">
        {() => <Button icon="table-export" onClick={() => openModal('export')}>Export…</Button>}
      </Row>
      {demo ? (
        <div className="prefs-note"><Callout>Import is not available in demo mode.</Callout></div>
      ) : (
        <Row
          title="Import data"
          description="Upload a filled template. You review a summary and confirm before anything is overwritten."
        >
          {() => (
            <div className="prefs-actions">
              <Button variant="ghost" onClick={() => void downloadTemplate()}>Download template</Button>
              <Button icon="table-import" onClick={() => openModal('import')}>Import…</Button>
            </div>
          )}
        </Row>
      )}
      {templateError && (
        <div className="prefs-note"><Callout tone="danger" role="alert">Could not download the template. Try again.</Callout></div>
      )}
    </Section>
  );
}

function AboutSection() {
  const appVersion = useAppStore((s) => s.appVersion);
  const latestVersion = useAppStore((s) => s.latestVersion);
  const latestReleaseUrl = useAppStore((s) => s.latestReleaseUrl);
  const updateAvailable = useAppStore((s) => s.updateAvailable);
  const releaseChannel = useAppStore((s) => s.releaseChannel);
  const releaseCheck = useAppStore((s) => s.releaseCheck);
  const requestReleaseCheck = useAppStore((s) => s.requestReleaseCheck);
  const info = buildReleaseInfo({ appVersion, latestVersion, latestReleaseUrl, updateAvailable });
  const checkedAt = releaseCheck.at
    ? new Date(releaseCheck.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : null;
  const title = appVersion ? `MOPAY ${formatVersionLabel(appVersion)}` : 'MOPAY (dev build)';

  return (
    <Section id="about" title="About">
      <Row
        title={title}
        description={`Release channel: ${releaseChannel}${checkedAt ? ` · checked ${checkedAt}` : ''}`}
      >
        {() => (
          <div className="prefs-actions">
            {!REPO_SLUG ? (
              <span className="prefs-state is-muted">Update check not configured</span>
            ) : releaseCheck.status === 'checking' ? (
              <span className="prefs-state is-muted" role="status">Checking…</span>
            ) : releaseCheck.status === 'failed' ? (
              <span className="prefs-state is-danger" role="status"><Icon name="alert-triangle" size="sm" />Could not check for updates</span>
            ) : info?.isUpdate && info.href ? (
              <a className="prefs-state is-accent" href={info.href} target="_blank" rel="noreferrer">{info.label}</a>
            ) : releaseCheck.status === 'done' && latestVersion ? (
              <span className="prefs-state is-success"><Icon name="check" size="sm" />Up to date</span>
            ) : releaseCheck.status === 'done' ? (
              <span className="prefs-state is-muted">No published release found</span>
            ) : null}
            {REPO_SLUG && (
              <Button variant="ghost" size="sm" icon="refresh" disabled={releaseCheck.status === 'checking'} onClick={requestReleaseCheck}>
                Check again
              </Button>
            )}
          </div>
        )}
      </Row>
    </Section>
  );
}

function DangerSection() {
  const demo = useAppStore((s) => s.demo);
  const workingYear = useAppStore((s) => s.year);
  const openModal = useAppStore((s) => s.openModal);
  const qc = useQueryClient();
  const { years } = useYears();
  const [selected, setSelected] = useState<number[]>([]);
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<null | { tone: 'success' | 'danger'; text: string }>(null);

  // Years removed elsewhere drop out of the selection.
  const chosen = selected.filter((year) => years.includes(year) && year !== workingYear).sort((a, b) => a - b);
  const phrase = chosen.join(', ');
  const confirmed = chosen.length > 0 && confirmation.replace(/\s/g, '') === phrase.replace(/\s/g, '');
  const target = chosen.length === 1 ? String(chosen[0]) : `${chosen.length} years`;

  const toggle = (year: number) => {
    setMessage(null);
    setConfirmation('');
    setSelected((current) => (current.includes(year) ? current.filter((value) => value !== year) : [...current, year]));
  };

  async function remove(event: FormEvent) {
    event.preventDefault();
    if (!confirmed || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await Api.years.remove(chosen);
      setSelected([]);
      setConfirmation('');
      setMessage({ tone: 'success', text: `Deleted ${phrase}.` });
      await qc.invalidateQueries({ queryKey: ['years'] });
    } catch {
      setMessage({ tone: 'danger', text: `Could not delete ${phrase}. Try again.` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section id="danger" title="Danger zone" danger>
      {demo ? (
        <div className="prefs-note"><Callout>Demo data is read only. Years cannot be deleted.</Callout></div>
      ) : (
        <Row
          title="Delete years"
          description="Permanently removes entries, tags and savings of the selected years. The working year cannot be deleted; choose another working year first."
          stack
        >
          {() => (
            <form className="prefs-delete" onSubmit={(event) => void remove(event)}>
              <fieldset className="prefs-year-list">
                <legend className="sr-only">Years to delete</legend>
                {years.map((year) => {
                  const working = year === workingYear;
                  return (
                    <label key={year} className={working ? 'is-disabled' : undefined}>
                      <input type="checkbox" checked={!working && selected.includes(year)} disabled={working} onChange={() => toggle(year)} />
                      <span>{year}</span>
                      {working && <>{' '}<span className="prefs-tag">working year</span></>}
                    </label>
                  );
                })}
              </fieldset>
              {chosen.length > 0 && (
                <>
                  <Callout tone="warning">
                    <p>Deleting {phrase} cannot be undone. Export a backup first if you might need it.</p>
                    <Button variant="ghost" size="sm" icon="table-export" onClick={() => openModal('export')}>Export a backup</Button>
                  </Callout>
                  <div className="prefs-inline-form">
                    <Input
                      label={`Type ${phrase} to confirm`}
                      value={confirmation}
                      autoComplete="off"
                      onChange={(event) => setConfirmation(event.target.value)}
                    />
                    <Button type="submit" variant="danger" icon="trash" disabled={!confirmed} loading={busy}>Delete {target}</Button>
                  </div>
                </>
              )}
              {message && (
                <p className={`prefs-message is-${message.tone}`} role={message.tone === 'danger' ? 'alert' : 'status'}>{message.text}</p>
              )}
            </form>
          )}
        </Row>
      )}
    </Section>
  );
}
