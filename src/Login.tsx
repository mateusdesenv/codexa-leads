import { useState } from 'react'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth'
import { Button, Card, Input, Alert } from 'codexa-ui'
import codexaIcon from 'codexa-ui/logos/logos-fundo-transparente/icon-only.png'
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
      <section className="login-hero" aria-labelledby="login-hero-title">
        <div className="login-hero__brand">
          <span className="login-hero__mark"><img src={codexaIcon} alt="" /></span>
          <span>Codexa</span>
        </div>

        <div className="login-hero__copy">
          <span className="login-hero__eyebrow">CRM de prospecção</span>
          <h1 id="login-hero-title">Mais contexto.<br />Mais conversões.</h1>
          <p>Centralize seus leads, organize oportunidades e conduza cada conversa ao próximo passo.</p>
        </div>

        <div className="login-hero__preview" aria-hidden="true">
          <div className="login-preview__header">
            <span className="login-preview__title"><i /> Pipeline comercial</span>
            <span className="login-preview__period">Este mês</span>
          </div>
          <div className="login-preview__metrics">
            <div><small>Novos leads</small><strong>48</strong><span>+18,5%</span></div>
            <div><small>Em negociação</small><strong>12</strong><span>+8,2%</span></div>
          </div>
          <div className="login-preview__chart">
            <span style={{ height: '30%' }} /><span style={{ height: '47%' }} /><span style={{ height: '42%' }} />
            <span style={{ height: '64%' }} /><span style={{ height: '56%' }} /><span className="is-highlight" style={{ height: '86%' }} />
            <span style={{ height: '74%' }} /><span style={{ height: '100%' }} />
          </div>
          <div className="login-preview__footer"><span><i /> Funil atualizado</span><strong>Ver dashboard →</strong></div>
        </div>

        <div className="login-hero__trust"><span>●</span> Dados organizados para decisões melhores</div>
      </section>

      <main className="login-panel">
        <Card padding="large" className="login-card">
          <header className="login-card__header">
            <span className="login-card__brand" role="img" aria-label="Codexa">
              <img src={codexaIcon} alt="" />
            </span>
            <span>Codexa Leads</span>
            <h2>Boas-vindas</h2>
            <p>{isSignUp ? 'Crie sua conta para solicitar acesso ao CRM.' : 'Entre para continuar seu trabalho.'}</p>
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

            <Button type="submit" variant="primary" fullWidth loading={loading}>
              {isSignUp ? 'Criar conta' : 'Entrar no CRM'}
            </Button>
          </form>

          <Button type="button" variant="ghost" fullWidth onClick={() => setIsSignUp((v) => !v)} disabled={loading}>
            {isSignUp ? 'Já tem conta? Entrar' : 'Ainda não tem conta? Criar agora'}
          </Button>

          <div className="login-card__divider"><span>ou continue com</span></div>

          <Button type="button" variant="secondary" fullWidth onClick={handleGoogle} disabled={loading}>
            Entrar com Google
          </Button>
        </Card>
      </main>
    </div>
  )
}
