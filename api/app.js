import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { connectToDatabase } from './lib/db.js'
import { Lead } from './lib/lead.js'
import { QnA } from './lib/qna.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))

app.get('/api/leads', async (_req, res) => {
  try {
    await connectToDatabase()
    const leads = await Lead.find({})
    res.json(leads)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao buscar leads' })
  }
})

app.post('/api/leads', async (req, res) => {
  try {
    await connectToDatabase()
    const lead = await Lead.create(req.body)
    res.status(201).json(lead)
  } catch (err) {
    console.error(err)
    res.status(400).json({ error: err instanceof Error ? err.message : 'Erro ao criar lead' })
  }
})

app.post('/api/leads/import', async (req, res) => {
  try {
    await connectToDatabase()
    const leads = Array.isArray(req.body) ? req.body : [req.body]
    const result = []

    for (const item of leads) {
      if (!item.title || !item.placeId) continue
      const update = { ...item }
      if (!item.kanbanState) delete update.kanbanState
      const lead = await Lead.findOneAndUpdate(
        { placeId: item.placeId },
        { $set: update },
        { upsert: true, returnDocument: 'after' },
      )
      result.push(lead)
    }

    res.json({ imported: result.length, leads: result })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao importar leads' })
  }
})

app.get('/api/leads/export', async (_req, res) => {
  try {
    await connectToDatabase()
    const leads = await Lead.find({})
    const fileName = `codexa-leads-${new Date().toISOString().slice(0, 10)}.json`
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
    res.json(leads)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao exportar leads' })
  }
})

app.post('/api/leads/seed', async (_req, res) => {
  try {
    await connectToDatabase()
    const seedPath = path.join(process.cwd(), 'public', 'data', 'leads.json')
    const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf8'))

    const result = []
    for (const item of seedData) {
      if (!item.title || !item.placeId) continue
      const update = { ...item }
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

app.put('/api/leads/:placeId', async (req, res) => {
  try {
    await connectToDatabase()
    const lead = await Lead.findOneAndUpdate(
      { placeId: req.params.placeId },
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
    const items = await QnA.find({}).sort({ createdAt: -1 })
    res.json(items)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao buscar perguntas' })
  }
})

app.post('/api/qna', async (req, res) => {
  try {
    await connectToDatabase()
    const { question, answer, tags } = req.body
    if (!question || !answer) {
      return res.status(400).json({ error: 'Pergunta e resposta são obrigatórias' })
    }
    const item = await QnA.create({
      question: question.trim(),
      answer: answer.trim(),
      tags: Array.isArray(tags) ? tags.filter(Boolean) : [],
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
    const { question, answer, tags } = req.body
    if (!question || !answer) {
      return res.status(400).json({ error: 'Pergunta e resposta são obrigatórias' })
    }
    const item = await QnA.findByIdAndUpdate(
      req.params.id,
      {
        question: question.trim(),
        answer: answer.trim(),
        tags: Array.isArray(tags) ? tags.filter(Boolean) : [],
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

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

export default app
