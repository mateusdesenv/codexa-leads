import { auth } from './firebase'

export async function apiFetch(path: string, init: RequestInit = {}) {
  const user = auth.currentUser
  if (!user) throw new Error('Sessão não informada')
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${await user.getIdToken()}`)
  const response = await fetch(path, { ...init, headers })
  if (response.status === 403) window.dispatchEvent(new Event('access-recheck'))
  return response
}
