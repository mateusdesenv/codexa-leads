import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { onAuthStateChanged, signOut, type User } from 'firebase/auth'
import { auth } from './firebase'
import Login from './Login'
import Help from './Help'
import Dashboard from './Dashboard'
import LeadGroupsTable, { type LeadGroup } from './LeadGroupsTable'
import LeadsTable from './LeadsTable'
import Packages from './Packages'
import codexaLogo from 'codexa-ui/logos/logos-fundo-transparente/primary-logo.png'
import codexaLogoDark from 'codexa-ui/logos/logos-fundo-transparente/primary-logo-reversed.png'
import codexaIcon from 'codexa-ui/logos/logos-fundo-transparente/icon-only.png'
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Dialog,
  EmptyState,
  Icon,
  Input,
  SearchInput,
  Select,
  Spinner,
  Tabs,
  Tag,
  Textarea,
} from 'codexa-ui'
import type { IconName, TabItem } from 'codexa-ui'

import type { ColumnId, KanbanState, Lead, LeadWithMeta, Temperature } from './types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AnchorButton = Button as any
import { loadKanbanStates } from './storage'
import './App.css'

const COLUMNS: { id: ColumnId; label: string; emoji: string; color: string; icon: IconName }[] = [
  { id: 'open', label: 'Open', emoji: '🟢', color: '#25BF44', icon: 'check-circle' },
  { id: 'em_contato', label: 'Tentativa de ligação', emoji: '📞', color: '#3B82F6', icon: 'send' },
  { id: 'contato', label: 'Contato feito', emoji: '✅', color: '#2DD4A0', icon: 'check' },
  { id: 'conversa', label: 'Em conversa', emoji: '💬', color: '#8B5CF6', icon: 'message' },
  { id: 'followup', label: 'Follow-up', emoji: '📅', color: '#F59E0B', icon: 'calendar' },
  { id: 'proposta', label: 'Proposta enviada', emoji: '📄', color: '#0EA5E9', icon: 'file' },
  { id: 'negociacao', label: 'Negociação', emoji: '🔥', color: '#EF4444', icon: 'warning' },
  { id: 'fechado', label: 'Cliente fechado', emoji: '🤝', color: '#13992F', icon: 'check' },
  { id: 'perdido', label: 'Perdido', emoji: '❌', color: '#6D7480', icon: 'x' },
]

const LOST_REASONS = [
  'Sem interesse',
  'Sem orçamento',
  'Já possui fornecedor',
  'Não respondeu',
  'Empresa encerrada',
  'Outro',
]

const SOCIAL_HOSTS = [
  'instagram.com',
  'facebook.com',
  'fb.com',
  'linktr.ee',
  'linktree',
  'maps.app.goo.gl',
  'g.page',
  'google.com',
  'wa.me',
  'whatsapp',
  'wixsite.com',
  'wordpress.com',
  'blogger.com',
  'youtube.com',
  'tiktok.com',
  'twitter.com',
  'x.com',
  'threads.net',
  'kw.ai',
  'canva.site',
  'beacons.ai',
]

const fetchLeads = async (): Promise<Lead[]> => {
  const res = await fetch('/api/leads')
  if (!res.ok) throw new Error('Não foi possível carregar os dados')
  return res.json()
}

