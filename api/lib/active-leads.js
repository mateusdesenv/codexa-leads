import { Lead } from './lead.js'

// Ungrouped records remain stored, but are outside the active CRM base.
export const activeLeadFilter = { groupId: { $type: 'string', $regex: /\S/ } }

export function findActiveLeads() {
  return Lead.find(activeLeadFilter)
}
