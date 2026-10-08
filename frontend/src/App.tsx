import { useEffect, useState } from "react";
import { useQueryClient } from '@tanstack/react-query';
import { useAppStore } from "./store";
import { Api } from "./api";

// komponenty
import { MainBar } from "./components/MainBar";
import { TableView } from "./components/TableView";
import { ReportsView } from "./components/ReportsView";
import { SavingsView } from "./components/SavingsView";
import { PinGuard } from "./components/PinGuard";
import { InitiateYearModal } from "./components/modals/InitiateYearModal";
import { AddEntryModal } from "./components/modals/AddEntryModal";
import { AddGroupModal } from "./components/modals/AddGroupModal";
import { CommentModal } from "./components/modals/CommentModal";
import { YearOperationsModal } from "./components/modals/YearOperationsModal";
import { ExportModal } from "./components/modals/ExportModal";
import { ImportModal } from "./components/modals/ImportModal";
import { SettingsModal } from "./components/modals/SettingsModal";
import { SavingsGoalModal } from "./components/modals/SavingsGoalModal";
import { EncryptionMigrationModal } from "./components/modals/EncryptionMigrationModal";
import { EncryptionKeyMismatchModal } from "./components/modals/EncryptionKeyMismatchModal";
import AddToHomeScreen from "./components/AddToHomeScreen";
import { ReleaseStatusProvider } from "./components/ReleaseStatusProvider";

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

  if (demo === null) return <div className="app-container py-6" role="status">
    {runtimeError ? <>Could not load application mode. <button className="btn" onClick={() => setAttempt(value => value + 1)}>Retry</button></> : 'Loading Mopay…'}
  </div>;

  return (
    <div className="min-h-screen">
      <ReleaseStatusProvider />
      <PinGuard />

      <header className="sticky-glass">
        <div className="app-container">
          {demo && <div className="demo-banner" role="status"><strong>Demo mode</strong><span>Sample data — read only</span></div>}
          <MainBar />
        </div>
      </header>

      <main className="app-main py-4 lg:py-6">
        <div className="app-container">
          {pinSession && financialReady && (tab === 'reports'
            ? <ReportsView />
            : tab === 'savings'
            ? <SavingsView />
            : <TableView />)}
        </div>
      </main>

      {!demo && <><InitiateYearModal /><AddEntryModal /><AddGroupModal /><CommentModal /><YearOperationsModal /></>}
      <ExportModal />
      {!demo && <ImportModal />}
      <SettingsModal />
      {!demo && <><SavingsGoalModal /><EncryptionMigrationModal /></>}
      <EncryptionKeyMismatchModal />
      <AddToHomeScreen />
    </div>
  );
}
