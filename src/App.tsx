import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { onAuthStateChanged, signOut, type User } from 'firebase/auth'
import { auth } from './firebase'
import Login from './Login'
import ImportExport from './ImportExport'
import type { ColumnId, KanbanState, Lead, LeadWithMeta, Temperature } from './types'
import { loadKanbanStates, saveKanbanStates } from './storage'
import './App.css'

const COLUMNS: { id: ColumnId; label: string; emoji: string; color: string }[] = [
  { id: 'open', label: 'Open', emoji: '🟢', color: '#25BF44' },
  { id: 'contato', label: 'Contato feito', emoji: '📞', color: '#3B82F6' },
  { id: 'conversa', label: 'Em conversa', emoji: '💬', color: '#8B5CF6' },
  { id: 'followup', label: 'Follow-up', emoji: '📅', color: '#F59E0B' },
  { id: 'proposta', label: 'Proposta enviada', emoji: '📄', color: '#0EA5E9' },
  { id: 'negociacao', label: 'Negociação', emoji: '🔥', color: '#EF4444' },
  { id: 'fechado', label: 'Cliente fechado', emoji: '✅', color: '#13992F' },
  { id: 'perdido', label: 'Perdido', emoji: '❌', color: '#6D7480' },
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

function isOverdue(dueDate?: string): boolean {
  if (!dueDate) return false
  return new Date(dueDate).getTime() < new Date().setHours(0, 0, 0, 0)
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('pt-BR')
}

function getUserInitials(user: User): string {
  const name = user.displayName ?? user.email ?? 'U'
  return name
    .split(/[\s@]+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

function Actions({ lead }: { lead: Lead }) {
  return (
    <div className="lead-actions" onClick={(e) => e.stopPropagation()}>
      {lead.phone && (
        <a
          className="action-btn action-btn--primary"
          href={`tel:${lead.phoneUnformatted ?? lead.phone}`}
        >
          Ligar
        </a>
      )}
      {lead.website && isValidUrl(lead.website) && (
        <a
          className="action-btn action-btn--secondary"
          href={lead.website}
          target="_blank"
          rel="noopener noreferrer"
        >
          Site
        </a>
      )}
      <a
        className="action-btn action-btn--secondary"
        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lead.title ?? '')}&query_place_id=${lead.placeId}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        Maps
      </a>
    </div>
  )
}

function LeadCard({
  lead,
  onClick,
}: {
  lead: LeadWithMeta
  onClick: (lead: LeadWithMeta) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({ id: lead.placeId, data: { lead } })

  const style = {
    transform: CSS.Translate.toString(transform),
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
            <span className="kanban-card__category">{lead.categoryName}</span>
          )}
        </div>
        <span
          className={`temperature-badge temperature-badge--${lead.temperature}`}
          title={`Score ${lead.score}`}
        >
          {getTemperatureEmoji(lead.temperature)} {lead.score}
        </span>
      </div>

      <div className="kanban-card__body">
        <div className="kanban-card__meta">
          {lead.totalScore !== null && lead.totalScore !== undefined && (
            <span className="kanban-card__rating">
              ⭐ {lead.totalScore.toFixed(1)} ({lead.reviewsCount ?? 0})
            </span>
          )}
          <span className={`kanban-card__website kanban-card__website--${lead.websiteKind}`}>
            {getWebsiteLabel(lead.websiteKind)}
          </span>
        </div>

        {lead.phone && (
          <a
            href={`tel:${lead.phoneUnformatted ?? lead.phone}`}
            className="kanban-card__phone"
            onClick={(e) => e.stopPropagation()}
          >
            {lead.phone}
          </a>
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
          <span className="kanban-column__emoji" style={{ color: column.color }}>
            {column.emoji}
          </span>
          <h2>{column.label}</h2>
        </div>
        <span className="kanban-column__count" style={{ color: column.color }}>
          {leads.length}
        </span>
      </header>
      <div className="kanban-column__cards">
        {leads.map((lead) => (
          <LeadCard key={lead.placeId} lead={lead} onClick={onCardClick} />
        ))}
      </div>
    </div>
  )
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(lead.placeId, state)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal__header">
          <h2>{lead.title}</h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </header>

        <div className="modal__meta">
          <span className={`temperature-badge temperature-badge--${lead.temperature}`}>
            {getTemperatureEmoji(lead.temperature)} {getTemperatureLabel(lead.temperature)} — Score {lead.score}
          </span>
          {lead.categoryName && <span className="modal__category">{lead.categoryName}</span>}
        </div>

        <form className="modal__form" onSubmit={handleSubmit}>
          <div className="prospect-field">
            <label htmlFor="status">Etapa do funil</label>
            <select
              id="status"
              value={state.column}
              onChange={(e) => setState({ ...state, column: e.target.value as ColumnId })}
            >
              {COLUMNS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji} {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="prospect-field">
            <label htmlFor="nextAction">Próxima ação</label>
            <input
              id="nextAction"
              type="text"
              placeholder="Ex: Enviar mensagem de apresentação"
              value={state.nextAction ?? ''}
              onChange={(e) => setState({ ...state, nextAction: e.target.value })}
            />
          </div>

          <div className="prospect-field">
            <label htmlFor="dueDate">Data de follow-up</label>
            <input
              id="dueDate"
              type="date"
              value={state.dueDate ?? ''}
              onChange={(e) => setState({ ...state, dueDate: e.target.value })}
            />
          </div>

          {state.column === 'proposta' && (
            <>
              <div className="prospect-field">
                <label htmlFor="proposalValue">Valor da proposta</label>
                <input
                  id="proposalValue"
                  type="text"
                  placeholder="R$ 0,00"
                  value={state.proposalValue ?? ''}
                  onChange={(e) => setState({ ...state, proposalValue: e.target.value })}
                />
              </div>
              <div className="prospect-field">
                <label htmlFor="proposalReturnDate">Data prevista de retorno</label>
                <input
                  id="proposalReturnDate"
                  type="date"
                  value={state.proposalReturnDate ?? ''}
                  onChange={(e) =>
                    setState({ ...state, proposalReturnDate: e.target.value })
                  }
                />
              </div>
            </>
          )}

          {state.column === 'perdido' && (
            <div className="prospect-field">
              <label htmlFor="lostReason">Motivo</label>
              <select
                id="lostReason"
                value={state.lostReason ?? ''}
                onChange={(e) => setState({ ...state, lostReason: e.target.value })}
              >
                <option value="">Selecione</option>
                {LOST_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="modal__actions">
            <button type="button" className="action-btn action-btn--secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="action-btn action-btn--primary">
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function App() {
  const [baseLeads, setBaseLeads] = useState<Lead[]>([])
  const [leadStates, setKanbanStates] = useState<Record<string, KanbanState>>(() =>
    loadKanbanStates(),
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [selectedLead, setSelectedLead] = useState<LeadWithMeta | null>(null)
  const [activeDrag, setActiveDrag] = useState<LeadWithMeta | null>(null)
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const [currentView, setCurrentView] = useState<'home' | 'import'>('home')
  const didDrag = useRef(false)

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => setUser(u))
  }, [])

  useEffect(() => {
    fetchLeads()
      .then((data) => {
        setBaseLeads(data)
        setLoading(false)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Erro desconhecido')
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    saveKanbanStates(leadStates)
  }, [leadStates])

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
      const state = leadStates[lead.placeId] ?? { column: 'open' }
      return {
        ...lead,
        kanbanState: state,
        score: scoreLead(lead),
        temperature: getTemperature(scoreLead(lead)),
        websiteKind: classifyWebsite(lead.website),
      }
    })
  }, [allLeads, leadStates])

  const filteredLeads = useMemo(() => {
    return leadsWithMeta.filter((lead) => {
      const matchesSearch = [lead.title, lead.address, lead.phone, lead.categoryName]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(search.toLowerCase()))
      const matchesCategory = categoryFilter ? lead.categoryName === categoryFilter : true
      return matchesSearch && matchesCategory
    })
  }, [leadsWithMeta, search, categoryFilter])

  const leadsByColumn = useMemo(() => {
    const map: Record<ColumnId, LeadWithMeta[]> = COLUMNS.reduce(
      (acc, c) => ({ ...acc, [c.id]: [] }),
      {} as Record<ColumnId, LeadWithMeta[]>,
    )
    filteredLeads.forEach((lead) => {
      map[lead.kanbanState.column] = map[lead.kanbanState.column] ?? []
      map[lead.kanbanState.column].push(lead)
    })
    COLUMNS.forEach((c) => {
      map[c.id].sort((a, b) => b.score - a.score)
    })
    return map
  }, [filteredLeads])

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
    const newColumn = over.id as ColumnId
    const placeId = active.id as string
    if (!COLUMNS.some((c) => c.id === newColumn)) return
    setKanbanStates((prev) => ({
      ...prev,
      [placeId]: { ...(prev[placeId] ?? { column: 'open' }), column: newColumn },
    }))
  }

  const handleSaveLead = (placeId: string, state: KanbanState) => {
    setKanbanStates((prev) => ({ ...prev, [placeId]: state }))
  }

  const handleImport = async (leads: Lead[]) => {
    try {
      const res = await fetch('/api/leads/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leads),
      })
      if (!res.ok) throw new Error('Erro ao importar leads')

      const stateMap = { ...leadStates }
      leads.forEach((item) => {
        const meta = item as unknown as Partial<LeadWithMeta>
        const { kanbanState } = meta
        if (kanbanState) stateMap[item.placeId] = kanbanState as KanbanState
      })
      setKanbanStates(stateMap)

      const fresh = await fetchLeads()
      setBaseLeads(fresh)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Erro ao importar leads')
    }
  }

  const handleExport = () => {
    const data = JSON.stringify(leadsWithMeta, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `codexa-leads-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const handleCardClick = (lead: LeadWithMeta) => {
    if (didDrag.current) return
    setSelectedLead(lead)
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
          <h1>Codexa</h1>
          <p>Prospecção</p>
        </div>

        <nav className="prospect-nav" aria-label="Navegação principal">
          <button
            type="button"
            className={`prospect-nav__item ${currentView === 'home' ? 'prospect-nav__item--active' : ''}`}
            onClick={() => setCurrentView('home')}
          >
            Home
          </button>
          <button
            type="button"
            className={`prospect-nav__item ${currentView === 'import' ? 'prospect-nav__item--active' : ''}`}
            onClick={() => setCurrentView('import')}
          >
            Importar / Exportar
          </button>
        </nav>
      </aside>

      <main className="prospect-main">
        <header className="prospect-header prospect-header--logged">
          <div className="prospect-header__page">
            <h2>{currentView === 'home' ? 'Home' : 'Importar / Exportar'}</h2>
            <p>{currentView === 'home' ? 'Kanban de prospecção comercial' : 'Importe ou exporte seus leads'}</p>
          </div>

          <div className="prospect-header__user">
            <div className="user-avatar" title={user.displayName ?? user.email ?? 'Usuário'}>
              {user.photoURL ? (
                <img src={user.photoURL} alt="" />
              ) : (
                <span>{getUserInitials(user)}</span>
              )}
            </div>
            <span className="user-name">{user.displayName ?? user.email ?? 'Usuário'}</span>
            <button
              type="button"
              className="action-btn action-btn--secondary"
              onClick={() => signOut(auth)}
            >
              Sair
            </button>
          </div>
        </header>

        <div className="prospect-content">
          {currentView === 'home' ? (
            <>
              <div className="prospect-toolbar">
            <div className="prospect-field" style={{ flex: '2 1 300px' }}>
              <label htmlFor="search">Buscar</label>
              <input
                id="search"
                type="text"
                placeholder="Nome, endereço, telefone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="prospect-field" style={{ flex: '1 1 220px' }}>
              <label htmlFor="category">Categoria</label>
              <select
                id="category"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="">Todas</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="prospect-loading">Carregando leads...</div>
          ) : error ? (
            <div className="prospect-empty">{error}</div>
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
      ) : (
        <ImportExport leads={leadsWithMeta} onImport={handleImport} onExport={handleExport} />
      )}
        </div>
      </main>
    </div>
  )
}

export default App
