import { DataTable } from 'codexa-ui'
import type { DataTableColumn } from 'codexa-ui'
import { Badge, Button, Icon } from 'codexa-ui'

import type { ColumnId, LeadWithMeta, Temperature } from './types'

type TableLead = LeadWithMeta

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

export default function LeadsTable({
  leads,
  onLeadClick,
}: {
  leads: TableLead[]
  onLeadClick: (lead: TableLead) => void
}) {
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
      key: 'column',
      header: 'Etapa',
      render: (lead) => <span className="leads-table__stage">{COLUMN_LABELS[lead.kanbanState.column]}</span>,
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
      <DataTable
        columns={columns}
        rows={leads}
        rowKey={(lead) => lead.placeId}
        emptyState={
          <p className="leads-table__empty">Nenhum lead encontrado. Ajuste os filtros ou importe novos leads.</p>
        }
      />
    </div>
  )
}
