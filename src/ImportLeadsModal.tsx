import { useRef, useState } from 'react'
import { Alert, Button, Dialog, FormField, Icon, Input } from 'codexa-ui'
import type { Lead } from './types'

interface ImportLeadsModalProps {
  open: boolean
  onClose: () => void
  onImport: (title: string, leads: Lead[]) => Promise<void>
  onCreateEmpty: (title: string) => Promise<void>
}

function isLead(value: unknown): value is Lead {
  if (!value || typeof value !== 'object') return false
  const obj = value as Record<string, unknown>
  return typeof obj.title === 'string' && typeof obj.placeId === 'string'
}

export default function ImportLeadsModal({ open, onClose, onImport, onCreateEmpty }: ImportLeadsModalProps) {
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
    if (isLoading) return
    if (!file && !title.trim()) {
      setError('Informe um nome para a lista.')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      if (file) {
        const text = await file.text()
        const parsed = JSON.parse(text)
        const raw = Array.isArray(parsed) ? parsed : [parsed]
        if (!raw.length) throw new Error('O arquivo JSON está vazio.')
        const validLeads = raw.filter(isLead)
        if (!validLeads.length) {
          throw new Error('Nenhum lead válido encontrado no arquivo. Verifique se cada item tem title e placeId.')
        }
        const finalTitle = title.trim() || `Importação em ${new Date().toLocaleDateString('pt-BR')}`
        await onImport(finalTitle, validLeads)
      } else {
        await onCreateEmpty(title.trim())
      }
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
    <Dialog open={open} onClose={() => { if (!isLoading) onClose() }} title="Nova lista">
      <form className="import-modal__form" onSubmit={handleSubmit}>
        <p className="import-modal__intro">Dê um nome à lista para começar a adicionar leads manualmente. Se já tiver um arquivo, importe os contatos abaixo.</p>
        <Input
          label="Nome da lista"
          id="import-title"
          type="text"
          placeholder="Ex: Prospects setembro"
          maxLength={120}
          required={!file}
          disabled={isLoading}
          autoFocus
          value={title}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
        />

        <div className="import-modal__upload">
        <FormField label="Importar contatos de um JSON (opcional)" id="import-file">
          <input
            id="import-file"
            ref={inputRef}
            className="import-modal__file"
            type="file"
            accept=".json,application/json"
            disabled={isLoading}
            onChange={handleFileChange}
          />
        </FormField>
        <p className="import-modal__hint">Sem arquivo, sua lista será criada vazia.</p>
        </div>

        {file && (
          <p className="import-modal__file-name">
            <Icon name="file" size={14} /> {file.name}
            <Button type="button" variant="ghost" size="small" disabled={isLoading} onClick={() => {
              setFile(null)
              setError(null)
              if (inputRef.current) inputRef.current.value = ''
            }}>Remover arquivo</Button>
          </p>
        )}

        {error && (
          <Alert tone="danger" title="Não foi possível criar a lista">
            {error}
          </Alert>
        )}

        <div className="import-modal__actions">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={isLoading}
            leadingIcon={<Icon name="plus" size={16} />}
          >
            {file ? 'Importar e criar lista' : 'Criar lista vazia'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
