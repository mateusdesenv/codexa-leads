import { useEffect, useState, type ReactNode } from 'react'
import { onAuthStateChanged, signOut, type User } from 'firebase/auth'
import { Alert, Button, Card } from 'codexa-ui'
import { auth } from './firebase'
import Login from './Login'
import Preloader from './Preloader'
import codexaLogo from 'codexa-ui/logos/logos-fundo-transparente/primary-logo.png'

export default function AccessGate({ children }: { children: (user: User) => ReactNode }) {
  const [user, setUser] = useState<User | null>()
  const [status, setStatus] = useState('checking')
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)

  useEffect(() => onAuthStateChanged(auth, (next) => {
    setStatus('checking')
    setUser(next)
  }), [])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    let busy = false
    const check = async () => {
      if (busy) return
      busy = true
      try {
        const token = await user.getIdToken()
        const response = await fetch('/api/users/me', { method: 'PUT', headers: { Authorization: `Bearer ${token}` } })
        if (!response.ok) throw new Error('Falha na verificação')
        const data = await response.json()
        if (!cancelled) {
          setStatus(data.accessStatus === 'approved' ? 'approved' : 'pending')
          setError(false)
        }
      } catch {
        if (!cancelled) { setStatus('error'); setError(true) }
      } finally { busy = false }
    }
    void check()
    const timer = window.setInterval(check, 15000)
    window.addEventListener('access-recheck', check)
    return () => { cancelled = true; window.clearInterval(timer); window.removeEventListener('access-recheck', check) }
  }, [user, retry])

  if (user === undefined) return <Preloader />
  if (!user) return <Login />
  if (status === 'checking') return <Preloader />
  if (status === 'approved') return children(user)

  return <main className="access-waiting">
    <Card padding="large" className="access-waiting__card">
      <img src={codexaLogo} alt="Codexa" width={140} />
      <h1>{error ? 'Não foi possível verificar seu acesso' : 'Aguardando liberação do administrador'}</h1>
      <p>{error ? 'Tente novamente para consultar a situação da sua conta.' : 'Sua solicitação foi registrada. Assim que o administrador aprovar, seu acesso será liberado automaticamente.'}</p>
      <p><strong>{user.email}</strong></p>
      {error && <Alert tone="danger">Não conseguimos consultar sua liberação agora.</Alert>}
      <div className="access-waiting__actions">
        <Button onClick={() => { setStatus('checking'); setRetry((value) => value + 1) }}>Verificar liberação</Button>
        <Button variant="ghost" onClick={() => signOut(auth)}>Sair</Button>
      </div>
    </Card>
  </main>
}
