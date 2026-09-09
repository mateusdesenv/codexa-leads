import { useState } from 'react'
import { Button, Card, Icon, Input, Link, Textarea } from 'codexa-ui'
import type { ContactResearch } from '../shared/contact-research'
import { InfoSection } from './LeadClientInfo'
import { formatCalendarDate } from './date'

const fields: { key: keyof ContactResearch; label: string; rows: number; full?: boolean }[] = [
  { key: 'qualification', label: 'Qualificação da pesquisa', rows: 2, full: true },
  { key: 'profile', label: 'Perfil da clínica', rows: 3 },
  { key: 'approach', label: 'Hipótese para abordagem', rows: 3 },
  { key: 'websiteNotes', label: 'Situação do site', rows: 3 },
  { key: 'whatsappStatus', label: 'Confirmação do WhatsApp', rows: 3 },
  { key: 'observations', label: 'Observações da pesquisa', rows: 3, full: true },
  { key: 'sources', label: 'Fontes consultadas', rows: 3, full: true },
  { key: 'recordNotes', label: 'Informações complementares', rows: 2, full: true },
]

export function ContactResearchFields({ value, onChange }: {
  value: ContactResearch
  onChange: (value: ContactResearch) => void
}) {
  const [editing, setEditing] = useState(false)
  const update = (key: keyof ContactResearch, next: string) => onChange({ ...value, [key]: next })
  const info = (key: keyof ContactResearch, label: string, wide = false) => (
    <div key={key} className={`lead-client-info__item ${wide ? 'lead-client-info__item--wide' : ''}`}>
      <span className="lead-client-info__label">{label}</span>
      <div className="lead-client-info__value contact-research-info__value">
        {key === 'researchDate' ? formatCalendarDate(value[key], 'Não informado')
          : key === 'sources' && value.sources?.trim()
            ? value.sources.split('\n').map((source, index) => /^https?:\/\/\S+$/.test(source.trim())
              ? <Link key={index} href={source.trim()} variant="subtle" external>{source}</Link>
              : <span key={index}>{source}</span>)
            : value[key]?.trim() ? value[key] : 'Não informado'}
      </div>
    </div>
  )
  return (
    <Card className="lead-client-info contact-research-info" padding="medium" as="article">
      <div className="contact-research-info__header">
        <h4 className="lead-client-info__title">Dados de contato</h4>
        <Button type="button" variant="secondary" size="small"
          leadingIcon={<Icon name={editing ? 'eye' : 'edit'} size={15} />}
          onClick={() => setEditing((current) => !current)}>
          {editing ? 'Visualizar informações' : 'Editar informações'}
        </Button>
      </div>
      {editing ? (
        <div className="contact-research-fields">
          <Input label="Data da pesquisa" id="contact-research-date" type="date"
            value={value.researchDate ?? ''} onChange={(e) => update('researchDate', e.target.value)} />
          <Input label="E-mail público" id="contact-research-email" type="text" inputMode="email"
            value={value.publicEmail ?? ''} onChange={(e) => update('publicEmail', e.target.value)} />
          {fields.map(({ key, label, rows, full }) => (
            <div key={key} className={full ? 'contact-research-fields__full' : undefined}>
              <Textarea label={label} id={`contact-research-${key}`} rows={rows}
                value={value[key] ?? ''} onChange={(e) => update(key, e.target.value)} />
            </div>
          ))}
        </div>
      ) : (
        <>
          <InfoSection title="Pesquisa e perfil">
            {info('researchDate', 'Data da pesquisa')}
            {info('qualification', 'Qualificação da pesquisa', true)}
            {info('profile', 'Perfil da clínica', true)}
          </InfoSection>
          <InfoSection title="Canais e abordagem" compact>
            {info('publicEmail', 'E-mail público')}
            {info('whatsappStatus', 'Confirmação do WhatsApp')}
            {info('websiteNotes', 'Situação do site', true)}
            {info('approach', 'Hipótese para abordagem', true)}
          </InfoSection>
          <InfoSection title="Fontes e observações">
            {info('observations', 'Observações da pesquisa', true)}
            {info('sources', 'Fontes consultadas', true)}
            {info('recordNotes', 'Informações complementares', true)}
          </InfoSection>
        </>
      )}
    </Card>
  )
}
