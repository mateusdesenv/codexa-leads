import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button, Icon } from 'codexa-ui'

export default function LeadActionsMenu({ title, onOpen, onEdit, onDelete }: {
  title: string
  onOpen: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!position) return
    menu.current?.querySelector('button')?.focus()
    const dismiss = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setPosition(null)
    }
    const close = () => setPosition(null)
    document.addEventListener('pointerdown', dismiss)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('pointerdown', dismiss)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [position])
  const run = (action: () => void) => { setPosition(null); action() }
  return <>
    <Button ref={trigger} type="button" variant="ghost" size="small" iconOnly
      aria-label={`Ações de ${title}`} aria-haspopup="menu" aria-expanded={!!position}
      leadingIcon={<Icon name="more-horizontal" size={18} />}
      onClick={(event) => {
        event.stopPropagation()
        const rect = event.currentTarget.getBoundingClientRect()
        setPosition(position ? null : { top: Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - 150)), right: Math.max(8, window.innerWidth - rect.right) })
      }}
    />
    {position && createPortal(<div ref={menu} className="leads-table__actions-menu lead-actions-menu" role="menu" aria-label={`Ações de ${title}`} style={position}
      onKeyDown={(event) => {
        const items = [...(menu.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
        const index = items.indexOf(document.activeElement as HTMLButtonElement)
        if (event.key === 'Escape') { event.preventDefault(); setPosition(null); trigger.current?.focus() }
        if (event.key === 'Tab') setPosition(null)
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault()
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
          items[next]?.focus()
        }
      }}>
      <button type="button" role="menuitem" className="leads-table__actions-item" onClick={() => run(onOpen)}><Icon name="external-link" size={16} />Abrir</button>
      <button type="button" role="menuitem" className="leads-table__actions-item" onClick={() => run(onEdit)}><Icon name="edit" size={16} />Editar</button>
      <button type="button" role="menuitem" className="leads-table__actions-item leads-table__actions-item--danger" onClick={() => run(onDelete)}><Icon name="trash" size={16} />Excluir</button>
    </div>, document.body)}
  </>
}
