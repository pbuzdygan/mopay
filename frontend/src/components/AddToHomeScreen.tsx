import { useEffect, useState } from "react";
import { Button } from "./ui";

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
    <div className="install-prompt" role="region" aria-label="Install MOPAY">
      <div className="install-prompt-card">
        <img src="/android-chrome-192x192.png" className="install-prompt-icon" alt="" />
        <div className="install-prompt-text">
          <strong>Add MOPAY to your home screen</strong>
          <span>Full offline mode, instant launch</span>
        </div>
        <div className="install-prompt-actions">
          <Button variant="ghost" onClick={skipPrompt}>
            Skip
          </Button>
          <Button variant="primary" onClick={onInstallClick}>
            Install
          </Button>
        </div>
      </div>
    </div>
  );
}
