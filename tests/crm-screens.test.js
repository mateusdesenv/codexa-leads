import test from 'node:test'
import assert from 'node:assert/strict'
import { CRM_SCREENS, parsePermissions, resolvePermissions } from '../shared/permissions.js'

test('CRM screen selection excludes retired views even for legacy accounts', () => {
  const visible = permissions => CRM_SCREENS.filter(screen => permissions[screen.id].read).map(screen => screen.id)
  assert.deepEqual(visible(resolvePermissions({}, true)), ['dashboard', 'table', 'kanban', 'users', 'help'])
  const legacy = parsePermissions({ portfolio: { read: true, write: true }, 'briefing-leads': { read: true, write: false } })
  assert.deepEqual(visible(resolvePermissions({ accessStatus: 'approved', screenPermissions: legacy })), [])
  const edited = parsePermissions({ ...legacy, table: { read: true, write: false } })
  assert.deepEqual(visible(resolvePermissions({ accessStatus: 'approved', screenPermissions: edited })), ['table'])
  assert.deepEqual(edited.portfolio, legacy.portfolio)
  assert.deepEqual(edited['briefing-leads'], legacy['briefing-leads'])
})
