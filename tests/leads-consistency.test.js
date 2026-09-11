import test from 'node:test'
import assert from 'node:assert/strict'
import { getMessageDay } from '../shared/message-day.js'

test('CRM reads and exports the same grouped database records and confirms saved state', async (t) => {
  process.env.MONGODB_URI = 'mongodb://localhost/test'
  process.env.VITE_FIREBASE_API_KEY = 'test-key'
  global.mongoose = { conn: {}, promise: null }
  const { Lead } = await import('../api/lib/lead.js')
  const { LeadGroup } = await import('../api/lib/lead-group.js')
  const { User } = await import('../api/lib/user.js')
  const assignees = [
    { firebaseUid: 'owner', displayName: 'Mateus', email: 'owner@example.com', accessStatus: 'approved' },
    { firebaseUid: 'helper', displayName: '', email: 'helper@example.com', accessStatus: 'approved' },
    { firebaseUid: 'pending', displayName: 'Pendente', email: 'pending@example.com', accessStatus: 'pending' },
  ]
  User.find = async (filter) => assignees.filter((user) => user.accessStatus === filter.accessStatus)
  User.findOne = async (filter) => assignees.find((user) => user.firebaseUid === filter.firebaseUid && user.accessStatus === filter.accessStatus)

  const lists = []
  LeadGroup.find = async () => lists.map((group) => ({ ...group }))
  LeadGroup.findOne = async ({ groupId }) => lists.find((group) => group.groupId === groupId)
  LeadGroup.create = async (group) => { lists.push({ ...group }); return group }
  LeadGroup.updateOne = async ({ groupId }, update) => {
    const group = lists.find((group) => group.groupId === groupId)
    if (group) Object.assign(group, update.$set)
    return { modifiedCount: group ? 1 : 0 }
  }
  LeadGroup.deleteOne = async ({ groupId }) => {
    const index = lists.findIndex((group) => group.groupId === groupId)
    if (index >= 0) lists.splice(index, 1)
    return { deletedCount: index >= 0 ? 1 : 0 }
  }
  const { default: app } = await import('../api/app.js')
  const records = [
    ...Array.from({ length: 51 }, (_, index) => ({
      placeId: `grouped-${index}`, title: `Lead ${index}`, groupId: 'seed',
      groupTitle: 'Leads clínicas', kanbanState: { column: 'open' },
    })),
    ...Array.from({ length: 180 }, (_, index) => ({
      placeId: `ungrouped-${index}`, title: 'Old lead', groupId: null,
      kanbanState: { column: 'open' },
    })),
    { placeId: 'missing-group' },
    { placeId: 'empty-group', groupId: '' },
    { placeId: 'blank-group', groupId: '   ' },
  ]
  const matches = (record, filter) => Object.entries(filter).every(([key, value]) => {
    if (value && typeof value === 'object') {
      return (!value.$type || typeof record[key] === value.$type)
        && (!value.$regex || value.$regex.test(record[key]))
    }
    return record[key] === value
  })
  let failRead = false
  Lead.find = async (filter) => {
    if (failRead) throw new Error('Database unavailable')
    return records.filter((record) => matches(record, filter))
  }
  Lead.findOne = async (filter) => records.find((record) => matches(record, filter))
  Lead.create = async (data) => {
    records.push(data)
    return data
  }
  Lead.findOneAndUpdate = async (filter, update) => {
    const record = await Lead.findOne(filter)
    if (!record) return null
    for (const [key, value] of Object.entries(update.$set)) {
      if (key.startsWith('kanbanState.')) record.kanbanState[key.slice('kanbanState.'.length)] = value
      else record[key] = value
    }
    return record
  }
  Lead.bulkWrite = async (operations) => {
    let modifiedCount = 0
    for (const { updateOne } of operations) {
      if (await Lead.findOneAndUpdate(updateOne.filter, updateOne.update)) modifiedCount++
    }
    return { modifiedCount }
  }
  Lead.findOneAndDelete = async (filter) => {
    const index = records.findIndex((record) => matches(record, filter))
    return index >= 0 ? records.splice(index, 1)[0] : null
  }
  Lead.updateMany = async (filter, update) => {
    const selected = records.filter((record) => matches(record, filter))
    selected.forEach((record) => Object.assign(record, update.$set))
    return { modifiedCount: selected.length }
  }
  const originalFetch = global.fetch
  t.mock.method(global, 'fetch', (url, options) => {
    if (String(url).startsWith('https://identitytoolkit.googleapis.com/')) {
      return Promise.resolve(new Response(JSON.stringify({ users: [{
        localId: 'owner', email: 'mateus.desenv@gmail.com', emailVerified: true,
      }] })))
    }
    return originalFetch(url, options)
  })
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  const request = (path, method = 'GET', body) => originalFetch(`http://127.0.0.1:${server.address().port}${path}`, {
    method,
    headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
    ...(body && { body: JSON.stringify(body) }),
  })
  try {
    const response = await request('/api/leads')
    assert.equal(response.headers.get('cache-control'), 'no-store')
    const active = await response.json()
    assert.deepEqual(await (await request('/api/lead-groups')).json(), [{ groupId: 'seed', groupTitle: 'Leads clínicas', count: 51 }])
    assert.equal(active.length, 51)
    assert.deepEqual(await (await request('/api/leads/export')).json(), active)
    assert.equal((await request('/api/leads', 'POST', { title: 'No group' })).status, 400)
    assert.equal((await request('/api/leads', 'POST', { groupId: 'deleted-group' })).status, 404)
    const created = await request('/api/leads', 'POST', {
      title: 'New lead', placeId: 'new', groupId: 'seed', groupTitle: 'Outdated title',
      kanbanState: { column: 'open' },
    })
    assert.equal(created.status, 201)
    assert.equal((await created.json()).groupTitle, 'Leads clínicas')
    const state = { column: 'followup', returnDate: '2026-09-20', collectedData: 'Saved notes',
      contactResearch: { profile: 'Perfil revisado', publicEmail: 'contato@example.com', sources: 'https://example.com' } }
    const saved = await (await request('/api/leads/new', 'PUT', { kanbanState: state })).json()
    assert.deepEqual(saved.kanbanState, state)
    assert.deepEqual((await (await request('/api/leads')).json()).find((lead) => lead.placeId === 'new'), saved)
    assert.equal((await request('/api/leads/ungrouped-0', 'PUT', { kanbanState: state })).status, 404)
    const batch = await (await request('/api/leads/batch', 'PUT', [
      { placeId: 'grouped-0', kanbanState: { column: 'conversa', order: 0, contactResearch: state.contactResearch } },
      { placeId: 'ungrouped-0', kanbanState: state },
    ])).json()
    assert.equal(batch.updated, 1)
    assert.equal(batch.leads.length, 52)
    assert.equal(batch.leads.find((lead) => lead.placeId === 'grouped-0').kanbanState.column, 'conversa')
    assert.deepEqual(batch.leads.find((lead) => lead.placeId === 'grouped-0').kanbanState.contactResearch, state.contactResearch)
    assert.equal(records.find((lead) => lead.placeId === 'ungrouped-0').kanbanState.column, 'open')
    assert.equal((await request('/api/leads/new/message-sent', 'PATCH', { sent: 'yes' })).status, 400)
    assert.equal((await request('/api/leads/ungrouped-0/message-sent', 'PATCH', { sent: true })).status, 404)
    const marked = await (await request('/api/leads/new/message-sent', 'PATCH', {
      sent: true, messageSentOn: '1999-01-01', kanbanState: { column: 'perdido' },
    })).json()
    assert.equal(marked.messageSentOn, getMessageDay(), 'server determines the current day')
    assert.deepEqual(marked.kanbanState, state, 'marking does not change the stage or lead details')
    assert.equal((await (await request('/api/leads')).json()).find((lead) => lead.placeId === 'new').messageSentOn, marked.messageSentOn)
    await request('/api/leads/new', 'PUT', { kanbanState: { ...state, column: 'conversa' } })
    assert.equal(records.find((lead) => lead.placeId === 'new').messageSentOn, marked.messageSentOn, 'editing Kanban state preserves the daily marker')
    const unmarked = await (await request('/api/leads/new/message-sent', 'PATCH', { sent: false })).json()
    assert.equal(unmarked.messageSentOn, null)
    assert.equal(unmarked.kanbanState.column, 'conversa')
    const editInput = { title: 'Nome editado', categoryName: 'Terapia', phone: '(48) 99999-9999',
      website: 'example.com', address: 'Endereço editado', column: 'proposta', collectedData: 'Notas atualizadas',
      groupId: 'should-not-change', messageSentOn: 'should-not-change' }
    assert.equal((await request('/api/leads/new/details', 'PATCH', { ...editInput, title: '  ' })).status, 400)
    assert.equal((await request('/api/leads/new/details', 'PATCH', { ...editInput, column: 'invalid' })).status, 400)
    assert.equal((await request('/api/leads/ungrouped-0/details', 'PATCH', editInput)).status, 404)
    const editResponse = await request('/api/leads/new/details', 'PATCH', editInput)
    assert.equal(editResponse.status, 200)
    const edited = await editResponse.json()
    assert.equal(edited.title, editInput.title)
    assert.equal(edited.groupId, 'seed')
    assert.equal(edited.website, 'https://example.com')
    assert.equal(edited.phoneUnformatted, '48999999999')
    assert.equal(edited.messageSentOn, null)
    assert.equal(edited.kanbanState.column, 'proposta')
    assert.equal(edited.kanbanState.returnDate, state.returnDate)
    assert.deepEqual(edited.kanbanState.contactResearch, state.contactResearch)
    assert.equal(edited.kanbanState.collectedData, editInput.collectedData)
    await request('/api/leads/group/seed', 'DELETE')
    assert.deepEqual(await (await request('/api/leads')).json(), [])
    assert.deepEqual(await (await request('/api/leads/export')).json(), [])
    assert.equal(records.length, 235, 'removing a group preserves stored records')
    // Lists persist without leads and accept their first manual lead.
    for (const groupTitle of ['', '   ', 'a'.repeat(121), 12]) {
      assert.equal((await request('/api/lead-groups', 'POST', { groupTitle })).status, 400)
    }
    const listResponse = await request('/api/lead-groups', 'POST', { groupTitle: '  Lista manual  ' })
    assert.equal(listResponse.status, 201)
    const list = await listResponse.json()
    assert.equal(list.groupTitle, 'Lista manual')
    assert.equal(list.count, 0)
    assert.deepEqual(await (await request('/api/lead-groups')).json(), [list])
    assert.deepEqual(await (await request('/api/leads')).json(), [], 'creating a list creates no placeholder lead')
    await request(`/api/leads/group/${list.groupId}`, 'PUT', { groupTitle: 'Renomeada' })
    assert.equal((await (await request('/api/lead-groups')).json())[0].groupTitle, 'Renomeada')
    assert.deepEqual(await (await request('/api/lead-assignees')).json(), [
      { uid: 'helper', name: 'helper@example.com' }, { uid: 'owner', name: 'Mateus' },
    ])
    for (const uid of ['missing', 'pending', { uid: 'owner' }]) {
      assert.equal((await request('/api/leads', 'POST', { title: 'Invalid', placeId: 'invalid', groupId: list.groupId, assigneeUid: uid })).status, 400)
    }
    const firstLead = await request('/api/leads', 'POST', {
      placeId: 'manual-first', title: 'Primeiro lead', groupId: list.groupId, groupTitle: 'Nome antigo',
      assigneeUid: 'owner', assigneeName: 'Untrusted name', kanbanState: { column: 'open', returnDate: '2026-09-20' },
    })
    assert.equal(firstLead.status, 201)
    const firstRecord = await firstLead.json()
    assert.equal(firstRecord.groupTitle, 'Renomeada')
    assert.equal(firstRecord.assigneeUid, 'owner')
    assert.equal(firstRecord.assigneeName, 'Mateus')
    const movedLead = await (await request('/api/leads/manual-first', 'PUT', { kanbanState: { ...firstRecord.kanbanState, column: 'contato' } })).json()
    assert.equal(movedLead.assigneeUid, 'owner', 'moving stages preserves responsibility')
    const reassigned = await (await request('/api/leads/manual-first/details', 'PATCH', { ...editInput, assigneeUid: 'helper', assigneeName: 'forged' })).json()
    assert.equal(reassigned.assigneeUid, 'helper')
    assert.equal(reassigned.assigneeName, 'helper@example.com')
    assert.equal(reassigned.kanbanState.returnDate, '2026-09-20')
    assert.equal((await request('/api/leads/manual-first/details', 'PATCH', { ...editInput, assigneeUid: 'pending' })).status, 400)
    assert.equal((await request('/api/leads/manual-first', 'PUT', { kanbanState: reassigned.kanbanState, assigneeUid: 'missing' })).status, 400)
    const cleared = await (await request('/api/leads/manual-first', 'PUT', { kanbanState: reassigned.kanbanState, assigneeUid: null })).json()
    assert.equal(cleared.assigneeUid, null)
    assert.equal(cleared.assigneeName, null)
    assert.equal((await (await request('/api/leads')).json()).find((lead) => lead.placeId === 'manual-first').assigneeUid, null)

    assert.equal((await (await request('/api/lead-groups')).json())[0].count, 1)
    await request('/api/leads/manual-first', 'DELETE')
    assert.equal((await (await request('/api/lead-groups')).json())[0].count, 0, 'list survives removal of last lead')
    await request(`/api/leads/group/${list.groupId}`, 'DELETE')
    assert.deepEqual(await (await request('/api/lead-groups')).json(), [])
    assert.equal((await request('/api/leads', 'POST', { groupId: list.groupId })).status, 404)
    failRead = true
    t.mock.method(console, 'error', () => {})
    assert.equal((await request('/api/leads')).status, 500, 'database failure never falls back to local leads')
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})
