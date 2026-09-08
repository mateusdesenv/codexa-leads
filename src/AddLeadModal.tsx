import { useState, type FormEvent } from 'react'
import { Alert, Button, Dialog, Icon, Input, Select, Textarea } from 'codexa-ui'
import type { ColumnId } from './types'

export interface NewLeadInput {
  title: string
  categoryName: string
  phone: string
  website: string
  address: string
  column: ColumnId
  collectedData: string
}

interface AddLeadModalProps {
  groupTitle: string
  onClose: () => void
  onCreate: (input: NewLeadInput) => Promise<void>
}

const STAGE_OPTIONS: { value: ColumnId; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'em_contato', label: 'Tentativa de ligação' },
  { value: 'mensagem_enviada', label: 'Mensagem enviada' },
  { value: 'contato', label: 'Contato feito' },
  { value: 'conversa', label: 'Em conversa' },
  { value: 'followup', label: 'Follow-up' },
  { value: 'proposta', label: 'Proposta enviada' },
  { value: 'negociacao', label: 'Negociação' },
  { value: 'fechado', label: 'Cliente fechado' },
  { value: 'perdido', label: 'Perdido' },
]

function getPhoneDigits(value: string): string {
  const digits = value.replace(/\D/g, '')
  const withoutCountryCode = digits.length > 11 && digits.startsWith('55')
    ? digits.slice(2)
    : digits
  return withoutCountryCode.slice(0, 11)
}

function formatBrazilianPhone(value: string): string {
  const digits = getPhoneDigits(value)
  if (!digits) return ''
  if (digits.length <= 2) return `(${digits}`

  const areaCode = digits.slice(0, 2)
  const localNumber = digits.slice(2)
  if (localNumber.length <= 4) return `(${areaCode}) ${localNumber}`

  const firstBlockLength = digits.length === 11 ? 5 : 4
  const firstBlock = localNumber.slice(0, firstBlockLength)
  const lastBlock = localNumber.slice(firstBlockLength)
  return `(${areaCode}) ${firstBlock}${lastBlock ? `-${lastBlock}` : ''}`
}

export default function AddLeadModal({ groupTitle, onClose, onCreate }: AddLeadModalProps) {
  const [title, setTitle] = useState('')
  const [categoryName, setCategoryName] = useState('')
  const [phone, setPhone] = useState('')
  const [phoneTouched, setPhoneTouched] = useState(false)
  const [website, setWebsite] = useState('')
  const [address, setAddress] = useState('')
  const [column, setColumn] = useState<ColumnId>('open')
  const [collectedData, setCollectedData] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const phoneDigits = getPhoneDigits(phone)
  const phoneIsValid = phoneDigits.length === 0 || phoneDigits.length === 10 || phoneDigits.length === 11
  const phoneError = phoneTouched && !phoneIsValid
    ? 'Informe o DDD e um telefone com 10 ou 11 dígitos.'
    : undefined

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!title.trim()) return
    if (!phoneIsValid) {
      setPhoneTouched(true)
      return
    }

    try {
      setSubmitting(true)
      setError(null)
      await onCreate({
        title: title.trim(),
        categoryName: categoryName.trim(),
        phone: phone.trim(),
        website: website.trim(),
        address: address.trim(),
        column,
        collectedData: collectedData.trim(),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível adicionar o lead')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open onClose={onClose} title="Adicionar novo lead">
      <div className="add-lead-modal__group">
        <span className="add-lead-modal__group-icon" aria-hidden="true">
          <Icon name="users" size={18} />
        </span>
        <div>
          <span>Adicionar ao grupo</span>
          <strong>{groupTitle}</strong>
        </div>
      </div>

      <form className="add-lead-modal__form" onSubmit={handleSubmit}>
        {error && (
          <div className="add-lead-modal__full">
            <Alert tone="danger" title="Erro ao adicionar lead">
              {error}
            </Alert>
          </div>
        )}

        <Input
          label="Nome do lead"
          id="new-lead-title"
          type="text"
          placeholder="Ex: Clínica Bem-Estar"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          leadingIcon={<Icon name="user" size={16} />}
          autoFocus
          required
        />

        <Input
          label="Categoria"
          id="new-lead-category"
          type="text"
          placeholder="Ex: Clínica de estética"
          value={categoryName}
          onChange={(event) => setCategoryName(event.target.value)}
          leadingIcon={<Icon name="file" size={16} />}
        />

        <Input
          label="Telefone / WhatsApp"
          id="new-lead-phone"
          type="tel"
          placeholder="(00) 00000-0000"
          value={phone}
          onChange={(event) => setPhone(formatBrazilianPhone(event.target.value))}
          onBlur={() => setPhoneTouched(true)}
          inputMode="numeric"
          autoComplete="tel"
          maxLength={15}
          helperText={phoneError ? undefined : 'Opcional. Informe o DDD e o número.'}
          error={phoneError}
          leadingIcon={<Icon name="message" size={16} />}
        />

        <Input
          label="Site ou rede social"
          id="new-lead-website"
          type="text"
          placeholder="exemplo.com.br"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
          leadingIcon={<Icon name="link" size={16} />}
        />

        <div className="add-lead-modal__full">
          <Input
            label="Endereço"
            id="new-lead-address"
            type="text"
            placeholder="Rua, número, bairro, cidade"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            leadingIcon={<Icon name="home" size={16} />}
          />
        </div>

        <div className="add-lead-modal__full">
          <Select
            label="Etapa inicial do funil"
            id="new-lead-column"
            value={column}
            onChange={(value: string) => setColumn(value as ColumnId)}
            options={STAGE_OPTIONS}
          />
        </div>

        <div className="add-lead-modal__full">
          <Textarea
            label="Dados e observações"
            id="new-lead-notes"
            rows={4}
            placeholder="Contexto da prospecção, decisores, dores e próximos passos..."
            value={collectedData}
            onChange={(event) => setCollectedData(event.target.value)}
          />
        </div>

        <div className="add-lead-modal__actions add-lead-modal__full">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={submitting}
            disabled={!title.trim() || !phoneIsValid || submitting}
            leadingIcon={<Icon name="plus" size={16} />}
          >
            Adicionar lead
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
