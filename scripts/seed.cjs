require('dotenv').config()

const fs = require('fs')
const path = require('path')
const { connectToDatabase } = require('../api/lib/db.cjs')
const { Lead } = require('../api/lib/lead.cjs')

async function main() {
  try {
    await connectToDatabase()

    const seedPath = path.join(process.cwd(), 'public', 'data', 'leads.json')
    const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf8'))

    let count = 0
    for (const item of seedData) {
      if (!item.title || !item.placeId) continue
      await Lead.findOneAndUpdate(
        { placeId: item.placeId },
        { $set: item },
        { upsert: true, new: true },
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
