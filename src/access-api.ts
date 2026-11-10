import { apiFetch } from './api'
import type { AccessSnapshot } from './UserManagement'
export async function loadAccess(): Promise<AccessSnapshot> {
  const r = await apiFetch('/api/admin/access')
  if (!r.ok) throw Error('Não foi possível carregar os acessos.')
  return r.json()
}
export async function saveAccess(url: string, body: unknown, method = 'PUT') {
  const r = await apiFetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await r.json()
  if (!r.ok) throw Error(data.error || 'Não foi possível salvar.')
  return data
}
