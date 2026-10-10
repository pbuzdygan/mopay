import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Api } from "../../api";
import { useAppStore } from "../../store";
import { ModalBase } from "./ModalBase";
import { Button, Callout, Input } from "../ui";

export function AddGroupModal() {
  const qc = useQueryClient();
  const { modals, closeModal, tab, year } = useAppStore();

  const open = modals.addGroup;
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    const tm = setTimeout(() => inputRef.current?.focus(), 80);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(tm);
    };
  }, [open]);

  async function submit() {
    if (!name.trim() || !year || saving) return;

    const type = tab === "incomes" ? "income" : "expense";
    setSaving(true);
    setError(null);
    try {
      await Api.entryGroups.add({
        type,
        year,
        name: name.trim(),
      });
    } catch {
      // The dialog stays open with the typed name, so the same click retries.
      setError("Could not add the group. Try again.");
      return;
    } finally {
      setSaving(false);
    }

    setName("");
    closeModal("addGroup");

    qc.invalidateQueries({
      queryKey: ["entry-groups", type, year],
    });
  }

  function close() {
    closeModal("addGroup");
    setName("");
    setError(null);
  }

  return (
    <ModalBase
      open={open}
      title={tab === "incomes" ? "Add income group" : "Add expense group"}
      onClose={close}
      size="sm"
      mobileAlign="top"
    >
      <form
        className="dialog-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Input
          id="group-name-input"
          ref={inputRef}
          label="Name"
          hint="You can rename groups later."
          maxLength={40}
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        {error && <Callout tone="danger" role="alert">{error}</Callout>}
        <div className="ui-dialog-actions">
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={!name.trim() || !year} loading={saving}>
            Add group
          </Button>
        </div>
      </form>
    </ModalBase>
  );
}
