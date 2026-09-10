import { useEffect, useState } from 'react'
import { Alert, Button, Icon, SearchInput, Spinner } from 'codexa-ui'
import { apiFetch } from './api'
import './AtlasEarlyAccess.css'

type Entry = {
  id: string
  name: string
  email: string
  phone: string
  realEstateAgency: string
  cityState: string
  teamSize?: string
  consent?: boolean
  createdAt?: string
}
type Result = { entries: Entry[]; total: number; page: number; pageSize: number }
const dateLabel = (value?: string) => {
  if (!value || Number.isNaN(new Date(value).getTime())) return '—'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

export default function AtlasEarlyAccess() {
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [refresh, setRefresh] = useState(0)
  const [result, setResult] = useState<Result | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => { setQuery(search.trim()); setPage(1) }, 300)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const params = new URLSearchParams({ q: query, page: String(page) })
        const response = await apiFetch(`/api/atlas/early-access?${params}`)
        if (!response.ok) throw new Error('Não foi possível carregar os cadastros. Tente novamente.')
        const data: Result = await response.json()
        if (!cancelled) { setResult(data); if (data.page !== page) setPage(data.page) }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Não foi possível carregar os cadastros.')
      } finally { if (!cancelled) setLoading(false) }
    }
    void load()
    return () => { cancelled = true }
  }, [query, page, refresh])

  const pages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1
  return (
    <section className="atlas-access" aria-label="Interessados em acesso antecipado">
      <div className="atlas-access__toolbar">
        <div><h3>Interessados no Atlas</h3><p>Cadastros recebidos pelo formulário do site.</p></div>
        <Button variant="secondary" leadingIcon={<Icon name="refresh" size={16} />} disabled={loading} onClick={() => setRefresh((value) => value + 1)}>Atualizar</Button>
      </div>
      <SearchInput label="Buscar cadastros" placeholder="Nome, e-mail, WhatsApp, imobiliária ou cidade..." value={search} onChange={(event) => setSearch(event.target.value)} />
      {error ? <Alert tone="danger">{error}</Alert> : loading ? (
        <div className="atlas-access__empty" role="status"><Spinner /><p>Carregando cadastros...</p></div>
      ) : result && result.entries.length > 0 ? <>
        <p className="atlas-access__count" aria-live="polite">{result.total} {result.total === 1 ? 'cadastro' : 'cadastros'}{query ? ' encontrados' : ' na lista de acesso antecipado'}</p>
        <div className="atlas-access__table-wrap" tabIndex={0} role="region" aria-label="Lista de cadastros, role horizontalmente para ver todos os campos">
          <table className="atlas-access__table">
            <caption className="atlas-access__sr-only">Interessados no Atlas, dos mais recentes aos mais antigos</caption>
            <thead><tr>{['Nome', 'E-mail', 'WhatsApp', 'Imobiliária', 'Cidade/UF', 'Equipe', 'Consentimento', 'Cadastro'].map((label) => <th scope="col" key={label}>{label}</th>)}</tr></thead>
            <tbody>{result.entries.map((entry) => <tr key={entry.id}>
              <td><strong>{entry.name || '—'}</strong></td><td>{entry.email || '—'}</td><td>{entry.phone || '—'}</td>
              <td>{entry.realEstateAgency || '—'}</td><td>{entry.cityState || '—'}</td><td>{entry.teamSize || 'Não informado'}</td>
              <td><span className={entry.consent ? 'atlas-access__consent' : ''}>{entry.consent ? 'Aceito' : 'Não informado'}</span></td>
              <td>{dateLabel(entry.createdAt)}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <div className="atlas-access__pagination"><span>Página {result.page} de {pages}</span><div>
          <Button variant="secondary" size="small" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Anterior</Button>
          <Button variant="secondary" size="small" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>Próxima</Button>
        </div></div>
      </> : <div className="atlas-access__empty"><Icon name="users" size={32} /><h3>{query ? 'Nenhum cadastro encontrado' : 'Nenhum cadastro recebido ainda'}</h3><p>{query ? 'Tente buscar por outro nome, contato ou imobiliária.' : 'Os interessados que preencherem o formulário do Atlas aparecerão aqui.'}</p></div>}
    </section>
  )
}
