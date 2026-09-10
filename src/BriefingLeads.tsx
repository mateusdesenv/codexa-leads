import { useEffect, useState } from 'react'
import { Alert, Button, Dialog, Icon, SearchInput, Spinner } from 'codexa-ui'
import { apiFetch } from './api'
import './AtlasEarlyAccess.css'
import './BriefingLeads.css'

type Entry = {
  id: string
  companyName?: string
  niche?: string
  projectType?: string
  protocol?: string
  description?: string
  sensations?: string[]
  otherSensation?: string
  currentWebsite?: string
  instagram?: string
  inspirations?: string
  themePreference?: string
  stylePreference?: string
  desiredColors?: string
  avoidedColors?: string
  urgency?: string
  status?: string
  createdAt?: string
}
const answerFields = [
  ['projectType', 'Tipo de projeto'], ['companyName', 'Empresa'], ['niche', 'Nicho de atuação'],
  ['description', 'Descrição do projeto'], ['sensations', 'Sensações desejadas'], ['otherSensation', 'Outras sensações'],
  ['currentWebsite', 'Site atual'], ['instagram', 'Instagram'], ['inspirations', 'Referências e inspirações'],
  ['themePreference', 'Preferência de tema'], ['stylePreference', 'Estilo visual'], ['desiredColors', 'Cores desejadas'],
  ['avoidedColors', 'Cores a evitar'], ['urgency', 'Urgência'],
] as const
const answerLabel = (value: string | string[] | undefined) => Array.isArray(value) ? value.join(', ') || 'Não informado' : value || 'Não informado'
const statusLabel = (status?: string) => status === 'new' ? 'Novo' : status || 'Não informado'
type Result = { entries: Entry[]; total: number; page: number; pageSize: number }
const dateLabel = (value?: string) => {
  if (!value || Number.isNaN(new Date(value).getTime())) return '—'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

export default function BriefingLeads() {
  const [selected, setSelected] = useState<Entry | null>(null)
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
        const response = await apiFetch(`/api/briefing/leads?${params}`)
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
    <section className="atlas-access" aria-label="Leads do formulário de briefing">
      <div className="atlas-access__toolbar">
        <div><h3>Briefings recebidos</h3><p>Dados enviados pelo formulário do Codexa Briefing.</p></div>
        <Button variant="secondary" leadingIcon={<Icon name="refresh" size={16} />} disabled={loading} onClick={() => setRefresh((value) => value + 1)}>Atualizar</Button>
      </div>
      <SearchInput label="Buscar cadastros" placeholder="Empresa, nicho, projeto, Instagram ou protocolo..." value={search} onChange={(event) => setSearch(event.target.value)} />
      {error ? <Alert tone="danger">{error}</Alert> : loading ? (
        <div className="atlas-access__empty" role="status"><Spinner /><p>Carregando cadastros...</p></div>
      ) : result && result.entries.length > 0 ? <>
        <p className="atlas-access__count" aria-live="polite">{result.total} {result.total === 1 ? 'cadastro' : 'cadastros'}{query ? ' encontrados' : ' recebidos'}</p>
        <div className="atlas-access__table-wrap" tabIndex={0} role="region" aria-label="Lista de cadastros, role horizontalmente para ver todos os campos">
          <table className="atlas-access__table">
            <caption className="atlas-access__sr-only">Briefings recebidos, dos mais recentes aos mais antigos</caption>
            <thead><tr>{['Empresa', 'Nicho', 'Projeto', 'Urgência', 'Status', 'Recebido em', 'Detalhes'].map((label) => <th scope="col" key={label}>{label}</th>)}</tr></thead>
            <tbody>{result.entries.map((entry) => <tr key={entry.id}>
              <td><strong>{entry.companyName || '—'}</strong></td><td>{entry.niche || '—'}</td><td>{entry.projectType || '—'}</td>
              <td>{entry.urgency || 'Não informada'}</td><td><span className="atlas-access__consent">{statusLabel(entry.status)}</span></td>
              <td>{dateLabel(entry.createdAt)}</td>
              <td><Button variant="secondary" size="small" onClick={() => setSelected(entry)} aria-label={`Ver briefing de ${entry.companyName || 'empresa'}`}>Ver briefing</Button></td>
            </tr>)}</tbody>
          </table>
        </div>
        <div className="atlas-access__pagination"><span>Página {result.page} de {pages}</span><div>
          <Button variant="secondary" size="small" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Anterior</Button>
          <Button variant="secondary" size="small" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>Próxima</Button>
        </div></div>
      </> : <div className="atlas-access__empty"><Icon name="users" size={32} /><h3>{query ? 'Nenhum cadastro encontrado' : 'Nenhum cadastro recebido ainda'}</h3><p>{query ? 'Tente buscar por outra empresa, nicho ou protocolo.' : 'Os formulários enviados pelo Codexa Briefing aparecerão aqui.'}</p></div>}
      {selected && <Dialog open onClose={() => setSelected(null)} title={`Briefing · ${selected.companyName || 'Empresa'}`}>
        <div className="briefing-detail">
          <div className="briefing-detail__meta"><p><strong>Protocolo</strong><span>{selected.protocol || selected.id}</span></p><p><strong>Recebido em</strong><span>{dateLabel(selected.createdAt)}</span></p><p><strong>Status</strong><span>{statusLabel(selected.status)}</span></p></div>
          <dl className="briefing-detail__answers">{answerFields.map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{answerLabel(selected[key])}</dd></div>)}</dl>
          <Button variant="secondary" onClick={() => setSelected(null)}>Fechar</Button>
        </div>
      </Dialog>}
    </section>
  )
}
