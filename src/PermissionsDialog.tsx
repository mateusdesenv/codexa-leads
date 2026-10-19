import { useState } from 'react'
import { Alert, Button, Dialog } from 'codexa-ui'
import { SCREENS, type ScreenPermissions } from '../shared/permissions'
import { apiFetch } from './api'

export default function PermissionsDialog({ target, onClose, onSaved }: {
  target: { uid: string; email: string; screenPermissions: ScreenPermissions }
  onClose: () => void
  onSaved: () => void
}) {
  const [permissions, setPermissions] = useState(target.screenPermissions)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const save = async () => {
    setSaving(true); setError('')
    try {
      const response = await apiFetch(`/api/users/${encodeURIComponent(target.uid)}/permissions`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ screenPermissions: permissions }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Não foi possível salvar as permissões')
      onSaved(); onClose()
    } catch (error) { setError(error instanceof Error ? error.message : 'Não foi possível salvar') }
    finally { setSaving(false) }
  }
  return <Dialog open onClose={() => { if (!saving) onClose() }} title="Permissões por tela">
    <div className="access-editor">
      <p>{target.email}</p>
      <p>Leitura permite visualizar a tela. Escrita permite alterar seus dados e exige leitura.</p>
      <div className="access-editor__table-wrap"><table className="access-editor__table">
        <thead><tr><th scope="col">Tela</th><th scope="col">Leitura</th><th scope="col">Escrita</th></tr></thead>
        <tbody>{SCREENS.map(({ id, label }) => <tr key={id}>
          <th scope="row">{label}</th>
          <td><input type="checkbox" aria-label={`Leitura: ${label}`} checked={permissions[id].read} disabled={saving}
            onChange={event => setPermissions(current => ({ ...current, [id]: { read: event.target.checked, write: event.target.checked && current[id].write } }))} /></td>
          <td><input type="checkbox" aria-label={`Escrita: ${label}`} checked={permissions[id].write} disabled={saving || !permissions[id].read}
            onChange={event => setPermissions(current => ({ ...current, [id]: { ...current[id], write: event.target.checked } }))} /></td>
        </tr>)}</tbody>
      </table></div>
      <p className="access-editor__note">Nas telas de consulta, escrita não adiciona ações. Em Usuários, ela permite editar o próprio perfil. Somente o administrador gerencia contas, permissões e acesso às listas.</p>
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="access-editor__actions"><Button variant="secondary" disabled={saving} onClick={onClose}>Cancelar</Button><Button loading={saving} onClick={save}>Salvar permissões</Button></div>
    </div>
  </Dialog>
}
