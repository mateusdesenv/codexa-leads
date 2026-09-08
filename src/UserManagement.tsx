import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { updateProfile, type User } from 'firebase/auth'
import { Alert, Avatar, Button, Card, ConfirmDialog, Icon, Input, Tag } from 'codexa-ui'

const ADMIN_EMAIL = 'mateus.desenv@gmail.com'

type UserManagementProps = {
  user: User
}

type SystemUser = {
  uid: string
  email: string
  displayName: string
  photoURL: string
  providerId: string
  accessStatus: 'pending' | 'approved'
  registeredAt?: string
  createdAt?: string
}

const getProviderLabel = (user: User) =>
  user.providerData[0]?.providerId === 'google.com' ? 'Google' : 'E-mail e senha'

const getSystemProviderLabel = (providerId: string) =>
  providerId === 'google.com' ? 'Google' : 'E-mail e senha'

const formatAccountDate = (value?: string) => {
  if (!value) return '—'

  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(date)
}

export default function UserManagement({ user }: UserManagementProps) {
  const [name, setName] = useState(user.displayName ?? '')
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([])
  const [approving, setApproving] = useState<string | null>(null)
  const [deletingUser, setDeletingUser] = useState<SystemUser | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const [usersLoading, setUsersLoading] = useState(false)
  const [usersError, setUsersError] = useState<string | null>(null)
  const isAdmin = user.email?.trim().toLowerCase() === ADMIN_EMAIL
  const providerLabel = getProviderLabel(user)

  useEffect(() => {
    if (!isAdmin) return

    let cancelled = false
    const loadUsers = async () => {
      setUsersLoading(true)
      setUsersError(null)
      try {
        const token = await user.getIdToken()
        const response = await fetch('/api/users', { headers: { Authorization: `Bearer ${token}` } })
        if (!response.ok) throw new Error('Não foi possível carregar os usuários')
        const data: SystemUser[] = await response.json()
        if (!cancelled) setSystemUsers(data)
      } catch {
        if (!cancelled) setUsersError('Não foi possível carregar os usuários do sistema.')
      } finally {
        if (!cancelled) setUsersLoading(false)
      }
    }

    void loadUsers()
    return () => { cancelled = true }
  }, [isAdmin, user, refresh])

  const approveUser = async (uid: string) => {
    setApproving(uid)
    setUsersError(null)
    try {
      const token = await user.getIdToken()
      const response = await fetch(`/api/users/${encodeURIComponent(uid)}/approve`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) throw new Error('Não foi possível liberar o acesso')
      const updated: SystemUser = await response.json()
      setSystemUsers((current) => current.map((entry) => entry.uid === uid ? updated : entry))
    } catch {
      setUsersError('Não foi possível liberar o acesso. Tente novamente.')
    } finally { setApproving(null) }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setFeedback(null)
    try {
      await updateProfile(user, { displayName: name.trim() || null })
      setFeedback('Dados atualizados com sucesso.')
    } catch {
      setFeedback('Não foi possível atualizar os dados. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const deleteUser = async () => {
    if (!deletingUser || deleting) return
    setDeleting(true)
    setUsersError(null)
    try {
      const token = await user.getIdToken()
      const response = await fetch(`/api/users/${encodeURIComponent(deletingUser.uid)}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) throw new Error('Não foi possível excluir o usuário')
      setSystemUsers((current) => current.filter((entry) => entry.uid !== deletingUser.uid))
    } catch {
      setUsersError('Não foi possível excluir o usuário. Tente novamente.')
    } finally { setDeleting(false); setDeletingUser(null) }
  }

  return (
    <section className="user-management" aria-labelledby="user-management-title">
      <div className="user-management__hero">
        <div>
          <span className="user-management__eyebrow">Conta e acesso</span>
          <h1 id="user-management-title">Gerenciamento de usuário</h1>
          <p>Atualize seus dados de perfil e consulte as permissões da sua conta.</p>
        </div>
        <Tag tone="success">Ativo</Tag>
      </div>

      <div className="user-management__grid">
        <Card padding="medium" className="user-management__profile">
          <div className="user-management__profile-head">
            <Avatar name={user.displayName ?? user.email ?? 'Usuário'} src={user.photoURL || undefined} size="large" />
            <div>
              <h2>{user.displayName ?? 'Usuário'}</h2>
              <p>{user.email}</p>
            </div>
          </div>
          <form className="user-management__form" onSubmit={handleSubmit}>
            <Input label="Nome de exibição" id="user-display-name" value={name} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setName(event.target.value)} placeholder="Como seu nome deve aparecer" />
            {feedback && <Alert tone={feedback.includes('sucesso') ? 'success' : 'danger'}>{feedback}</Alert>}
            <Button type="submit" variant="primary" disabled={saving}>{saving ? 'Salvando...' : 'Salvar alterações'}</Button>
          </form>
        </Card>

        <Card padding="medium" className="user-management__access">
          <div className="user-management__card-title">
            <Icon name="users" size={20} />
            <div><h2>Acesso ao CRM</h2><p>Resumo das permissões atuais.</p></div>
          </div>
          <dl className="user-management__details">
            <div><dt>E-mail</dt><dd>{user.email ?? 'Não informado'}</dd></div>
            <div><dt>Perfil</dt><dd><Tag tone={isAdmin ? 'info' : 'neutral'}>{isAdmin ? 'Administrador' : 'Usuário'}</Tag></dd></div>
            <div><dt>Provedor</dt><dd>{providerLabel}</dd></div>
          </dl>
        </Card>
      </div>

      {isAdmin && (
        <Card padding="medium" className="user-management__system-users">
          <div className="user-management__section-head">
            <div className="user-management__card-title">
              <Icon name="users" size={20} />
              <div>
                <h2>Usuários do sistema</h2>
                <p>Aprove as solicitações para liberar o acesso ao CRM.</p>
              </div>
            </div>
            <Button variant="secondary" size="small" disabled={usersLoading} onClick={() => setRefresh((value) => value + 1)}>Atualizar solicitações</Button>
            <Tag tone="info">{usersLoading ? 'Carregando...' : `${systemUsers.length} ${systemUsers.length === 1 ? 'usuário' : 'usuários'}`}</Tag>
          </div>

          <div className="user-management__table-wrap">
            <table className="user-management__table">
              <thead>
                <tr>
                  <th scope="col">Usuário</th>
                  <th scope="col">Perfil</th>
                  <th scope="col">Provedor</th>
                  <th scope="col">Desde</th>
                  <th scope="col">Acesso</th>
                  <th scope="col">Ação</th>
                </tr>
              </thead>
              <tbody>
                {systemUsers.map((systemUser) => (
                  <tr key={systemUser.uid}>
                    <td>
                      <div className="user-management__table-user">
                        <Avatar name={systemUser.displayName || systemUser.email} src={systemUser.photoURL || undefined} size="small" />
                        <span>
                          <strong>{systemUser.displayName || 'Usuário'}</strong>
                          <small>{systemUser.email}</small>
                        </span>
                      </div>
                    </td>
                    <td><Tag tone={systemUser.email.toLowerCase() === ADMIN_EMAIL ? 'info' : 'neutral'}>{systemUser.email.toLowerCase() === ADMIN_EMAIL ? 'Administrador' : 'Usuário'}</Tag></td>
                    <td>{getSystemProviderLabel(systemUser.providerId)}</td>
                    <td>{formatAccountDate(systemUser.registeredAt ?? systemUser.createdAt)}</td>
                    <td><Tag tone={systemUser.accessStatus === 'approved' ? 'success' : 'warning'}>{systemUser.accessStatus === 'approved' ? 'Liberado' : 'Aguardando liberação'}</Tag></td>
                    <td><UserActionsMenu user={systemUser} busy={approving !== null || deleting} onApprove={() => approveUser(systemUser.uid)} onDelete={() => setDeletingUser(systemUser)} /></td>
                  </tr>
                ))}
                {!usersLoading && systemUsers.length === 0 && (
                  <tr><td className="user-management__table-empty" colSpan={6}>Nenhum usuário sincronizado ainda.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {usersError ? <Alert tone="danger">{usersError}</Alert> : <p className="user-management__table-note">Novas solicitações aparecem após a autenticação e permanecem bloqueadas até sua aprovação.</p>}
        </Card>
      )}
      <ConfirmDialog
        open={deletingUser !== null}
        onClose={() => { if (!deleting) setDeletingUser(null) }}
        onConfirm={deleteUser}
        title="Excluir usuário"
        description={`Excluir ${deletingUser?.email ?? 'este usuário'} do CRM? O acesso será removido. Se entrar novamente, precisará solicitar uma nova liberação.`}
        confirmLabel={deleting ? 'Excluindo...' : 'Excluir usuário'}
        tone="danger"
      />
    </section>
  )
}

function UserActionsMenu({ user, busy, onApprove, onDelete }: {
  user: SystemUser
  busy: boolean
  onApprove: () => void
  onDelete: () => void
}) {
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null)
  const trigger = useRef<HTMLSpanElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const owner = user.email.trim().toLowerCase() === ADMIN_EMAIL
  const close = () => {
    setPosition(null)
    trigger.current?.querySelector('button')?.focus()
  }

  useEffect(() => {
    if (!position) return
    (menu.current?.querySelector<HTMLButtonElement>('button:not(:disabled)') ?? menu.current)?.focus()
    const outside = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setPosition(null)
    }
    const dismiss = () => setPosition(null)
    document.addEventListener('pointerdown', outside)
    window.addEventListener('resize', dismiss)
    window.addEventListener('scroll', dismiss, true)
    return () => {
      document.removeEventListener('pointerdown', outside)
      window.removeEventListener('resize', dismiss)
      window.removeEventListener('scroll', dismiss, true)
    }
  }, [position])

  return <>
    <span ref={trigger}>
      <Button variant="ghost" size="small" iconOnly aria-label={`Mais ações para ${user.email}`} aria-haspopup="menu" aria-expanded={position !== null} disabled={busy}
        leadingIcon={<Icon name="more-horizontal" size={18} />}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect()
          setPosition(position ? null : { top: Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - 110)), right: Math.max(8, window.innerWidth - rect.right) })
        }} />
    </span>
    {position && createPortal(<div ref={menu} className="leads-table__actions-menu user-actions-menu" role="menu" tabIndex={-1} aria-label={`Ações para ${user.email}`} style={position}
      onKeyDown={(event) => {
        if (event.key === 'Escape') { event.preventDefault(); close() }
        if (event.key === 'Tab') { event.preventDefault(); close() }
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault()
          const items = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])
          const current = items.indexOf(document.activeElement as HTMLButtonElement)
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (current + (event.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length
          items[next]?.focus()
        }
      }}>
      <button type="button" role="menuitem" className="leads-table__actions-item" disabled={busy || owner || user.accessStatus === 'approved'} onClick={() => { close(); onApprove() }}><Icon name="check-circle" size={16} />Liberar acesso</button>
      <button type="button" role="menuitem" className="leads-table__actions-item leads-table__actions-item--danger" disabled={busy || owner} onClick={() => { close(); onDelete() }}><Icon name="trash" size={16} />Excluir usuário</button>
    </div>, document.body)}
  </>
}
