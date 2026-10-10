import { useEffect, useState } from "react";
import { useQueryClient } from '@tanstack/react-query';
import { useAppStore } from "./store";
import { Api } from "./api";

// komponenty
import { MobileTopBar } from "./components/mobile/MobileTopBar";
import { MobileTabBar } from "./components/mobile/MobileTabBar";
import { useNarrow } from "./components/shell/useNarrow";
import { Sidebar } from "./components/shell/Sidebar";
import { PageHeader } from "./components/shell/PageHeader";
import { useShellEffects } from "./components/shell/useShell";
import { TableView } from "./components/TableView";
import { OverviewView } from "./components/OverviewView";
import { SettingsView } from "./components/settings/SettingsView";
import { SavingsView } from "./components/SavingsView";
import { PinGuard } from "./components/PinGuard";
import { InitiateYearModal } from "./components/modals/InitiateYearModal";
import { AddEntryModal } from "./components/modals/AddEntryModal";
import { AddGroupModal } from "./components/modals/AddGroupModal";
import { ExportModal } from "./components/modals/ExportModal";
import { ImportModal } from "./components/modals/ImportModal";
import { SavingsGoalModal } from "./components/modals/SavingsGoalModal";
import { EncryptionMigrationModal } from "./components/modals/EncryptionMigrationModal";
import { EncryptionKeyMismatchModal } from "./components/modals/EncryptionKeyMismatchModal";
import AddToHomeScreen from "./components/AddToHomeScreen";
import { ReleaseStatusProvider } from "./components/ReleaseStatusProvider";
import { Button, Callout } from "./components/ui";

// style globalne
import "./styles/global.css";

export default function App() {
  const theme = useAppStore((s) => s.theme);
  const viewMode = useAppStore((s) => s.viewMode);
  const tab = useAppStore((s) => s.tab);
  const settingsOpen = useAppStore((s) => s.settingsOpen);
  const themeMode = useAppStore((s) => s.themeMode);
  const narrow = useNarrow();
  const demo = useAppStore((s) => s.demo);
  const pinSession = useAppStore((s) => s.pinSession);
  const financialReady = useAppStore((s) => s.financialReady);
  const qc = useQueryClient();
  const [runtimeError, setRuntimeError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setRuntimeError(false);
    qc.clear();
    Api.meta().then(meta => {
      if (cancelled) return;
      if (typeof meta.demo !== 'boolean' || (meta.demo && meta.demoPin !== '1234')) {
        throw new Error('Invalid application mode metadata');
      }
      const store = useAppStore.getState();
      store.setAppVersion(meta.version ?? null);
      store.setReleaseChannel(meta.channel ?? 'main');
      store.setRuntimeMode(meta.demo, meta.demo ? meta.demoPin : null);
    }).catch(() => { if (!cancelled) setRuntimeError(true); });
    return () => { cancelled = true; };
  }, [attempt, qc]);
  const setMigrationNotice = useAppStore((s) => s.setMigrationNotice);
  const setKeyMismatch = useAppStore((s) => s.setKeyMismatch);

  useShellEffects();

  // THEME TRANSITION
  useEffect(() => {
    const root = document.documentElement;

    root.classList.add("theme-changing");
    root.setAttribute("data-theme", theme);

    const tm = setTimeout(() => {
      root.classList.remove("theme-changing");
    }, 350);

    return () => clearTimeout(tm);
  }, [theme]);

  // Theme "System" (D6) follows the operating system while the app is open.
  useEffect(() => {
    if (themeMode !== 'system') return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => useAppStore.getState().syncSystemTheme();
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, [themeMode]);

  useEffect(() => {
    document.documentElement.setAttribute('data-view', viewMode);
  }, [viewMode]);

  useEffect(() => {
    (async () => {
      try {
        const status = await Api.encryption.status();
        setKeyMismatch(Boolean(status?.keyMismatch));
        if (status?.keyMismatch) {
          setMigrationNotice(false);
          return;
        }
        if (demo === false && status?.encryptionEnabled && status?.showNotice) {
          setMigrationNotice(true);
        }
      } catch {
        // ignore errors – app can still function
      }
    })();
  }, [demo, setMigrationNotice, setKeyMismatch]);

  if (demo === null) return <main className="ui-status-page">
    <div className="ui-status-card" role="status">
      {runtimeError ? <>
        <Callout tone="danger" title="Could not load application mode.">
          <p>Check that the Mopay server is reachable, then try again.</p>
        </Callout>
        <Button icon="refresh" onClick={() => setAttempt(value => value + 1)}>Retry</Button>
      </> : <p className="ui-status-text">Loading Mopay…</p>}
    </div>
  </main>;

  const demoBanner = demo && (
    <div className="demo-banner" role="status"><strong>Demo mode</strong><span>Sample data — read only</span></div>
  );

  // Desktop (>=960px): sidebar + page header. Below that the mobile layout
  // (plan Phase 8): top bar and bottom tab bar. Only one layout is rendered.
  return (
    <div className="app-shell">
      <ReleaseStatusProvider />
      <PinGuard />
      {!narrow && <Sidebar />}

      <div className="app-shell-main">
        {narrow && (
          <header className="app-mobile-header">
            {demoBanner}
            <MobileTopBar />
          </header>
        )}

        <main className="app-main">
          <div className="app-container">
            {!narrow && (
              <div className="app-desktop-header">
                {demoBanner}
                <PageHeader />
              </div>
            )}
            {pinSession && financialReady && (settingsOpen
              ? <SettingsView />
              : tab === 'reports'
              ? <OverviewView />
              : tab === 'savings'
              ? <SavingsView />
              : <TableView />)}
          </div>
        </main>
        {narrow && <MobileTabBar />}
      </div>

      {!demo && <><InitiateYearModal /><AddEntryModal /><AddGroupModal /></>}
      <ExportModal />
      {!demo && <ImportModal />}
      {!demo && <><SavingsGoalModal /><EncryptionMigrationModal /></>}
      <EncryptionKeyMismatchModal />
      <AddToHomeScreen />
    </div>
  );
}
