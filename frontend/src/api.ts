const BASE = (import.meta as any).env.VITE_API_BASE || '';
export async function api(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, { headers: { 'Content-Type': 'application/json' }, ...init });
  if (!res.ok) throw new Error(await res.text());
  return res.headers.get('content-type')?.includes('json') ? res.json() : res;
}
export const Api = {
  verifyPin: (pin: string) => api('/api/pin/verify', { method: 'POST', body: JSON.stringify({ pin }) }),
  years: { list: () => api('/api/years'), exists: () => api('/api/years/exists'), add: (year: number) => api('/api/years', { method: 'POST', body: JSON.stringify({ year }) }), remove: (years: number[]) => api('/api/years', { method: 'DELETE', body: JSON.stringify({ years }) }) },
  entries: {
    list: (type: 'income'|'expense', year: number) => api(`/api/entries?type=${type}&year=${year}`),
    add: (payload: { type: 'income'|'expense'; year: number; name: string; }) => api('/api/entries', { method: 'POST', body: JSON.stringify(payload) }),
    patch: (id: number, payload: any) => api(`/api/entries/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    remove: (ids: number[]) => api('/api/entries', { method: 'DELETE', body: JSON.stringify({ ids }) }),
    reorder: (orderedIds: number[]) => api('/api/entries/reorder', { method: 'POST', body: JSON.stringify({ orderedIds }) })
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
  exportYears: async (years: number[]) => {
    const res = await fetch(`${BASE}/api/export`, { method: 'POST', body: JSON.stringify({ years }), headers: { 'Content-Type': 'application/json' } });
    const blob = await res.blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = 'mopay_export.xlsx'; a.click(); URL.revokeObjectURL(url);
  }
};
