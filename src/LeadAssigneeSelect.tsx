import { useEffect, useState } from 'react'
import { Alert, Button, Select } from 'codexa-ui'
import { apiFetch } from './api'

export default function LeadAssigneeSelect({ value, currentName, onChange, disabled = false }: {
  value: string
  currentName?: string | null
  onChange: (value: string) => void
  disabled?: boolean
}) {
  const [users, setUsers] = useState<{ uid: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    apiFetch('/api/lead-assignees', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Não foi possível carregar')
        const data = await response.json()
        if (!controller.signal.aborted) setUsers(data)
      })
      .catch(() => { if (!controller.signal.aborted) setError(true) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [attempt])
  const options = [{ value: '', label: 'Sem responsável' }, ...users.map((user) => ({ value: user.uid, label: user.name }))]
  if (value && !users.some((user) => user.uid === value)) options.push({ value, label: currentName || 'Responsável atual' })
  return <div className="lead-assignee-field">
    <Select id="lead-assignee" label="Responsável" value={value} onChange={onChange} options={options} disabled={disabled || loading || error} />
    {loading && <small>Carregando usuários...</small>}
    {error && <Alert tone="danger" title="Não foi possível carregar os responsáveis"><Button type="button" size="small" variant="ghost" onClick={() => { setLoading(true); setError(false); setAttempt((current) => current + 1) }}>Tentar novamente</Button></Alert>}
  </div>
}
