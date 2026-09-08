import test from 'node:test'
import assert from 'node:assert/strict'

test('access requests require administrator approval before CRM access', async () => {
  process.env.MONGODB_URI = 'mongodb://localhost/test'
  process.env.VITE_FIREBASE_API_KEY = 'test-key'
  global.mongoose = { conn: {}, promise: null }
  const { User } = await import('../api/lib/user.js')
  const { Lead } = await import('../api/lib/lead.js')
  const { default: app } = await import('../api/app.js')
  const users = new Map()
  const originalFetch = global.fetch
  const identities = {
    admin: { localId: 'owner', email: 'mateus.desenv@gmail.com', emailVerified: true },
    pending: { localId: 'new-user', email: 'new@example.com', emailVerified: true },
    unverified: { localId: 'impostor', email: 'mateus.desenv@gmail.com', emailVerified: false },
  }
  global.fetch = (url, options) => {
    if (String(url).startsWith('https://identitytoolkit.googleapis.com/')) {
      const identity = identities[JSON.parse(options.body).idToken]
      return Promise.resolve(new Response(JSON.stringify({ users: identity ? [identity] : [] }), { status: identity ? 200 : 400 }))
    }
    return originalFetch(url, options)
  }
  User.findOne = async ({ firebaseUid }) => users.get(firebaseUid)
  User.findOneAndUpdate = async ({ firebaseUid }, update, options) => {
    let user = users.get(firebaseUid)
    if (!user && !options.upsert) return null
    user ??= { firebaseUid, accessStatus: 'pending', ...update.$setOnInsert }
    Object.assign(user, update.$set)
    users.set(firebaseUid, user)
    return user
  }
  User.find = () => ({ sort: async () => [...users.values()] })
  Lead.find = async () => [{ title: 'Protected lead' }]
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  const request = (path, token, method = 'GET', body) => originalFetch(base + path, {
    method,
    headers: { ...(token && { Authorization: `Bearer ${token}` }), 'Content-Type': 'application/json' },
    ...(body && { body: JSON.stringify(body) }),
  })
  try {
    assert.equal((await request('/api/leads')).status, 401)
    assert.equal((await request('/api/leads', 'invalid')).status, 401)
    for (const [path, method] of [['/api/leads', 'GET'], ['/api/leads', 'POST'], ['/api/qna', 'GET'], ['/api/leads/any', 'DELETE']]) {
      assert.equal((await request(path, 'pending', method)).status, 403)
    }
    const pending = await request('/api/users/me', 'pending', 'PUT', { accessStatus: 'approved', email: 'mateus.desenv@gmail.com' })
    assert.equal((await pending.json()).accessStatus, 'pending')
    assert.equal((await request('/api/users', 'pending')).status, 403)
    assert.equal((await request('/api/users/new-user/approve', 'pending', 'PATCH')).status, 403)
    assert.equal((await request('/api/leads', 'unverified')).status, 403)
    assert.equal((await request('/api/users/new-user/approve', 'unverified', 'PATCH')).status, 403)
    const admin = await request('/api/users/me', 'admin', 'PUT')
    assert.equal((await admin.json()).accessStatus, 'approved')
    assert.equal((await request('/api/users', 'admin')).status, 200)
    assert.equal((await request('/api/users/missing/approve', 'admin', 'PATCH')).status, 404)
    const approval = await request('/api/users/new-user/approve', 'admin', 'PATCH')
    assert.equal((await approval.json()).accessStatus, 'approved')
    assert.equal((await request('/api/leads', 'pending')).status, 200)
    const relogin = await request('/api/users/me', 'pending', 'PUT')
    assert.equal((await relogin.json()).accessStatus, 'approved')
    users.delete('new-user')
    assert.equal((await request('/api/leads', 'pending')).status, 403)
    assert.equal((await (await request('/api/users/me', 'pending', 'PUT')).json()).accessStatus, 'pending')
    assert.equal((await request('/api/leads', 'pending')).status, 403)
  } finally {
    global.fetch = originalFetch
    await new Promise((resolve) => server.close(resolve))
  }
})
