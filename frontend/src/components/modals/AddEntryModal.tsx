import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Api } from "../../api";
import { useAppStore } from "../../store";
import { ModalBase } from "./ModalBase";
import { FormSection } from "../FormSection";
import { SoftButton } from "../SoftButton";

export function AddEntryModal() {
  const qc = useQueryClient();
  const { modals, closeModal, tab, year, addEntryGroupId } = useAppStore();

  const open = modals.add;
  const [name, setName] = useState("");
  const [groupId, setGroupId] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const type = tab === "incomes" ? "income" : "expense";
  const groupsQ = useQuery({
    enabled: open && !!year,
    queryKey: ["entry-groups", type, year],
    queryFn: () => Api.entryGroups.list(type, year!),
  });
  const groups = (groupsQ.data?.groups ?? []) as Array<{ id: number; name: string }>;

  // Focus na input po otwarciu
  useEffect(() => {
    if (!open) return;
    setGroupId(addEntryGroupId ?? null);
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    const tm = setTimeout(() => inputRef.current?.focus(), 80);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(tm);
    };
  }, [open, addEntryGroupId]);

  async function submit() {
    if (!name.trim() || !year) return;

    await Api.entries.add({
      type: tab === "incomes" ? "income" : "expense",
      year,
      name: name.trim(),
      groupId,
    });

    setName("");
    setGroupId(null);
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
        setGroupId(null);
      }}
      size="sm"
      mobileAlign="top"
    >
      <div className="space-y-3 sm:space-y-4">
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

        <FormSection title="Group">
          <div className="field-stack">
            <label className="field-label" htmlFor="entry-group-input">
              Place entry in
            </label>
            <select
              id="entry-group-input"
              className="input"
              value={groupId ?? ""}
              onChange={(e) => setGroupId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Ungrouped</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>
            <p className="field-helper">You can move the entry later from its details panel.</p>
          </div>
        </FormSection>

        <div className="modal-footer-premium flex justify-end gap-2">
          <SoftButton
            type="button"
            variant="ghost"
            onClick={() => {
              closeModal("add");
              setName("");
              setGroupId(null);
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
