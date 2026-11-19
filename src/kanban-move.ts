import type { ColumnId, KanbanState, Lead } from './types'

export interface CardMove {
  placeId: string
  column: ColumnId
  before: string | null
  // Capture the displayed sort when a drop switches an automatic column to manual.
  displayedOrder?: string[]
}

export interface ContactOutcome {
  placeId: string
  column: 'mensagem_enviada' | 'perdido'
  contactDay: string
}

export interface KanbanChange {
  placeId: string
  version: number
  kanbanState: KanbanState
  markMessageSent?: true
}

export function getNextColumnOrder(leads: Lead[], groupId: Lead['groupId'], column: ColumnId): number {
  const lastOrder = leads.reduce((max, lead) => (
    lead.groupId === groupId && lead.kanbanState?.column === column
      ? Math.max(max, lead.kanbanState.order ?? -1)
      : max
  ), -1)
  return lastOrder + 1
}

export function planMove(leads: Lead[], move: CardMove | ContactOutcome): KanbanChange[] {
  const moving = leads.find(lead => lead.placeId === move.placeId)
  if (!moving) return []
  if ('contactDay' in move) {
    const sameColumn = moving.kanbanState?.column === move.column
    const markSent = move.column === 'mensagem_enviada' && moving.messageSentOn !== move.contactDay
    if (sameColumn && !markSent) return []
    const kanbanState: KanbanState = { column: move.column }
    if (!sameColumn) kanbanState.order = getNextColumnOrder(leads, moving.groupId, move.column)
    return [{ placeId: moving.placeId, version: moving.version ?? 0, kanbanState,
      ...(markSent && { markMessageSent: true }) }]
  }
  if (move.before === move.placeId) return []
  const rank = new Map(move.displayedOrder?.map((id, i) => [id, i]))
  const ordered = leads.filter(lead =>
    lead.groupId === moving.groupId && (lead.kanbanState?.column ?? 'open') === move.column,
  ).sort((a, b) => rank.size
    ? (rank.get(a.placeId) ?? Infinity) - (rank.get(b.placeId) ?? Infinity)
    : (a.kanbanState?.order ?? Infinity) - (b.kanbanState?.order ?? Infinity))
  const destination = ordered.filter(lead => lead.placeId !== moving.placeId)
  const anchor = destination.findIndex(lead => lead.placeId === move.before)
  const index = anchor < 0 ? destination.length : anchor
  if (ordered.indexOf(moving) === index) return []
  destination.splice(index, 0, moving)

  // Only the destination needs new ranks. Gaps in the source order are harmless.
  return destination.flatMap((lead, order) =>
    lead.kanbanState?.column === move.column && lead.kanbanState.order === order ? [] :
      [{ placeId: lead.placeId, version: lead.version ?? 0, kanbanState: { column: move.column, order } }])
}

export function previewMove(leads: Lead[], move: CardMove | ContactOutcome): Lead[] {
  const changes = new Map(planMove(leads, move).map(change => [change.placeId, change]))
  return leads.map(lead => {
    const change = changes.get(lead.placeId)
    if (!change) return lead
    return {
      ...lead,
      kanbanState: { ...lead.kanbanState, ...change.kanbanState },
      ...(change.markMessageSent && 'contactDay' in move && { messageSentOn: move.contactDay }),
    }
  })
}

// A poll started before a move can arrive after its acknowledgement.
export function mergeFetchedLeads(previous: Lead[], incoming: Lead[]): Lead[] {
  const existing = new Map(previous.map(lead => [lead.placeId, lead]))
  return incoming.map(lead => {
    const current = existing.get(lead.placeId)
    return current && (current.version ?? 0) > (lead.version ?? 0) ? current : lead
  })
}
