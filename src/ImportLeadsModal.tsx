import { useRef, useState } from 'react'
import { Alert, Button, Dialog, FormField, Icon, Input } from 'codexa-ui'
import type { Lead } from './types'

interface ImportLeadsModalProps {
  open: boolean
  onClose: () => void
  onImport: (title: string, leads: Lead[]) => Promise<void>
}

function isLead(value: unknown): value is Lead {
  if (!value || typeof value !== 'object') return false
  const obj = value as Record<string, unknown>
  return typeof obj.title === 'string' && typeof obj.placeId === 'string'
}

export default function ImportLeadsModal({ open, onClose, onImport }: ImportLeadsModalProps) {
  const [title, setTitle] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] ?? null)
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      setError('Selecione um arquivo JSON.')
      return
    }

    setIsLoading(true)
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
        throw new Error('Nenhum lead válido encontrado no arquivo. Verifique se cada item tem title e placeId.')
      }

      const finalTitle = title.trim() || `Importação em ${new Date().toLocaleDateString('pt-BR')}`
      await onImport(finalTitle, validLeads)
      setTitle('')
      setFile(null)
      if (inputRef.current) inputRef.current.value = ''
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar o arquivo.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Importar nova lista">
      <form className="import-modal__form" onSubmit={handleSubmit}>
        <Input
          label="Título do grupo"
          id="import-title"
          type="text"
          placeholder="Ex: Prospects setembro"
          value={title}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
        />

        <FormField label="Arquivo JSON (Apify)" id="import-file">
          <input
            id="import-file"
            ref={inputRef}
            className="import-modal__file"
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
          />
        </FormField>

        {file && (
          <p className="import-modal__file-name">
            <Icon name="file" size={14} /> {file.name}
          </p>
        )}

        {error && (
          <Alert tone="danger" title="Erro na importação">
            {error}
          </Alert>
        )}

        <div className="import-modal__actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={isLoading}
            leadingIcon={<Icon name="plus" size={16} />}
          >
            Importar
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
