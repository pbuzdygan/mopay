import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Api } from "../api";
import { useAppStore } from "../store";
import { SoftButton } from "./SoftButton";

export function PinGuard() {
  const pinOk = useAppStore((s) => s.pinSession);
  const setPinOk = useAppStore((s) => s.setPinSession);

  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const errorTimerRef = useRef<number | null>(null);

  // restore session
  useEffect(() => {
    const cached = sessionStorage.getItem("pin-ok") === "1";
    if (cached) setPinOk(true);
  }, [setPinOk]);

  useEffect(() => {
    if (!pinOk) {
      const raf = requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [pinOk]);

  useEffect(() => {
    if (pinOk) return;
    const root = document.documentElement;
    const vv = window.visualViewport;
    let maxViewportHeight = window.innerHeight;
    const updateInset = () => {
      if (!vv) {
        root.style.setProperty("--keyboard-inset", "0px");
        root.style.setProperty("--pin-guard-shift", "0px");
        return;
      }
      maxViewportHeight = Math.max(maxViewportHeight, vv.height);
      const visualDelta = Math.max(0, maxViewportHeight - vv.height);
      const layoutDelta = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);

      // Apply bottom padding only when the layout viewport does NOT shrink with the keyboard.
      // On many mobile browsers (e.g. Android Chrome), window.innerHeight tracks the visual viewport,
      // so adding extra padding would double-count and push the card off-screen.
      root.style.setProperty("--keyboard-inset", `${layoutDelta}px`);

      const cardHeight = document.querySelector(".pin-guard-card")?.getBoundingClientRect().height ?? 0;
      const rootFontSize = Number.parseFloat(getComputedStyle(root).fontSize || "16");
      const basePaddingPx = 0.85 * rootFontSize;
      const centerShift = basePaddingPx + cardHeight / 2 - maxViewportHeight / 2;

      // Blend between centered (keyboard closed) and bottom-aligned (keyboard open) to avoid jumps.
      const t = Math.min(1, visualDelta / 140);
      const shift = centerShift * (1 - t);
      root.style.setProperty("--pin-guard-shift", `${shift}px`);
    };
    updateInset();
    vv?.addEventListener("resize", updateInset);
    vv?.addEventListener("scroll", updateInset);
    window.addEventListener("resize", updateInset);
    return () => {
      vv?.removeEventListener("resize", updateInset);
      vv?.removeEventListener("scroll", updateInset);
      window.removeEventListener("resize", updateInset);
      root.style.setProperty("--keyboard-inset", "0px");
      root.style.setProperty("--pin-guard-shift", "0px");
    };
  }, [pinOk]);

  function handlePinFailure() {
    if (errorTimerRef.current) {
      window.clearTimeout(errorTimerRef.current);
      errorTimerRef.current = null;
    }
    setPin("");
    setError("Wrong PIN");
    setLocked(true);
    errorTimerRef.current = window.setTimeout(() => {
      setError(null);
      setLocked(false);
      requestAnimationFrame(() => inputRef.current?.focus());
      errorTimerRef.current = null;
    }, 1800);
  }

  async function submit() {
    if (locked) return;
    if (pin.length < 4 || pin.length > 8) return;

    try {
      const res = await Api.verifyPin(pin);

      if (res.ok) {
        sessionStorage.setItem("pin-ok", "1");
        setPinOk(true);
        setPin("");
      } else {
        handlePinFailure();
      }
    } catch {
      handlePinFailure();
    }
  }

  return (
    <AnimatePresence>
      {!pinOk && (
        <motion.div
          className="pin-guard-overlay fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ scale: 0.94, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 8 }}
          >
            <div className="layer-card compact pin-guard-card w-full max-w-sm stack">
              <div className="flex justify-center">
                <img
                  src="/mopay_banner_512x512.png"
                  alt="MOPAY"
                  className="pin-banner"
                />
              </div>
              <div className="stack-sm">
                <h2 className="type-title-xl">Enter PIN</h2>
                <p className="type-body-sm text-textSec">
                  Unlock your data with a 4–8 digit PIN.
                </p>
              </div>

            <div className="stack-sm">
              <label className="field-label" htmlFor="pin-guard-input">
                PIN
              </label>
              <div className="pin-input-wrap">
                <input
                  id="pin-guard-input"
                  ref={inputRef}
                  type="password"
                  inputMode="numeric"
                  maxLength={8}
                  className={`input w-full ${error ? "input-error" : ""}`}
                  value={pin}
                  disabled={locked}
                  onChange={(e) =>
                    setPin(e.target.value.replace(/[^0-9]/g, ""))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submit();
                  }}
                />
                {error && (
                  <div className="pin-input-error feedback-badge err" aria-live="polite">
                    Wrong PIN. Try again.
                  </div>
                )}
              </div>
            </div>

            <div className="cluster justify-end">
              <SoftButton
                type="button"
                variant="ghost"
                onClick={() => setPin("")}
                disabled={!pin.length || locked}
              >
                Clear
              </SoftButton>
              <button
                className="btn px-6"
                disabled={pin.length < 4 || locked}
                onClick={submit}
              >
                Enter
              </button>
            </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
