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

export function getReturnDateTone(value: string, now = new Date()): 'success' | 'warning' | 'info' | 'danger' | 'neutral' {
  const date = parseCalendarDate(value)
  if (Number.isNaN(date.getTime())) return 'neutral'

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  date.setHours(0, 0, 0, 0)

  if (date < today) return 'danger'
  if (date.getTime() === today.getTime()) return 'success'
  if (date.getTime() === tomorrow.getTime()) return 'warning'
  return 'info'
}
