import { useEffect, useState } from "react";

export default function AddToHomeScreen() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
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

    setDeferredPrompt(null);
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 left-0 right-0 flex justify-center z-50">
      <div className="bg-white shadow-xl rounded-xl p-4 flex items-center gap-4 border">
        <img src="/android-chrome-192x192.png" className="w-10 h-10" />
        <div className="flex flex-col">
          <span className="font-semibold">Dodaj MOPAY do ekranu głównego</span>
          <span className="text-sm text-gray-600">Pełny tryb offline, szybkie uruchamianie</span>
        </div>
        <button
          className="px-3 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700"
          onClick={onInstallClick}
        >
          Dodaj
        </button>
      </div>
    </div>
  );
}
