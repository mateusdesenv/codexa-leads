export type ScreenId = 'dashboard' | 'kanban' | 'table' | 'packages' | 'portfolio' | 'users' | 'help' | 'atlas-early-access' | 'briefing-leads'
export type ScreenPermissions = Record<ScreenId, { read: boolean; write: boolean }>
export interface AccessProfile { uid: string; role: 'admin' | 'operator' | 'reader'; accessStatus: 'pending' | 'approved' | 'suspended'; isAdmin: boolean; screenPermissions: ScreenPermissions }
export const SCREENS: { id: ScreenId; label: string }[]
export type CrmScreenId = 'dashboard' | 'table' | 'kanban' | 'users' | 'help'
export const CRM_SCREENS: { id: CrmScreenId; label: string }[]
export function resolvePermissions(user?: { accessStatus?: string; role?: string; screenPermissions?: Partial<ScreenPermissions> }, administrator?: boolean): ScreenPermissions
export function parsePermissions(input: unknown): ScreenPermissions | null
export function canViewGroup(group: { archivedAt?: string | null; visibility?: string; viewerUids?: string[] }, uid: string, administrator?: boolean): boolean

export function resolveRole(user?: { role?: string; screenPermissions?: Partial<ScreenPermissions> }, administrator?: boolean): "admin" | "operator" | "reader"
export function canOperate(user?: { accessStatus?: string; role?: string; screenPermissions?: Partial<ScreenPermissions> }, administrator?: boolean): boolean
