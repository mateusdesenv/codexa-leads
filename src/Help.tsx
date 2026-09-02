import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  ConfirmDialog,
  Dialog,
  EmptyState,
  Icon,
  Input,
  SearchInput,
  Tag,
  Textarea,
} from 'codexa-ui'
import type { QnA } from './types'

const API = '/api/qna'

function parseTags(input: string): string[] {
  return input
    .split(/[,;]/)
    .map((t) => t.trim())
    .filter(Boolean)
}

function formatTags(tags: string[]): string {
  return tags.join(', ')
}

export default function Help() {
  const [items, setItems] = useState<QnA[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editing, setEditing] = useState<QnA | null>(null)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  useEffect(() => {
    fetchItems()
  }, [])

  async function fetchItems() {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(API)
      if (!res.ok) throw new Error('Erro ao carregar perguntas')
      const data: QnA[] = await res.json()
      setItems(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    const term = search.toLowerCase()
    if (!term) return items
    return items.filter((i) =>
      [i.question, i.answer, ...(i.tags || [])]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(term)),
    )
  }, [items, search])

  function openCreate() {
    setEditing(null)
    setQuestion('')
    setAnswer('')
    setTagInput('')
    setFormError(null)
    setIsFormOpen(true)
  }

  function openEdit(item: QnA) {
    setEditing(item)
    setQuestion(item.question)
    setAnswer(item.answer)
    setTagInput(formatTags(item.tags))
    setFormError(null)
    setIsFormOpen(true)
  }

  async function handleSave() {
    if (!question.trim() || !answer.trim()) {
      setFormError('Pergunta e resposta são obrigatórias')
      return
    }
    const body = {
      question: question.trim(),
      answer: answer.trim(),
      tags: parseTags(tagInput),
    }
    try {
      const res = await fetch(editing ? `${API}/${editing.id}` : API, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Erro ao salvar')
      await fetchItems()
      setIsFormOpen(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao salvar')
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`${API}/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erro ao remover')
      await fetchItems()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao remover')
    } finally {
      setDeleteId(null)
    }
  }

  return (
    <div className="help-page">
      <header className="help-page__header">
        <div>
          <h2>Base de conhecimento</h2>
          <p>Perguntas e respostas para auxiliar nas prospecções</p>
        </div>
        <Button
          variant="primary"
          onClick={openCreate}
          leadingIcon={<Icon name="plus" size={18} />}
        >
          Nova pergunta
        </Button>
      </header>

      <div className="help-page__toolbar">
        <SearchInput
          label="Buscar"
          id="qna-search"
          placeholder="Pergunta, resposta ou tag..."
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
          onClear={() => setSearch('')}
        />
      </div>

      {loading ? (
        <div className="help-page__loading">Carregando perguntas...</div>
      ) : error ? (
        <Alert tone="danger" title="Erro ao carregar">
          {error}
        </Alert>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="help"
          title="Nenhuma pergunta encontrada"
          description="Crie uma nova pergunta e resposta para começar."
          action={
            <Button
              variant="primary"
              onClick={openCreate}
              leadingIcon={<Icon name="plus" size={16} />}
            >
              Nova pergunta
            </Button>
          }
        />
      ) : (
        <div className="help-page__grid">
          {filtered.map((item) => (
            <Card key={item.id} padding="medium" className="qna-card">
              <div className="qna-card__header">
                <h3 className="qna-card__question">{item.question}</h3>
                <div className="qna-card__actions">
                  <Button
                    variant="ghost"
                    size="small"
                    onClick={() => openEdit(item)}
                    leadingIcon={<Icon name="edit" size={14} />}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="small"
                    onClick={() => setDeleteId(item.id!)}
                    leadingIcon={<Icon name="trash" size={14} />}
                  >
                    Excluir
                  </Button>
                </div>
              </div>
              <p className="qna-card__answer">{item.answer}</p>
              {item.tags.length > 0 && (
                <div className="qna-card__tags">
                  {item.tags.map((tag) => (
                    <Tag key={tag} tone="neutral">
                      {tag}
                    </Tag>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editing ? 'Editar pergunta' : 'Nova pergunta'}
      >
        <div className="qna-form">
          <Input
            label="Pergunta"
            id="qna-question"
            value={question}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setQuestion(e.target.value)
            }
            leadingIcon={<Icon name="help" size={16} />}
          />
          <Textarea
            label="Resposta"
            id="qna-answer"
            value={answer}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
              setAnswer(e.target.value)
            }
            rows={4}
          />
          <Input
            label="Tags (separadas por vírgula)"
            id="qna-tags"
            value={tagInput}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setTagInput(e.target.value)
            }
            leadingIcon={<Icon name="filter" size={16} />}
            helperText="Ex: preço, integração, suporte"
          />
          {formError && (
            <Alert tone="danger" title="Erro no formulário">
              {formError}
            </Alert>
          )}
          <div className="qna-form__actions">
            <Button variant="secondary" onClick={() => setIsFormOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              leadingIcon={<Icon name="check" size={16} />}
            >
              Salvar
            </Button>
          </div>
        </div>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        title="Excluir pergunta"
        description="Tem certeza que deseja excluir esta pergunta? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        tone="danger"
      />
    </div>
  )
}
