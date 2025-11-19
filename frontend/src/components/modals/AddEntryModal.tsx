import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Api } from "../../api";
import { useAppStore } from "../../store";
import { ModalBase } from "./ModalBase";
import { FormSection } from "../FormSection";
import { SoftButton } from "../SoftButton";

export function AddEntryModal() {
  const qc = useQueryClient();
  const { modals, closeModal, tab, year } = useAppStore();

  const open = modals.add;
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus na input po otwarciu
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

    await Api.entries.add({
      type: tab === "incomes" ? "income" : "expense",
      year,
      name: name.trim(),
    });

    setName("");
    closeModal("add");

    qc.invalidateQueries({
      queryKey: ["entries", tab === "incomes" ? "income" : "expense", year],
    });
  }

  return (
    <ModalBase
      open={open}
      title={tab === "incomes" ? "Add income entry" : "Add expense entry"}
      onClose={() => {
        closeModal("add");
        setName("");
      }}
      size="sm"
    >
      <div className="space-y-4">
        <FormSection
          //label="Details"
          title="Entry name"
          //description="Max 40 characters."
        >
          <div className="field-stack">
            <label className="field-label" htmlFor="entry-name-input">
              Name
            </label>
            <input
              id="entry-name-input"
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
            <p className="field-helper">You can rename entries later.</p>
          </div>
        </FormSection>

        <div className="modal-footer-premium flex justify-end gap-2">
          <SoftButton
            type="button"
            variant="ghost"
            onClick={() => {
              closeModal("add");
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
            Add entry
          </button>
        </div>
      </div>
    </ModalBase>
  );
}
