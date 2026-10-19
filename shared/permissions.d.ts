export type ScreenId = 'dashboard' | 'kanban' | 'table' | 'packages' | 'portfolio' | 'users' | 'help' | 'atlas-early-access' | 'briefing-leads'
export type ScreenPermissions = Record<ScreenId, { read: boolean; write: boolean }>
export interface AccessProfile { uid: string; accessStatus: 'pending' | 'approved'; isAdmin: boolean; screenPermissions: ScreenPermissions }
export const SCREENS: { id: ScreenId; label: string }[]
export function resolvePermissions(user?: { accessStatus?: string; screenPermissions?: Partial<ScreenPermissions> }, administrator?: boolean): ScreenPermissions
export function parsePermissions(input: unknown): ScreenPermissions | null
export function canViewGroup(group: { visibility?: string; viewerUids?: string[] }, uid: string, administrator?: boolean): boolean
