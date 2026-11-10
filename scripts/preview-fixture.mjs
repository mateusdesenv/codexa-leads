// Isolated UI review only: loopback servers, disposable database and synthetic users.
// No production credentials or database are read by this harness.
import express from 'express'
import cors from 'cors'
import mongoose from 'mongoose'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { createServer } from 'vite'
import { randomUUID } from 'node:crypto'

const replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
process.env.MONGODB_URI = replica.getUri('ui_review')
process.env.CODEXA_HUB_URL = 'http://127.0.0.1:4302'
process.env.CODEXA_API_PROXY_TARGET = 'http://127.0.0.1:4301'
process.env.VITE_CODEXA_HUB_URL = process.env.CODEXA_HUB_URL
const { User } = await import('../server/lib/user.js')
const { Lead } = await import('../server/lib/lead.js')
const { LeadGroup } = await import('../server/lib/lead-group.js')
const { default: app } = await import('../server/app.js')
await mongoose.connect(process.env.MONGODB_URI)
const people = {
  admin: {
    uid: 'owner',
    email: 'mateus.desenv@gmail.com',
    name: 'Administrador de teste',
  },
  operator: {
    uid: 'op',
    email: 'operador@example.com',
    name: 'Operador de teste',
  },
  reader: {
    uid: 'ro',
    email: 'consulta@example.com',
    name: 'Consulta de teste',
  },
  fresh: { uid: 'new', email: 'novo@example.com', name: 'Pessoa sem listas' },
}
await User.create(
  Object.entries(people).map(([key, p]) => ({
    firebaseUid: 'hub_' + p.uid,
    hubUid: p.uid,
    email: p.email,
    displayName: p.name,
    accessStatus: 'approved',
    role: key === 'operator' ? 'operator' : 'reader',
  })),
)
await LeadGroup.create([
  {
    groupId: 'clinics',
    groupTitle: 'Clínicas · teste',
    visibility: 'selected',
    viewerUids: ['hub_op', 'hub_ro'],
    assignees: [{ uid: 'hub_op', name: 'Operador de teste' }],
  },
  {
    groupId: 'private',
    groupTitle: 'Lista exclusiva da administração',
    visibility: 'selected',
    viewerUids: [],
  },
  {
    groupId: 'empty',
    groupTitle: 'Lista vazia · teste',
    visibility: 'selected',
    viewerUids: ['hub_op'],
  },
])
await Lead.create([
  {
    placeId: 'clinic-1',
    title: 'Clínica Exemplo',
    groupId: 'clinics',
    groupTitle: 'Clínicas · teste',
    phone: '11999990000',
    categoryName: 'Saúde',
    kanbanState: {
      column: 'contato',
      returnDate: '2026-01-01',
      nextAction: 'Retomar conversa',
      collectedData: 'Registro fictício para validação.',
    },
  },
  {
    placeId: 'clinic-2',
    title: 'Consultório Exemplo',
    groupId: 'clinics',
    groupTitle: 'Clínicas · teste',
    kanbanState: { column: 'open' },
  },
  {
    placeId: 'private-1',
    title: 'Contato reservado de teste',
    groupId: 'private',
    groupTitle: 'Lista exclusiva da administração',
  },
  {
    placeId: 'orphan-1',
    title: 'Registro recuperável de teste',
    groupId: null,
  },
])
const hub = express(),
  codes = new Map(),
  tokens = new Map()
hub.use(cors({ origin: 'http://127.0.0.1:4300' }), express.json())
hub.get('/', (req, res) => {
  if (
    req.query.role &&
    people[req.query.role] &&
    req.query.redirect === 'http://127.0.0.1:4300/?codexa_callback=1'
  ) {
    const code = randomUUID()
    codes.set(code, people[req.query.role])
    const target = new URL(req.query.redirect)
    target.searchParams.set('code', code)
    target.searchParams.set('state', String(req.query.state))
    return res.redirect(target.href)
  }
  res.type('html').send(
    '<h1>Hub de teste — dados fictícios</h1><p>Escolha uma conta para validar o Leads isolado.</p>' +
      Object.entries(people)
        .map(([role, p]) => {
          const q = new URLSearchParams(req.query)
          q.set('role', role)
          return `<p><a href="/?${q.toString()}">${p.name}</a></p>`
        })
        .join(''),
  )
})
hub.post('/api/exchange', (req, res) => {
  const user = codes.get(req.body.code)
  codes.delete(req.body.code)
  if (!user) return res.sendStatus(401)
  const token = 'cx_' + randomUUID()
  tokens.set(token, user)
  res.json({ token, user })
})
hub.get('/api/introspect/leads', (req, res) => {
  const user = tokens.get(req.get('authorization')?.replace('Bearer ', ''))
  return user ? res.json(user) : res.sendStatus(401)
})
const apiServer = app.listen(4301, '127.0.0.1'),
  hubServer = hub.listen(4302, '127.0.0.1')
const vite = await createServer({
  server: { host: '127.0.0.1', port: 4300, strictPort: true },
})
await vite.listen()
console.log('Isolated UI review: http://127.0.0.1:4300/?codexa_launch=1')
const stop = async () => {
  await vite.close()
  apiServer.close()
  hubServer.close()
  await mongoose.disconnect()
  await replica.stop()
  process.exit(0)
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
