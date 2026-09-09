import test from 'node:test'
import assert from 'node:assert/strict'
import { getMessageDay } from '../shared/message-day.js'

test('daily message markers expire at midnight in São Paulo, not UTC', () => {
  const sentOn = getMessageDay(new Date('2026-09-09T15:00:00Z'))
  assert.equal(sentOn, '2026-09-09')
  assert.equal(getMessageDay(new Date('2026-09-10T02:59:59Z')), sentOn)
  assert.notEqual(getMessageDay(new Date('2026-09-10T03:00:00Z')), sentOn)
  assert.equal(getMessageDay(new Date('2027-01-01T02:59:59Z')), '2026-12-31')
})
