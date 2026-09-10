import mongoose from 'mongoose'
import { connectToDatabase } from './db.js'

const fields = ['companyName', 'niche', 'projectType', 'protocol', 'instagram']
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const briefingLeads = {
  async list({ search = '', page = 1, pageSize = 20 } = {}) {
    await connectToDatabase()
    const collection = mongoose.connection.useDb('codexa-briefing', { useCache: true }).collection('briefings')
    const filter = search ? { $or: fields.map((field) => ({ [field]: { $regex: escapeRegex(search), $options: 'i' } })) } : {}
    const total = await collection.countDocuments(filter)
    const currentPage = Math.min(page, Math.max(1, Math.ceil(total / pageSize)))
    const projection = Object.fromEntries([...fields, 'description', 'sensations', 'otherSensation', 'currentWebsite', 'inspirations', 'themePreference', 'stylePreference', 'desiredColors', 'avoidedColors', 'urgency', 'createdAt', 'status'].map((field) => [field, 1]))
    const entries = await collection.find(filter, { projection }).sort({ createdAt: -1, _id: -1 })
      .skip((currentPage - 1) * pageSize).limit(pageSize).toArray()
    return {
      entries: entries.map(({ _id, ...entry }) => ({ id: String(_id), ...entry })),
      total, page: currentPage, pageSize,
    }
  },
}
