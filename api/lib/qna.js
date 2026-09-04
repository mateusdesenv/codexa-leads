import mongoose from 'mongoose'

const qnaSchema = new mongoose.Schema(
  {
    question: { type: String, required: true },
    answer: { type: String, required: true },
    tags: { type: [String], default: [] },
    isFavorite: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_, ret) => {
        ret.id = ret._id.toString()
        delete ret._id
        delete ret.__v
        return ret
      },
    },
  },
)

export const QnA = mongoose.models.QnA || mongoose.model('QnA', qnaSchema)
