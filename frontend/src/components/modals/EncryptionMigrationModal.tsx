import { Api } from "../../api";
import { Button, Callout, Icon } from "../ui";
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
      icon={<Icon name="shield" />}
      onClose={handleClose}
      size="md"
    >
      <div className="encryption-copy">
        <p>
          This Mopay update encrypted all existing income, expense, and savings amounts. Even if someone copies the
          database file, they cannot read your numbers without the encryption key.
        </p>
        <Callout tone="warning" title="Keep the key safe">
          <p>
            The APP_ENC_KEY was loaded from your Docker configuration. Without it the encrypted data cannot be decrypted.
          </p>
        </Callout>
        {message && <p className="encryption-note">{message}</p>}
      </div>
      <div className="ui-dialog-actions">
        <Button variant="primary" onClick={handleClose}>
          Got it
        </Button>
      </div>
    </ModalBase>
  );
}
