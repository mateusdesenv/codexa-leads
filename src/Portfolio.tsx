import { useEffect, useMemo, useState } from 'react'
import { Alert, Badge, Button, Card, EmptyState, Icon, Link, MultiSelect, PortfolioCard as CodexaPortfolioCard, SearchInput, Spinner, Switch } from 'codexa-ui'
import { auth } from './firebase'

type PortfolioItem = {
  id: string
  title: string
  category: string
  shortDescription: string
  projectUrl: string
  primaryCtaUrl: string
  primaryCtaLabel: string
  desktopImageUrl: string
  altText: string
  tags: string[]
  openInNewTab: boolean
  status?: 'published' | 'draft' | 'archived'
  showInPortfolio?: boolean
}

type PortfolioResponse = {
  data?: PortfolioItem[]
}

const PORTFOLIO_API_URL = import.meta.env.VITE_PORTFOLIO_API_URL || 'https://codexa-portifolio-api.vercel.app'

function assetUrl(path: string) {
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) return path
  return new URL(path, PORTFOLIO_API_URL).toString()
}

export default function Portfolio() {
  const [items, setItems] = useState<PortfolioItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [canManage, setCanManage] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    const loadPortfolio = async () => {
      const currentUser = auth.currentUser
      let token = ''
      if (currentUser) {
        try {
          token = await currentUser.getIdToken()
        } catch {
          token = ''
        }
      }
      const adminResponse = token
        ? await fetch(`${PORTFOLIO_API_URL}/api/v1/admin/portfolio-items?limit=100`, {
          signal: controller.signal,
          headers: { Authorization: `Bearer ${token}` },
        })
        : null

      if (adminResponse?.ok) {
        const payload = await adminResponse.json() as PortfolioResponse
        setItems(payload.data ?? [])
        setCanManage(true)
        return
      }

      const response = await fetch(`${PORTFOLIO_API_URL}/api/v1/portfolio-items?limit=100`, { signal: controller.signal })
      if (!response.ok) throw new Error('Não foi possível carregar o portfólio')
      const payload = await response.json() as PortfolioResponse
      setItems(payload.data ?? [])
      setCanManage(false)
    }

    loadPortfolio()
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return
        setError(true)
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [])

  const categories = useMemo(
    () => Array.from(new Set(items.map((item) => item.category).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [items],
  )

  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR')
    return items.filter((item) => {
      const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(item.category)
      const matchesQuery = !normalizedQuery || [item.title, item.category, item.shortDescription, ...(item.tags ?? [])]
        .join(' ')
        .toLocaleLowerCase('pt-BR')
        .includes(normalizedQuery)
      return matchesCategory && matchesQuery
    })
  }, [items, query, selectedCategories])

  const clearFilters = () => {
    setQuery('')
    setSelectedCategories([])
  }

  const updatePortfolioItem = async (item: PortfolioItem, changes: Partial<PortfolioItem>) => {
    const currentUser = auth.currentUser
    if (!currentUser) return

    setUpdatingId(item.id)
    setActionError(null)
    try {
      const token = await currentUser.getIdToken()
      const response = await fetch(`${PORTFOLIO_API_URL}/api/v1/admin/portfolio-items/${encodeURIComponent(item.id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(changes),
      })
      if (!response.ok) throw new Error('Não foi possível salvar a alteração')
      const payload = await response.json() as { data?: PortfolioItem }
      if (!payload.data) throw new Error('Resposta inválida da API')
      setItems((current) => current.map((entry) => entry.id === item.id ? payload.data! : entry))
    } catch {
      setActionError('Não foi possível salvar a alteração. Tente novamente.')
    } finally {
      setUpdatingId(null)
    }
  }

  if (loading) {
    return <div className="portfolio-loading"><Spinner size="medium" label="Carregando portfólio..." /></div>
  }

  if (error) {
    return (
      <section className="portfolio-page" aria-labelledby="portfolio-title">
        <PortfolioHeader total={0} />
        <EmptyState
          icon="warning"
          title="Não foi possível carregar o portfólio"
          description="Tente atualizar a página em alguns instantes."
        />
      </section>
    )
  }

  return (
    <section className="portfolio-page" aria-labelledby="portfolio-title">
      <PortfolioHeader total={items.length} />

      <div className="portfolio-toolbar">
        <div className="portfolio-toolbar__search">
          <SearchInput
            id="portfolio-search"
            label="Buscar projeto"
            placeholder="Nome, segmento ou tecnologia"
            value={query}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)}
            onClear={() => setQuery('')}
          />
        </div>
        <div className="portfolio-toolbar__view" role="group" aria-label="Visualização dos projetos">
          <Button
            type="button"
            size="small"
            variant={view === 'grid' ? 'primary' : 'ghost'}
            aria-pressed={view === 'grid'}
            onClick={() => setView('grid')}
          >
            Grid
          </Button>
          <Button
            type="button"
            size="small"
            variant={view === 'list' ? 'primary' : 'ghost'}
            aria-pressed={view === 'list'}
            onClick={() => setView('list')}
          >
            Lista
          </Button>
        </div>
        <div className="portfolio-filters">
          <MultiSelect
            label="Categorias"
            options={categories.map((category) => ({ value: category, label: category }))}
            value={selectedCategories}
            onChange={setSelectedCategories}
            placeholder="Todas as categorias"
          />
        </div>
      </div>

      <div className="portfolio-results" aria-live="polite">
        <p><strong>{visibleItems.length}</strong> {visibleItems.length === 1 ? 'projeto encontrado' : 'projetos encontrados'}</p>
        {(query || selectedCategories.length > 0) && (
          <Button type="button" variant="ghost" size="small" onClick={clearFilters}>
            Limpar filtros
          </Button>
        )}
      </div>

      {actionError && <Alert tone="danger" title="Alteração não salva">{actionError}</Alert>}

      {visibleItems.length && view === 'grid' ? (
        <div className="portfolio-grid">
          {visibleItems.map((item) => (
            <CodexaPortfolioCard
              key={item.id}
              title={item.title}
              description={item.shortDescription || 'Produto digital criado pela Codexa.'}
              image={assetUrl(item.desktopImageUrl) || undefined}
              tags={item.tags?.slice(0, 4)}
              href={item.projectUrl || item.primaryCtaUrl || undefined}
            />
          ))}
        </div>
      ) : visibleItems.length ? (
        <div className="portfolio-list" role="list">
          {visibleItems.map((item, index) => (
            <PortfolioListItem
              item={item}
              index={index}
              key={item.id}
              canManage={canManage}
              updating={updatingId === item.id}
              onUpdate={updatePortfolioItem}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon="search"
          title="Nenhum projeto encontrado"
          description="Tente outro termo de busca ou ajuste a categoria."
          action={<Button type="button" variant="secondary" onClick={clearFilters}>Limpar filtros</Button>}
        />
      )}
    </section>
  )
}

function PortfolioHeader({ total }: { total: number }) {
  return (
    <header className="portfolio-page__header">
      <div>
        <span className="portfolio-page__eyebrow">Projetos Codexa</span>
        <h2 id="portfolio-title">Portfólio que transforma ideias em presença digital.</h2>
        <p>Explore soluções criadas para negócios que querem ser vistos, lembrados e escolhidos.</p>
      </div>
      <div className="portfolio-page__total" aria-label={`${total} projetos no portfólio`}>
        <Icon name="file" size={22} aria-hidden="true" />
        <span><strong>{String(total).padStart(2, '0')}</strong> projetos</span>
      </div>
    </header>
  )
}

function PortfolioListItem({
  item,
  index,
  canManage,
  updating,
  onUpdate,
}: {
  item: PortfolioItem
  index: number
  canManage: boolean
  updating: boolean
  onUpdate: (item: PortfolioItem, changes: Partial<PortfolioItem>) => Promise<void>
}) {
  const href = item.projectUrl || item.primaryCtaUrl
  const image = assetUrl(item.desktopImageUrl)

  return (
    <Card className="portfolio-list-item" padding="medium" as="article" role="listitem">
      <div className={`portfolio-list-item__visual${image ? ' portfolio-list-item__visual--image' : ''}`}>
        {image ? (
          <img src={image} alt={item.altText || `Preview do projeto ${item.title}`} loading="lazy" />
        ) : (
          <div className="portfolio-card__fallback" aria-hidden="true"><span /><span /><span /></div>
        )}
      </div>
      <span className="portfolio-list-item__index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
      <div className="portfolio-list-item__content">
        <div>
          <span className="portfolio-card__category">{item.category || 'Projeto digital'}</span>
          <h3>{item.title}</h3>
          <p>{item.shortDescription || 'Produto digital criado pela Codexa.'}</p>
        </div>
        {item.tags?.length > 0 && (
          <div className="portfolio-card__tags" aria-label="Tecnologias e características">
            {item.tags.slice(0, 4).map((tag) => <Badge key={tag} tone="neutral" size="small">{tag}</Badge>)}
          </div>
        )}
      </div>
      <div className="portfolio-list-item__actions">
        <Badge tone={item.status === 'draft' ? 'warning' : 'success'} size="small">
          {item.status === 'draft' ? 'Rascunho' : 'Publicado'}
        </Badge>
        <Button
          type="button"
          variant="secondary"
          size="small"
          disabled={!canManage || updating || item.status === 'draft'}
          onClick={() => onUpdate(item, { status: 'draft' })}
          title={canManage ? 'Mover projeto para rascunho' : 'Sua conta não tem permissão para gerir o portfólio'}
        >
          Rascunho
        </Button>
        <Switch
          id={`portfolio-visible-${item.id}`}
          label="Exibir no site"
          disabled={!canManage || updating}
          checked={item.showInPortfolio !== false}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => onUpdate(item, { showInPortfolio: event.target.checked })}
        />
        {href && (
          <Link className="portfolio-card__link portfolio-list-item__link" href={href} external={item.openInNewTab !== false}>
            {item.primaryCtaLabel || 'Ver projeto'} <Icon name="external-link" size={16} aria-hidden="true" />
          </Link>
        )}
      </div>
    </Card>
  )
}
