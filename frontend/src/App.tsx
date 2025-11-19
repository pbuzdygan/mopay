import { useEffect } from "react";
import { useAppStore } from "./store";

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
import AddToHomeScreen from "./components/AddToHomeScreen";

// style globalne
import "./styles/global.css";

export default function App() {
  const theme = useAppStore((s) => s.theme);
  const tab = useAppStore((s) => s.tab);

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

      <InitiateYearModal />
      <AddEntryModal />
      <CommentModal />
      <YearOperationsModal />
      <ExportModal />
      <SettingsModal />
      <SavingsGoalModal />
      <AddToHomeScreen />
    </div>
  );
}
