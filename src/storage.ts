import type { KanbanState, Lead } from './types'

const KANBAN_KEY = 'codexa-leads-kanban'
const CUSTOM_LEADS_KEY = 'codexa-leads-custom'

export function loadKanbanStates(): Record<string, KanbanState> {
  try {
    const raw = localStorage.getItem(KANBAN_KEY)
    return raw ? (JSON.parse(raw) as Record<string, KanbanState>) : {}
  } catch {
    return {}
  }
}

export function saveKanbanStates(states: Record<string, KanbanState>) {
  try {
    localStorage.setItem(KANBAN_KEY, JSON.stringify(states))
  } catch {
    // noop
  }
}

export function loadCustomLeads(): Lead[] {
  try {
    const raw = localStorage.getItem(CUSTOM_LEADS_KEY)
    return raw ? (JSON.parse(raw) as Lead[]) : []
  } catch {
    return []
  }
}

export function saveCustomLeads(leads: Lead[]) {
  try {
    localStorage.setItem(CUSTOM_LEADS_KEY, JSON.stringify(leads))
  } catch {
    // noop
  }
}
