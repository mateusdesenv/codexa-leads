import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, ConfirmDialog, DataTable, Dialog, Icon, Input } from 'codexa-ui'
import type { DataTableColumn } from 'codexa-ui'


export interface LeadGroup {
  groupId: string | null
  groupTitle: string | null
  assignees?: { uid: string; name: string }[]
  count: number
  visibility?: 'all' | 'selected'
  viewerUids?: string[]
}

export default function LeadGroupsTable({
  groups,
  currentUserUid,
  readOnly = false,
  onManageAccess,
  onOpenKanban,
  onGroupClick,
  onEditGroup,
  onDeleteGroup,
}: {
  currentUserUid: string
  groups: LeadGroup[]
  readOnly?: boolean
  onManageAccess?: (group: LeadGroup) => void
  onOpenKanban: (group: LeadGroup) => void
  onGroupClick: (group: LeadGroup) => void
  onEditGroup: (group: LeadGroup, newTitle: string) => Promise<void>
  onDeleteGroup: (group: LeadGroup) => Promise<void>
}) {
  const [view, setView] = useState<'grid' | 'list'>(() => {
    try { return localStorage.getItem('codexa-lead-groups-view') === 'list' ? 'list' : 'grid' }
    catch { return 'grid' }
  })
  const changeView = (next: 'grid' | 'list') => {
    closeMenu()
    setView(next)
    try { localStorage.setItem('codexa-lead-groups-view', next) } catch { /* Storage may be unavailable. */ }
  }
  const [search, setSearch] = useState('')
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null)
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null)
  const [editingGroup, setEditingGroup] = useState<LeadGroup | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [deletingGroup, setDeletingGroup] = useState<LeadGroup | null>(null)
  const [actionError, setActionError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const filteredGroups = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR')
    return groups.filter(g => !term || g.groupTitle?.toLocaleLowerCase('pt-BR').includes(term))
      .sort((a, b) => Number(b.assignees?.some(person => person.uid === currentUserUid) ?? false)
        - Number(a.assignees?.some(person => person.uid === currentUserUid) ?? false)
        || (a.groupTitle ?? '').localeCompare(b.groupTitle ?? '', 'pt-BR'))
  }, [groups, search, currentUserUid])

  const closeMenu = () => {
    setMenuOpenFor(null)
    setMenuPosition(null)
  }

  useEffect(() => {
    if (!menuOpenFor) return
    const handleClick = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        closeMenu()
      }
    }
    document.addEventListener('pointerdown', handleClick)
    return () => document.removeEventListener('pointerdown', handleClick)
  }, [menuOpenFor])

  const startEdit = (group: LeadGroup) => {
    setEditTitle(group.groupTitle ?? '')
    setEditingGroup(group)
  }

  const handleSaveEdit = async () => {
    if (!editingGroup || !editTitle.trim()) return
    setIsSubmitting(true)
    setActionError('')
    try {
      await onEditGroup(editingGroup, editTitle.trim())
      setEditingGroup(null)
    } catch (e) { setActionError((e as Error).message) } finally {
      setIsSubmitting(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deletingGroup) return
    setIsSubmitting(true)
    setActionError('')
    try {
      await onDeleteGroup(deletingGroup)
      setDeletingGroup(null)
    } catch (e) { setActionError((e as Error).message) } finally {
      setIsSubmitting(false)
    }
  }

  const renderActions = (group: LeadGroup) => {
        const groupKey = group.groupId ?? group.groupTitle ?? 'unknown'
        const hasGroup = group.groupId !== null
        return (
          <div className="leads-table__actions" ref={menuOpenFor === groupKey ? menuRef : undefined}>
            <Button
              type="button"
              variant="ghost"
              size="small"
              onClick={() => onGroupClick(group)}
              leadingIcon={<Icon name="external-link" size={16} />}
            >
              Ver leads
            </Button>
            <Button variant="ghost" size="small" onClick={() => onOpenKanban(group)}>Abrir no Kanban</Button>
            {hasGroup && (!readOnly || onManageAccess) && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="small"
                  iconOnly
                  aria-label="Mais ações"
                  onClick={(event) => {
                    const rect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect()
                    setMenuPosition({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
                    setMenuOpenFor((current) => (current === groupKey ? null : groupKey))
                  }}
                  leadingIcon={<Icon name="more-horizontal" size={16} />}
                />
                {menuOpenFor === groupKey && menuPosition && (
                  <div
                    className="leads-table__actions-menu"
                    role="menu"
                    aria-label="Ações do grupo"
                    style={{ top: menuPosition.top, right: menuPosition.right }}
                  >
                    {onManageAccess && <button type="button" role="menuitem" className="leads-table__actions-item" onClick={() => { closeMenu(); onManageAccess(group) }}><Icon name="users" size={14} />Equipe e acesso</button>}
                    <button
                      disabled={readOnly}
                      type="button"
                      className="leads-table__actions-item"
                      role="menuitem"
                      onClick={() => {
                        closeMenu()
                        startEdit(group)
                      }}
                    >
                      <Icon name="edit" size={14} />
                      Editar
                    </button>
                    <button
                      type="button"
                      disabled={readOnly}
                      className="leads-table__actions-item leads-table__actions-item--danger"
                      role="menuitem"
                      onClick={() => {
                        closeMenu()
                        setDeletingGroup(group)
                      }}
                    >
                      <Icon name="trash" size={14} />
                      Arquivar
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )
      }

  const renderAssignees = (group: LeadGroup) => (
    <div className="lead-group-assignees">
      {group.assignees?.length ? group.assignees.map(person => <span key={person.uid} className={person.uid === currentUserUid ? 'lead-group-assignees__mine' : undefined}>{person.name}{person.uid === currentUserUid ? ' · Você' : ''}</span>) : <span>Sem responsáveis</span>}
    </div>
  )

  const columns: DataTableColumn<LeadGroup>[] = [
    {
      key: 'title',
      header: 'Nome da lista',
      render: (group) => <span className="leads-table__title">{group.groupTitle}</span>,
    },
    {
      key: 'count',
      header: 'Leads',
      align: 'center',
      render: (group) => <span className="leads-table__score">{group.count}</span>,
    },
    {
      key: 'assignees',
      header: 'Responsáveis',
      render: renderAssignees,
    },
    {
      key: 'actions',
      header: '',
      align: 'end',
      render: renderActions,
    },
  ]

  return (
    <div className="leads-table">
      {actionError && <p role="alert">{actionError}</p>}
      <div className="lead-groups-toolbar">
        <div className="prospect-toolbar__field prospect-toolbar__field--search">
          <Input
            label="Buscar lista"
            id="group-search"
            type="text"
            placeholder="Nome da lista..."
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
          />
        </div>
        <div className="lead-groups-view" role="group" aria-label="Visualização das listas">
          <Button type="button" variant={view === 'grid' ? 'primary' : 'secondary'} aria-pressed={view === 'grid'} onClick={() => changeView('grid')}>Grid</Button>
          <Button type="button" variant={view === 'list' ? 'primary' : 'secondary'} aria-pressed={view === 'list'} onClick={() => changeView('list')}>Lista</Button>
        </div>
      </div>

      {view === 'grid' ? (
        <div className="lead-groups-grid">
          {filteredGroups.map((group) => (
            <article className="lead-group-card" key={group.groupId ?? group.groupTitle ?? 'unknown'}>
              <div className="lead-group-card__icon"><Icon name="users" size={24} /></div>
              <h3>{group.groupTitle || 'Lista'}</h3>
              <span className="lead-group-card__count">{group.count} {group.count === 1 ? 'lead' : 'leads'}</span>
              {renderAssignees(group)}
              <div className="lead-group-card__actions">{renderActions(group)}</div>
            </article>
          ))}
          {!filteredGroups.length && <p className="leads-table__empty">{search ? 'Nenhuma lista corresponde à busca.' : 'Nenhuma lista foi liberada para você ainda.'}</p>}
        </div>
      ) : <DataTable
        columns={columns}
        rows={filteredGroups}
        rowKey={(group) => group.groupId ?? group.groupTitle ?? 'unknown'}
        emptyState={
          <p className="leads-table__empty">{search ? 'Nenhuma lista corresponde à busca.' : 'Nenhuma lista foi liberada para você ainda.'}</p>
        }
      />}


      {editingGroup && (
        <Dialog open onClose={() => setEditingGroup(null)} title="Renomear lista">
          <div className="leads-table__edit-dialog">
            <Input
              label="Novo título"
              id="edit-group-title"
              type="text"
              placeholder="Nome da lista"
              value={editTitle}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditTitle(e.target.value)}
              autoFocus
            />
            <div className="leads-table__edit-actions">
              <Button type="button" variant="ghost" onClick={() => setEditingGroup(null)}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleSaveEdit} loading={isSubmitting}>
                Salvar
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      <ConfirmDialog
        open={!!deletingGroup}
        onClose={() => setDeletingGroup(null)}
        onConfirm={handleConfirmDelete}
        title="Arquivar lista"
        description="Tem certeza que deseja arquivar esta lista? Os leads e seus vínculos serão preservados. Você poderá restaurá-la em Acessos do Leads."
        confirmLabel="Arquivar"
        tone="danger"
      />
    </div>
  )
}
