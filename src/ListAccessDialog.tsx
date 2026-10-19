import { useEffect, useState } from 'react'
import { Alert, Button, Dialog } from 'codexa-ui'
import { apiFetch } from './api'
import type { LeadGroup } from './LeadGroupsTable'

type Viewer = { uid: string; displayName: string; email: string; accessStatus: string; isAdmin: boolean }
export default function ListAccessDialog({ group, onClose, onSaved }: { group: LeadGroup; onClose: () => void; onSaved: () => Promise<void> }) {
  const [visibility, setVisibility] = useState<'all' | 'selected'>(group.visibility ?? 'all')
  const [selected, setSelected] = useState(group.viewerUids ?? [])
  const [users, setUsers] = useState<Viewer[]>([])
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    void apiFetch('/api/users', { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('Não foi possível carregar os usuários')
      const data: Viewer[] = await response.json()
      if (controller.signal.aborted) return
      const approved = data.filter(user => user.accessStatus === 'approved' && !user.isAdmin)
      setUsers(approved); setSelected(current => current.filter(uid => approved.some(user => user.uid === uid)))
    }).catch(error => { if (!controller.signal.aborted) { setError(error.message); setLoadFailed(true) } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [])
  const save = async () => {
    setSaving(true); setError('')
    try {
      const response = await apiFetch(`/api/lead-groups/${encodeURIComponent(group.groupId!)}/access`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visibility, viewerUids: selected }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Não foi possível salvar o acesso')
      await onSaved(); onClose()
    } catch (error) { setError(error instanceof Error ? error.message : 'Não foi possível salvar') }
    finally { setSaving(false) }
  }
  return <Dialog open title="Quem pode visualizar esta lista" onClose={() => { if (!saving) onClose() }}>
    <div className="access-editor">
      <strong>{group.groupTitle}</strong>
      <label className="access-editor__choice"><input type="radio" name="list-visibility" checked={visibility === 'all'} disabled={saving} onChange={() => setVisibility('all')} />Todos os usuários liberados</label>
      <label className="access-editor__choice"><input type="radio" name="list-visibility" checked={visibility === 'selected'} disabled={saving} onChange={() => setVisibility('selected')} />Somente usuários selecionados</label>
      {visibility === 'selected' && <fieldset className="access-editor__viewers" disabled={saving || loading}>
        <legend>Usuários com acesso</legend>
        {loading ? <p>Carregando usuários...</p> : users.length === 0 ? <p>Nenhum outro usuário liberado.</p> : users.map(user => <label key={user.uid} className="access-editor__choice">
          <input type="checkbox" checked={selected.includes(user.uid)} onChange={event => setSelected(current => event.target.checked ? [...current, user.uid] : current.filter(uid => uid !== user.uid))} />
          <span>{user.displayName || user.email}<small>{user.displayName ? user.email : ''}</small></span>
        </label>)}
      </fieldset>}
      <p className="access-editor__note">O administrador sempre pode visualizar a lista. Sem usuários selecionados, apenas ele terá acesso. A visualização também exige leitura na tela correspondente.</p>
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="access-editor__actions"><Button variant="secondary" disabled={saving} onClick={onClose}>Cancelar</Button><Button disabled={loading || loadFailed} loading={saving} onClick={save}>Salvar acesso</Button></div>
    </div>
  </Dialog>
}
