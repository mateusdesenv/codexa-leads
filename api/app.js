import 'dotenv/config'
import dotenv from 'dotenv'
import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { connectToDatabase } from './lib/db.js'
import { Lead } from './lib/lead.js'
import { atlasWaitlist } from './lib/atlas-waitlist.js'
import { briefingLeads } from './lib/briefing-leads.js'
import { LeadGroup } from './lib/lead-group.js'
import { randomUUID } from 'node:crypto'
import { activeLeadFilter, findActiveLeads } from './lib/active-leads.js'
import { getMessageDay } from '../shared/message-day.js'
import { QnA } from './lib/qna.js'
import { User } from './lib/user.js'

dotenv.config({ path: '.env.local' })

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store')
  next()
})

const ADMIN_EMAIL = 'mateus.desenv@gmail.com'

const toDate = (timestamp) => {
  const value = Number(timestamp)
  if (!Number.isFinite(value)) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

const getBearerToken = (request) => {
  const authorization = request.get('authorization') ?? ''
  return authorization.startsWith('Bearer ') ? authorization.slice(7) : null
}

const resolveFirebaseUser = async (idToken) => {
  const apiKey = process.env.FIREBASE_WEB_API_KEY || process.env.VITE_FIREBASE_API_KEY
  if (!apiKey) {
    const error = new Error('Firebase não configurado no servidor')
    error.statusCode = 500
    throw error
  }

  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  })
  const payload = await response.json().catch(() => ({}))
  const firebaseUser = payload.users?.[0]

  if (!response.ok || !firebaseUser?.localId || !firebaseUser?.email) {
    const error = new Error('Sessão inválida')
    error.statusCode = 401
    throw error
  }

  return firebaseUser
}

const requireAuthenticatedUser = async (request, response, next) => {
  try {
    const token = getBearerToken(request)
    if (!token) {
      return response.status(401).json({ error: 'Sessão não informada' })
    }
    request.firebaseUser = await resolveFirebaseUser(token)
    return next()
  } catch (error) {
    const status = error?.statusCode ?? 401
    return response.status(status).json({ error: status === 401 ? 'Sessão inválida' : 'Não foi possível validar a sessão' })
  }
}

const isAdmin = (user) => user?.email?.trim().toLowerCase() === ADMIN_EMAIL && user.emailVerified === true

const requireAdmin = (request, response, next) => {
  if (!isAdmin(request.firebaseUser)) {
    return response.status(403).json({ error: 'Acesso restrito ao administrador' })
  }
  return next()
}

const serializeUser = (user) => ({
  uid: user.firebaseUid,
  email: user.email,
  displayName: user.displayName,
  photoURL: user.photoURL,
  providerId: user.providerId,
  registeredAt: user.registeredAt,
  lastSignInAt: user.lastSignInAt,
  createdAt: user.createdAt,
  accessStatus: user.accessStatus ?? 'pending',
  approvedAt: user.approvedAt,
})

