import { useEffect, useState } from "react";
import { useQueryClient } from '@tanstack/react-query';
import { useAppStore } from "./store";
import { Api } from "./api";

// komponenty
import { MainBar } from "./components/MainBar";
import { Sidebar } from "./components/shell/Sidebar";
import { PageHeader } from "./components/shell/PageHeader";
import { useShellEffects } from "./components/shell/useShell";
import { TableView } from "./components/TableView";
import { ReportsView } from "./components/ReportsView";
import { SavingsView } from "./components/SavingsView";
import { PinGuard } from "./components/PinGuard";
import { InitiateYearModal } from "./components/modals/InitiateYearModal";
import { AddEntryModal } from "./components/modals/AddEntryModal";
import { AddGroupModal } from "./components/modals/AddGroupModal";
import { YearOperationsModal } from "./components/modals/YearOperationsModal";
import { ExportModal } from "./components/modals/ExportModal";
import { ImportModal } from "./components/modals/ImportModal";
import { SettingsModal } from "./components/modals/SettingsModal";
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

  // Sticky header scroll effect
  useEffect(() => {
    const header = document.querySelector(".sticky-glass");
    if (!header) return;

    const onScroll = () => {
      if (window.scrollY > 20) header.classList.add("scrolled");
      else header.classList.remove("scrolled");
    };

    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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

  // Desktop (>=960px): sidebar + page header. Below that the previous toolbar
  // stays until the mobile layout (plan Phase 8); CSS shows one of them.
  return (
    <div className="app-shell">
      <ReleaseStatusProvider />
      <PinGuard />
      <Sidebar />

      <div className="app-shell-main">
        <header className="sticky-glass app-mobile-header">
          <div className="app-container">
            {demoBanner}
            <MainBar />
          </div>
        </header>

        <main className="app-main">
          <div className="app-container">
            <div className="app-desktop-header">
              {demoBanner}
              <PageHeader />
            </div>
            {pinSession && financialReady && (tab === 'reports'
              ? <ReportsView />
              : tab === 'savings'
              ? <SavingsView />
              : <TableView />)}
          </div>
        </main>
      </div>

      {!demo && <><InitiateYearModal /><AddEntryModal /><AddGroupModal /><YearOperationsModal /></>}
      <ExportModal />
      {!demo && <ImportModal />}
      <SettingsModal />
      {!demo && <><SavingsGoalModal /><EncryptionMigrationModal /></>}
      <EncryptionKeyMismatchModal />
      <AddToHomeScreen />
    </div>
  );
}
