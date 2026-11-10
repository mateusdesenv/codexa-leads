import { currentSessionUser } from './session'

let requestScreen = 'table'
export const setRequestScreen = (screen: string) => { requestScreen = screen }

export async function apiFetch(path: string, init: RequestInit = {}) {
  const user = currentSessionUser()
  if (!user) throw new Error('Sessão não informada')
  const headers = new Headers(init.headers)
  if (!headers.has('X-CRM-Screen')) headers.set('X-CRM-Screen', requestScreen)
  headers.set('Authorization', `Bearer ${await user.getIdToken()}`)
  const response = await fetch(path, { cache: 'no-store', ...init, headers })
  if (response.status === 401) window.dispatchEvent(new Event('session-expired'))
  if (response.status === 403) window.dispatchEvent(new Event('access-recheck'))
  return response
}
