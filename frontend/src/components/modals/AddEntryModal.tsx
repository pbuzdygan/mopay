import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Api } from "../../api";
import { useAppStore } from "../../store";
import { ModalBase } from "./ModalBase";
import { Button, Callout, Input, Select } from "../ui";

export function AddEntryModal() {
  const qc = useQueryClient();
  const { modals, closeModal, tab, year, addEntryGroupId } = useAppStore();

  const open = modals.add;
  const [name, setName] = useState("");
  const [groupId, setGroupId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const type = tab === "incomes" ? "income" : "expense";
  const groupsQ = useQuery({
    enabled: open && !!year,
    queryKey: ["entry-groups", type, year],
    queryFn: () => Api.entryGroups.list(type, year!),
  });
  const groups = (groupsQ.data?.groups ?? []) as Array<{ id: number; name: string }>;

  // Focus the name field after opening.
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
    if (!name.trim() || !year || saving) return;

    setSaving(true);
    setError(null);
    try {
      await Api.entries.add({
        type: tab === "incomes" ? "income" : "expense",
        year,
        name: name.trim(),
        groupId,
      });
    } catch {
      // The dialog stays open with the typed name and group, so the same click retries.
      setError("Could not add the entry. Try again.");
      return;
    } finally {
      setSaving(false);
    }

    setName("");
    setGroupId(null);
    closeModal("add");

    qc.invalidateQueries({
      queryKey: ["entries", tab === "incomes" ? "income" : "expense", year],
    });
  }

  function close() {
    closeModal("add");
    setName("");
    setGroupId(null);
    setError(null);
  }

  return (
    <ModalBase
      open={open}
      title={tab === "incomes" ? "Add income entry" : "Add expense entry"}
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
          id="entry-name-input"
          ref={inputRef}
          label="Name"
          hint="You can rename entries later."
          maxLength={40}
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Select
          id="entry-group-input"
          label="Place entry in"
          hint="You can move the entry later from its details panel."
          value={groupId ?? ""}
          onChange={(e) => setGroupId(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">Ungrouped</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>{group.name}</option>
          ))}
        </Select>
        {error && <Callout tone="danger" role="alert">{error}</Callout>}
        <div className="ui-dialog-actions">
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={!name.trim() || !year} loading={saving}>
            Add entry
          </Button>
        </div>
      </form>
    </ModalBase>
  );
}
