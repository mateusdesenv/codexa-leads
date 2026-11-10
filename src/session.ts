import { centralSession, centralLogout } from './central-session'
export interface SessionUser {
  uid: string
  email: string
  displayName: string
  photoURL: string | null
  getIdToken: () => Promise<string>
}
export function currentSessionUser(): SessionUser | null {
  const s = centralSession()
  return s
    ? {
        uid: s.user.uid,
        email: s.user.email,
        displayName: s.user.name,
        photoURL: null,
        getIdToken: async () => s.token,
      }
    : null
}
export function watchSession(callback: (user: SessionUser | null) => void) {
  callback(currentSessionUser())
  return () => {}
}
export async function logoutSession() {
  centralLogout()
}
