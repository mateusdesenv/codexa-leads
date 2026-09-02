const mongoose = require('mongoose')

const leadSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    subTitle: { type: String, default: null },
    categoryName: { type: String, default: null },
    address: { type: String, default: null },
    neighborhood: { type: String, default: null },
    street: { type: String, default: null },
    city: { type: String, default: null },
    state: { type: String, default: null },
    postalCode: { type: String, default: null },
    website: { type: String, default: null },
    phone: { type: String, default: null },
    phoneUnformatted: { type: String, default: null },
    totalScore: { type: Number, default: null },
    reviewsCount: { type: Number, default: null },
    permanentlyClosed: { type: Boolean, default: false },
    temporarilyClosed: { type: Boolean, default: false },
    categories: { type: [String], default: [] },
    placeId: { type: String, required: true, unique: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_, ret) => {
        delete ret._id
        delete ret.__v
        delete ret.createdAt
        delete ret.updatedAt
        return ret
      },
    },
  },
)

const Lead = mongoose.models.Lead || mongoose.model('Lead', leadSchema)

module.exports = { Lead }
