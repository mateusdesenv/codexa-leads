export interface ContactResearch {
  researchDate?: string
  qualification?: string
  profile?: string
  approach?: string
  publicEmail?: string
  websiteNotes?: string
  whatsappStatus?: string
  observations?: string
  sources?: string
  recordNotes?: string
}
export const CONTACT_RESEARCH_KEYS: (keyof ContactResearch)[]
export function isMetropolitanClinicsGroup(title: unknown): boolean
export function parseContactResearch(notes: unknown): ContactResearch
export function getContactResearchBackfill(lead: {
  groupTitle?: string | null
  groupId?: string | null
  kanbanState?: { collectedData?: string; contactResearch?: ContactResearch | null }
}): ContactResearch | null
