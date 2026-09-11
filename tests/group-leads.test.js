import test from 'node:test'
import assert from 'node:assert/strict'
import { groupLeadsByColumn } from '../shared/group-leads.js'

test('rendering the table twice does not duplicate leads or change previous results', () => {
  const columns = ['open', 'contato']
  const lead = Object.freeze({ placeId: 'one', score: 25, kanbanState: Object.freeze({ column: 'open' }) })
  const input = Object.freeze([lead])
  const first = groupLeadsByColumn(input, columns)
  const second = groupLeadsByColumn(input, columns)
  assert.equal(first.open.length, 1)
  assert.equal(second.open.length, 1)
  assert.notEqual(first.open, second.open)
  assert.deepEqual(groupLeadsByColumn([], columns), { open: [], contato: [] })
  const moved = groupLeadsByColumn([{ ...lead, kanbanState: { column: 'contato' } }], columns)
  assert.equal(moved.open.length, 0)
  assert.equal(moved.contato.length, 1)
  assert.equal(first.open.length, 1)
  assert.equal(first.contato.length, 0)
})

test('switching lists and filtering cannot leak rows from other results', () => {
  const columns = ['open', 'contato']
  const records = [10, 50].map((score) => ({ score, kanbanState: { column: 'open' } }))
  assert.deepEqual(groupLeadsByColumn(records, columns).open.map((lead) => lead.score), [50, 10])
  assert.deepEqual(records.map((lead) => lead.score), [10, 50])
  assert.deepEqual(groupLeadsByColumn([records[0]], columns).open, [records[0]])
})
