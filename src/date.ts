export function parseCalendarDate(value: string): Date {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!dateOnly) return new Date(value)

  const [, year, month, day] = dateOnly
  return new Date(Number(year), Number(month) - 1, Number(day))
}

export function formatCalendarDate(value?: string | null, fallback = ''): string {
  if (!value) return fallback
  const date = parseCalendarDate(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('pt-BR')
}
