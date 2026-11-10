import test from 'node:test'
import assert from 'node:assert/strict'
import {
  canViewGroup,
  resolvePermissions,
  resolveRole,
  parsePermissions,
  canOperate,
} from '../shared/permissions.js'
test('missing policy never grants broad list access or legacy write privileges', () => {
  assert.equal(canViewGroup(undefined, 'u'), false)
  assert.equal(canViewGroup({ visibility: 'all' }, 'u'), false)
  assert.equal(
    canViewGroup(
      { visibility: 'selected', viewerUids: ['u'], archivedAt: '2026-01-01' },
      'u',
    ),
    false,
  )
  assert.equal(
    canViewGroup({ visibility: 'selected', viewerUids: ['u'] }, 'u'),
    true,
  )
  assert.equal(canViewGroup(undefined, 'owner', true), true)
  assert.equal(resolveRole({ accessStatus: 'approved' }), 'reader')
  assert.equal(
    resolvePermissions({ accessStatus: 'approved' }).table.write,
    false,
  )
  assert.equal(
    canOperate({ role: 'operator', accessStatus: 'suspended' }),
    false,
  )
})
test('explicit legacy restrictions stay restricted until an administrator chooses a profile', () => {
  const p = resolvePermissions({
    accessStatus: 'approved',
    screenPermissions: { table: { read: true, write: false } },
  })
  assert.deepEqual(p.table, { read: true, write: false })
  assert.equal(p.kanban.read, false)
  assert.equal(p['briefing-leads'].read, false)
  assert.equal(
    resolvePermissions({ role: 'operator', accessStatus: 'approved' }).kanban
      .write,
    true,
  )
  assert.equal(resolvePermissions({}, true).users.write, true)
  assert.equal(parsePermissions({ table: { read: false, write: true } }), null)
})
