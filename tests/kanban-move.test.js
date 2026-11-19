import assert from 'node:assert/strict'
import test from 'node:test'
import { mergeFetchedLeads, planMove, previewMove } from '../src/kanban-move.ts'

const lead = (placeId, column, order, groupId = 'list') => ({
  placeId, groupId, version: 2, kanbanState: { column, order, nextAction: 'Ligar' },
})
const base = [
  lead('a', 'open', 0), lead('b', 'triado', 0), lead('c', 'triado', 1),
  lead('hidden', 'triado', 2), lead('other', 'triado', 0, 'other-list'),
]
const insert = { placeId: 'a', column: 'triado', before: 'c' }

test('a drop uses the visible anchor without changing the other list or losing details', () => {
  const board = previewMove(base, insert)
  assert.deepEqual(board.map(item => item.kanbanState.order), [1, 0, 2, 3, 0])
  assert.equal(board[0].kanbanState.nextAction, 'Ligar')
  assert.equal(board[0].kanbanState.column, 'triado')
  assert.equal(base[0].kanbanState.column, 'open')
  assert.equal(board[4], base[4])
})

test('removing a rejected move restores its position while preserving a newer move', () => {
  const later = { placeId: 'b', column: 'contato', before: null }
  const both = [insert, later].reduce(previewMove, base)
  const afterRejection = [later].reduce(previewMove, base)
  assert.equal(both[0].kanbanState.column, 'triado')
  assert.deepEqual(afterRejection[0], base[0])
  assert.equal(afterRejection[1].kanbanState.column, 'contato')
  assert.deepEqual(afterRejection[2], base[2])
})

test('a manual drop captures the displayed order, including legacy cards without a rank', () => {
  const legacy = [lead('b', 'open'), { placeId: 'a', groupId: 'list' }, lead('c', 'open')]
  const changes = planMove(legacy, { placeId: 'b', column: 'open', before: 'c', displayedOrder: ['c', 'a', 'b'] })
  assert.deepEqual(changes.map(item => [item.placeId, item.kanbanState.order]), [['b', 0], ['c', 1], ['a', 2]])
  assert.deepEqual(planMove(base, { placeId: 'b', column: 'triado', before: 'c' }), [])
})

test('a stale refresh cannot undo an acknowledged move or reintroduce inaccessible leads', () => {
  const saved = { ...base[0], version: 3, kanbanState: { column: 'triado', order: 1 } }
  const result = mergeFetchedLeads([saved, ...base.slice(1)], [base[0]])
  assert.deepEqual(result, [saved])
  assert.equal(planMove(result, { placeId: 'a', column: 'contato', before: null })[0].version, 3)
})

test('confirming WhatsApp contact moves only the selected lead and marks its message today', () => {
  const outcome = { placeId: 'a', column: 'mensagem_enviada', contactDay: '2026-11-19' }
  const board = [...base, lead('previous', outcome.column, 4)]
  const changes = planMove(board, outcome)
  assert.deepEqual(changes, [{ placeId: 'a', version: 2, kanbanState: { column: outcome.column, order: 5 }, markMessageSent: true }])
  const preview = previewMove(board, outcome)
  assert.equal(preview[0].messageSentOn, outcome.contactDay)
  assert.deepEqual(planMove(preview, outcome), [])
  assert.equal(preview[0].kanbanState.nextAction, 'Ligar')
  const earlier = { ...preview[0], messageSentOn: '2026-11-18' }
  assert.equal(previewMove([earlier], outcome)[0].kanbanState.order, 5)
  assert.equal(board[0].messageSentOn, undefined)
})

test('marking a lead lost preserves its message history and its rank if already lost', () => {
  const item = { ...base[0], messageSentOn: '2026-11-18' }
  const outcome = { placeId: item.placeId, column: 'perdido', contactDay: '2026-11-19' }
  const [lost] = previewMove([item], outcome)
  assert.equal(lost.kanbanState.column, 'perdido')
  assert.equal(lost.messageSentOn, item.messageSentOn)
  assert.deepEqual(planMove([lost], outcome), [])
})
