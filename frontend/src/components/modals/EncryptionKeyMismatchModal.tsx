import { useState } from "react";
import { Api } from "../../api";
import { useAppStore } from "../../store";
import { ModalBase } from "./ModalBase";
import { Button, Callout, Icon } from "../ui";

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
      icon={<Icon name="shield" />}
      onClose={() => {}}
      disableClose
      size="md"
    >
      <div className="encryption-copy">
        <p>
          Your <code>APP_ENC_KEY</code> has been changed and does not match the key that was used to encrypt the current
          data. To keep your data, edit your Docker configuration, restore the previous key, and restart Mopay.
        </p>
        <p>If the old key is lost, you can wipe all stored data and start fresh. This action is irreversible.</p>
        {error && <Callout tone="danger" role="alert"><p>{error}</p></Callout>}
        {confirming && (
          <Callout tone="danger" title="Delete everything?">
            <p>Confirm reset: all years, entries, and savings data will be permanently deleted.</p>
          </Callout>
        )}
      </div>
      <div className="ui-dialog-actions">
        {!confirming ? (
          <Button variant="danger" onClick={() => setConfirming(true)} disabled={loading}>
            Reset all data and start fresh
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)} disabled={loading}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleReset} loading={loading}>
              {loading ? "Resetting..." : "Confirm reset"}
            </Button>
          </>
        )}
      </div>
    </ModalBase>
  );
}
