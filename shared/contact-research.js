export const CONTACT_RESEARCH_KEYS = [
  'researchDate', 'qualification', 'profile', 'approach', 'publicEmail',
  'websiteNotes', 'whatsappStatus', 'observations', 'sources', 'recordNotes',
]

export function isMetropolitanClinicsGroup(title) {
  return typeof title === 'string' && title.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim().replace(/\s+/g, ' ').toLowerCase() === 'clinicas regiao metropolitana'
}

// Extract only information explicitly present in the original research notes.
export function parseContactResearch(notes) {
  const result = {}
  let currentKey = 'observations'
  const append = (key, value) => {
    if (value.trim()) result[key] = [result[key], value.trim()].filter(Boolean).join('\n')
    currentKey = key
  }
  for (const line of (typeof notes === 'string' ? notes : '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean)) {
    const research = line.match(/^Pesquisa:\s*(\d{4}-\d{2}-\d{2})(?:\.\s*|\s*$)(.*)$/)
    if (research) {
      append('researchDate', research[1])
      append('qualification', research[2])
      continue
    }
    const labeled = line.match(/^(Perfil|Hipótese para abordagem|E-mail público|Observações|Fontes):\s*(.*)$/)
    if (labeled) {
      const key = { Perfil: 'profile', 'Hipótese para abordagem': 'approach', 'E-mail público': 'publicEmail', Observações: 'observations', Fontes: 'sources' }[labeled[1]]
      if (key === 'approach') {
        const [approach, ...website] = labeled[2].split(/(?=Site próprio não localizado nesta pesquisa;)/)
        if (website.length) append('websiteNotes', website.join(''))
        append(key, approach)
      } else {
        append(key, key === 'sources' ? labeled[2].split(/\s*\|\s*/).join('\n') : labeled[2])
      }
    } else if (/^(WhatsApp publicado|Canal WhatsApp)/.test(line)) {
      append('whatsappStatus', line)
    } else if (/^(Identificador interno|Avaliações Google)/.test(line)) {
      append('recordNotes', line)
    } else {
      append(currentKey, line)
    }
  }
  return result
}

export function getContactResearchBackfill(lead) {
  if (!isMetropolitanClinicsGroup(lead.groupTitle) || !lead.groupId?.trim()) return null
  // Never replace an existing form, including intentionally cleared fields.
  if (lead.kanbanState?.contactResearch != null) return null
  const parsed = parseContactResearch(lead.kanbanState?.collectedData)
  return Object.keys(parsed).length ? parsed : null
}
