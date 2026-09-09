import test from 'node:test'
import assert from 'node:assert/strict'
import { getMessageDay } from '../shared/message-day.js'

test('CRM reads and exports the same grouped database records and confirms saved state', async (t) => {
  process.env.MONGODB_URI = 'mongodb://localhost/test'
  process.env.VITE_FIREBASE_API_KEY = 'test-key'
  global.mongoose = { conn: {}, promise: null }
  const { Lead } = await import('../api/lib/lead.js')
  const { LeadGroup } = await import('../api/lib/lead-group.js')
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
    Object.assign(record, update.$set)
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
    const firstLead = await request('/api/leads', 'POST', {
      placeId: 'manual-first', title: 'Primeiro lead', groupId: list.groupId, groupTitle: 'Nome antigo',
    })
    assert.equal(firstLead.status, 201)
    assert.equal((await firstLead.json()).groupTitle, 'Renomeada')
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
