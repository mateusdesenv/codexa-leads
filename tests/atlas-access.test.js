import test from 'node:test'
import assert from 'node:assert/strict'

test('Atlas registrations require approved authentication, validate input and handle failures', async () => {
  process.env.MONGODB_URI = 'mongodb://localhost/test'
  process.env.VITE_FIREBASE_API_KEY = 'test-key'
  global.mongoose = { conn: {}, promise: null }
  const { User } = await import('../api/lib/user.js')
  const { atlasWaitlist } = await import('../api/lib/atlas-waitlist.js')
  const { default: app } = await import('../api/app.js')
  const originalFetch = global.fetch
  const originalFind = User.findOne
  const originalList = atlasWaitlist.list
  let calls = 0
  const identities = {
    approved: { localId: 'approved', email: 'approved@example.com', emailVerified: true },
    pending: { localId: 'pending', email: 'pending@example.com', emailVerified: true },
  }
  global.fetch = (url, options) => String(url).startsWith('https://identitytoolkit.googleapis.com/')
    ? Promise.resolve(new Response(JSON.stringify({ users: [identities[JSON.parse(options.body).idToken]].filter(Boolean) })))
    : originalFetch(url, options)
  User.findOne = async ({ firebaseUid }) => ({ accessStatus: firebaseUid === 'approved' ? 'approved' : 'pending' })
  atlasWaitlist.list = async (params) => { calls++; assert.deepEqual(params, { search: 'Imobiliária', page: 2 }); return { entries: [{ id: 'entry', name: 'Exemplo' }], total: 21, page: 2, pageSize: 20 } }
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  const request = (token, suffix = '') => originalFetch(`http://127.0.0.1:${server.address().port}/api/atlas/early-access${suffix}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  try {
    assert.equal((await request()).status, 401)
    assert.equal((await request('invalid')).status, 401)
    assert.equal((await request('pending')).status, 403)
    assert.equal(calls, 0)
    for (const suffix of ['?page=0', '?page=1.5', '?q[x]=abc', '?q=' + 'a'.repeat(201)]) assert.equal((await request('approved', suffix)).status, 400)
    assert.equal(calls, 0)
    const response = await request('approved', '?q=Imobili%C3%A1ria&page=2')
    assert.equal(response.status, 200)
    assert.equal((await response.json()).total, 21)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    atlasWaitlist.list = async () => { throw new Error('private connection details') }
    const failure = await request('approved')
    assert.equal(failure.status, 503)
    assert.deepEqual(await failure.json(), { error: 'Não foi possível carregar os cadastros do Atlas' })
  } finally {
    global.fetch = originalFetch; User.findOne = originalFind; atlasWaitlist.list = originalList
    await new Promise((resolve) => server.close(resolve))
  }
})
