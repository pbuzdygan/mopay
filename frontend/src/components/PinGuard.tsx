import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { Api, ApiError } from "../api";
import { useAppStore } from "../store";
import { Button, Callout, Input } from "./ui";

export function PinGuard() {
  const pinOk = useAppStore((s) => s.pinSession);
  const demoPin = useAppStore((s) => s.demoPin);
  const setPinOk = useAppStore((s) => s.setPinSession);
  const queryClient = useQueryClient();

  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const errorTimerRef = useRef<number | null>(null);

  // restore session
  useEffect(() => {
    const cached = sessionStorage.getItem("pin-ok") === "1" && Boolean(sessionStorage.getItem("pin-token"));
    let cancelled = false;
    if (cached) {
      Api.years.list().then(() => { if (!cancelled) setPinOk(true); }).catch(() => {
        if (!cancelled) {
          sessionStorage.removeItem('pin-ok');
          sessionStorage.removeItem('pin-token');
          queryClient.clear();
          setPinOk(false);
        }
      });
    }
    return () => { cancelled = true; };
  }, [queryClient, setPinOk]);

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
    const root = overlayRef.current;
    if (!root) return;
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

      const cardHeight = root.querySelector(".pin-guard-card")?.getBoundingClientRect().height ?? 0;
      const basePaddingPx = Number.parseFloat(getComputedStyle(root).paddingTop) || 12;
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
      // Keep the exiting card's viewport alignment until AnimatePresence removes it.
    };
  }, [pinOk]);

  function handlePinFailure(message = "Wrong PIN", cooldownMs = 1800) {
    if (errorTimerRef.current) {
      window.clearTimeout(errorTimerRef.current);
      errorTimerRef.current = null;
    }
    setPin("");
    setError(message);
    setLocked(true);
    errorTimerRef.current = window.setTimeout(() => {
      setError(null);
      setLocked(false);
      requestAnimationFrame(() => inputRef.current?.focus());
      errorTimerRef.current = null;
    }, cooldownMs);
  }

  async function submit() {
    if (locked) return;
    if (pin.length < 4 || pin.length > 8) return;

    try {
      const res = await Api.verifyPin(pin);

      if (res.ok && typeof res.sessionToken === "string" && res.sessionToken.length > 10) {
        sessionStorage.setItem("pin-token", res.sessionToken);
        sessionStorage.setItem("pin-ok", "1");
        setPinOk(true);
        setPin("");
        void queryClient.invalidateQueries();
      } else {
        handlePinFailure();
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 429) {
        const wait = error.retryAfterSeconds && error.retryAfterSeconds > 0
          ? `${error.retryAfterSeconds}s`
          : "a moment";
        handlePinFailure(`Too many attempts. Wait ${wait}.`, 2200);
        return;
      }
      handlePinFailure("Wrong PIN", 1800);
    }
  }

  return (
    <AnimatePresence onExitComplete={() => {
      // Mount financial tables after the PIN exit to keep its animation responsive.
      if (useAppStore.getState().pinSession) useAppStore.getState().setFinancialReady();
    }}>
      {!pinOk && (
        <motion.div
          ref={overlayRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="pin-guard-title"
          aria-describedby="pin-guard-help"
          className="pin-guard-overlay"
          // Native opacity completion can restore full visibility before unmount.
          style={{ opacity: 'var(--pin-opacity)' }}
          initial={{ '--pin-opacity': 0 }}
          animate={{ '--pin-opacity': 1 }}
          exit={{ '--pin-opacity': 0 }}
          transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <motion.div
            className="pin-guard-motion"
            style={{ opacity: 'var(--pin-card-opacity)' }}
            initial={{ scale: 0.94, '--pin-card-opacity': 0, y: 10 }}
            animate={{ scale: 1, '--pin-card-opacity': 1, y: 0 }}
            exit={{ scale: 0.92, '--pin-card-opacity': 0, y: 8 }}
            transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <form
              className="pin-guard-card"
              data-testid="pin-card"
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
            >
              <div className="pin-guard-brand">
                <img src="/icon-128x128.png" alt="" className="pin-guard-logo" />
                <span>MOPAY</span>
              </div>
              <div>
                <h2 id="pin-guard-title" className="pin-guard-title">Enter PIN</h2>
                <p id="pin-guard-help" className="pin-guard-help">Unlock your data with a 4–8 digit PIN.</p>
              </div>
              {demoPin && (
                <Callout tone="info">
                  <p className="demo-pin">Demo PIN: <strong>{demoPin}</strong></p>
                </Callout>
              )}
              <Input
                ref={inputRef}
                id="pin-guard-input"
                label="PIN"
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                maxLength={8}
                value={pin}
                disabled={locked}
                error={error}
                onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ""))}
              />
              <div className="pin-guard-actions">
                <Button variant="ghost" onClick={() => setPin("")} disabled={!pin.length || locked}>
                  Clear
                </Button>
                <Button type="submit" variant="primary" disabled={pin.length < 4 || locked}>
                  Enter
                </Button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
