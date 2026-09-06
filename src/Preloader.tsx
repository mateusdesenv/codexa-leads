import { Spinner } from 'codexa-ui'
import codexaLogo from 'codexa-ui/logos/logos-fundo-transparente/primary-logo.png'

export default function Preloader() {
  return (
    <main className="codexa-preloader" aria-busy="true" aria-live="polite">
      <div className="codexa-preloader__glow codexa-preloader__glow--one" aria-hidden="true" />
      <div className="codexa-preloader__glow codexa-preloader__glow--two" aria-hidden="true" />
      <section className="codexa-preloader__content" aria-label="Carregando Codexa Leads">
        <div className="codexa-preloader__brand">
          <img src={codexaLogo} alt="Codexa" />
        </div>
        <div className="codexa-preloader__loader">
          <Spinner size="medium" label="Carregando aplicação..." />
          <p>Preparando seu espaço de trabalho</p>
        </div>
      </section>
    </main>
  )
}
