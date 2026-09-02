import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { connectToDatabase } from '../api/lib/db.js'
import { Lead } from '../api/lib/lead.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function main() {
  try {
    await connectToDatabase()

    const seedPath = path.join(process.cwd(), 'public', 'data', 'leads.json')
    const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf8'))

    let count = 0
    for (const item of seedData) {
      if (!item.title || !item.placeId) continue
      const update = { ...item }
      if (!item.kanbanState) delete update.kanbanState
      await Lead.findOneAndUpdate(
        { placeId: item.placeId },
        { $set: update },
        { upsert: true, returnDocument: 'after' },
      )
      count++
    }

    console.log(`Seeded ${count} leads.`)
    process.exit(0)
  } catch (err) {
    console.error('Seed failed:', err)
    process.exit(1)
  }
}

main()
