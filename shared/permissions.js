export const SCREENS = [
  { id: 'dashboard', label: 'Meu dia' },
  { id: 'table', label: 'Listas' },
  { id: 'kanban', label: 'Kanban' },
  { id: 'users', label: 'Acessos do Leads' },
  { id: 'help', label: 'Ajuda' },
  { id: 'packages', label: 'Pacotes' },
  { id: 'portfolio', label: 'Portfólio' },
  { id: 'atlas-early-access', label: 'Atlas' },
  { id: 'briefing-leads', label: 'Briefing' },
]
export const CRM_SCREENS = SCREENS.slice(0, 5)
export function resolveRole(user, administrator = false) {
  if (administrator) return 'admin'
  if (['operator', 'reader'].includes(user?.role)) return user.role
  // Preserve explicit legacy grants; absence no longer grants write access.
  return ['dashboard', 'table', 'kanban'].some(
    (id) => user?.screenPermissions?.[id]?.write === true,
  )
    ? 'operator'
    : 'reader'
}
export function resolvePermissions(user, administrator = false) {
  const active = user?.accessStatus === 'approved'
  const role = resolveRole(user, administrator)
  return Object.fromEntries(
    SCREENS.map(({ id }) => {
      if (administrator) return [id, { read: true, write: true }]
      const core = ['dashboard', 'table', 'kanban', 'help'].includes(id)
      const legacy = !user?.role && user?.screenPermissions != null
      const read =
        active && core && (!legacy || user.screenPermissions[id]?.read === true)
      const write =
        read &&
        id !== 'help' &&
        role === 'operator' &&
        (!legacy || user.screenPermissions[id]?.write === true)
      return [id, { read, write }]
    }),
  )
}
export function parsePermissions(input) {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some((key) => !SCREENS.some((s) => s.id === key))
  )
    return null
  const result = {}
  for (const { id } of SCREENS) {
    const value = input[id] ?? { read: false, write: false }
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      Object.keys(value).some((k) => !['read', 'write'].includes(k)) ||
      typeof value.read !== 'boolean' ||
      typeof value.write !== 'boolean' ||
      (value.write && !value.read)
    )
      return null
    result[id] = { read: value.read, write: value.write }
  }
  return result
}
export function canViewGroup(group, uid, administrator = false) {
  return (
    administrator ||
    (!!group &&
      !group.archivedAt &&
      group.visibility === 'selected' &&
      group.viewerUids?.includes(uid) === true)
  )
}
export function canOperate(user, administrator = false) {
  if (administrator) return true
  const p = resolvePermissions(user)
  return (
    user?.accessStatus === 'approved' &&
    ['dashboard', 'table', 'kanban'].some((id) => p[id].write)
  )
}