const updateLeadState = async (placeId: string, kanbanState: KanbanState): Promise<Lead> => {
  const res = await fetch(`/api/leads/${placeId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kanbanState }),
  })
  if (!res.ok) throw new Error('Erro ao atualizar lead')
  return res.json()
}

const updateLeadsBatch = async (leads: { placeId: string; kanbanState: KanbanState }[]): Promise<void> => {
  const res = await fetch('/api/leads/batch', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(leads),
  })
  if (!res.ok) throw new Error('Erro ao atualizar leads')
}

const migrateLocalStates = async (leads: Lead[]) => {
  const local = loadKanbanStates()
  const placeIds = Object.keys(local)
  if (!placeIds.length) return

  const updates: Promise<Lead>[] = []
  for (const lead of leads) {
    const localState = local[lead.placeId]
    if (!localState) continue
    const remoteState = lead.kanbanState ?? { column: 'open' }
    if (JSON.stringify(localState) !== JSON.stringify(remoteState)) {
      updates.push(updateLeadState(lead.placeId, localState))
    }
  }

  if (updates.length) {
    await Promise.all(updates)
  }

  try {
    localStorage.removeItem('codexa-leads-kanban')
  } catch {
    // noop
  }
}

function getHost(website: string): string | null {
  try {
    return new URL(website).hostname.toLowerCase()
  } catch {
    return null
  }
}

function isSocialOrAggregator(website: string): boolean {
  const host = getHost(website)
  if (!host) return false
  return SOCIAL_HOSTS.some((h) => host === h || host.endsWith('.' + h) || host.includes(h))
}

function classifyWebsite(website: string | null): LeadWithMeta['websiteKind'] {
  if (!website) return 'sem'
  if (isSocialOrAggregator(website)) return 'social'
  return 'proprio'
}

function scoreLead(lead: Lead): number {
  let score = 0

  const website = classifyWebsite(lead.website)
  if (website === 'sem') score += 25
  else if (website === 'social') score += 35
  else score += 15

  const reviews = lead.reviewsCount ?? 0
  if (reviews >= 100) score += 15
  else if (reviews >= 50) score += 10
  else if (reviews >= 10) score += 5

  const rating = lead.totalScore
  if (rating !== null && rating !== undefined) {
    if (rating < 3.5 && reviews >= 20) score += 20
    else if (rating >= 4.5 && reviews >= 50) score += 10
    else if (rating >= 4.0) score += 5
  }

  if (lead.phone) score += 10
  if (lead.website) score += 5

  return Math.min(100, Math.max(0, score))
}

function getTemperature(score: number): Temperature {
  if (score >= 70) return 'quente'
  if (score >= 40) return 'medio'
  return 'frio'
}

function getTemperatureLabel(t: Temperature) {
  if (t === 'quente') return 'Quente'
  if (t === 'medio') return 'Médio'
  return 'Frio'
}

function getTemperatureEmoji(t: Temperature) {
  if (t === 'quente') return '🔥'
  if (t === 'medio') return '🟡'
  return '❄️'
}

function getWebsiteLabel(kind: LeadWithMeta['websiteKind']) {
  if (kind === 'proprio') return 'Site próprio'
  if (kind === 'social') return 'Rede social'
  return 'Sem site'
}

function getTemperatureTone(t: Temperature): 'danger' | 'warning' | 'info' {
  if (t === 'quente') return 'danger'
  if (t === 'medio') return 'warning'
  return 'info'
}

function getWebsiteTone(kind: LeadWithMeta['websiteKind']): 'success' | 'info' | 'neutral' {
  if (kind === 'proprio') return 'success'
  if (kind === 'social') return 'info'
  return 'neutral'
}

function getWebsiteIcon(kind: LeadWithMeta['websiteKind']): IconName {
  if (kind === 'proprio') return 'external-link'
  if (kind === 'social') return 'share'
  return 'x'
}

function isOverdue(dueDate?: string): boolean {
  if (!dueDate) return false
  return new Date(dueDate).getTime() < new Date().setHours(0, 0, 0, 0)
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('pt-BR')
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

function getWhatsAppUrl(phone: string | null | undefined): string | null {
  if (!phone) return null
  let digits = phone.replace(/\D/g, '')
  if (!digits) return null
  if (digits.length === 11 && !digits.startsWith('55')) {
    digits = `55${digits}`
  }
  return `https://wa.me/${digits}`
}

function Actions({ lead }: { lead: Lead }) {
  return (
    <div className="lead-actions" onClick={(e) => e.stopPropagation()}>
      {lead.phone && (
        <AnchorButton
          as="a"
          href={getWhatsAppUrl(lead.phoneUnformatted ?? lead.phone)}
          target="_blank"
          rel="noopener noreferrer"
          variant="primary"
          size="small"
          leadingIcon={<Icon name="message" size={14} />}
        >
          WhatsApp
        </AnchorButton>
      )}
      {lead.website && isValidUrl(lead.website) && (
        <AnchorButton
          as="a"
          href={lead.website}
          target="_blank"
          rel="noopener noreferrer"
          variant="secondary"
          size="small"
          leadingIcon={<Icon name="external-link" size={14} />}
        >
          Site
        </AnchorButton>
      )}
      <AnchorButton
        as="a"
        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lead.title ?? '')}&query_place_id=${lead.placeId}`}
        target="_blank"
        rel="noopener noreferrer"
        variant="secondary"
        size="small"
        leadingIcon={<Icon name="link" size={14} />}
      >
        Maps
      </AnchorButton>
    </div>
  )
}

function LeadCard({
  lead,
  index,
  onClick,
}: {
  lead: LeadWithMeta
  index: number
  onClick: (lead: LeadWithMeta) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lead.placeId, data: { lead } })

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <article
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`kanban-card kanban-card--${lead.temperature}`}
      style={style}
      onClick={() => !isDragging && onClick(lead)}
    >
      <div className="kanban-card__header">
        <div className="kanban-card__title-wrap">
          <h3 className="kanban-card__title" title={lead.title}>
            {lead.title}
          </h3>
          {lead.categoryName && (
            <Tag tone="neutral">
              {lead.categoryName}
            </Tag>
          )}
        </div>
        <div className="kanban-card__badges">
          <span className="kanban-card__position">#{index + 1}</span>
          <Badge tone={getTemperatureTone(lead.temperature)} size="small">
            {getTemperatureEmoji(lead.temperature)} {lead.score}
          </Badge>
        </div>
      </div>

      <div className="kanban-card__body">
        <div className="kanban-card__meta">
          {lead.totalScore !== null && lead.totalScore !== undefined && (
            <span className="kanban-card__rating">
              <Icon name="star" size={12} /> {lead.totalScore.toFixed(1)} ({lead.reviewsCount ?? 0})
            </span>
          )}
          <Badge tone={getWebsiteTone(lead.websiteKind)} size="small">
            <Icon name={getWebsiteIcon(lead.websiteKind)} size={12} /> {getWebsiteLabel(lead.websiteKind)}
          </Badge>
        </div>

        {lead.phone && (
          <AnchorButton
            as="a"
            href={`tel:${lead.phoneUnformatted ?? lead.phone}`}
            variant="ghost"
            size="small"
            className="kanban-card__phone"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            {lead.phone}
          </AnchorButton>
        )}

        {lead.kanbanState.nextAction && (
          <div
            className={`kanban-card__next-action ${isOverdue(lead.kanbanState.dueDate) ? 'kanban-card__next-action--overdue' : ''}`}
          >
            <span>Próxima ação</span>
            <strong>{lead.kanbanState.nextAction}</strong>
            {lead.kanbanState.dueDate && (
              <time dateTime={lead.kanbanState.dueDate}>
                {isOverdue(lead.kanbanState.dueDate) ? 'Atrasado: ' : 'Até: '}
                {formatDate(lead.kanbanState.dueDate)}
              </time>
            )}
          </div>
        )}
      </div>

      <div className="kanban-card__footer">
        <Actions lead={lead} />
      </div>
    </article>
  )
}

function KanbanColumn({
  column,
  leads,
  onCardClick,
}: {
  column: (typeof COLUMNS)[number]
  leads: LeadWithMeta[]
  onCardClick: (lead: LeadWithMeta) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id, data: { column } })

  return (
    <div
      ref={setNodeRef}
      className={`kanban-column ${isOver ? 'kanban-column--over' : ''}`}
    >
      <header className="kanban-column__header" style={{ borderColor: column.color }}>
        <div className="kanban-column__title">
          <Icon name={column.icon} size={18} style={{ color: column.color }} label={column.label} />
          <h2>{column.label}</h2>
        </div>
        <span className="kanban-column__count" style={{ color: column.color }}>
          {leads.length}
        </span>
      </header>
      <SortableContext
        items={leads.map((lead) => lead.placeId)}
        strategy={verticalListSortingStrategy}
      >
        <div className="kanban-column__cards">
          {leads.map((lead, index) => (
            <LeadCard key={lead.placeId} lead={lead} index={index} onClick={onCardClick} />
          ))}
        </div>
      </SortableContext>
    </div>
  )
}

const MESSAGE_TEMPLATE = `Oi, [nome]! Tudo bem? 😊

Sou o Mateus, da Codexa. Dei uma olhada no perfil da [clínica] e identifiquei 2 pontos que, na minha visão, poderiam melhorar bastante a experiência de uma cliente que chega até vocês pelo Instagram.

São coisas simples, mas que podem fazer diferença principalmente na hora de transformar uma pessoa interessada em uma cliente.

Posso te mandar os 2 pontos? Prometo ser rapidinho`

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function LeadModal({
  lead,
  onClose,
  onSave,
}: {
  lead: LeadWithMeta
  onClose: () => void
  onSave: (placeId: string, state: KanbanState) => void
}) {
  const [state, setState] = useState<KanbanState>({ ...lead.kanbanState })

  const [message, setMessage] = useState(() =>
    MESSAGE_TEMPLATE
      .replace(/\[nome\]/g, () => '[nome]')
      .replace(/\[clínica\]/g, () => lead.title),
  )
  const [contactName, setContactName] = useState('')
  const [clinicName, setClinicName] = useState(lead.title)
  const [activeTab, setActiveTab] = useState<'cliente' | 'contato' | 'dados'>('cliente')

  const tabItems: TabItem[] = [
    { id: 'cliente', label: 'Cliente' },
    { id: 'contato', label: 'Contato' },
    { id: 'dados', label: 'Dados' },
  ]

  const interestOptions = [
    { value: '', label: 'Selecione' },
    { value: 'alto', label: 'Alto' },
    { value: 'medio', label: 'Médio' },
    { value: 'baixo', label: 'Baixo' },
  ]

  const updateMessageForName = (nextName: string) =>
    setMessage((prev) => {
      const restored = contactName ? prev.replace(new RegExp(escapeRegExp(contactName), 'g'), '[nome]') : prev
      return restored.replace(/\[nome\]/g, () => nextName || '[nome]')
    })

  const updateMessageForClinic = (nextClinic: string) =>
    setMessage((prev) => {
      const restored = clinicName ? prev.replace(new RegExp(escapeRegExp(clinicName), 'g'), '[clínica]') : prev
      return restored.replace(/\[clínica\]/g, () => nextClinic || '[clínica]')
    })

  useEffect(() => {
    document.body.classList.add('lead-modal-open')
    return () => {
      document.body.classList.remove('lead-modal-open')
    }
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(lead.placeId, state)
    onClose()
  }

  const statusOptions = COLUMNS.map((c) => ({
    value: c.id,
    label: `${c.emoji} ${c.label}`,
  }))

  const lostReasonOptions = [
    { value: '', label: 'Selecione' },
    ...LOST_REASONS.map((r) => ({ value: r, label: r })),
  ]

  return (
    <Dialog open onClose={onClose} title={lead.title}>
      <div className="modal__meta">
        <Badge tone={getTemperatureTone(lead.temperature)} size="small">
          {getTemperatureEmoji(lead.temperature)} {getTemperatureLabel(lead.temperature)} — Score {lead.score}
        </Badge>
        {lead.categoryName && (
          <Tag tone="neutral">
            {lead.categoryName}
          </Tag>
        )}
      </div>

      <form className="modal__form" onSubmit={handleSubmit}>
        <Tabs
          items={tabItems}
          value={activeTab}
          onChange={(value) => setActiveTab(value as 'cliente' | 'contato' | 'dados')}
        />

        {activeTab === 'cliente' && (
          <div className="modal__column">
            <h3 className="modal__column-title">Cliente</h3>

            <Select
              label="Etapa do funil"
              id="status"
              value={state.column}
              onChange={(value: string) => setState({ ...state, column: value as ColumnId })}
              options={statusOptions}
            />

            <Input
              label="Próxima ação"
              id="nextAction"
              type="text"
              placeholder="Ex: Enviar mensagem de apresentação"
              value={state.nextAction ?? ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setState({ ...state, nextAction: e.target.value })
              }
              leadingIcon={<Icon name="edit" size={16} />}
            />

            <Input
              label="Data de follow-up"
              id="dueDate"
              type="date"
              value={state.dueDate ?? ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setState({ ...state, dueDate: e.target.value })
              }
              leadingIcon={<Icon name="calendar" size={16} />}
            />

            {state.column === 'proposta' && (
              <>
                <Input
                  label="Valor da proposta"
                  id="proposalValue"
                  type="text"
                  placeholder="R$ 0,00"
                  value={state.proposalValue ?? ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setState({ ...state, proposalValue: e.target.value })
                  }
                  leadingIcon={<Icon name="plus" size={16} />}
                />
                <Input
                  label="Data prevista de retorno"
                  id="proposalReturnDate"
                  type="date"
                  value={state.proposalReturnDate ?? ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setState({ ...state, proposalReturnDate: e.target.value })
                  }
                  leadingIcon={<Icon name="calendar" size={16} />}
                />
              </>
            )}

            {state.column === 'perdido' && (
              <Select
                label="Motivo"
                id="lostReason"
                value={state.lostReason ?? ''}
                onChange={(value: string) => setState({ ...state, lostReason: value })}
                options={lostReasonOptions}
              />
            )}
          </div>
        )}

        {activeTab === 'contato' && (
          <div className="modal__column modal__column--contact">
            <h3 className="modal__column-title">Contato</h3>

            <Input
              label="Nome"
              id="contact-name"
              type="text"
              placeholder="Ex: Ana"
              value={contactName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setContactName(e.target.value)
                updateMessageForName(e.target.value)
              }}
              leadingIcon={<Icon name="user" size={16} />}
            />

            <Input
              label="Clínica"
              id="clinic-name"
              type="text"
              value={clinicName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setClinicName(e.target.value)
                updateMessageForClinic(e.target.value)
              }}
              leadingIcon={<Icon name="home" size={16} />}
            />

            <Textarea
              label="Mensagem"
              id="lead-message"
              value={message}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMessage(e.target.value)}
              rows={8}
              className="modal__message"
            />
          </div>
        )}

        {activeTab === 'dados' && (
          <div className="modal__column modal__column--dados">
            <h3 className="modal__column-title">Dados coletados</h3>

            <Select
              label="Interesse"
              id="interest"
              value={state.interest ?? ''}
              onChange={(value: string) => setState({ ...state, interest: value as KanbanState['interest'] })}
              options={interestOptions}
            />

            <Input
              label="Orçamento previsto"
              id="budget"
              type="text"
              placeholder="Ex: R$ 2.000"
              value={state.budget ?? ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setState({ ...state, budget: e.target.value })
              }
              leadingIcon={<Icon name="plus" size={16} />}
            />

            <Input
              label="Data de retorno"
              id="returnDate"
              type="date"
              value={state.returnDate ?? ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setState({ ...state, returnDate: e.target.value })
              }
              leadingIcon={<Icon name="calendar" size={16} />}
            />

            <Textarea
              label="Dados e observações"
              id="collectedData"
              value={state.collectedData ?? ''}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setState({ ...state, collectedData: e.target.value })
              }
              rows={6}
              placeholder="Anotações da prospecção, decisores, dores, canais, contexto..."
            />
          </div>
        )}

        <div className="modal__actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary">
            Salvar
          </Button>
        </div>
      </form>

    </Dialog>
  )
}

function App() {
  const [baseLeads, setBaseLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [kanbanGroupFilter, setKanbanGroupFilter] = useState('')
  const [selectedLead, setSelectedLead] = useState<LeadWithMeta | null>(null)
  const [activeDrag, setActiveDrag] = useState<LeadWithMeta | null>(null)
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const [currentView, setCurrentView] = useState<'dashboard' | 'kanban' | 'table' | 'packages' | 'help'>('dashboard')
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const [navOpen, setNavOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    const saved = localStorage.getItem('codexa-theme')
    if (saved === 'dark' || saved === 'light' || saved === 'system') return saved
    return 'system'
  })

  const didDrag = useRef(false)

  useEffect(() => {
    const resolved = theme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : theme
    document.documentElement.setAttribute('data-theme', resolved)
    localStorage.setItem('codexa-theme', theme)
  }, [theme])

  useEffect(() => {
    if (theme !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      document.documentElement.setAttribute('data-theme', media.matches ? 'dark' : 'light')
    }
    media.addEventListener('change', handler)
    return () => media.removeEventListener('change', handler)
  }, [theme])

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => setUser(u))
  }, [])

  useEffect(() => {
    fetchLeads()
      .then(async (data) => {
        setBaseLeads(data)
        await migrateLocalStates(data)
        const fresh = await fetchLeads()
        setBaseLeads(fresh)
        setLoading(false)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Erro desconhecido')
        setLoading(false)
      })
  }, [])

  const allLeads = baseLeads

  const categories = useMemo(
    () =>
      Array.from(
        new Set(allLeads.map((l) => l.categoryName).filter((c): c is string => !!c)),
      ).sort(),
    [allLeads],
  )

  const leadsWithMeta = useMemo<LeadWithMeta[]>(() => {
    return allLeads.map((lead) => {
      const state = lead.kanbanState ?? { column: 'open' }
      return {
        ...lead,
        kanbanState: state,
        score: scoreLead(lead),
        temperature: getTemperature(scoreLead(lead)),
        websiteKind: classifyWebsite(lead.website),
      } as LeadWithMeta
    })
  }, [allLeads])

  const filteredLeads = useMemo(() => {
    return leadsWithMeta.filter((lead) => {
      const matchesSearch = [lead.title, lead.address, lead.phone, lead.categoryName]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(search.toLowerCase()))
      const matchesCategory = categoryFilter ? lead.categoryName === categoryFilter : true
      return matchesSearch && matchesCategory
    })
  }, [leadsWithMeta, search, categoryFilter])

  const kanbanFilteredLeads = useMemo(() => {
    if (!kanbanGroupFilter) return filteredLeads
    return filteredLeads.filter((lead) => lead.groupId === kanbanGroupFilter)
  }, [filteredLeads, kanbanGroupFilter])

  const groups = useMemo(() => {
    const map = new Map<string, { groupId: string; groupTitle: string; count: number }>()
    leadsWithMeta.forEach((lead) => {
      if (!lead.groupId) return
      const existing = map.get(lead.groupId)
      if (existing) {
        existing.count += 1
      } else {
        map.set(lead.groupId, { groupId: lead.groupId, groupTitle: lead.groupTitle?.trim() || 'Grupo', count: 1 })
      }
    })
    return Array.from(map.values()).sort((a, b) => a.groupTitle.localeCompare(b.groupTitle))
  }, [leadsWithMeta])

  const leadsByColumn = useMemo(() => {
    const map: Record<ColumnId, LeadWithMeta[]> = COLUMNS.reduce(
      (acc, c) => ({ ...acc, [c.id]: [] }),
      {} as Record<ColumnId, LeadWithMeta[]>,
    )
    kanbanFilteredLeads.forEach((lead) => {
      map[lead.kanbanState.column] = map[lead.kanbanState.column] ?? []
      map[lead.kanbanState.column].push(lead)
    })
    COLUMNS.forEach((c) => {
      if (c.id === 'open') {
        map[c.id].sort((a, b) => b.score - a.score)
      } else {
        map[c.id].sort(
          (a, b) => (a.kanbanState.order ?? Infinity) - (b.kanbanState.order ?? Infinity),
        )
      }
    })
    return map
  }, [kanbanFilteredLeads])

  const selectedGroupLeads = useMemo(() => {
    if (!selectedGroup) return []
    return filteredLeads.filter((lead) => lead.groupId === selectedGroup)
  }, [filteredLeads, selectedGroup])

  const selectedGroupTitle = useMemo(() => {
    if (!selectedGroup) return ''
    return leadsWithMeta.find((lead) => lead.groupId === selectedGroup)?.groupTitle?.trim() || 'Grupo'
  }, [leadsWithMeta, selectedGroup])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
  )

  const handleDragStart = (event: DragStartEvent) => {
    didDrag.current = true
    const placeId = event.active.id as string
    const lead = leadsWithMeta.find((l) => l.placeId === placeId)
    if (lead) setActiveDrag(lead)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDrag(null)
    setTimeout(() => {
      didDrag.current = false
    }, 100)

    const { active, over } = event
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string
    const activeIndex = baseLeads.findIndex((l) => l.placeId === activeId)
    if (activeIndex === -1) return

    const activeLead = baseLeads[activeIndex]
    const activeColumn = activeLead.kanbanState?.column ?? 'open'

    // Build current column map respecting the same ordering used in leadsByColumn
    const byColumn = COLUMNS.reduce(
      (acc, c) => ({ ...acc, [c.id]: [] as Lead[] }),
      {} as Record<ColumnId, Lead[]>,
    )
    baseLeads.forEach((lead) => {
      byColumn[lead.kanbanState?.column ?? 'open'].push(lead)
    })
    COLUMNS.forEach((c) => {
      if (c.id === 'open') {
        byColumn[c.id].sort((a, b) => scoreLead(b) - scoreLead(a))
      } else {
        byColumn[c.id].sort(
          (a, b) => (a.kanbanState?.order ?? Infinity) - (b.kanbanState?.order ?? Infinity),
        )
      }
    })

    const overIsColumn = COLUMNS.some((c) => c.id === overId)
    let targetColumn: ColumnId
    let targetIndex: number

    if (overIsColumn) {
      targetColumn = overId as ColumnId
      targetIndex = byColumn[targetColumn].length
    } else {
      const overLead = baseLeads.find((l) => l.placeId === overId)
      if (!overLead) return
      targetColumn = overLead.kanbanState?.column ?? 'open'
      targetIndex = byColumn[targetColumn].findIndex((l) => l.placeId === overId)
      if (targetIndex === -1) return
    }

    const activeInColumnIndex = byColumn[activeColumn].findIndex((l) => l.placeId === activeId)
    if (activeInColumnIndex === -1) return

    if (activeColumn === targetColumn) {
      byColumn[targetColumn] = arrayMove(
        byColumn[targetColumn],
        activeInColumnIndex,
        targetIndex,
      )
    } else {
      const [moved] = byColumn[activeColumn].splice(activeInColumnIndex, 1)
      byColumn[targetColumn].splice(targetIndex, 0, moved)
    }

    // Rebuild leads with updated column and order, persisting order only for non-open columns
    const nextLeads: Lead[] = []
    const leadsToUpdate: { placeId: string; kanbanState: KanbanState }[] = []

    COLUMNS.forEach((c) => {
      byColumn[c.id].forEach((lead, index) => {
        const nextKanbanState: KanbanState = {
          ...(lead.kanbanState ?? {}),
          column: c.id,
          order: c.id === 'open' ? undefined : index,
        }
        nextLeads.push({ ...lead, kanbanState: nextKanbanState })
        if (
          lead.kanbanState?.column !== c.id ||
          lead.kanbanState?.order !== nextKanbanState.order
        ) {
          leadsToUpdate.push({ placeId: lead.placeId, kanbanState: nextKanbanState })
        }
      })
    })

    setBaseLeads(nextLeads)

    if (leadsToUpdate.length) {
      updateLeadsBatch(leadsToUpdate).catch((err) => {
        console.error(err)
        setError('Erro ao salvar ordem dos leads')
      })
    }
  }

  const handleSaveLead = (placeId: string, state: KanbanState) => {
    setBaseLeads((prev) =>
      prev.map((l) => (l.placeId === placeId ? { ...l, kanbanState: state } : l)),
    )
    updateLeadState(placeId, state).catch((err) => {
      console.error(err)
      setError('Erro ao salvar lead')
    })
  }

  const handleCardClick = (lead: LeadWithMeta) => {
    if (didDrag.current) return
    setSelectedLead(lead)
  }

  const handleRefresh = async () => {
    try {
      setLoading(true)
      const fresh = await fetchLeads()
      setBaseLeads(fresh)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Erro ao atualizar')
    } finally {
      setLoading(false)
    }
  }

  const handleEditGroup = async (group: LeadGroup, title: string) => {
    if (!group.groupId) return
    try {
      const res = await fetch(`/api/leads/group/${group.groupId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupTitle: title }),
      })
      if (!res.ok) throw new Error('Erro ao editar grupo')
      const fresh = await fetchLeads()
      setBaseLeads(fresh)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Erro ao editar grupo')
    }
  }

  const handleDeleteGroup = async (group: LeadGroup) => {
    if (!group.groupId) return
    try {
      const res = await fetch(`/api/leads/group/${group.groupId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erro ao excluir grupo')
      const fresh = await fetchLeads()
      setBaseLeads(fresh)
      if (selectedGroup === group.groupId) setSelectedGroup(null)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Erro ao excluir grupo')
    }
  }

  if (user === undefined) {
    return <div className="prospect-loading">Inicializando…</div>
  }

  if (user === null) {
    return <Login />
  }

  return (
    <div className="prospect-app">
      <aside className="prospect-sidebar">
        <div className="prospect-sidebar__brand">
          <img src={theme === 'dark' ? codexaLogoDark : codexaLogo} alt="Codexa" className="prospect-sidebar__logo" />
          <div className="prospect-sidebar__user">
            <Avatar
              name={user.displayName ?? user.email ?? 'Usuário'}
              src={user.photoURL || undefined}
              size="medium"
            />
            <div className="prospect-sidebar__user-info">
              <span className="prospect-sidebar__user-name">{user.displayName ?? user.email ?? 'Usuário'}</span>
              <Button
                type="button"
                variant="ghost"
                size="small"
                onClick={() => signOut(auth)}
                leadingIcon={<Icon name="logout" size={14} />}
              >
                Sair
              </Button>
            </div>
          </div>
          <Button
            type="button"
            className="prospect-sidebar__menu"
            variant="ghost"
            size="small"
            iconOnly
            leadingIcon={<Icon name={navOpen ? 'x' : 'menu'} size={22} />}
            onClick={() => setNavOpen((prev) => !prev)}
            aria-label="Abrir menu"
            aria-expanded={navOpen}
          />
        </div>

        <nav className={`prospect-nav ${navOpen ? 'prospect-nav--open' : ''}`} aria-label="Navegação principal">
          <div className="prospect-nav__header">
            <img
              src={theme === 'dark' ? codexaLogoDark : codexaLogo}
              alt="Codexa"
              className="prospect-nav__logo"
            />
            <div className="prospect-nav__theme" role="group" aria-label="Tema">
              <Button
                type="button"
                className={`prospect-nav__theme-btn ${theme === 'system' ? 'prospect-nav__theme-btn--active' : ''}`}
                variant="ghost"
                size="small"
                iconOnly
                onClick={() => setTheme('system')}
                aria-label="Sistema"
                leadingIcon={(
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                )}
              />
              <Button
                type="button"
                className={`prospect-nav__theme-btn ${theme === 'light' ? 'prospect-nav__theme-btn--active' : ''}`}
                variant="ghost"
                size="small"
                iconOnly
                onClick={() => setTheme('light')}
                aria-label="Claro"
                leadingIcon={(
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5" />
                    <line x1="12" y1="1" x2="12" y2="3" />
                    <line x1="12" y1="21" x2="12" y2="23" />
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                    <line x1="1" y1="12" x2="3" y2="12" />
                    <line x1="21" y1="12" x2="23" y2="12" />
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                  </svg>
                )}
              />
              <Button
                type="button"
                className={`prospect-nav__theme-btn ${theme === 'dark' ? 'prospect-nav__theme-btn--active' : ''}`}
                variant="ghost"
                size="small"
                iconOnly
                onClick={() => setTheme('dark')}
                aria-label="Escuro"
                leadingIcon={(
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                )}
              />
            </div>
          </div>

          <div className="prospect-nav__user">
            <Avatar
              name={user.displayName ?? user.email ?? 'Usuário'}
              src={user.photoURL || undefined}
              size="medium"
            />
            <div className="prospect-nav__user-info">
              <span className="prospect-nav__user-name">{user.displayName ?? user.email ?? 'Usuário'}</span>
              <Button
                type="button"
                variant="ghost"
                size="small"
                onClick={() => signOut(auth)}
                leadingIcon={<Icon name="logout" size={14} />}
              >
                Sair
              </Button>
            </div>
            <Button
              type="button"
              className="prospect-nav__close"
              variant="ghost"
              size="small"
              iconOnly
              leadingIcon={<Icon name="x" size={20} />}
              onClick={() => setNavOpen(false)}
              aria-label="Fechar menu"
            />
          </div>

          <Button
            type="button"
            className="prospect-nav__btn"
            variant={currentView === 'dashboard' ? 'primary' : 'ghost'}
            onClick={() => { setSelectedGroup(null); setCurrentView('dashboard'); setNavOpen(false) }}
            leadingIcon={<Icon name="home" size={18} />}
          >
            Dashboard
          </Button>
          <Button
            type="button"
            className="prospect-nav__btn"
            variant={currentView === 'kanban' ? 'primary' : 'ghost'}
            onClick={() => { setSelectedGroup(null); setCurrentView('kanban'); setNavOpen(false) }}
            leadingIcon={<Icon name="sort" size={18} />}
          >
            Kanban
          </Button>
          <Button
            type="button"
            className="prospect-nav__btn"
            variant={currentView === 'table' ? 'primary' : 'ghost'}
            onClick={() => { setSelectedGroup(null); setCurrentView('table'); setNavOpen(false) }}
            leadingIcon={<Icon name="users" size={18} />}
          >
            Leads
          </Button>
          <Button
            type="button"
            className="prospect-nav__btn"
            variant={currentView === 'packages' ? 'primary' : 'ghost'}
            onClick={() => { setSelectedGroup(null); setCurrentView('packages'); setNavOpen(false) }}
            leadingIcon={<Icon name="file" size={18} />}
          >
            Pacotes
          </Button>
          <Button
            type="button"
            className="prospect-nav__btn"
            variant={currentView === 'help' ? 'primary' : 'ghost'}
            onClick={() => { setSelectedGroup(null); setCurrentView('help'); setNavOpen(false) }}
            leadingIcon={<Icon name="help" size={18} />}
          >
            Help
          </Button>
        </nav>
      </aside>

      {navOpen && (
        <div
          className="prospect-nav-overlay"
          onClick={() => setNavOpen(false)}
          aria-hidden="true"
        />
      )}

      <main className="prospect-main">
        <header className="prospect-header prospect-header--logged">
          <div className="prospect-header__page">
            <img
              src={theme === 'dark' ? codexaLogoDark : codexaLogo}
              alt="Codexa"
              className="prospect-header__logo"
            />
            <img
              src={codexaIcon}
              alt="Codexa"
              className="prospect-header__logo-mobile"
            />
            <div>
              <h2>
                {currentView === 'dashboard'
                  ? 'Dashboard'
                  : currentView === 'kanban'
                    ? 'Kanban'
                  : currentView === 'table'
                    ? 'Leads'
                    : currentView === 'packages'
                      ? 'Pacotes'
                      : 'Help'}
              </h2>
              <p>
                {currentView === 'dashboard'
                  ? 'Visão geral do funil comercial'
                  : currentView === 'kanban'
                    ? 'Kanban de prospecção comercial'
                  : currentView === 'table'
                    ? 'Lista completa de leads'
                    : currentView === 'packages'
                      ? 'Planos e valores para clínicas de estética'
                      : 'Base de conhecimento para prospecções'}
              </p>
            </div>
          </div>
          <Button
            type="button"
            className="prospect-header__menu"
            variant="ghost"
            size="small"
            iconOnly
            leadingIcon={<Icon name={navOpen ? 'x' : 'menu'} size={22} />}
            onClick={() => setNavOpen((prev) => !prev)}
            aria-label="Abrir menu"
            aria-expanded={navOpen}
          />
        </header>

        <div className="prospect-content">
          {(currentView === 'kanban' || (currentView === 'table' && selectedGroup)) && (
            <>
              <div className="prospect-toolbar">
                <div className="prospect-toolbar__fields">
                  <div className="prospect-toolbar__field prospect-toolbar__field--search">
                    <SearchInput
                      label="Buscar"
                      id="search"
                      placeholder="Nome, endereço, telefone..."
                      value={search}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                      onClear={() => setSearch('')}
                    />
                  </div>
                  <div className="prospect-toolbar__field prospect-toolbar__field--category">
                    <Select
                      label="Categoria"
                      id="category"
                      value={categoryFilter}
                      onChange={(value: string) => setCategoryFilter(value)}
                      options={[
                        { value: '', label: 'Todas' },
                        ...categories.map((cat) => ({ value: cat, label: cat })),
                      ]}
                    />
                  </div>
                  {currentView === 'kanban' && (
                    <div className="prospect-toolbar__field prospect-toolbar__field--group">
                      <Select
                        label="Grupo"
                        id="kanban-group"
                        value={kanbanGroupFilter}
                        onChange={(value: string) => setKanbanGroupFilter(value)}
                        options={[
                          { value: '', label: 'Todos os grupos' },
                          ...groups.map((g) => ({ value: g.groupId, label: `${g.groupTitle} (${g.count})` })),
                        ]}
                      />
                    </div>
                  )}
                </div>
                <Button
                  type="button"
                  className="prospect-toolbar__filter-toggle"
                  variant="secondary"
                  size="small"
                  onClick={() => setFiltersOpen(true)}
                  leadingIcon={<Icon name="filter" size={18} />}
                >
                  Filtros
                </Button>
                <Button
                  type="button"
                  className="prospect-toolbar__refresh"
                  variant="secondary"
                  size="small"
                  onClick={handleRefresh}
                  leadingIcon={<Icon name="refresh" size={18} />}
                >
                  Atualizar
                </Button>
              </div>

              {filtersOpen && (
                <Dialog open onClose={() => setFiltersOpen(false)} title="Filtros">
                  <div className="prospect-filters">
                    <div className="prospect-filters__field">
                      <SearchInput
                        label="Buscar"
                        id="search-mobile"
                        placeholder="Nome, endereço, telefone..."
                        value={search}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                        onClear={() => setSearch('')}
                      />
                    </div>
                    <div className="prospect-filters__field">
                      <Select
                        label="Categoria"
                        id="category-mobile"
                        value={categoryFilter}
                        onChange={(value: string) => setCategoryFilter(value)}
                        options={[
                          { value: '', label: 'Todas' },
                          ...categories.map((cat) => ({ value: cat, label: cat })),
                        ]}
                      />
                    </div>
                    {currentView === 'kanban' && (
                      <div className="prospect-filters__field">
                        <Select
                          label="Grupo"
                          id="kanban-group-mobile"
                          value={kanbanGroupFilter}
                          onChange={(value: string) => setKanbanGroupFilter(value)}
                          options={[
                            { value: '', label: 'Todos os grupos' },
                            ...groups.map((g) => ({ value: g.groupId, label: `${g.groupTitle} (${g.count})` })),
                          ]}
                        />
                      </div>
                    )}
                    <div className="prospect-filters__actions">
                      <Button type="button" variant="secondary" onClick={() => setFiltersOpen(false)}>
                        Fechar
                      </Button>
                    </div>
                  </div>
                </Dialog>
              )}
            </>
          )}

          {currentView === 'dashboard' ? (
            loading ? (
              <div className="prospect-loading">
                <Spinner size="medium" label="Carregando dashboard..." />
              </div>
            ) : error ? (
              <div className="prospect-empty">
                <Alert tone="danger" title="Erro ao carregar">
                  {error}
                </Alert>
              </div>
            ) : (
              <Dashboard
                leads={leadsWithMeta}
                columns={COLUMNS}
                onOpenKanban={() => setCurrentView('kanban')}
              />
            )
          ) : currentView === 'kanban' ? (
            <>
              {loading ? (
                <div className="prospect-loading">
                  <Spinner size="medium" label="Carregando leads..." />
                </div>
              ) : error ? (
                <div className="prospect-empty">
                  <Alert tone="danger" title="Erro ao carregar">
                    {error}
                  </Alert>
                </div>
              ) : kanbanFilteredLeads.length === 0 ? (
                <div className="prospect-empty">
                  <EmptyState
                    icon="search"
                    title="Nenhum lead encontrado"
                    description="Tente ajustar os filtros."
                  />
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                >
                  <div className="kanban-board">
                    {COLUMNS.map((column) => (
                      <KanbanColumn
                        key={column.id}
                        column={column}
                        leads={leadsByColumn[column.id]}
                        onCardClick={handleCardClick}
                      />
                    ))}
                  </div>
                  <DragOverlay dropAnimation={null}>
                    {activeDrag ? (
                      <div className="kanban-card kanban-card--dragging">
                        <div className="kanban-card__header">
                          <div className="kanban-card__title-wrap">
                            <h3 className="kanban-card__title">{activeDrag.title}</h3>
                          </div>
                          <span className={`temperature-badge temperature-badge--${activeDrag.temperature}`}>
                            {getTemperatureEmoji(activeDrag.temperature)} {activeDrag.score}
                          </span>
                        </div>
                        <div className="kanban-card__body">
                          <div className="kanban-card__meta">
                            {activeDrag.totalScore !== null && activeDrag.totalScore !== undefined && (
                              <span className="kanban-card__rating">
                                ⭐ {activeDrag.totalScore.toFixed(1)} ({activeDrag.reviewsCount ?? 0})
                              </span>
                            )}
                            <span className={`kanban-card__website kanban-card__website--${activeDrag.websiteKind}`}>
                              {getWebsiteLabel(activeDrag.websiteKind)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </DragOverlay>
                </DndContext>
              )}

              {selectedLead && (
                <LeadModal
                  lead={selectedLead}
                  onClose={() => setSelectedLead(null)}
                  onSave={handleSaveLead}
                />
              )}
            </>
          ) : currentView === 'table' ? (
            <>
              {loading ? (
                <div className="prospect-loading">
                  <Spinner size="medium" label="Carregando leads..." />
                </div>
              ) : error ? (
                <div className="prospect-empty">
                  <Alert tone="danger" title="Erro ao carregar">
                    {error}
                  </Alert>
                </div>
              ) : selectedGroup ? (
                selectedGroupLeads.length === 0 ? (
                  <div className="prospect-empty">
                    <EmptyState
                      icon="search"
                      title="Nenhum lead encontrado"
                      description="Tente ajustar os filtros."
                    />
                  </div>
                ) : (
                  <>
                    <div className="prospect-group-header">
                      <Button
                        type="button"
                        variant="ghost"
                        size="small"
                        onClick={() => setSelectedGroup(null)}
                        leadingIcon={<Icon name="arrow-left" size={16} />}
                      >
                        Voltar
                      </Button>
                      <h3 className="prospect-group-header__title">{selectedGroupTitle}</h3>
                    </div>
                    <LeadsTable leads={selectedGroupLeads} onLeadClick={handleCardClick} />
                  </>
                )
              ) : (
                <LeadGroupsTable
                  leads={leadsWithMeta}
                  onGroupClick={(group: LeadGroup) => setSelectedGroup(group.groupId)}
                  onEditGroup={handleEditGroup}
                  onDeleteGroup={handleDeleteGroup}
                />
              )}

              {selectedLead && (
                <LeadModal
                  lead={selectedLead}
                  onClose={() => setSelectedLead(null)}
                  onSave={handleSaveLead}
                />
              )}
            </>
          ) : currentView === 'packages' ? (
            <Packages />
          ) : (
            <Help />
          )}
        </div>
      </main>
    </div>
  )
}

export default App
