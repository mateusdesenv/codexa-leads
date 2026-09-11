export function groupLeadsByColumn<C extends string, T extends { kanbanState: { column: C }; score: number }>(leads: readonly T[], columns: readonly C[]): Record<C, T[]>
