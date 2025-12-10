import { useEffect } from "react";
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
import { CommentModal } from "./components/modals/CommentModal";
import { YearOperationsModal } from "./components/modals/YearOperationsModal";
import { ExportModal } from "./components/modals/ExportModal";
import { SettingsModal } from "./components/modals/SettingsModal";
import { SavingsGoalModal } from "./components/modals/SavingsGoalModal";
import { EncryptionMigrationModal } from "./components/modals/EncryptionMigrationModal";
import { EncryptionKeyMismatchModal } from "./components/modals/EncryptionKeyMismatchModal";
import AddToHomeScreen from "./components/AddToHomeScreen";
import { VersionIndicator } from "./components/VersionIndicator";

// style globalne
import "./styles/global.css";

export default function App() {
  const theme = useAppStore((s) => s.theme);
  const tab = useAppStore((s) => s.tab);
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
    (async () => {
      try {
        const status = await Api.encryption.status();
        setKeyMismatch(Boolean(status?.keyMismatch));
        if (status?.keyMismatch) {
          setMigrationNotice(false);
          return;
        }
        if (status?.encryptionEnabled && status?.showNotice) {
          setMigrationNotice(true);
        }
      } catch {
        // ignore errors – app can still function
      }
    })();
  }, [setMigrationNotice, setKeyMismatch]);

  return (
    <div className="min-h-screen">
      <PinGuard />

      <header className="sticky-glass">
        <div className="app-container">
          <MainBar />
        </div>
      </header>

      <main className="py-4 lg:py-6">
        <div className="app-container">
          {tab === 'reports'
            ? <ReportsView />
            : tab === 'savings'
            ? <SavingsView />
            : <TableView />}
        </div>
      </main>

      <footer className="py-4">
        <div className="app-container flex justify-end">
          <VersionIndicator />
        </div>
      </footer>

      <InitiateYearModal />
      <AddEntryModal />
      <CommentModal />
      <YearOperationsModal />
      <ExportModal />
      <SettingsModal />
      <SavingsGoalModal />
      <EncryptionMigrationModal />
      <EncryptionKeyMismatchModal />
      <AddToHomeScreen />
    </div>
  );
}
