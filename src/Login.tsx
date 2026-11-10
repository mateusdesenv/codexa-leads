import { useState } from 'react'
import { Button, Card, Alert } from 'codexa-ui'
import { centralLogin } from './central-session'
export default function Login({ message }: { message?: string }) {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  return (
    <main className="login-page">
      <Card padding="large">
        <h1>Codexa Leads</h1>
        <p>
          {message ||
            'Sua entrada é feita pelo Hub Codexa. Você não precisa de outra conta ou senha.'}
        </p>
        {error && <Alert tone="danger">{error}</Alert>}
        <Button
          loading={loading}
          onClick={() => {
            setLoading(true)
            void centralLogin().catch(() => {
              setError('Não foi possível abrir o Hub. Tente novamente.')
              setLoading(false)
            })
          }}
        >
          Continuar pelo Hub
        </Button>
      </Card>
    </main>
  )
}
