export const hubUrl = (import.meta.env.VITE_CODEXA_HUB_URL ||
  'https://hub.codexa-web.online') as string
const client = 'leads'
const key = 'codexa-sso-' + client
const encode = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
export function centralSession(): {
  token: string
  user: { uid: string; email: string; name: string }
} | null {
  try {
    return JSON.parse(sessionStorage.getItem(key) || 'null')
  } catch {
    return null
  }
}
export async function centralLogin() {
  if (!hubUrl) throw Error('Hub não configurado')
  const verifier = encode(crypto.getRandomValues(new Uint8Array(32)))
  const state = encode(crypto.getRandomValues(new Uint8Array(32)))
  sessionStorage.setItem(
    key + '-pending',
    JSON.stringify({
      verifier,
      state,
      returnTo: location.pathname + location.search + location.hash,
    }),
  )
  const challenge = encode(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)),
    ),
  )
  const url = new URL(hubUrl)
  Object.entries({
    client,
    challenge,
    state,
    redirect: location.origin + '/?codexa_callback=1',
  }).forEach(([k, v]) => url.searchParams.set(k, v))
  location.assign(url.href)
}
export async function completeCentralLogin() {
  if (!hubUrl || !new URLSearchParams(location.search).has('codexa_callback'))
    return
  const p = new URLSearchParams(location.search)
  const pending = JSON.parse(sessionStorage.getItem(key + '-pending') || 'null')
  history.replaceState(null, '', '/')
  sessionStorage.removeItem(key + '-pending')
  if (!pending || p.get('state') !== pending.state)
    throw Error('Retorno de login inválido. Entre novamente.')
  const r = await fetch(new URL('/api/exchange', hubUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Codexa-Request': '1' },
    body: JSON.stringify({
      client,
      code: p.get('code'),
      verifier: pending.verifier,
      redirect: location.origin + '/?codexa_callback=1',
    }),
  })
  if (!r.ok) throw Error('Login expirado ou acesso removido. Entre novamente.')
  sessionStorage.setItem(key, JSON.stringify(await r.json()))
  const destination = new URL(pending.returnTo, location.origin)
  if (destination.origin === location.origin)
    history.replaceState(
      null,
      '',
      destination.pathname + destination.search + destination.hash,
    )
}
export async function initializeCentralSession(): Promise<boolean> {
  const url = new URL(location.href)
  if (
    hubUrl &&
    url.searchParams.get('codexa_launch') === '1' &&
    !url.searchParams.has('codexa_callback')
  ) {
    // Consume the launch marker before saving the return address.
    url.searchParams.delete('codexa_launch')
    history.replaceState(null, '', url.pathname + url.search + url.hash)
    await centralLogin()
    return true
  }
  await completeCentralLogin()
  if (!centralSession()) {
    await centralLogin()
    return true
  }
  return false
}
export function centralLogout() {
  sessionStorage.removeItem(key)
  location.assign(hubUrl + '/?logout=1')
}
