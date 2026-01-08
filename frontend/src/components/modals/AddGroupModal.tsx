import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Api } from "../../api";
import { useAppStore } from "../../store";
import { ModalBase } from "./ModalBase";
import { FormSection } from "../FormSection";
import { SoftButton } from "../SoftButton";

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

  return (
    <ModalBase
      open={open}
      title={tab === "incomes" ? "Add income group" : "Add expense group"}
      onClose={() => {
        closeModal("addGroup");
        setName("");
      }}
      size="sm"
      mobileAlign="top"
    >
      <div className="space-y-3 sm:space-y-4">
        <FormSection title="Group name">
          <div className="field-stack">
            <label className="field-label" htmlFor="group-name-input">
              Name
            </label>
            <input
              id="group-name-input"
              ref={inputRef}
              type="text"
              className="input"
              maxLength={40}
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
            />
            <p className="field-helper">You can rename groups later.</p>
          </div>
        </FormSection>

        <div className="modal-footer-premium flex justify-end gap-2">
          <SoftButton
            type="button"
            variant="ghost"
            onClick={() => {
              closeModal("addGroup");
              setName("");
            }}
          >
            Cancel
          </SoftButton>
          <button
            type="button"
            className="btn"
            disabled={!name.trim() || !year}
            onClick={submit}
          >
            Add group
          </button>
        </div>
      </div>
    </ModalBase>
  );
}
