export async function centralIdentity(token, client) {
  const base = process.env.CODEXA_HUB_URL || 'https://hub.codexa-web.online'
  if (!base || !token.startsWith('cx_')) throw Object.assign(new Error('Entre pelo hub da Codexa.'), { statusCode: 401 })
  const response = await fetch(new URL('/api/introspect/' + client, base), {
    headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(5000),
  })
  if (!response.ok) throw Object.assign(new Error('Acesso central encerrado.'), { statusCode: response.status === 403 ? 403 : 401 })
  const identity = await response.json()
  if (!identity.uid || !identity.email) throw Object.assign(new Error('Identidade inválida'), { statusCode: 401 })
  return identity
}