app.put('/api/users/me', requireAuthenticatedUser, async (request, response) => {
  try {
    await connectToDatabase()
    const firebaseUser = request.firebaseUser
    const providerId = firebaseUser.providerUserInfo?.[0]?.providerId ?? 'password'
    const data = {
      email: firebaseUser.email,
      displayName: firebaseUser.displayName ?? '',
      photoURL: firebaseUser.photoUrl ?? '',
      providerId,
      registeredAt: toDate(firebaseUser.createdAt),
      lastSignInAt: toDate(firebaseUser.lastLoginAt),
    }
    if (isAdmin(firebaseUser)) data.accessStatus = 'approved'
    const user = await User.findOneAndUpdate(
      { firebaseUid: firebaseUser.localId },
      { $set: data, $setOnInsert: { firebaseUid: firebaseUser.localId } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    )
    return response.json(serializeUser(user))
  } catch (error) {
    console.error(error)
    return response.status(500).json({ error: 'Não foi possível sincronizar o usuário' })
  }
})

app.get('/api/users', requireAuthenticatedUser, requireAdmin, async (_request, response) => {
  try {
    await connectToDatabase()
    const users = await User.find({}).sort({ displayName: 1, email: 1 })
    return response.json(users.map(serializeUser))
  } catch (error) {
    console.error(error)
    return response.status(500).json({ error: 'Não foi possível buscar os usuários' })
  }
})

app.patch('/api/users/:uid/approve', requireAuthenticatedUser, requireAdmin, async (request, response) => {
  try {
    await connectToDatabase()
    const user = await User.findOneAndUpdate(
      { firebaseUid: request.params.uid },
      { $set: { accessStatus: 'approved', approvedAt: new Date(), approvedBy: request.firebaseUser.localId } },
      { returnDocument: 'after' },
    )
    if (!user) return response.status(404).json({ error: 'Usuário não encontrado' })
    return response.json(serializeUser(user))
  } catch {
    return response.status(500).json({ error: 'Não foi possível liberar o acesso' })
  }
})

app.delete('/api/users/:uid', requireAuthenticatedUser, requireAdmin, async (request, response) => {
  try {
    await connectToDatabase()
    const user = await User.findOne({ firebaseUid: request.params.uid })
    if (!user) return response.status(404).json({ error: 'Usuário não encontrado' })
    if (user.firebaseUid === request.firebaseUser.localId || user.email?.trim().toLowerCase() === ADMIN_EMAIL) {
      return response.status(403).json({ error: 'A conta do administrador não pode ser excluída' })
    }
    await User.deleteOne({ firebaseUid: user.firebaseUid, email: { $ne: ADMIN_EMAIL } })
    return response.status(204).end()
  } catch {
    return response.status(500).json({ error: 'Não foi possível excluir o usuário' })
  }
})

app.get('/api/health', (_request, response) => response.json({ ok: true }))

app.use('/api', requireAuthenticatedUser, async (request, response, next) => {
  try {
    if (isAdmin(request.firebaseUser)) return next()
    await connectToDatabase()
    const user = await User.findOne({ firebaseUid: request.firebaseUser.localId })
    if (user?.accessStatus !== 'approved') {
      return response.status(403).json({ code: 'ACCESS_PENDING', error: 'Aguardando liberação do administrador' })
    }
    return next()
  } catch {
    return response.status(503).json({ error: 'Não foi possível verificar a liberação' })
  }
})

// Protected by authentication and account approval middleware above.
app.get('/api/atlas/early-access', async (req, res) => {
  const page = Number(req.query.page ?? 1)
  if (!Number.isSafeInteger(page) || page < 1 || (req.query.q !== undefined && typeof req.query.q !== 'string')) {
    return res.status(400).json({ error: 'Parâmetros de busca inválidos' })
  }
  const search = (req.query.q ?? '').trim()
  if (search.length > 200) return res.status(400).json({ error: 'A busca deve ter até 200 caracteres' })
  try {
    return res.json(await atlasWaitlist.list({ search, page }))
  } catch {
    return res.status(503).json({ error: 'Não foi possível carregar os cadastros do Atlas' })
  }
})

app.get('/api/briefing/leads', async (req, res) => {
  const page = Number(req.query.page ?? 1)
  if (!Number.isSafeInteger(page) || page < 1 || (req.query.q !== undefined && typeof req.query.q !== 'string')) {
    return res.status(400).json({ error: 'Parâmetros de busca inválidos' })
  }
  const search = (req.query.q ?? '').trim()
  if (search.length > 200) return res.status(400).json({ error: 'A busca deve ter até 200 caracteres' })
  try {
    return res.json(await briefingLeads.list({ search, page }))
  } catch {
    return res.status(503).json({ error: 'Não foi possível carregar os briefings' })
  }
})

app.get('/api/lead-groups', async (_req, res) => {
  try {
    await connectToDatabase()
    const [saved, leads] = await Promise.all([LeadGroup.find({}), findActiveLeads()])
    const groups = new Map(saved.map((group) => [group.groupId, {
      groupId: group.groupId, groupTitle: group.groupTitle, count: 0,
    }]))
    for (const lead of leads) {
      const group = groups.get(lead.groupId)
      if (group) group.count++
      else groups.set(lead.groupId, { groupId: lead.groupId, groupTitle: lead.groupTitle || 'Grupo', count: 1 })
    }
    res.json([...groups.values()].sort((a, b) => a.groupTitle.localeCompare(b.groupTitle, 'pt-BR')))
  } catch {
    res.status(500).json({ error: 'Não foi possível carregar as listas' })
  }
})

app.post('/api/lead-groups', async (req, res) => {
  const title = req.body?.groupTitle
  if (typeof title !== 'string' || !title.trim() || title.trim().length > 120) {
    return res.status(400).json({ error: 'Informe um nome de até 120 caracteres para a lista' })
  }
  try {
    await connectToDatabase()
    const group = await LeadGroup.create({ groupId: `group-${randomUUID()}`, groupTitle: title.trim() })
    res.status(201).json({ groupId: group.groupId, groupTitle: group.groupTitle, count: 0 })
  } catch {
    res.status(500).json({ error: 'Não foi possível criar a lista' })
  }
})

app.get('/api/leads', async (_req, res) => {
  try {
    await connectToDatabase()
    const leads = await findActiveLeads()
    res.json(leads)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao buscar leads' })
  }
})

app.post('/api/leads', async (req, res) => {
  try {
    await connectToDatabase()
    const groupId = req.body?.groupId
    if (typeof groupId !== 'string' || !groupId.trim()) {
      return res.status(400).json({ error: 'Selecione um grupo para cadastrar o lead' })
    }
    const group = await LeadGroup.findOne({ groupId }) || await Lead.findOne({ groupId })
    if (!group) return res.status(404).json({ error: 'Grupo não encontrado' })
    const lead = await Lead.create({ ...req.body, groupId, groupTitle: group.groupTitle })
    res.status(201).json(lead)
  } catch (err) {
    console.error(err)
    res.status(400).json({ error: err instanceof Error ? err.message : 'Erro ao criar lead' })
  }
})

app.post('/api/leads/import', async (req, res) => {
  try {
    await connectToDatabase()
    const payload = req.body ?? {}
    const leads = Array.isArray(payload) ? payload : Array.isArray(payload.leads) ? payload.leads : []
    const title = typeof payload.title === 'string' && payload.title.trim()
      ? payload.title.trim()
      : `Importação em ${new Date().toLocaleDateString('pt-BR')}`
    const groupId = `group-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`

    const result = []

    for (const item of leads) {
      if (!item.title || !item.placeId) continue
      const update = { ...item, groupId, groupTitle: title }
      if (!item.kanbanState) delete update.kanbanState
      const lead = await Lead.findOneAndUpdate(
        { placeId: item.placeId },
        { $set: update },
        { upsert: true, returnDocument: 'after' },
      )
      result.push(lead)
    }

    res.json({ imported: result.length, groupId, groupTitle: title, leads: result })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao importar leads' })
  }
})

app.get('/api/leads/export', async (_req, res) => {
  try {
    await connectToDatabase()
    const leads = await findActiveLeads()
    const fileName = `codexa-leads-${new Date().toISOString().slice(0, 10)}.json`
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
    res.json(leads)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao exportar leads' })
  }
})

app.post('/api/leads/seed', requireAdmin, async (_req, res) => {
  try {
    await connectToDatabase()
    const seedPath = path.join(process.cwd(), 'scripts', 'data', 'leads.json')
    const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf8'))

    const result = []
    const groupId = 'seed'
    const groupTitle = 'Leads iniciais'
    for (const item of seedData) {
      if (!item.title || !item.placeId) continue
      const update = { ...item, groupId, groupTitle }
      if (!item.kanbanState) delete update.kanbanState
      const lead = await Lead.findOneAndUpdate(
        { placeId: item.placeId },
        { $set: update },
        { upsert: true, returnDocument: 'after' },
      )
      result.push(lead)
    }

    res.json({ seeded: result.length })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao popular leads' })
  }
})

app.put('/api/leads/batch', async (req, res) => {
  try {
    await connectToDatabase()
    const items = Array.isArray(req.body) ? req.body : []
    if (!items.length) return res.json({ updated: 0, leads: await findActiveLeads() })

    const bulkOps = items
      .filter((item) => item && typeof item.placeId === 'string' && item.kanbanState)
      .map((item) => ({
        updateOne: {
          filter: { ...activeLeadFilter, placeId: item.placeId },
          update: { $set: { kanbanState: item.kanbanState } },
        },
      }))

    if (!bulkOps.length) return res.status(400).json({ error: 'Nenhuma atualização válida' })

    const result = await Lead.bulkWrite(bulkOps)
    res.json({ updated: result.modifiedCount, leads: await findActiveLeads() })
  } catch (err) {
    console.error(err)
    res.status(400).json({ error: err instanceof Error ? err.message : 'Erro ao atualizar leads' })
  }
})

app.patch('/api/leads/:placeId/message-sent', async (req, res) => {
  if (typeof req.body?.sent !== 'boolean') {
    return res.status(400).json({ error: 'Informe se a mensagem foi enviada' })
  }
  try {
    await connectToDatabase()
    const lead = await Lead.findOneAndUpdate(
      { ...activeLeadFilter, placeId: req.params.placeId },
      { $set: { messageSentOn: req.body.sent ? getMessageDay() : null } },
      { returnDocument: 'after' },
    )
    if (!lead) return res.status(404).json({ error: 'Lead não encontrado' })
    res.json(lead)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao marcar mensagem enviada' })
  }
})

app.put('/api/leads/:placeId', async (req, res) => {
  try {
    await connectToDatabase()
    const lead = await Lead.findOneAndUpdate(
      { ...activeLeadFilter, placeId: req.params.placeId },
      { $set: { kanbanState: req.body.kanbanState } },
      { returnDocument: 'after' },
    )
    if (!lead) return res.status(404).json({ error: 'Lead não encontrado' })
    res.json(lead)
  } catch (err) {
    console.error(err)
    res.status(400).json({ error: err instanceof Error ? err.message : 'Erro ao atualizar lead' })
  }
})

app.get('/api/qna', async (_req, res) => {
  try {
    await connectToDatabase()
    const items = await QnA.find({}).sort({ isFavorite: -1, createdAt: -1 })
    res.json(items)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao buscar perguntas' })
  }
})

app.post('/api/qna', async (req, res) => {
  try {
    await connectToDatabase()
    const { question, answer, tags, isFavorite } = req.body
    if (!question || !answer) {
      return res.status(400).json({ error: 'Pergunta e resposta são obrigatórias' })
    }
    const item = await QnA.create({
      question: question.trim(),
      answer: answer.trim(),
      tags: Array.isArray(tags) ? tags.filter(Boolean) : [],
      isFavorite: isFavorite === true,
    })
    res.status(201).json(item)
  } catch (err) {
    console.error(err)
    res.status(400).json({ error: err instanceof Error ? err.message : 'Erro ao criar pergunta' })
  }
})

app.put('/api/qna/:id', async (req, res) => {
  try {
    await connectToDatabase()
    const { question, answer, tags, isFavorite } = req.body
    if (!question || !answer) {
      return res.status(400).json({ error: 'Pergunta e resposta são obrigatórias' })
    }
    const item = await QnA.findByIdAndUpdate(
      req.params.id,
      {
        question: question.trim(),
        answer: answer.trim(),
        tags: Array.isArray(tags) ? tags.filter(Boolean) : [],
        isFavorite: isFavorite === true,
      },
      { returnDocument: 'after' },
    )
    if (!item) return res.status(404).json({ error: 'Pergunta não encontrada' })
    res.json(item)
  } catch (err) {
    console.error(err)
    res.status(400).json({ error: err instanceof Error ? err.message : 'Erro ao atualizar pergunta' })
  }
})

app.patch('/api/qna/:id/favorite', async (req, res) => {
  try {
    await connectToDatabase()
    const current = await QnA.findById(req.params.id)
    if (!current) return res.status(404).json({ error: 'Pergunta não encontrada' })
    const item = await QnA.findByIdAndUpdate(
      req.params.id,
      { isFavorite: !current.isFavorite },
      { returnDocument: 'after' },
    )
    res.json(item)
  } catch (err) {
    console.error(err)
    res.status(400).json({ error: err instanceof Error ? err.message : 'Erro ao favoritar pergunta' })
  }
})

app.delete('/api/qna/:id', async (req, res) => {
  try {
    await connectToDatabase()
    const item = await QnA.findByIdAndDelete(req.params.id)
    if (!item) return res.status(404).json({ error: 'Pergunta não encontrada' })
    res.status(204).end()
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao remover pergunta' })
  }
})

app.put('/api/leads/group/:groupId', async (req, res) => {
  try {
    await connectToDatabase()
    const { groupTitle } = req.body ?? {}
    if (!groupTitle || typeof groupTitle !== 'string' || !groupTitle.trim()) {
      return res.status(400).json({ error: 'Título do grupo é obrigatório' })
    }
    await LeadGroup.updateOne({ groupId: req.params.groupId }, { $set: { groupTitle: groupTitle.trim() } })
    const result = await Lead.updateMany(
      { groupId: req.params.groupId },
      { $set: { groupTitle: groupTitle.trim() } },
    )
    res.json({ updated: result.modifiedCount })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao atualizar grupo' })
  }
})

app.delete('/api/leads/group/:groupId', async (req, res) => {
  try {
    await connectToDatabase()
    const result = await Lead.updateMany(
      { groupId: req.params.groupId },
      { $set: { groupId: null, groupTitle: null } },
    )
    await LeadGroup.deleteOne({ groupId: req.params.groupId })
    res.json({ updated: result.modifiedCount })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao excluir grupo' })
  }
})

app.delete('/api/leads/:placeId', async (req, res) => {
  try {
    await connectToDatabase()
    const lead = await Lead.findOneAndDelete({ placeId: req.params.placeId })
    if (!lead) return res.status(404).json({ error: 'Lead não encontrado' })
    res.status(204).end()
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao excluir lead' })
  }
})

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

export default app
