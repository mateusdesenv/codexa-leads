import { useEffect, useState } from 'react'
import { updateProfile, type User } from 'firebase/auth'
import { Alert, Avatar, Button, Card, Icon, Input, Tag } from 'codexa-ui'

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
                    <td>{systemUser.accessStatus !== 'approved' && systemUser.email.toLowerCase() !== ADMIN_EMAIL && <Button size="small" disabled={approving !== null} onClick={() => approveUser(systemUser.uid)}>{approving === systemUser.uid ? 'Liberando...' : 'Liberar acesso'}</Button>}</td>
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
    </section>
  )
}
