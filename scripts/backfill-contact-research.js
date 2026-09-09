import mongoose from 'mongoose'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { isMetropolitanClinicsGroup, getContactResearchBackfill } from '../shared/contact-research.js'

const apply = process.argv.includes('--apply')
const backupDir = process.argv.find((arg) => arg.startsWith('--backup-dir='))?.split('=').slice(1).join('=')
if (apply && !backupDir) throw new Error('--apply requires --backup-dir outside the repository')

try {
  await mongoose.connect(process.env.MONGODB_URI)
  if (mongoose.connection.name !== 'codexa-leads') throw new Error('Unexpected database; expected codexa-leads')
  const collection = mongoose.connection.collection('leads')
  const groups = await collection.aggregate([
    { $match: { groupId: { $type: 'string', $ne: '' } } },
    { $group: { _id: { id: '$groupId', title: '$groupTitle' }, count: { $sum: 1 } } },
  ]).toArray()
  const targets = groups.filter((group) => isMetropolitanClinicsGroup(group._id.title))
  if (targets.length !== 1) throw new Error(`Expected one matching group, found ${targets.length}`)
  const groupId = targets[0]._id.id
  const records = await collection.find({ groupId }).toArray()
  const updates = records.map((lead) => ({ lead, research: getContactResearchBackfill(lead) })).filter(({ research }) => research)
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', groupId, groupTitle: targets[0]._id.title,
    groupCount: records.length, toFill: updates.length, preserved: records.length - updates.length,
    fields: Object.fromEntries([...new Set(updates.flatMap(({ research }) => Object.keys(research)))].map((key) => [key, updates.filter(({ research }) => research[key]).length])) }))
  if (updates.some(({ research }) => !research.profile || !research.sources || !research.researchDate)) {
    throw new Error('Research format incomplete; review before migration')
  }
  if (apply && updates.length) {
    const directory = resolve(backupDir)
    if (directory.startsWith(process.cwd() + '/')) throw new Error('Backup must be outside the repository')
    await mkdir(directory, { recursive: true, mode: 0o700 })
    const backup = resolve(directory, `contact-research-${Date.now()}.json`)
    await writeFile(backup, JSON.stringify(records, null, 2), { mode: 0o600, flag: 'wx' })
    console.log(JSON.stringify({ backup }))
    const result = await collection.bulkWrite(updates.map(({ lead, research }) => ({ updateOne: {
      filter: { _id: lead._id, groupId, groupTitle: lead.groupTitle,
        'kanbanState.collectedData': lead.kanbanState.collectedData,
        'kanbanState.contactResearch': null },
      update: { $set: { 'kanbanState.contactResearch': research } },
    } })))
    if (result.modifiedCount !== updates.length) throw new Error('Concurrent changes detected; inspect backup and rerun dry-run')
    const saved = await collection.find({ groupId }).toArray()
    for (const { lead, research } of updates) {
      const after = saved.find((item) => item._id.equals(lead._id))
      if (!after || JSON.stringify(after.kanbanState.contactResearch) !== JSON.stringify(research)) throw new Error('Saved research mismatch')
      const { contactResearch: _research, ...originalState } = after.kanbanState
      const { contactResearch: _previousResearch, ...expectedState } = lead.kanbanState
      if (JSON.stringify(originalState) !== JSON.stringify(expectedState)) throw new Error('Unexpected change outside contact research')
    }
    console.log(JSON.stringify({ updated: result.modifiedCount, verified: updates.length, originalNotesPreserved: true }))
  }
} finally {
  await mongoose.disconnect()
}
