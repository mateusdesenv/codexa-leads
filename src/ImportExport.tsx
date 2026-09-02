import { useRef, useState } from 'react'
import type { Lead, LeadWithMeta } from './types'

interface ImportExportProps {
  leads: LeadWithMeta[]
  onImport: (leads: Lead[]) => void
  onExport: () => void
}

function isLead(value: unknown): value is Lead {
  if (!value || typeof value !== 'object') return false
  const obj = value as Record<string, unknown>
  return (
    typeof obj.title === 'string' &&
    typeof obj.placeId === 'string'
  )
}

export default function ImportExport({ leads, onImport, onExport }: ImportExportProps) {
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setMessage(null)
    setError(null)

    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      const raw = Array.isArray(parsed) ? parsed : [parsed]

      if (!raw.length) {
        throw new Error('O arquivo JSON está vazio.')
      }

      const validLeads = raw.filter(isLead)
      if (!validLeads.length) {
        throw new Error('Nenhum lead válido encontrado no arquivo.')
      }

      onImport(validLeads)
      setMessage(`${validLeads.length} lead(s) importado(s) com sucesso.`)
      if (inputRef.current) inputRef.current.value = ''
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erro ao processar o arquivo.',
      )
    }
  }

  return (
    <div className="import-export-page">
      <header className="import-export__header">
        <h2>Importação e exportação</h2>
        <p>Gerencie seus leads em formato JSON.</p>
      </header>

      <div className="import-export__grid">
        <section className="import-card">
          <h3>Importar leads</h3>
          <p>
            Selecione um arquivo JSON com os leads. Cada lead precisa ter pelo
            menos <code>title</code> e <code>placeId</code>.
          </p>
          <div className="prospect-field">
            <label htmlFor="import-file">Arquivo JSON</label>
            <input
              id="import-file"
              ref={inputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileChange}
            />
          </div>
          {message && <div className="import-export__message import-export__message--success" role="status">{message}</div>}
          {error && <div className="import-export__message import-export__message--error" role="alert">{error}</div>}
        </section>

        <section className="export-card">
          <h3>Exportar leads</h3>
          <p>
            Baixe todos os <strong>{leads.length}</strong> leads atuais em
            formato JSON.
          </p>
          <button
            type="button"
            className="action-btn action-btn--primary"
            onClick={onExport}
          >
            Exportar JSON
          </button>
        </section>
      </div>
    </div>
  )
}
