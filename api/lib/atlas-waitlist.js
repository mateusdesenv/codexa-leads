import mongoose from 'mongoose'
import { connectToDatabase } from './db.js'

const fields = ['name', 'email', 'phone', 'realEstateAgency', 'cityState', 'teamSize']
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const atlasWaitlist = {
  async list({ search = '', page = 1, pageSize = 20 } = {}) {
    await connectToDatabase()
    const collection = mongoose.connection.useDb('codexa-imoveis', { useCache: true }).collection('whitelist')
    const filter = search ? { $or: fields.map((field) => ({ [field]: { $regex: escapeRegex(search), $options: 'i' } })) } : {}
    const total = await collection.countDocuments(filter)
    const currentPage = Math.min(page, Math.max(1, Math.ceil(total / pageSize)))
    const projection = Object.fromEntries([...fields, 'consent', 'createdAt'].map((field) => [field, 1]))
    const entries = await collection.find(filter, { projection }).sort({ createdAt: -1, _id: -1 })
      .skip((currentPage - 1) * pageSize).limit(pageSize).toArray()
    return {
      entries: entries.map(({ _id, ...entry }) => ({ id: String(_id), ...entry })),
      total, page: currentPage, pageSize,
    }
  },
}
