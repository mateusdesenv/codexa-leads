import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Icon, type IconName } from 'codexa-ui'
import codexaLogo from 'codexa-ui/logos/logos-fundo-transparente/primary-logo-reversed.png'
import type { ThemePreference } from './useTheme'
import './AppShell.css'

const navigation = [
  { label: 'Workspace', items: [
    { view: 'dashboard', label: 'Dashboard', icon: 'home' },
    { view: 'kanban', label: 'Kanban', icon: 'sort' },
    { view: 'table', label: 'Leads', icon: 'users' },
    { view: 'packages', label: 'Pacotes', icon: 'file' },
    { view: 'portfolio', label: 'Portfólio', icon: 'file' },
    { view: 'users', label: 'Usuários', icon: 'user' },
    { view: 'help', label: 'Help', icon: 'help' },
  ] },
  { label: 'Atlas', items: [
    { view: 'atlas-early-access', label: 'Acesso antecipado', icon: 'users' },
  ] },
  { label: 'Briefing', items: [
    { view: 'briefing-leads', label: 'Leads', icon: 'file' },
  ] },
] as const satisfies readonly { label: string; items: readonly { view: string; label: string; icon: IconName }[] }[]

export type AppView = typeof navigation[number]['items'][number]['view']

type ShellProps = {
  user: { displayName: string | null; email: string | null; photoURL: string | null }
  theme: ThemePreference
  onThemeChange: (theme: ThemePreference) => void
  currentView: AppView
  onNavigate: (view: AppView) => void
  onSignOut: () => void
  children: ReactNode
}

function ThemeIcon({ theme }: { theme: ThemePreference }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {theme === 'light' ? <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </> : <path d="M20.9 13.2A9 9 0 0 1 10.8 3.1a9 9 0 1 0 10.1 10.1Z" />}
    </svg>
  )
}

function Navigation({ user, theme, onThemeChange, currentView, onNavigate, onSignOut, onClose }: Omit<ShellProps, 'children'> & { onClose?: () => void }) {
  const id = useId()
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null)
  const name = user.displayName || user.email || 'Usuário'
  const photoURL = user.photoURL !== failedPhoto ? user.photoURL : null
  const initials = name.trim().split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase()

  return <>
    <div className="shell-nav__top">
      <fieldset className="shell-theme">
        <legend className="shell-sr-only">Tema</legend>
        {(['light', 'dark'] as const).map(value => <label className="shell-theme__option" key={value}>
          <input type="radio" name={`theme-${id}`} value={value} checked={theme === value} onChange={() => onThemeChange(value)} />
          <span><ThemeIcon theme={value} />{value === 'light' ? 'Claro' : 'Escuro'}</span>
        </label>)}
      </fieldset>
      {onClose && <button type="button" className="shell-icon-button shell-nav__close" aria-label="Fechar menu" onClick={onClose}><Icon name="x" size={20} /></button>}
    </div>
    <div className="shell-brand"><img src={codexaLogo} alt="Codexa" /></div>
    <nav className="shell-nav__groups" aria-label="Navegação principal">
      {navigation.map((group, index) => <section className="shell-nav__group" key={group.label} aria-labelledby={`${id}-group-${index}`}>
        <h2 id={`${id}-group-${index}`}>{group.label}</h2>
        {group.items.map(item => <button
          type="button" className="shell-nav__link" key={item.view}
          aria-current={currentView === item.view ? 'page' : undefined}
          onClick={() => onNavigate(item.view)}
        ><Icon name={item.icon} size={19} /><span>{item.label}</span></button>)}
      </section>)}
    </nav>
    <div className="shell-profile">
      <span className="shell-profile__avatar" aria-hidden="true">
        {photoURL ? <img src={photoURL} alt="" onError={() => setFailedPhoto(photoURL)} /> : initials}
      </span>
      <div className="shell-profile__details">
        <span className="shell-profile__name" title={name}>{name}</span>
        <button type="button" className="shell-profile__logout" onClick={onSignOut}><Icon name="logout" size={15} />Sair</button>
      </div>
    </div>
  </>
}

export default function AppShell({ children, ...props }: ShellProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [today, setToday] = useState(() => new Date())
  const drawer = useRef<HTMLDialogElement>(null)
  const menuButton = useRef<HTMLButtonElement>(null)
  const main = useRef<HTMLElement>(null)
  const drawerId = useId()
  const group = navigation.find(group => group.items.some(item => item.view === props.currentView))!
  const page = group.items.find(item => item.view === props.currentView)!

  useEffect(() => {
    const update = () => setToday(new Date())
    const timer = window.setInterval(update, 60_000)
    window.addEventListener('focus', update)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', update) }
  }, [])

  useEffect(() => {
    if (!menuOpen) { drawer.current?.close(); return }
    const dialog = drawer.current
    if (!dialog) return
    dialog.showModal()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const desktop = window.matchMedia('(min-width: 761px)')
    const closeOnDesktop = () => {
      if (desktop.matches) { setMenuOpen(false); main.current?.focus() }
    }
    desktop.addEventListener('change', closeOnDesktop)
    return () => {
      document.body.style.overflow = previousOverflow
      desktop.removeEventListener('change', closeOnDesktop)
      dialog.close()
    }
  }, [menuOpen])

  const navigate = (view: AppView) => { setMenuOpen(false); props.onNavigate(view) }
  const dateLabel = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }).format(today)
  const dateValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  return <div className="prospect-app app-shell">
    <a className="shell-skip-link" href="#workspace-content">Pular para o conteúdo</a>
    <aside className="shell-sidebar"><Navigation {...props} onNavigate={navigate} /></aside>
    <dialog
      id={drawerId} ref={drawer} className="shell-drawer" aria-label="Menu de navegação"
      onClose={() => { setMenuOpen(false); if (!window.matchMedia('(min-width: 761px)').matches) menuButton.current?.focus() }}
      onKeyDown={event => {
        if (event.key !== 'Tab') return
        const controls = event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:checked')
        const first = controls[0]
        const last = controls[controls.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }}
      onClick={event => {
        if (event.target !== event.currentTarget) return
        const rect = event.currentTarget.getBoundingClientRect()
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) setMenuOpen(false)
      }}
    ><Navigation {...props} onNavigate={navigate} onClose={() => setMenuOpen(false)} /></dialog>
    <main className="prospect-main" id="workspace-content" ref={main} tabIndex={-1}>
      <header className="shell-header">
        <div className="shell-header__page">
          <h1>{page.label}</h1>
          <p className="shell-breadcrumb"><span>{group.label}</span><Icon name="chevron-right" size={13} /><span>{page.label}</span></p>
        </div>
        <time className="shell-header__date" dateTime={dateValue}><Icon name="calendar" size={17} /><span>{dateLabel}</span></time>
        <button type="button" ref={menuButton} className="shell-icon-button shell-header__menu" aria-label="Abrir menu" aria-expanded={menuOpen} aria-controls={drawerId} aria-haspopup="dialog" onClick={() => setMenuOpen(true)}><Icon name="menu" size={23} /></button>
      </header>
      {children}
    </main>
  </div>
}
