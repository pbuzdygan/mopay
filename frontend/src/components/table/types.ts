import type { TagColor } from '../TagEditorPopover';

export type EntryTag = {
  id: number;
  entryId: number;
  month: string;
  color: TagColor;
  text?: string | null;
};

export type EntryGroup = { id: number; name: string; sortIndex: number };

export type EntryRowData = {
  id: number;
  name: string;
  comment?: string | null;
  groupId: number | null;
  sort_index: number;
  Jan: number | null;
  Feb: number | null;
  Mar: number | null;
  Apr: number | null;
  May: number | null;
  Jun: number | null;
  Jul: number | null;
  Aug: number | null;
  Sep: number | null;
  Oct: number | null;
  Nov: number | null;
  Decm: number | null;
};

export type EntryPatch = Partial<EntryRowData>;
