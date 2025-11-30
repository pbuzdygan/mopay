import { useState } from "react";
import { Api } from "../../api";
import { useAppStore } from "../../store";
import { ModalBase } from "./ModalBase";

export function EncryptionKeyMismatchModal() {
  const keyMismatch = useAppStore((s) => s.keyMismatch);
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReset = async () => {
    setLoading(true);
    setError(null);
    try {
      await Api.encryption.resetData();
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setLoading(false);
      setConfirming(false);
    }
  };

  return (
    <ModalBase
      open={keyMismatch}
      title="Encryption key mismatch"
      subtitle="Restore the previous APP_ENC_KEY or wipe all data to continue"
      onClose={() => {}}
      disableClose
      size="md"
    >
      <div className="stack-md">
        <p className="type-body-sm">
          Your <code>APP_ENC_KEY</code> has been changed and does not match the key that was used to encrypt the current
          data. To keep your data, edit your Docker configuration, restore the previous key, and restart Mopay.
        </p>
        <p className="type-body-sm">
          If the old key is lost, you can wipe all stored data and start fresh. This action is irreversible.
        </p>
        {error && (
          <p className="type-body-sm" style={{ color: "var(--error)" }}>
            {error}
          </p>
        )}
      </div>

      <div className="mt-6 space-y-3">
        {!confirming && (
          <button
            type="button"
            className="btn w-full"
            onClick={() => setConfirming(true)}
            disabled={loading}
          >
            Reset all data and start fresh
          </button>
        )}
        {confirming && (
          <div className="stack-sm">
            <p className="type-body-sm" style={{ color: "var(--error)" }}>
              Confirm reset: all years, entries, and savings data will be permanently deleted.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                className="btn flex-1"
                onClick={() => setConfirming(false)}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger flex-1"
                onClick={handleReset}
                disabled={loading}
              >
                {loading ? "Resetting..." : "Confirm reset"}
              </button>
            </div>
          </div>
        )}
      </div>
    </ModalBase>
  );
}
