import { useEffect, useMemo, useState } from 'react'
import './App.css'

interface Lead {
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
}

type SortKey = 'title' | 'categoryName' | 'city' | 'totalScore' | 'reviewsCount'
type ViewMode = 'grid' | 'list'

const fetchLeads = async (): Promise<Lead[]> => {
  const res = await fetch('/data/leads.json')
  if (!res.ok) throw new Error('Não foi possível carregar os dados')
  return res.json()
}

function statusTag(lead: Lead) {
  if (lead.permanentlyClosed) return <span className="closed-tag">Fechado</span>
  if (lead.temporarilyClosed) return <span className="closed-tag">Fechado temp.</span>
  return <span className="open-tag">Ativo</span>
}

function scoreBadge(score: number | null) {
  if (score == null) return '-'
  return <span className="card-score">{score.toFixed(1)}</span>
}

function Actions({ lead }: { lead: Lead }) {
  return (
    <div className="lead-actions">
      {lead.phone && (
        <a
          className="action-btn action-btn--primary"
          href={`tel:${lead.phoneUnformatted ?? lead.phone}`}
        >
          Ligar
        </a>
      )}
      {lead.website && (
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

function GridCard({ lead }: { lead: Lead }) {
  return (
    <article className="prospect-card">
      <div className="prospect-card__header">
        <div>
          <h2 className="prospect-card__title">{lead.title}</h2>
          {lead.categoryName && (
            <span className="prospect-card__category">{lead.categoryName}</span>
          )}
        </div>
        {statusTag(lead)}
      </div>

      <div className="prospect-card__body">
        {lead.address && (
          <p className="prospect-card__row">
            <span>Endereço</span>
            <strong>{lead.address}</strong>
          </p>
        )}
        {lead.phone && (
          <p className="prospect-card__row">
            <span>Telefone</span>
            <a
              href={`tel:${lead.phoneUnformatted ?? lead.phone}`}
              className="prospect-card__link"
            >
              {lead.phone}
            </a>
          </p>
        )}
        {lead.website && (
          <p className="prospect-card__row">
            <span>Site</span>
            <a
              href={lead.website}
              target="_blank"
              rel="noopener noreferrer"
              className="prospect-card__link"
            >
              {lead.website.replace(/^https?:\/\//, '')}
            </a>
          </p>
        )}
        <div className="prospect-card__metrics">
          <div>
            <span>Nota</span>
            <strong>{scoreBadge(lead.totalScore)}</strong>
          </div>
          <div>
            <span>Reviews</span>
            <strong>{lead.reviewsCount ?? '-'}</strong>
          </div>
          {lead.city && (
            <div>
              <span>Cidade</span>
              <strong className="prospect-card__city">{lead.city}</strong>
            </div>
          )}
        </div>
      </div>

      <div className="prospect-card__footer">
        <Actions lead={lead} />
      </div>
    </article>
  )
}

function ListItem({ lead }: { lead: Lead }) {
  return (
    <article className="prospect-list-item">
      <div className="prospect-list-item__main">
        <div className="prospect-list-item__info">
          <h3 className="prospect-list-item__title">{lead.title}</h3>
          {lead.categoryName && (
            <span className="prospect-list-item__category">{lead.categoryName}</span>
          )}
        </div>

        <div className="prospect-list-item__details">
          {lead.address && (
            <span className="prospect-list-item__address" title={lead.address}>
              {lead.address}
            </span>
          )}
          {lead.phone && (
            <a
              href={`tel:${lead.phoneUnformatted ?? lead.phone}`}
              className="prospect-list-item__phone"
            >
              {lead.phone}
            </a>
          )}
          {lead.website && (
            <a
              href={lead.website}
              target="_blank"
              rel="noopener noreferrer"
              className="prospect-list-item__website"
            >
              {lead.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
            </a>
          )}
        </div>

        <div className="prospect-list-item__metrics">
          {lead.city && (
            <span className="prospect-list-item__city">{lead.city}</span>
          )}
          <span className="prospect-list-item__score">{scoreBadge(lead.totalScore)}</span>
          <span>{lead.reviewsCount ?? '-'} reviews</span>
        </div>
      </div>

      <div className="prospect-list-item__aside">
        {statusTag(lead)}
        <Actions lead={lead} />
      </div>
    </article>
  )
}

function App() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [cityFilter, setCityFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [view, setView] = useState<ViewMode>(() => {
    const params = new URLSearchParams(window.location.search)
    const viewParam = params.get('view')
    return viewParam === 'list' ? 'list' : 'grid'
  })
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({
    key: 'title',
    dir: 'asc',
  })

  useEffect(() => {
    fetchLeads()
      .then((data) => {
        setLeads(data)
        setLoading(false)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Erro desconhecido')
        setLoading(false)
      })
  }, [])

  const cities = useMemo(
    () =>
      Array.from(
        new Set(leads.map((l) => l.city).filter((c): c is string => !!c)),
      ).sort(),
    [leads],
  )

  const categories = useMemo(
    () =>
      Array.from(
        new Set(
          leads.map((l) => l.categoryName).filter((c): c is string => !!c),
        ),
      ).sort(),
    [leads],
  )

  const filtered = useMemo(() => {
    return leads.filter((lead) => {
      const matchesSearch = [lead.title, lead.address, lead.phone, lead.categoryName]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(search.toLowerCase()))
      const matchesCity = cityFilter ? lead.city === cityFilter : true
      const matchesCategory = categoryFilter ? lead.categoryName === categoryFilter : true
      return matchesSearch && matchesCity && matchesCategory
    })
  }, [leads, search, cityFilter, categoryFilter])

  const sorted = useMemo(() => {
    const sortedList = [...filtered]
    sortedList.sort((a, b) => {
      const aVal = a[sort.key]
      const bVal = b[sort.key]
      if (aVal == null && bVal == null) return 0
      if (aVal == null) return 1
      if (bVal == null) return -1
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sort.dir === 'asc'
          ? aVal.localeCompare(bVal, 'pt-BR')
          : bVal.localeCompare(aVal, 'pt-BR')
      }
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sort.dir === 'asc' ? aVal - bVal : bVal - aVal
      }
      return 0
    })
    return sortedList
  }, [filtered, sort])

  const sortOptions: { key: SortKey; label: string }[] = [
    { key: 'title', label: 'Nome' },
    { key: 'categoryName', label: 'Categoria' },
    { key: 'city', label: 'Cidade' },
    { key: 'totalScore', label: 'Nota' },
    { key: 'reviewsCount', label: 'Reviews' },
  ]

  return (
    <div className="prospect-app">
      <header className="prospect-header">
        <h1>Prospecção Codexa</h1>
        <p>Leads capturados do Google Places para prospecção comercial.</p>
      </header>

      <section className="prospect-stats">
        <div className="stat-card">
          <strong>{leads.length}</strong>
          <span>Total de leads</span>
        </div>
        <div className="stat-card">
          <strong>{filtered.length}</strong>
          <span>Filtrados</span>
        </div>
        <div className="stat-card">
          <strong>{cities.length}</strong>
          <span>Cidades</span>
        </div>
      </section>

      <div className="prospect-toolbar">
        <div className="prospect-field">
          <label htmlFor="search">Buscar</label>
          <input
            id="search"
            type="text"
            placeholder="Nome, endereço, telefone, categoria..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="prospect-field">
          <label htmlFor="city">Cidade</label>
          <select
            id="city"
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
          >
            <option value="">Todas</option>
            {cities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </div>
        <div className="prospect-field">
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
        <div className="prospect-field">
          <label htmlFor="sort">Ordenar</label>
          <div className="prospect-sort">
            <select
              id="sort"
              value={sort.key}
              onChange={(e) =>
                setSort((prev) => ({ ...prev, key: e.target.value as SortKey }))
              }
            >
              {sortOptions.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="sort-direction"
              onClick={() =>
                setSort((prev) => ({ ...prev, dir: prev.dir === 'asc' ? 'desc' : 'asc' }))
              }
              aria-label={sort.dir === 'asc' ? 'Ordenar decrescente' : 'Ordenar crescente'}
            >
              {sort.dir === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>
        <div className="prospect-field" style={{ flex: '0 0 auto' }}>
          <label>Visualização</label>
          <div className="view-toggle" role="group" aria-label="Visualização">
            <button
              type="button"
              className={`view-toggle__btn ${view === 'grid' ? 'is-active' : ''}`}
              onClick={() => setView('grid')}
              aria-pressed={view === 'grid'}
            >
              Grid
            </button>
            <button
              type="button"
              className={`view-toggle__btn ${view === 'list' ? 'is-active' : ''}`}
              onClick={() => setView('list')}
              aria-pressed={view === 'list'}
            >
              Lista
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="prospect-loading">Carregando leads...</div>
      ) : error ? (
        <div className="prospect-empty">{error}</div>
      ) : (
        <>
          {view === 'grid' ? (
            <div className="cards-grid">
              {sorted.map((lead) => (
                <GridCard key={lead.placeId} lead={lead} />
              ))}
              {sorted.length === 0 && (
                <div className="prospect-empty">Nenhum lead encontrado.</div>
              )}
            </div>
          ) : (
            <div className="list-view">
              {sorted.map((lead) => (
                <ListItem key={lead.placeId} lead={lead} />
              ))}
              {sorted.length === 0 && (
                <div className="prospect-empty">Nenhum lead encontrado.</div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default App
