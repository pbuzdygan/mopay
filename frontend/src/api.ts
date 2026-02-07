import { useAppStore } from './store';

const BASE = (import.meta as any).env.VITE_API_BASE || '';
export class ApiError extends Error {
  status: number;
  retryAfterSeconds: number | null;
  body: any;
  constructor(message: string, status: number, retryAfterSeconds: number | null, body: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
    this.body = body;
  }
}

function authHeaders() {
  const token = sessionStorage.getItem('pin-token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['X-Mopay-Session'] = token;
  return headers;
}

export async function api(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { ...authHeaders(), ...(init?.headers as Record<string, string> | undefined) },
    ...init,
  });
  const retryAfterRaw = res.headers.get('retry-after');
  const retryAfterSeconds = retryAfterRaw ? Number(retryAfterRaw) : null;
  const isJson = res.headers.get('content-type')?.includes('json');
  const body = isJson ? await res.json() : await res.text();
  if (!res.ok) {
    if (res.status === 401 && path !== '/api/pin/verify' && path !== '/api/pin/logout') {
      sessionStorage.removeItem('pin-token');
      sessionStorage.removeItem('pin-ok');
      useAppStore.getState().setPinSession(false);
    }
    const message = typeof body === 'string'
      ? body
      : body?.message || body?.error || `API request failed (${res.status})`;
    throw new ApiError(message, res.status, Number.isFinite(retryAfterSeconds ?? NaN) ? retryAfterSeconds : null, body);
  }
  return body;
}
export const Api = {
  meta: () => api('/api/meta'),
  verifyPin: (pin: string) => api('/api/pin/verify', { method: 'POST', body: JSON.stringify({ pin }) }),
  logoutPin: () => api('/api/pin/logout', { method: 'POST', body: JSON.stringify({}) }),
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
    const res = await fetch(`${BASE}/api/export`, {
      method: 'POST',
      body: JSON.stringify({ years }),
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error('Export failed');
    const blob = await res.blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = 'mopay_export.xlsx'; a.click(); URL.revokeObjectURL(url);
  },
  downloadImportTemplate: async () => {
    const res = await fetch(`${BASE}/api/import/template`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Template download failed');
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
