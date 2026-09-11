import { useMemo, useState } from 'react'
import { Alert, ConfirmDialog, DataTable, Tabs } from 'codexa-ui'
import type { DataTableColumn, TabItem } from 'codexa-ui'
import { Badge } from 'codexa-ui'

import type { ColumnId, LeadWithMeta, Temperature } from './types'
import { formatCalendarDate } from './date'
import { groupLeadsByColumn } from '../shared/group-leads.js'
import LeadActionsMenu from './LeadActionsMenu'

type TableLead = LeadWithMeta

const COLUMN_ORDER: ColumnId[] = [
  'open',
  'em_contato',
  'mensagem_enviada',
  'contato',
  'conversa',
  'followup',
  'proposta',
  'negociacao',
  'fechado',
  'perdido',
]

const COLUMN_LABELS: Record<ColumnId, string> = {
  open: 'Open',
  em_contato: 'Tentativa de ligação',
  mensagem_enviada: 'Mensagem enviada',
  contato: 'Contato feito',
  conversa: 'Em conversa',
  followup: 'Follow-up',
  proposta: 'Proposta enviada',
  negociacao: 'Negociação',
  fechado: 'Cliente fechado',
  perdido: 'Perdido',
}

const getTemperatureTone = (t: Temperature): 'danger' | 'warning' | 'info' => {
  if (t === 'quente') return 'danger'
  if (t === 'medio') return 'warning'
  return 'info'
}

const getTemperatureEmoji = (t: Temperature): string => {
  if (t === 'quente') return '🔥'
  if (t === 'medio') return '🟡'
  return '❄️'
}

const formatDate = (value?: string | null): string => {
  return formatCalendarDate(value, '—')
}

export default function LeadsTable({
  leads,
  onLeadClick,
  onEditLead,
  onDeleteLead,
}: {
  leads: TableLead[]
  onLeadClick: (lead: TableLead) => void
  onEditLead: (lead: TableLead) => void
  onDeleteLead: (lead: TableLead) => Promise<void>
}) {
  const [activeColumn, setActiveColumn] = useState<ColumnId>('open')

  const [deletingLead, setDeletingLead] = useState<TableLead | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const leadsByColumn = useMemo(() => groupLeadsByColumn(leads, COLUMN_ORDER), [leads])

  const firstWithLeads = useMemo(
    () => COLUMN_ORDER.find((column) => leadsByColumn[column].length > 0),
    [leadsByColumn],
  )

  const effectiveColumn = leadsByColumn[activeColumn].length > 0
    ? activeColumn
    : (firstWithLeads ?? 'open')

  const tabItems: TabItem[] = useMemo(
    () =>
      COLUMN_ORDER.map((column) => ({
        id: column,
        label: `${COLUMN_LABELS[column]} (${leadsByColumn[column].length})`,
        disabled: leadsByColumn[column].length === 0,
      })),
    [leadsByColumn],
  )

  const columns: DataTableColumn<TableLead>[] = [
    {
      key: 'title',
      header: 'Nome',
      render: (lead) => (
        <div className="leads-table__cell leads-table__cell--title">
          <span className="leads-table__title">{lead.title}</span>
          {lead.categoryName && <span className="leads-table__category">{lead.categoryName}</span>}
        </div>
      ),
    },
    {
      key: 'assignee',
      header: 'Responsável',
      render: (lead) => <span className="leads-table__cell--muted">{lead.assigneeName || 'Sem responsável'}</span>,
    },
    {
      key: 'address',
      header: 'Endereço',
      render: (lead) => <span className="leads-table__cell--muted">{lead.address ?? '—'}</span>,
    },
    {
      key: 'phone',
      header: 'Telefone',
      render: (lead) => <span className="leads-table__cell--muted">{lead.phone ?? lead.phoneUnformatted ?? '—'}</span>,
    },
    {
      key: 'score',
      header: 'Score',
      align: 'center',
      render: (lead) => <span className="leads-table__score">{lead.score}</span>,
    },
    {
      key: 'temperature',
      header: 'Temp.',
      align: 'center',
      render: (lead) => (
        <Badge tone={getTemperatureTone(lead.temperature)} size="small">
          {getTemperatureEmoji(lead.temperature)}
        </Badge>
      ),
    },
    {
      key: 'nextAction',
      header: 'Próxima ação',
      render: (lead) => <span className="leads-table__cell--muted">{lead.kanbanState.nextAction ?? '—'}</span>,
    },
    {
      key: 'dueDate',
      header: 'Follow-up',
      align: 'center',
      render: (lead) => <span className="leads-table__cell--muted">{formatDate(lead.kanbanState.dueDate)}</span>,
    },
    {
      key: 'actions',
      header: '',
      align: 'end',
      render: (lead) => (
        <LeadActionsMenu
          title={lead.title}
          onOpen={() => onLeadClick(lead)}
          onEdit={() => onEditLead(lead)}
          onDelete={() => { setDeleteError(null); setDeletingLead(lead) }}
        />
      ),
    },
  ]

  return (
    <div className="leads-table">
      {deleteError && <Alert tone="danger" title="Não foi possível excluir">{deleteError}</Alert>}
      <ConfirmDialog
        open={!!deletingLead}
        onClose={() => { if (!deleting) setDeletingLead(null) }}
        onConfirm={async () => {
          if (!deletingLead || deleting) return
          setDeleting(true)
          setDeleteError(null)
          try {
            await onDeleteLead(deletingLead)
            setDeletingLead(null)
          } catch (error) {
            setDeleteError(error instanceof Error ? error.message : 'Não foi possível excluir o lead')
          } finally { setDeleting(false) }
        }}
        title="Excluir lead"
        description={`Excluir “${deletingLead?.title ?? ''}”? Esta ação remove o lead e suas informações.`}
        confirmLabel={deleting ? 'Excluindo...' : 'Excluir lead'}
        tone="danger"
      />
      <div className="leads-table__tabs">
        <Tabs
          items={tabItems}
          value={effectiveColumn}
          onChange={(value) => setActiveColumn(value as ColumnId)}
        />
      </div>
      <DataTable
        columns={columns}
        rows={leadsByColumn[effectiveColumn]}
        rowKey={(lead) => lead.placeId}
        emptyState={
          <p className="leads-table__empty">Nenhum lead encontrado nesta etapa. Ajuste os filtros ou importe novos leads.</p>
        }
      />
    </div>
  )
}
