import { useEffect, useState } from "react";
import { SoftButton } from "./SoftButton";

export default function AddToHomeScreen() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);
  const STORAGE_KEY = "mopay-pwa-install-dismissed";

  useEffect(() => {
    const handler = (e: any) => {
      try {
        if (sessionStorage.getItem(STORAGE_KEY) === "1") return;
      } catch {
        // ignore storage access issues
      }
      e.preventDefault();
      setDeferredPrompt(e);
      setIsVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const onInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      console.log("User accepted installation");
    }

    dismissPrompt();
  };

  const dismissPrompt = () => {
    setDeferredPrompt(null);
    setIsVisible(false);
  };

  const skipPrompt = () => {
    dismissPrompt();
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // storage may be unavailable (private mode) – fail silently
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 left-0 right-0 z-50 flex justify-center px-4">
      <div className="layer-card compact w-full max-w-xl flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 border border-border shadow-soft">
        <div className="flex items-center gap-3">
          <img
            src="/android-chrome-192x192.png"
            className="w-12 h-12 rounded-2xl border border-border shadow-soft"
            alt="MOPAY icon"
          />
          <div className="flex flex-col">
            <span className="font-semibold text-textPrim">Add MOPAY to your home screen</span>
            <span className="text-sm text-textSec">Full offline mode, instant launch</span>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto sm:ml-auto">
          <SoftButton
            type="button"
            variant="ghost"
            block
            className="sm:w-auto"
            onClick={skipPrompt}
          >
            Skip
          </SoftButton>
          <button type="button" className="btn w-full sm:w-auto px-5 py-2" onClick={onInstallClick}>
            Install
          </button>
        </div>
      </div>
    </div>
  );
}
