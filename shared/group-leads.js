export function groupLeadsByColumn(leads, columns) {
  const groups = Object.fromEntries(columns.map((column) => [column, []]))
  for (const lead of leads) {
    groups[lead.kanbanState.column]?.push(lead)
  }
  for (const group of Object.values(groups)) group.sort((a, b) => b.score - a.score)
  return groups
}
