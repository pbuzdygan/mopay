const BASE = (import.meta as any).env.VITE_API_BASE || '';
export async function api(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, { headers: { 'Content-Type': 'application/json' }, ...init });
  if (!res.ok) throw new Error(await res.text());
  return res.headers.get('content-type')?.includes('json') ? res.json() : res;
}
export const Api = {
  meta: () => api('/api/meta'),
  verifyPin: (pin: string) => api('/api/pin/verify', { method: 'POST', body: JSON.stringify({ pin }) }),
  years: { list: () => api('/api/years'), exists: () => api('/api/years/exists'), add: (year: number) => api('/api/years', { method: 'POST', body: JSON.stringify({ year }) }), remove: (years: number[]) => api('/api/years', { method: 'DELETE', body: JSON.stringify({ years }) }) },
  entries: {
    list: (type: 'income'|'expense', year: number) => api(`/api/entries?type=${type}&year=${year}`),
    add: (payload: { type: 'income'|'expense'; year: number; name: string; groupId?: number | null }) => api('/api/entries', { method: 'POST', body: JSON.stringify(payload) }),
    patch: (id: number, payload: any) => api(`/api/entries/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    remove: (ids: number[]) => api('/api/entries', { method: 'DELETE', body: JSON.stringify({ ids }) }),
    reorder: (orderedIds: number[]) => api('/api/entries/reorder', { method: 'POST', body: JSON.stringify({ orderedIds }) })
  },
  entryGroups: {
    list: (type: 'income' | 'expense', year: number) => api(`/api/entry-groups?type=${type}&year=${year}`),
    add: (payload: { type: 'income' | 'expense'; year: number; name: string }) =>
      api('/api/entry-groups', { method: 'POST', body: JSON.stringify(payload) }),
    patch: (id: number, payload: { name?: string; sortIndex?: number }) =>
      api(`/api/entry-groups/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    remove: (ids: number[]) => api('/api/entry-groups', { method: 'DELETE', body: JSON.stringify({ ids }) }),
    reorder: (payload: { type: 'income' | 'expense'; year: number; orderedIds: number[] }) =>
      api('/api/entry-groups/order', { method: 'PATCH', body: JSON.stringify(payload) }),
  },
  savings: {
    list: (year: number) => api(`/api/savings?year=${year}`),
    addGoal: (payload: { year: number; name: string; targetValue: number | null }) => api('/api/savings', { method: 'POST', body: JSON.stringify(payload) }),
    updateGoal: (id: number, payload: { name?: string; targetValue?: number | null }) => api(`/api/savings/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    removeGoal: (id: number) => api(`/api/savings/${id}`, { method: 'DELETE' }),
    addItem: (goalId: number) => api(`/api/savings/${goalId}/items`, { method: 'POST', body: JSON.stringify({}) }),
    updateItem: (itemId: number, payload: { name?: string; value?: number }) => api(`/api/savings/items/${itemId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    removeItem: (itemId: number) => api(`/api/savings/items/${itemId}`, { method: 'DELETE' }),
  },
  encryption: {
    status: () => api('/api/encryption/status'),
    noticeAck: () => api('/api/encryption/notice-ack', { method: 'POST', body: JSON.stringify({}) }),
    resetData: () => api('/api/encryption/reset', { method: 'POST', body: JSON.stringify({ confirm: true }) }),
  },
  tags: {
    list: (year: number) => api(`/api/tags?year=${year}`),
    save: (payload: { entryId: number; month: string; color: string; text: string }) =>
      api('/api/tags', { method: 'POST', body: JSON.stringify(payload) }),
    remove: (entryId: number, month: string) =>
      api(`/api/tags?entryId=${entryId}&month=${month}`, { method: 'DELETE' }),
  },
  exportYears: async (years: number[]) => {
    const res = await fetch(`${BASE}/api/export`, { method: 'POST', body: JSON.stringify({ years }), headers: { 'Content-Type': 'application/json' } });
    const blob = await res.blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = 'mopay_export.xlsx'; a.click(); URL.revokeObjectURL(url);
  },
  downloadImportTemplate: async () => {
    const res = await fetch(`${BASE}/api/import/template`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mopay_import_template.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  },
  validateImportTemplate: (payload: { name: string; data: string }) =>
    api('/api/import/validate', { method: 'POST', body: JSON.stringify(payload) }),
  importData: (payload: { name: string; data: string; overwriteYears: number[]; importYears: number[] }) =>
    api('/api/import', { method: 'POST', body: JSON.stringify(payload) }),
};
