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

const fetchLeads = async (): Promise<Lead[]> => {
  const res = await fetch('/data/leads.json')
  if (!res.ok) throw new Error('Não foi possível carregar os dados')
  return res.json()
}

function App() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [cityFilter, setCityFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
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
    () => Array.from(new Set(leads.map((l) => l.city).filter(Boolean))).sort(),
    [leads],
  )

  const categories = useMemo(
    () =>
      Array.from(new Set(leads.map((l) => l.categoryName).filter(Boolean))).sort(),
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

  const handleSort = (key: SortKey) => {
    setSort((prev) => ({
      key,
      dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc',
    }))
  }

  const scoreBadge = (score: number | null) => {
    if (score == null) return '-'
    return (
      <span className="cell-score">
        {score.toFixed(1)}
      </span>
    )
  }

  const statusTag = (lead: Lead) => {
    if (lead.permanentlyClosed) return <span className="closed-tag">Fechado</span>
    if (lead.temporarilyClosed) return <span className="closed-tag">Fechado temp.</span>
    return <span className="open-tag">Ativo</span>
  }

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
      </div>

      {loading ? (
        <div className="prospect-loading">Carregando leads...</div>
      ) : error ? (
        <div className="prospect-empty">{error}</div>
      ) : (
        <div className="table-wrap">
          <table className="prospect-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('title')}>
                  Nome {sort.key === 'title' && <span className="sort">{sort.dir === 'asc' ? '↑' : '↓'}</span>}
                </th>
                <th onClick={() => handleSort('categoryName')}>
                  Categoria {sort.key === 'categoryName' && <span className="sort">{sort.dir === 'asc' ? '↑' : '↓'}</span>}
                </th>
                <th onClick={() => handleSort('city')}>
                  Cidade {sort.key === 'city' && <span className="sort">{sort.dir === 'asc' ? '↑' : '↓'}</span>}
                </th>
                <th onClick={() => handleSort('totalScore')}>
                  Nota {sort.key === 'totalScore' && <span className="sort">{sort.dir === 'asc' ? '↑' : '↓'}</span>}
                </th>
                <th onClick={() => handleSort('reviewsCount')}>
                  Reviews {sort.key === 'reviewsCount' && <span className="sort">{sort.dir === 'asc' ? '↑' : '↓'}</span>}
                </th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((lead) => (
                <tr key={lead.placeId}>
                  <td className="cell-title">{lead.title}</td>
                  <td>
                    {lead.categoryName ? (
                      <span className="cell-category">{lead.categoryName}</span>
                    ) : (
                      <span className="cell-muted">-</span>
                    )}
                  </td>
                  <td>
                    {lead.city ? <span className="cell-city">{lead.city}</span> : '-'}
                  </td>
                  <td>{scoreBadge(lead.totalScore)}</td>
                  <td>{lead.reviewsCount ?? '-'}</td>
                  <td>{statusTag(lead)}</td>
                  <td className="cell-actions">
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
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={7} className="prospect-empty">
                    Nenhum lead encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default App
