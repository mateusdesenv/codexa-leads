import { apiFetch } from './api'
import type { AccessSnapshot } from './UserManagement'

function normalizeSnapshot(data: AccessSnapshot): AccessSnapshot {
  if (!data || !Array.isArray(data.users) || !Array.isArray(data.groups))
    throw Error('Não foi possível carregar os acessos. Tente atualizar.')
  return {
    ...data,
    groups: data.groups.map((group) => ({
      ...group,
      viewerUids: Array.isArray(group.viewerUids) ? group.viewerUids : [],
      assignees: Array.isArray(group.assignees) ? group.assignees : [],
    })),
  }
}

export async function loadAccess(): Promise<AccessSnapshot> {
  const r = await apiFetch('/api/admin/access')
  if (!r.ok) throw Error('Não foi possível carregar os acessos.')
  return normalizeSnapshot(await r.json())
}
export async function saveAccess(url: string, body: unknown, method = 'PUT') {
  const r = await apiFetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await r.json()
  if (!r.ok) throw Error(data.error || 'Não foi possível salvar.')
  if (Array.isArray(data?.users) && Array.isArray(data?.groups))
    return normalizeSnapshot(data)
  return data
}
