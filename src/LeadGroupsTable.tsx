import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, ConfirmDialog, DataTable, Dialog, Icon, Input } from 'codexa-ui'
import type { DataTableColumn } from 'codexa-ui'

import type { LeadWithMeta } from './types'

export interface LeadGroup {
  groupId: string | null
  groupTitle: string | null
  count: number
}

export default function LeadGroupsTable({
  leads,
  onGroupClick,
  onEditGroup,
  onDeleteGroup,
}: {
  leads: LeadWithMeta[]
  onGroupClick: (group: LeadGroup) => void
  onEditGroup: (group: LeadGroup, newTitle: string) => Promise<void>
  onDeleteGroup: (group: LeadGroup) => Promise<void>
}) {
  const [search, setSearch] = useState('')
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null)
  const [editingGroup, setEditingGroup] = useState<LeadGroup | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [deletingGroup, setDeletingGroup] = useState<LeadGroup | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const groups = useMemo<LeadGroup[]>(() => {
    const map = new Map<string, LeadGroup>()
    for (const lead of leads) {
      const key = lead.groupId ?? 'no-group'
      const existing = map.get(key)
      if (existing) {
        existing.count += 1
      } else {
        map.set(key, {
          groupId: lead.groupId ?? null,
          groupTitle: lead.groupTitle?.trim() || 'Sem grupo',
          count: 1,
        })
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      (a.groupTitle ?? '').localeCompare(b.groupTitle ?? '', 'pt-BR'),
    )
  }, [leads])

  const filteredGroups = useMemo(() => {
    if (!search.trim()) return groups
    const term = search.toLowerCase()
    return groups.filter((g) => g.groupTitle?.toLowerCase().includes(term))
  }, [groups, search])

  const closeMenu = () => setMenuOpenFor(null)

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
    try {
      await onEditGroup(editingGroup, editTitle.trim())
      setEditingGroup(null)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deletingGroup) return
    setIsSubmitting(true)
    try {
      await onDeleteGroup(deletingGroup)
      setDeletingGroup(null)
    } finally {
      setIsSubmitting(false)
    }
  }

  const columns: DataTableColumn<LeadGroup>[] = [
    {
      key: 'title',
      header: 'Título do grupo',
      render: (group) => <span className="leads-table__title">{group.groupTitle}</span>,
    },
    {
      key: 'count',
      header: 'Leads',
      align: 'center',
      render: (group) => <span className="leads-table__score">{group.count}</span>,
    },
    {
      key: 'actions',
      header: '',
      align: 'end',
      render: (group) => {
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
            {hasGroup && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="small"
                  iconOnly
                  aria-label="Mais ações"
                  onClick={() => setMenuOpenFor((current) => (current === groupKey ? null : groupKey))}
                  leadingIcon={<Icon name="more-horizontal" size={16} />}
                />
                {menuOpenFor === groupKey && (
                  <div className="leads-table__actions-menu" role="menu" aria-label="Ações do grupo">
                    <button
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
                      className="leads-table__actions-item leads-table__actions-item--danger"
                      role="menuitem"
                      onClick={() => {
                        closeMenu()
                        setDeletingGroup(group)
                      }}
                    >
                      <Icon name="trash" size={14} />
                      Excluir
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <div className="leads-table">
      <div className="prospect-toolbar">
        <div className="prospect-toolbar__field prospect-toolbar__field--search">
          <Input
            label="Buscar grupo"
            id="group-search"
            type="text"
            placeholder="Título do grupo..."
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={filteredGroups}
        rowKey={(group) => group.groupId ?? group.groupTitle ?? 'unknown'}
        emptyState={
          <p className="leads-table__empty">Nenhum grupo encontrado.</p>
        }
      />

      {editingGroup && (
        <Dialog open onClose={() => setEditingGroup(null)} title="Editar grupo">
          <div className="leads-table__edit-dialog">
            <Input
              label="Novo título"
              id="edit-group-title"
              type="text"
              placeholder="Título do grupo"
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
        title="Excluir grupo"
        description="Tem certeza que deseja excluir este grupo? Os leads não serão removidos, apenas ficarão sem grupo."
        confirmLabel="Excluir"
        tone="danger"
      />
    </div>
  )
}
