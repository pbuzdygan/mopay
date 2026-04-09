import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Api } from '../../api';
import type { EntryGroup, EntryPatch, EntryRowData, EntryTag } from './types';

export function useTableQueryState({
  type,
  year,
}: {
  type: 'income' | 'expense';
  year: number | null;
}) {
  const entriesQuery = useQuery({
    enabled: !!year,
    queryKey: ['entries', type, year],
    queryFn: () => Api.entries.list(type, year!),
  });
  const groupsQuery = useQuery({
    enabled: !!year,
    queryKey: ['entry-groups', type, year],
    queryFn: () => Api.entryGroups.list(type, year!),
  });
  const tagsQuery = useQuery({
    enabled: !!year,
    queryKey: ['tags', year],
    queryFn: () => Api.tags.list(year!),
  });

  const entriesFromServer = (entriesQuery.data?.entries ?? []) as EntryRowData[];
  const groups = (groupsQuery.data?.groups ?? []) as EntryGroup[];
  const tagsList = (tagsQuery.data?.tags ?? []) as EntryTag[];

  const [entryOverrides, setEntryOverrides] = useState<Record<number, EntryPatch>>({});

  useEffect(() => {
    setEntryOverrides((prev) => {
      const validIds = new Set(entriesFromServer.map((entry) => entry.id));
      const next: Record<number, EntryPatch> = {};
      Object.entries(prev).forEach(([id, patch]) => {
        const numericId = Number(id);
        if (validIds.has(numericId)) next[numericId] = patch;
      });
      return next;
    });
  }, [entriesFromServer]);

  const rows = useMemo(
    () =>
      entriesFromServer.map((entry) => {
        const patch = entryOverrides[entry.id];
        return patch ? { ...entry, ...patch } : entry;
      }),
    [entriesFromServer, entryOverrides]
  );

  const tagsByEntry = useMemo(() => {
    const map = new Map<number, Record<string, EntryTag>>();
    for (const tag of tagsList) {
      if (!map.has(tag.entryId)) map.set(tag.entryId, {});
      map.get(tag.entryId)![tag.month] = tag;
    }
    return map;
  }, [tagsList]);

  const patchEntryLocal = (entryId: number, patch: EntryPatch) => {
    setEntryOverrides((prev) => ({
      ...prev,
      [entryId]: {
        ...(prev[entryId] ?? {}),
        ...patch,
      },
    }));
  };

  return {
    rows,
    groups,
    tagsByEntry,
    patchEntryLocal,
    setEntryOverrides,
  };
}
