import { useMemo, useState } from 'react'
import { DataTable, Tabs } from 'codexa-ui'
import type { DataTableColumn, TabItem } from 'codexa-ui'
import { Badge, Button, Icon } from 'codexa-ui'

import type { ColumnId, LeadWithMeta, Temperature } from './types'

type TableLead = LeadWithMeta

const COLUMN_ORDER: ColumnId[] = [
  'open',
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
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString('pt-BR')
  } catch {
    return value
  }
}

const INITIAL_BY_COLUMN: Record<ColumnId, LeadWithMeta[]> = {
  open: [],
  contato: [],
  conversa: [],
  followup: [],
  proposta: [],
  negociacao: [],
  fechado: [],
  perdido: [],
}

export default function LeadsTable({
  leads,
  onLeadClick,
}: {
  leads: TableLead[]
  onLeadClick: (lead: TableLead) => void
}) {
  const [activeColumn, setActiveColumn] = useState<ColumnId>('open')

  const leadsByColumn = useMemo(() => {
    const map = { ...INITIAL_BY_COLUMN }
    leads.forEach((lead) => {
      map[lead.kanbanState.column].push(lead)
    })
    COLUMN_ORDER.forEach((column) => {
      map[column].sort((a, b) => b.score - a.score)
    })
    return map
  }, [leads])

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
        <Button
          type="button"
          variant="ghost"
          size="small"
          onClick={() => onLeadClick(lead)}
          leadingIcon={<Icon name="edit" size={16} />}
        >
          Abrir
        </Button>
      ),
    },
  ]

  return (
    <div className="leads-table">
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
