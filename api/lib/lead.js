import mongoose from 'mongoose'

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
    groupId: { type: String, default: null },
    groupTitle: { type: String, default: null },
    kanbanState: {
      column: { type: String, default: 'open' },
      nextAction: { type: String, default: null },
      dueDate: { type: String, default: null },
      lostReason: { type: String, default: null },
      proposalValue: { type: String, default: null },
      proposalReturnDate: { type: String, default: null },
      collectedData: { type: String, default: null },
      interest: { type: String, default: null },
      budget: { type: String, default: null },
      returnDate: { type: String, default: null },
    },
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

export const Lead = mongoose.models.Lead || mongoose.model('Lead', leadSchema)
