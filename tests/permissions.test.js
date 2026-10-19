import test from 'node:test'
import assert from 'node:assert/strict'
import { canViewGroup, parsePermissions, resolvePermissions } from '../shared/permissions.js'

test('permissions deny invalid grants and preserve only existing legacy access', () => {
  for (const input of [null, [], { unknown: { read: true, write: true } }, { table: { read: false, write: true } }, { table: { read: 'yes', write: false } }]) assert.equal(parsePermissions(input), null)
  const configured = parsePermissions({ table: { read: true, write: false } })
  assert.equal(configured.table.read, true)
  assert.equal(configured.kanban.read, false)
  assert.equal(resolvePermissions({ accessStatus: 'approved' }).table.write, true)
  assert.equal(resolvePermissions({ accessStatus: 'pending' }).table.read, false)
  assert.equal(resolvePermissions({ accessStatus: 'approved', screenPermissions: {} }).table.read, false)
  assert.equal(resolvePermissions({}, true).table.write, true)
  assert.equal(canViewGroup({ visibility: 'selected', viewerUids: [] }, 'reader'), false)
  assert.equal(canViewGroup({ visibility: 'selected', viewerUids: [] }, 'owner', true), true)
})

test('API enforces screens and list audiences on reads, exports and every mutation', async (t) => {
  process.env.MONGODB_URI = 'mongodb://localhost/test'
  process.env.VITE_FIREBASE_API_KEY = 'test-key'
  global.mongoose = { conn: {}, promise: null }
  const { User } = await import('../api/lib/user.js')
  const { Lead } = await import('../api/lib/lead.js')
  const { LeadGroup } = await import('../api/lib/lead-group.js')
  const { QnA } = await import('../api/lib/qna.js')
  const { default: app } = await import('../api/app.js')
  const clone = value => structuredClone(value)
  const users = [
    { firebaseUid: 'owner', email: 'mateus.desenv@gmail.com', accessStatus: 'approved', screenPermissions: {} },
    { firebaseUid: 'reader', email: 'reader@example.com', accessStatus: 'approved', screenPermissions: { table: { read: true, write: false } } },
    { firebaseUid: 'writer', email: 'writer@example.com', accessStatus: 'approved', screenPermissions: { table: { read: true, write: true }, kanban: { read: true, write: false }, help: { read: true, write: false }, users: { read: true, write: true } } },
    { firebaseUid: 'pending', email: 'pending@example.com', accessStatus: 'pending', screenPermissions: {} },
  ]
  const groups = [
    { groupId: 'public', groupTitle: 'Public', visibility: 'all', viewerUids: [] },
    { groupId: 'private', groupTitle: 'Private', visibility: 'selected', viewerUids: ['reader', 'writer'] },
    { groupId: 'hidden', groupTitle: 'Hidden', visibility: 'selected', viewerUids: [] },
    { groupId: 'empty', groupTitle: 'Empty', visibility: 'selected', viewerUids: ['writer'] },
  ]
  const records = ['public', 'private', 'hidden', 'legacy', null].map((groupId, i) => ({ placeId: `lead-${i}`, title: `Lead ${i}`, groupId, groupTitle: groupId, kanbanState: { column: 'open' } }))
  const matches = (row, filter) => Object.entries(filter).every(([key, value]) => {
    if (value && typeof value === 'object') {
      return (!value.$type || typeof row[key] === value.$type) && (!value.$regex || value.$regex.test(row[key]))
        && (!value.$in || value.$in.includes(row[key])) && (!value.$nin || !value.$nin.includes(row[key]))
    }
    return row[key] === value
  })
  t.mock.method(User, 'findOne', async filter => users.find(user => matches(user, filter)))
  t.mock.method(User, 'find', async filter => users.filter(user => matches(user, filter)))
  t.mock.method(User, 'findOneAndUpdate', async (filter, update, options) => {
    let user = users.find(user => matches(user, filter))
    if (!user && options?.upsert) { user = { accessStatus: 'pending', ...update.$setOnInsert }; users.push(user) }
    if (!user) return null
    Object.assign(user, update.$set); return user
  })
  t.mock.method(LeadGroup, 'find', async filter => clone(groups.filter(group => matches(group, filter))))
  t.mock.method(LeadGroup, 'findOne', async filter => clone(groups.find(group => matches(group, filter))))
  t.mock.method(LeadGroup, 'create', async group => { groups.push(clone(group)); return group })
  t.mock.method(LeadGroup, 'updateOne', async (filter, update, options) => {
    let group = groups.find(group => matches(group, filter))
    if (!group && options?.upsert) { group = { ...filter }; groups.push(group) }
    if (group) Object.assign(group, update.$set)
    return { modifiedCount: group ? 1 : 0 }
  })
  t.mock.method(Lead, 'find', async filter => clone(records.filter(record => matches(record, filter))))
  t.mock.method(Lead, 'findOne', async filter => clone(records.find(record => matches(record, filter))))
  t.mock.method(Lead, 'findOneAndUpdate', async (filter, update) => {
    const record = records.find(record => matches(record, filter))
    if (!record) return null
    for (const [key, value] of Object.entries(update.$set)) {
      if (key.startsWith('kanbanState.')) record.kanbanState[key.slice(12)] = value
      else record[key] = value
    }
    return clone(record)
  })
  t.mock.method(Lead, 'findOneAndDelete', async filter => {
    const i = records.findIndex(record => matches(record, filter))
    return i < 0 ? null : records.splice(i, 1)[0]
  })
  const bulk = t.mock.method(Lead, 'bulkWrite', async () => ({ modifiedCount: 0 }))
  t.mock.method(QnA, 'find', () => ({ sort: async () => [] }))
  const originalFetch = global.fetch
  t.mock.method(global, 'fetch', (url, options) => {
    if (!String(url).startsWith('https://identitytoolkit.googleapis.com/')) return originalFetch(url, options)
    const token = JSON.parse(options.body).idToken
    const user = users.find(user => user.firebaseUid === token)
    return Promise.resolve(new Response(JSON.stringify({ users: user ? [{ localId: user.firebaseUid, email: user.email, emailVerified: true }] : [] }), { status: user ? 200 : 400 }))
  })
  const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  const request = (path, user = 'reader', method = 'GET', body, screen) => originalFetch(`http://127.0.0.1:${server.address().port}${path}`, {
    method, headers: { Authorization: `Bearer ${user}`, 'Content-Type': 'application/json', ...(screen && { 'X-CRM-Screen': screen }) },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  })
  const ids = entries => entries.map(entry => entry.placeId)
  try {
    assert.deepEqual(ids(await (await request('/api/leads')).json()), ['lead-0', 'lead-1', 'lead-3'])
    for (const path of ['/api/LEADS', '/api/leads/', '/api/LEADS/EXPORT/']) assert.deepEqual(ids(await (await request(path)).json()), ['lead-0', 'lead-1', 'lead-3'])
    assert.deepEqual(ids(await (await request('/api/leads/export')).json()), ['lead-0', 'lead-1', 'lead-3'])
    assert.deepEqual((await (await request('/api/lead-groups')).json()).map(group => group.groupId), ['legacy', 'private', 'public'])
    assert.equal((await request('/api/leads', 'reader', 'GET', undefined, 'kanban')).status, 403)
    assert.equal((await request('/api/leads', 'writer', 'GET', undefined, 'kanban')).status, 200)
    assert.equal((await request('/api/leads', 'writer', 'GET', undefined, 'dashboard')).status, 403)
    assert.equal((await request('/api/leads', 'writer', 'GET', undefined, 'help')).status, 400)
    for (const [path, method] of [
      ['/api/lead-groups', 'POST'], ['/api/leads', 'POST'], ['/api/leads/import', 'POST'], ['/api/leads/batch', 'PUT'],
      ['/api/leads/lead-0', 'PUT'], ['/api/leads/lead-0/details', 'PATCH'], ['/api/leads/lead-0/message-sent', 'PATCH'],
      ['/api/leads/lead-0', 'DELETE'], ['/api/leads/group/public', 'PUT'], ['/api/leads/group/public', 'DELETE'],
    ]) assert.equal((await request(path, 'reader', method, {})).status, 403, `${method} ${path}`)
    assert.equal((await request('/api/leads/lead-0', 'writer', 'PUT', { kanbanState: { column: 'contato' } }, 'kanban')).status, 403)
    assert.equal((await request('/api/leads/lead-0', 'writer', 'PUT', { kanbanState: { column: 'contato' } }, 'table')).status, 200)
    const details = { title: 'Changed', categoryName: '', phone: '', website: '', address: '', column: 'open', collectedData: '' }
    const before = clone(records)
    for (const [path, method, body] of [
      ['/api/leads/lead-2', 'PUT', { kanbanState: { column: 'contato' } }],
      ['/api/leads/lead-2/details', 'PATCH', details], ['/api/leads/lead-2/message-sent', 'PATCH', { sent: true }], ['/api/leads/lead-2', 'DELETE'],
      ['/api/LEADS/lead-2/', 'PUT', { kanbanState: { column: 'contato' } }],
      ['/api/LEADS/GROUP/hidden/', 'DELETE'],
      ['/api/leads/group/hidden', 'PUT', { groupTitle: 'Changed' }], ['/api/leads/group/hidden', 'DELETE'],
      ['/api/leads', 'POST', { groupId: 'hidden', title: 'Forged', placeId: 'forged' }],
      ['/api/leads/batch', 'PUT', [{ placeId: 'lead-0', kanbanState: { column: 'perdido' } }, { placeId: 'lead-2', kanbanState: { column: 'perdido' } }]],
      ['/api/leads/import', 'POST', { title: 'Import', leads: [{ placeId: 'lead-2', title: 'Hijacked' }] }],
    ]) assert.equal((await request(path, 'writer', method, body)).status, 404, `${method} ${path}`)
    assert.deepEqual(records, before)
    assert.equal(bulk.mock.callCount(), 0)
    assert.equal(groups.length, 4, 'failed import creates no group')
    assert.equal((await request('/api/qna', 'writer')).status, 200)
    assert.equal((await request('/api/qna', 'writer', 'POST', { question: 'Q', answer: 'A' })).status, 403)
    for (const path of ['/api/atlas/early-access', '/api/ATLAS/EARLY-ACCESS/', '/api/briefing/leads', '/api/BRIEFING/LEADS/', '/api/qna', '/api/QNA/']) assert.equal((await request(path)).status, 403)
    assert.equal((await request('/api/users/reader/permissions', 'writer', 'PATCH', { screenPermissions: {} })).status, 403)
    assert.equal((await request('/api/users/owner/permissions', 'owner', 'PATCH', { screenPermissions: {} })).status, 403)
    assert.equal((await request('/api/users/reader/permissions', 'owner', 'PATCH', { screenPermissions: { table: { read: false, write: true } } })).status, 400)
    assert.equal((await request('/api/lead-groups/public/access', 'writer', 'PATCH', { visibility: 'all', viewerUids: [] })).status, 403)
    assert.equal((await request('/api/lead-groups/public/access', 'owner', 'PATCH', { visibility: 'selected', viewerUids: ['pending'] })).status, 400)
    assert.equal((await request('/api/lead-groups/public/access', 'owner', 'PATCH', { visibility: 'selected', viewerUids: ['writer'] })).status, 200)
    assert.deepEqual(ids(await (await request('/api/leads')).json()), ['lead-1', 'lead-3'])
    assert.deepEqual(ids(await (await request('/api/leads/export')).json()), ['lead-1', 'lead-3'])
    assert.equal((await (await request('/api/lead-groups')).json()).some(group => group.groupId === 'public'), false)
    assert.equal((await request('/api/lead-groups/legacy/access', 'owner', 'PATCH', { visibility: 'selected', viewerUids: [] })).status, 200)
    assert.deepEqual(ids(await (await request('/api/leads')).json()), ['lead-1'])
    assert.equal((await (await request('/api/leads', 'owner')).json()).length, 4, 'administrator retains all active leads')
    assert.equal((await request('/api/users/reader/permissions', 'owner', 'PATCH', { screenPermissions: {} })).status, 200)
    assert.equal((await request('/api/leads')).status, 403, 'permission revocation applies on the next request')
    const sync = await (await request('/api/users/me', 'reader', 'PUT', { screenPermissions: { table: { read: true, write: true } }, accessStatus: 'approved' })).json()
    assert.equal(sync.screenPermissions.table.read, false, 'self-sync cannot grant permissions')
    const newList = await (await request('/api/lead-groups', 'writer', 'POST', { groupTitle: 'Writer private list', visibility: 'all' })).json()
    assert.equal(groups.find(group => group.groupId === newList.groupId).visibility, 'selected')
    assert.deepEqual(groups.find(group => group.groupId === newList.groupId).viewerUids, ['writer'])
  } finally { await new Promise(resolve => server.close(resolve)) }
})
