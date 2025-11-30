import { Api } from "../../api";
import { useAppStore } from "../../store";
import { ModalBase } from "./ModalBase";

export function EncryptionMigrationModal() {
  const { open, message } = useAppStore((s) => s.migrationNotice);
  const setMigrationNotice = useAppStore((s) => s.setMigrationNotice);

  const handleClose = async () => {
    try {
      await Api.encryption.noticeAck();
    } catch {
      // ignore errors, user can close anyway
    }
    setMigrationNotice(false);
  };

  return (
    <ModalBase
      open={open}
      title="Your data has been encrypted"
      subtitle="Amounts are now protected with your APP_ENC_KEY"
      onClose={handleClose}
      size="md"
    >
      <div className="stack-md">
        <p className="type-body-sm">
          This Mopay update encrypted all existing income, expense, and savings amounts. Even if someone copies the
          database file, they cannot read your numbers without the encryption key.
        </p>
        <p className="type-body-sm">
          The APP_ENC_KEY was loaded from your Docker configuration. Keep it safe – without it the encrypted data cannot
          be decrypted.
        </p>
        {message && <p className="type-body-sm text-textSec">{message}</p>}
      </div>
      <div className="mt-4 flex justify-end">
        <button type="button" className="btn btn-primary-premium" onClick={handleClose}>
          Got it
        </button>
      </div>
    </ModalBase>
  );
}
