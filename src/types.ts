export interface Lead {
  title: string
  subTitle: string | null
  categoryName: string | null
  address: string | null
  neighborhood: string | null
  street: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  website: string | null
  phone: string | null
  phoneUnformatted: string | null
  totalScore: number | null
  reviewsCount: number | null
  permanentlyClosed: boolean
  temporarilyClosed: boolean
  categories: string[]
  placeId: string
  groupId?: string | null
  groupTitle?: string | null
  kanbanState?: KanbanState
}

export type ColumnId =
  | 'open'
  | 'contato'
  | 'conversa'
  | 'followup'
  | 'proposta'
  | 'negociacao'
  | 'fechado'
  | 'perdido'

export type Temperature = 'quente' | 'medio' | 'frio'

export interface KanbanState {
  column: ColumnId
  nextAction?: string
  dueDate?: string
  lostReason?: string
  proposalValue?: string
  proposalReturnDate?: string
  collectedData?: string
  interest?: 'alto' | 'medio' | 'baixo' | ''
  budget?: string
  returnDate?: string
  order?: number
}

export interface LeadWithMeta extends Lead {
  kanbanState: KanbanState
  score: number
  temperature: Temperature
  websiteKind: 'proprio' | 'social' | 'sem'
}

export interface QnA {
  _id?: string
  id?: string
  question: string
  answer: string
  tags: string[]
  isFavorite?: boolean
  createdAt?: string
  updatedAt?: string
}
