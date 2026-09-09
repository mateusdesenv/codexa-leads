import mongoose from 'mongoose'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { isMetropolitanClinicsGroup, parseContactResearch } from '../shared/contact-research.js'

const apply = process.argv.includes('--apply')
const backupDir = process.argv.find((arg) => arg.startsWith('--backup-dir='))?.slice('--backup-dir='.length)
if (apply && !backupDir) throw new Error('--apply requires --backup-dir outside the repository')

try {
  await mongoose.connect(process.env.MONGODB_URI)
  if (mongoose.connection.name !== 'codexa-leads') throw new Error('Unexpected database')
  const collection = mongoose.connection.collection('leads')
  const groups = await collection.aggregate([
    { $match: { groupId: { $type: 'string', $ne: '' } } },
    { $group: { _id: { id: '$groupId', title: '$groupTitle' } } },
  ]).toArray()
  const targets = groups.filter(({ _id }) => isMetropolitanClinicsGroup(_id.title))
  if (targets.length !== 1) throw new Error(`Expected one matching group, found ${targets.length}`)
  const groupId = targets[0]._id.id
  const records = await collection.find({ groupId }).toArray()
  const pending = records.filter((lead) => typeof lead.kanbanState?.collectedData === 'string' && lead.kanbanState.collectedData.length)
  const missing = pending.filter((lead) => {
    const research = lead.kanbanState.contactResearch
    const expected = parseContactResearch(lead.kanbanState.collectedData)
    return !research || !Object.keys(expected).length || Object.entries(expected).some(([key, value]) => research[key] !== value)
  })
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', groupId, groupTitle: targets[0]._id.title,
    total: records.length, toClear: pending.length, researchFullyPreserved: missing.length === 0 }))
  if (missing.length) throw new Error(`${missing.length} leads have unmatched contact data; review before clearing`)
  if (apply && pending.length) {
    const directory = resolve(backupDir)
    if (directory === process.cwd() || directory.startsWith(process.cwd() + sep)) throw new Error('Backup must be outside repository')
    await mkdir(directory, { recursive: true, mode: 0o700 })
    const backup = resolve(directory, `before-clear-collected-data-${Date.now()}.json`)
    await writeFile(backup, JSON.stringify(records, null, 2), { mode: 0o600, flag: 'wx' })
    console.log(JSON.stringify({ backup }))
    const otherNotes = await collection.find({ groupId: { $ne: groupId } }, { projection: { 'kanbanState.collectedData': 1 } }).toArray()
    const result = await collection.bulkWrite(pending.map((lead) => ({ updateOne: {
      filter: { _id: lead._id, groupId, groupTitle: lead.groupTitle,
        'kanbanState.collectedData': lead.kanbanState.collectedData,
        'kanbanState.contactResearch': lead.kanbanState.contactResearch },
      update: { $set: { 'kanbanState.collectedData': '' } },
    } })))
    if (result.modifiedCount !== pending.length) throw new Error('Concurrent changes detected; rerun dry-run')
    for (const before of pending) {
      const after = await collection.findOne({ _id: before._id })
      const expected = { ...before, kanbanState: { ...before.kanbanState, collectedData: '' } }
      if (!isDeepStrictEqual(after, expected)) throw new Error('Unexpected change outside collectedData')
    }
    const afterOtherNotes = await collection.find({ groupId: { $ne: groupId } }, { projection: { 'kanbanState.collectedData': 1 } }).toArray()
    console.log(JSON.stringify({ cleared: result.modifiedCount, contactResearchUnchanged: true,
      otherGroupNotesUnchanged: isDeepStrictEqual(otherNotes, afterOtherNotes) }))
  }
} finally {
  await mongoose.disconnect()
}
