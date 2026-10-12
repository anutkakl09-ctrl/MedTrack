import type {
  BootstrapData,
  Dose,
  Medication,
  Profile,
  SchedulePreview,
} from './types';

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) || '';

function telegramHeaders() {
  const initData = window.Telegram?.WebApp?.initData || 'demo';
  return { 'x-telegram-init-data': initData };
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(API_URL + path, {
    headers: {
      'Content-Type': 'application/json',
      ...telegramHeaders(),
      ...(options?.headers || {}),
    },
    ...options,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: 'Ошибка запроса' }));
    throw new Error(body.message || 'Ошибка запроса');
  }
  return response.json() as Promise<T>;
}

export const api = {
  bootstrap: (profileId?: string) =>
    request<BootstrapData>('/api/bootstrap' + (profileId ? '?profileId=' + profileId : '')),
  createProfile: (payload: Partial<Profile>) =>
    request<Profile>('/api/profiles', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateProfile: (id: string, payload: Partial<Profile>) =>
    request<Profile>('/api/profiles/' + id, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  createMedication: (payload: Record<string, unknown>) =>
    request<Medication>('/api/medications', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateMedication: (id: string, payload: Record<string, unknown>) =>
    request<Medication>('/api/medications/' + id, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteMedication: (id: string) =>
    request<{ ok: true }>('/api/medications/' + id, { method: 'DELETE' }),
  doseAction: (id: string, action: string, payload?: Record<string, unknown>) =>
    request<Dose>('/api/doses/' + id + '/action', {
      method: 'POST',
      body: JSON.stringify({ action, ...(payload || {}) }),
    }),
  restock: (id: string, amount: number) =>
    request<Medication>('/api/medications/' + id + '/restock', {
      method: 'POST',
      body: JSON.stringify({ amount }),
    }),
  takeNow: (id: string) =>
    request<Dose>('/api/medications/' + id + '/take-now', {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  previewSchedule: (payload: Record<string, unknown>) =>
    request<SchedulePreview>('/api/schedule/preview', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
