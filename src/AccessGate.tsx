import { useEffect, useState, type ReactNode } from 'react'
import {
  watchSession,
  logoutSession,
  type SessionUser as User,
} from './session'
import { Alert, Button, Card } from 'codexa-ui'

import Login from './Login'
import type { AccessProfile } from '../shared/permissions'
import Preloader from './Preloader'
import codexaLogo from 'codexa-ui/logos/logos-fundo-transparente/primary-logo.png'

export default function AccessGate({
  children,
}: {
  children: (user: User, access: AccessProfile) => ReactNode
}) {
  const [access, setAccess] = useState<AccessProfile | null>(null)
  const [user, setUser] = useState<User | null>()
  const [status, setStatus] = useState('checking')
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)

  useEffect(
    () =>
      watchSession((next) => {
        setStatus('checking')
        setAccess(null)
        setUser(next)
      }),
    [],
  )

  useEffect(() => {
    if (!user) return
    let cancelled = false
    let busy = false
    let synced = false
    const check = async () => {
      if (busy) return
      busy = true
      try {
        const token = await user.getIdToken()
        const response = await fetch('/api/users/me', {
          method: synced ? 'GET' : 'PUT',
          headers: { Authorization: `Bearer ${token}` },
        })
        if (response.status === 401) {
          if (!cancelled) setStatus('expired')
          return
        }
        if (response.status === 403) {
          if (!cancelled) setStatus('blocked')
          return
        }
        if (!response.ok) throw new Error('Falha na verificação')
        synced = true
        const data = await response.json()
        if (!cancelled) {
          setAccess((current) =>
            JSON.stringify(current) === JSON.stringify(data) ? current : data,
          )
          setStatus(data.accessStatus === 'approved' ? 'approved' : 'blocked')
          setError(false)
        }
      } catch {
        if (!cancelled) {
          setStatus('error')
          setError(true)
        }
      } finally {
        busy = false
      }
    }
    void check()
    const expired = () => setStatus('expired')
    window.addEventListener('session-expired', expired)
    const timer = window.setInterval(check, 15000)
    window.addEventListener('access-recheck', check)
    return () => {
      window.removeEventListener('session-expired', expired)
      cancelled = true
      window.clearInterval(timer)
      window.removeEventListener('access-recheck', check)
    }
  }, [user, retry])

  if (user === undefined) return <Preloader />
  if (!user) return <Login />
  if (status === 'expired')
    return (
      <Login message="Sua sessão terminou. Continue pelo Hub para retomar seu trabalho." />
    )
  if (status === 'blocked')
    return (
      <Login message="Seu acesso ao Leads está suspenso ou foi removido. Fale com o administrador ou volte ao Hub." />
    )
  if (status === 'checking') return <Preloader />
  if (status === 'approved' && access) return children(user, access)

  return (
    <main className="access-waiting">
      <Card padding="large" className="access-waiting__card">
        <img src={codexaLogo} alt="Codexa" width={140} />
        <h1>
          {error
            ? 'Não foi possível verificar seu acesso'
            : 'Aguardando liberação do administrador'}
        </h1>
        <p>
          {error
            ? 'Tente novamente para consultar a situação da sua conta.'
            : 'Sua solicitação foi registrada. Assim que o administrador aprovar, seu acesso será liberado automaticamente.'}
        </p>
        <p>
          <strong>{user.email}</strong>
        </p>
        {error && (
          <Alert tone="danger">
            Não conseguimos consultar sua liberação agora.
          </Alert>
        )}
        <div className="access-waiting__actions">
          <Button
            onClick={() => {
              setStatus('checking')
              setRetry((value) => value + 1)
            }}
          >
            Verificar liberação
          </Button>
          <Button variant="ghost" onClick={() => logoutSession()}>
            Sair
          </Button>
        </div>
      </Card>
    </main>
  )
}
