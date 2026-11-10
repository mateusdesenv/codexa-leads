import mongoose from 'mongoose'

const schema = new mongoose.Schema({
  groupId: { type: String, required: true, unique: true },
  groupTitle: { type: String, required: true, trim: true, maxlength: 120 },
  visibility: { type: String, enum: ['all', 'selected'], default: 'selected' },
  assignees: { type: [{ _id: false, uid: String, name: String }], default: [] },
  archivedAt: { type: Date, default: null },
  viewerUids: { type: [String], default: [] },
}, { timestamps: true })

export const LeadGroup = mongoose.models.LeadGroup || mongoose.model('LeadGroup', schema)
