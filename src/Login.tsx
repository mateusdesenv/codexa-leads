import { useState } from 'react'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth'
import { Button, Card, Input, Alert } from 'codexa-ui'
import { auth, googleProvider } from './firebase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password)
      } else {
        await signInWithEmailAndPassword(auth, email, password)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao autenticar')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setError(null)
    setLoading(true)
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao entrar com Google')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <Card padding="large" className="login-card" style={{ width: '100%', maxWidth: '420px' }}>
        <header className="login-card__header">
          <h1>Prospecção Codexa</h1>
          <p>Faça login para acessar o painel de leads.</p>
        </header>

        {error && (
          <Alert tone="danger" title="Erro de autenticação">
            {error}
          </Alert>
        )}

        <form className="login-card__form" onSubmit={handleSubmit}>
          <Input
            label="E-mail"
            id="email"
            type="email"
            autoComplete="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            required
          />

          <Input
            label="Senha"
            id="password"
            type="password"
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            required
          />

          <Button
            type="submit"
            variant="primary"
            fullWidth
            loading={loading}
          >
            {isSignUp ? 'Criar conta' : 'Entrar'}
          </Button>
        </form>

        <Button
          type="button"
          variant="ghost"
          fullWidth
          onClick={() => setIsSignUp((v) => !v)}
          disabled={loading}
        >
          {isSignUp ? 'Já tem conta? Entrar' : 'Criar nova conta'}
        </Button>

        <div className="login-card__divider">
          <span>ou</span>
        </div>

        <Button
          type="button"
          variant="secondary"
          fullWidth
          onClick={handleGoogle}
          disabled={loading}
        >
          Entrar com Google
        </Button>
      </Card>
    </div>
  )
}
