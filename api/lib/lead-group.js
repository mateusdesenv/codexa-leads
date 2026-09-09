import mongoose from 'mongoose'

const schema = new mongoose.Schema({
  groupId: { type: String, required: true, unique: true },
  groupTitle: { type: String, required: true, trim: true, maxlength: 120 },
}, { timestamps: true })

export const LeadGroup = mongoose.models.LeadGroup || mongoose.model('LeadGroup', schema)
