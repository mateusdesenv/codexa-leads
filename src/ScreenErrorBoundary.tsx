import { Component, type ReactNode } from 'react'
import { Alert, Button } from 'codexa-ui'

export default class ScreenErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error) {
    console.error('Não foi possível exibir a tela do Leads.', error)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <Alert tone="danger">
        <h2>Não foi possível exibir esta tela</h2>
        <p>Tente novamente ou abra outra seção pelo menu.</p>
        <Button variant="secondary" onClick={() => this.setState({ failed: false })}>
          Tentar novamente
        </Button>
      </Alert>
    )
  }
}
