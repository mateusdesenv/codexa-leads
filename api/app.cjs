require('dotenv').config()

const express = require('express')
const cors = require('cors')
const { connectToDatabase } = require('./lib/db.cjs')
const { Lead } = require('./lib/lead.cjs')

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
      const lead = await Lead.findOneAndUpdate(
        { placeId: item.placeId },
        { $set: item },
        { upsert: true, new: true },
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
    const fs = require('fs')
    const path = require('path')
    const seedPath = path.join(process.cwd(), 'public', 'data', 'leads.json')
    const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf8'))

    const result = []
    for (const item of seedData) {
      if (!item.title || !item.placeId) continue
      const lead = await Lead.findOneAndUpdate(
        { placeId: item.placeId },
        { $set: item },
        { upsert: true, new: true },
      )
      result.push(lead)
    }

    res.json({ seeded: result.length })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao popular leads' })
  }
})

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

module.exports = app
