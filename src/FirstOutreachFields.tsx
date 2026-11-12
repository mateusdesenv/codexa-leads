import { useState } from 'react'
import { Button, Card, Icon, Input, Select, Textarea } from 'codexa-ui'
import type { ContactResearch } from '../shared/contact-research'
import type { FirstOutreach, LeadWithMeta } from './types'

const CHANNEL_OPTIONS = [
  { value: '', label: 'Selecione' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'phone', label: 'Ligação' },
]

export default function FirstOutreachFields({ lead, research, value, onChange, onViewClient, readOnly }: {
  lead: LeadWithMeta
  research?: ContactResearch
  value: FirstOutreach
  onChange: (value: FirstOutreach) => void
  onViewClient: () => void
  readOnly: boolean
}) {
  const [copyStatus, setCopyStatus] = useState('')
  const isCall = value.channel === 'phone'
  const message = value.message ?? ''
  const phone = lead.phone || lead.phoneUnformatted
  const summary = [
    { label: 'Segmento', detail: lead.categoryName || lead.categories?.[0] },
    { label: 'Localização', detail: [lead.city, lead.state].filter(Boolean).join(', ') || lead.address },
    { label: 'Presença digital', detail: research?.websiteNotes?.trim() || lead.website },
    { label: 'Contato', detail: [phone, research?.whatsappStatus?.trim() || research?.publicEmail?.trim()].filter(Boolean).join('\n') },
  ]

  const update = <K extends keyof FirstOutreach>(key: K, field: FirstOutreach[K]) => {
    setCopyStatus('')
    onChange({ ...value, [key]: field })
  }

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message)
      setCopyStatus(isCall ? 'Roteiro copiado.' : 'Mensagem copiada.')
    } catch {
      setCopyStatus('Não foi possível copiar. Selecione o texto para copiar manualmente.')
    }
  }

  return (
    <div className="first-outreach" id="abordagem-panel" role="tabpanel" aria-label="Primeira abordagem">
      <Card className="first-outreach__panel" padding="medium" as="article">
        <h3 className="modal__column-title">Resumo do cliente</h3>
        <dl className="first-outreach__summary">
          {summary.map(({ label, detail }) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{detail || 'Não informado'}</dd>
            </div>
          ))}
        </dl>
        <Button type="button" variant="ghost" size="small" onClick={onViewClient}
          trailingIcon={<Icon name="arrow-right" size={14} />}>
          Ver informações do cliente
        </Button>
      </Card>
      <Card className="first-outreach__panel" padding="medium" as="article">
        <h3 className="modal__column-title">Plano de abordagem</h3>
        <fieldset className="permission-fields">
          <Textarea
            label="Oportunidade observada"
            id="outreach-opportunity"
            rows={2}
            readOnly={readOnly}
            placeholder="O que chamou a atenção na pesquisa?"
            value={value.opportunity ?? ''}
            onChange={(event) => update('opportunity', event.target.value)}
          />
          <Input
            label="Oferta inicial"
            id="outreach-offer"
            readOnly={readOnly}
            placeholder="Ex. Página de imóveis com botão de WhatsApp"
            value={value.offer ?? ''}
            onChange={(event) => update('offer', event.target.value)}
          />
          <Select
            label="Canal preferido"
            id="outreach-channel"
            disabled={readOnly}
            options={CHANNEL_OPTIONS}
            value={value.channel ?? ''}
            onChange={(channel) => update('channel', channel as FirstOutreach['channel'])}
          />
          <Textarea
            label={isCall ? 'Roteiro de primeira ligação' : 'Mensagem de primeiro contato'}
            id="outreach-message"
            rows={5}
            readOnly={readOnly}
            placeholder={isCall ? 'Escreva como vai abrir a conversa.' : 'Escreva a mensagem que vai usar na abordagem.'}
            value={message}
            onChange={(event) => update('message', event.target.value)}
          />
        </fieldset>
        {message.trim() && (
          <div className="first-outreach__copy">
            <Button type="button" variant="secondary" size="small" onClick={copyMessage}
              leadingIcon={<Icon name="copy" size={14} />}>
              {isCall ? 'Copiar roteiro' : 'Copiar mensagem'}
            </Button>
            <span role="status">{copyStatus}</span>
          </div>
        )}
      </Card>
    </div>
  )
}
