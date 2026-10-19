export const SCREENS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'kanban', label: 'Kanban' },
  { id: 'table', label: 'Leads e listas' },
  { id: 'packages', label: 'Pacotes' },
  { id: 'portfolio', label: 'Portfólio' },
  { id: 'users', label: 'Usuários e perfil' },
  { id: 'help', label: 'Help' },
  { id: 'atlas-early-access', label: 'Atlas — Acesso antecipado' },
  { id: 'briefing-leads', label: 'Briefing — Leads' },
]

export function resolvePermissions(user, administrator = false) {
  // Existing approved accounts retain their access until explicitly configured.
  const legacy = user?.screenPermissions == null && user?.accessStatus === 'approved'
  return Object.fromEntries(SCREENS.map(({ id }) => {
    const entry = user?.screenPermissions?.[id]
    const read = administrator || (legacy ? true : entry?.read === true)
    return [id, { read, write: read && (administrator || (legacy ? true : entry?.write === true)) }]
  }))
}

export function parsePermissions(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || Object.keys(input).some(key => !SCREENS.some(screen => screen.id === key))) return null
  const result = {}
  for (const { id } of SCREENS) {
    const value = input[id] ?? { read: false, write: false }
    if (!value || typeof value !== 'object' || Array.isArray(value)
      || Object.keys(value).some(key => !['read', 'write'].includes(key))
      || typeof value.read !== 'boolean' || typeof value.write !== 'boolean'
      || (value.write && !value.read)) return null
    result[id] = { read: value.read, write: value.write }
  }
  return result
}

export function canViewGroup(group, uid, administrator = false) {
  return administrator || group?.visibility !== 'selected' || group.viewerUids?.includes(uid) === true
}
