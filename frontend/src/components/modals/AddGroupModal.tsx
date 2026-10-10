import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Api } from "../../api";
import { useAppStore } from "../../store";
import { ModalBase } from "./ModalBase";
import { Button, Input } from "../ui";

export function AddGroupModal() {
  const qc = useQueryClient();
  const { modals, closeModal, tab, year } = useAppStore();

  const open = modals.addGroup;
  const [name, setName] = useState("");
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
    if (!name.trim() || !year) return;

    const type = tab === "incomes" ? "income" : "expense";
    await Api.entryGroups.add({
      type,
      year,
      name: name.trim(),
    });

    setName("");
    closeModal("addGroup");

    qc.invalidateQueries({
      queryKey: ["entry-groups", type, year],
    });
  }

  function close() {
    closeModal("addGroup");
    setName("");
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
        <div className="ui-dialog-actions">
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={!name.trim() || !year}>
            Add group
          </Button>
        </div>
      </form>
    </ModalBase>
  );
}
