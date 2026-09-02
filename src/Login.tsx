import { useState } from 'react'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth'
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
      <div className="login-card">
        <header className="login-card__header">
          <h1>Prospecção Codexa</h1>
          <p>Faça login para acessar o painel de leads.</p>
        </header>

        {error && <div className="login-card__error" role="alert">{error}</div>}

        <form className="login-card__form" onSubmit={handleSubmit}>
          <div className="prospect-field">
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="prospect-field">
            <label htmlFor="password">Senha</label>
            <input
              id="password"
              type="password"
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className="action-btn action-btn--primary action-btn--full"
            disabled={loading}
          >
            {loading ? 'Carregando…' : isSignUp ? 'Criar conta' : 'Entrar'}
          </button>
        </form>

        <button
          type="button"
          className="login-card__toggle"
          onClick={() => setIsSignUp((v) => !v)}
          disabled={loading}
        >
          {isSignUp ? 'Já tem conta? Entrar' : 'Criar nova conta'}
        </button>

        <div className="login-card__divider">
          <span>ou</span>
        </div>

        <button
          type="button"
          className="action-btn action-btn--secondary action-btn--full"
          onClick={handleGoogle}
          disabled={loading}
        >
          Entrar com Google
        </button>
      </div>
    </div>
  )
}
