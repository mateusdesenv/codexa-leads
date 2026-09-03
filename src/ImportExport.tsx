import { useRef, useState } from 'react'
import { Button, Card, FormField, Alert, Input } from 'codexa-ui'
import type { Lead, LeadWithMeta } from './types'

interface ImportExportProps {
  leads: LeadWithMeta[]
  onImport: (title: string, leads: Lead[]) => void
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
  const [groupTitle, setGroupTitle] = useState('')
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

      const title = groupTitle.trim() || `Importação em ${new Date().toLocaleDateString('pt-BR')}`
      onImport(title, validLeads)
      setMessage(`${validLeads.length} lead(s) importado(s) no grupo "${title}".`)
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
        <Card padding="medium">
          <h3>Importar leads</h3>
          <p>
            Selecione um arquivo JSON com os leads. Cada lead precisa ter pelo
            menos <code>title</code> e <code>placeId</code>.
          </p>
          <Input
            label="Título do grupo"
            id="import-title"
            type="text"
            placeholder="Ex: Prospects setembro"
            value={groupTitle}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGroupTitle(e.target.value)}
          />
          <FormField label="Arquivo JSON" id="import-file">
            <input
              id="import-file"
              ref={inputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileChange}
            />
          </FormField>
          {message && (
            <Alert tone="success" title="Importação concluída">
              {message}
            </Alert>
          )}
          {error && (
            <Alert tone="danger" title="Erro na importação">
              {error}
            </Alert>
          )}
        </Card>

        <Card padding="medium">
          <h3>Exportar leads</h3>
          <p>
            Baixe todos os <strong>{leads.length}</strong> leads atuais em
            formato JSON.
          </p>
          <Button type="button" variant="primary" onClick={onExport}>
            Exportar JSON
          </Button>
        </Card>
      </div>
    </div>
  )
}
