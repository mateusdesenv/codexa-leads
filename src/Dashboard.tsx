import { Badge, Button, Card, Icon } from 'codexa-ui'
import type { IconName } from 'codexa-ui'
import type { CSSProperties } from 'react'

import type { ColumnId, LeadWithMeta } from './types'
import { formatCalendarDate } from './date'

type DashboardColumn = {
  id: ColumnId
  label: string
  color: string
  icon: IconName
}

type DashboardProps = {
  leads: LeadWithMeta[]
  columns: DashboardColumn[]
  onOpenKanban: () => void
  onOpenLead: (lead: LeadWithMeta) => void
}

const formatNumber = new Intl.NumberFormat('pt-BR')
const longDateFormatter = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: '2-digit',
  month: 'long',
})

function toLocalDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(date: Date, amount: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + amount)
  return result
}

function getDateKey(value?: string): string {
  return value?.slice(0, 10) ?? ''
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function percentage(value: number, total: number) {
  return total === 0 ? 0 : Math.round((value / total) * 100)
}

export default function Dashboard({ leads, columns, onOpenKanban, onOpenLead }: DashboardProps) {
  const total = leads.length
  const counts = columns.reduce(
    (acc, column) => ({
      ...acc,
      [column.id]: leads.filter((lead) => lead.kanbanState.column === column.id).length,
    }),
    {} as Record<ColumnId, number>,
  )

  const open = counts.open
  const inProgress = total - counts.open - counts.fechado - counts.perdido
  const closed = counts.fechado
  const conversionRate = percentage(closed, total)
  const contacted = total - counts.open
  const conversations = counts.contato + counts.conversa + counts.followup + counts.proposta + counts.negociacao + counts.fechado
  const opportunities = counts.proposta + counts.negociacao + counts.fechado
  const today = new Date()
  const todayKey = toLocalDateKey(today)
  const nextSevenDaysKey = toLocalDateKey(addDays(today, 7))
  const activeLeads = leads.filter(
    (lead) => lead.kanbanState.column !== 'fechado' && lead.kanbanState.column !== 'perdido',
  )
  const scheduledReturns = activeLeads
    .filter((lead) => getDateKey(lead.kanbanState.returnDate))
    .sort((a, b) => getDateKey(a.kanbanState.returnDate).localeCompare(getDateKey(b.kanbanState.returnDate)))
  const returnsToday = scheduledReturns.filter(
    (lead) => getDateKey(lead.kanbanState.returnDate) === todayKey,
  )
  const overdueReturns = scheduledReturns.filter(
    (lead) => getDateKey(lead.kanbanState.returnDate) < todayKey,
  )
  const upcomingReturns = scheduledReturns.filter(
    (lead) => getDateKey(lead.kanbanState.returnDate) > todayKey,
  )
  const returnsNextSevenDays = upcomingReturns.filter(
    (lead) => getDateKey(lead.kanbanState.returnDate) <= nextSevenDaysKey,
  )
  const nextReturns = upcomingReturns.slice(0, 5)
  const columnById = new Map(columns.map((column) => [column.id, column]))

  let cursor = 0
  const donutStops = columns.map((column) => {
    const start = cursor
    cursor += total === 0 ? 0 : (counts[column.id] / total) * 100
    return `${column.color} ${start}% ${cursor}%`
  })
  const donutBackground = total > 0
    ? `conic-gradient(${donutStops.join(', ')})`
    : 'var(--ds-line)'

  const funnel = [
    { label: 'Contato iniciado', value: contacted, color: '#3B82F6' },
    { label: 'Contato estabelecido', value: conversations, color: '#8B5CF6' },
    { label: 'Oportunidades', value: opportunities, color: '#F59E0B' },
    { label: 'Clientes fechados', value: closed, color: '#25BF44' },
  ]

  return (
    <section className="dashboard" aria-labelledby="dashboard-title">
      <Card className="dashboard__hero" padding="large">
        <div>
          <Badge tone="success" size="small">{capitalize(longDateFormatter.format(today))}</Badge>
          <h2 id="dashboard-title">Seu dia comercial começa aqui</h2>
          <p>Priorize os retornos de hoje e mantenha as próximas oportunidades em movimento.</p>
        </div>
        <Button
          type="button"
          variant="primary"
          onClick={onOpenKanban}
          leadingIcon={<Icon name="arrow-right" size={18} />}
        >
          Abrir Kanban
        </Button>
      </Card>

      <div className="dashboard__agenda-summary" aria-label="Resumo das próximas tarefas">
        <Card className="dashboard-agenda-metric dashboard-agenda-metric--today" padding="medium">
          <span className="dashboard-agenda-metric__icon" aria-hidden="true">
            <Icon name="calendar" size={20} />
          </span>
          <div>
            <span>Retornos hoje</span>
            <strong>{formatNumber.format(returnsToday.length)}</strong>
          </div>
          <small>{returnsToday.length === 1 ? 'conversa para retomar' : 'conversas para retomar'}</small>
        </Card>
        <Card className="dashboard-agenda-metric dashboard-agenda-metric--overdue" padding="medium">
          <span className="dashboard-agenda-metric__icon" aria-hidden="true">
            <Icon name="warning" size={20} />
          </span>
          <div>
            <span>Retornos atrasados</span>
            <strong>{formatNumber.format(overdueReturns.length)}</strong>
          </div>
          <small>{overdueReturns.length > 0 ? 'pedem atenção prioritária' : 'nenhuma pendência vencida'}</small>
        </Card>
        <Card className="dashboard-agenda-metric dashboard-agenda-metric--upcoming" padding="medium">
          <span className="dashboard-agenda-metric__icon" aria-hidden="true">
            <Icon name="arrow-right" size={20} />
          </span>
          <div>
            <span>Próximos 7 dias</span>
            <strong>{formatNumber.format(returnsNextSevenDays.length)}</strong>
          </div>
          <small>{returnsNextSevenDays.length === 1 ? 'retorno já programado' : 'retornos já programados'}</small>
        </Card>
      </div>

      <div className="dashboard__agenda">
        <Card className="dashboard-agenda" padding="large" as="article">
          <div className="dashboard-agenda__header">
            <div>
              <span className="dashboard-agenda__eyebrow">Prioridade do dia</span>
              <h3>Retornos de hoje</h3>
              <p>Leads com data de retorno marcada para {formatCalendarDate(todayKey)}.</p>
            </div>
            <Badge tone={returnsToday.length > 0 ? 'warning' : 'success'} size="small">
              {returnsToday.length > 0 ? `${returnsToday.length} pendente${returnsToday.length === 1 ? '' : 's'}` : 'Tudo em dia'}
            </Badge>
          </div>

          {returnsToday.length > 0 ? (
            <ul className="dashboard-task-list" aria-label="Leads com retorno para hoje">
              {returnsToday.map((lead) => {
                const column = columnById.get(lead.kanbanState.column)
                return (
                  <li key={lead.placeId}>
                    <button type="button" className="dashboard-task" onClick={() => onOpenLead(lead)}>
                      <span className="dashboard-task__icon" aria-hidden="true">
                        <Icon name="message" size={18} />
                      </span>
                      <span className="dashboard-task__content">
                        <strong>{lead.title}</strong>
                        <small>{lead.kanbanState.nextAction || 'Retomar o contato comercial'}</small>
                        <span className="dashboard-task__meta">
                          {lead.groupTitle && <span>{lead.groupTitle}</span>}
                          {lead.categoryName && <span>{lead.categoryName}</span>}
                        </span>
                      </span>
                      <span className="dashboard-task__status">
                        <span style={{ '--task-color': column?.color ?? 'var(--ds-green)' } as CSSProperties}>
                          {column?.label ?? 'Em andamento'}
                        </span>
                        <small>Ver lead <Icon name="arrow-right" size={14} /></small>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className="dashboard-agenda__empty">
              <span aria-hidden="true"><Icon name="check-circle" size={24} /></span>
              <div>
                <strong>Nenhum retorno marcado para hoje</strong>
                <p>Sua agenda está livre. Aproveite para avançar os próximos leads do funil.</p>
              </div>
            </div>
          )}
        </Card>

        <Card className="dashboard-upcoming" padding="large" as="article">
          <div className="dashboard-agenda__header">
            <div>
              <span className="dashboard-agenda__eyebrow">Na sequência</span>
              <h3>Próximos retornos</h3>
              <p>Sua agenda comercial depois de hoje.</p>
            </div>
          </div>

          {nextReturns.length > 0 ? (
            <ol className="dashboard-upcoming__list">
              {nextReturns.map((lead) => (
                <li key={lead.placeId}>
                  <button type="button" onClick={() => onOpenLead(lead)}>
                    <time dateTime={lead.kanbanState.returnDate}>
                      <strong>{formatCalendarDate(lead.kanbanState.returnDate).slice(0, 5)}</strong>
                      <span>{getDateKey(lead.kanbanState.returnDate) <= nextSevenDaysKey ? 'em breve' : 'agendado'}</span>
                    </time>
                    <span>
                      <strong>{lead.title}</strong>
                      <small>{lead.kanbanState.nextAction || lead.groupTitle || 'Retorno comercial'}</small>
                    </span>
                    <Icon name="arrow-right" size={15} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <div className="dashboard-upcoming__empty">
              <Icon name="calendar" size={20} />
              <p>Nenhum próximo retorno agendado.</p>
            </div>
          )}

          <Button type="button" variant="secondary" fullWidth onClick={onOpenKanban}>
            Organizar no Kanban
          </Button>
        </Card>
      </div>

      <div className="dashboard__metrics" aria-label="Principais métricas">
        <Card className="dashboard-metric" padding="medium">
          <span className="dashboard-metric__icon dashboard-metric__icon--total" aria-hidden="true">
            <Icon name="users" size={20} />
          </span>
          <span className="dashboard-metric__label">Total de leads</span>
          <strong>{formatNumber.format(total)}</strong>
          <small>Base comercial completa</small>
        </Card>
        <Card className="dashboard-metric" padding="medium">
          <span className="dashboard-metric__icon dashboard-metric__icon--open" aria-hidden="true">
            <Icon name="plus" size={20} />
          </span>
          <span className="dashboard-metric__label">Novos no funil</span>
          <strong>{formatNumber.format(open)}</strong>
          <small>{percentage(open, total)}% aguardam primeiro contato</small>
        </Card>
        <Card className="dashboard-metric" padding="medium">
          <span className="dashboard-metric__icon dashboard-metric__icon--progress" aria-hidden="true">
            <Icon name="refresh" size={20} />
          </span>
          <span className="dashboard-metric__label">Em andamento</span>
          <strong>{formatNumber.format(inProgress)}</strong>
          <small>{percentage(inProgress, total)}% em etapas intermediárias</small>
        </Card>
        <Card className="dashboard-metric" padding="medium">
          <span className="dashboard-metric__icon dashboard-metric__icon--closed" aria-hidden="true">
            <Icon name="check-circle" size={20} />
          </span>
          <span className="dashboard-metric__label">Clientes fechados</span>
          <strong>{formatNumber.format(closed)}</strong>
          <small>{conversionRate}% de conversão total</small>
        </Card>
      </div>

      <div className="dashboard__charts">
        <Card className="dashboard-chart" padding="large" as="article">
          <div className="dashboard-chart__header">
            <div>
              <h3>Distribuição por status</h3>
              <p>Onde os leads estão agora.</p>
            </div>
            <Badge tone="neutral" size="small">{formatNumber.format(total)} leads</Badge>
          </div>

          <div className="dashboard-distribution">
            <div
              className="dashboard-donut"
              style={{ background: donutBackground }}
              role="img"
              aria-label={`Distribuição dos ${total} leads pelos status do funil`}
            >
              <span>
                <strong>{formatNumber.format(total)}</strong>
                <small>leads</small>
              </span>
            </div>

            <ul className="dashboard-legend" aria-label="Leads por status">
              {columns.map((column) => (
                <li key={column.id}>
                  <span className="dashboard-legend__dot" style={{ backgroundColor: column.color }} aria-hidden="true" />
                  <span className="dashboard-legend__label">{column.label}</span>
                  <strong>{formatNumber.format(counts[column.id])}</strong>
                  <small>{percentage(counts[column.id], total)}%</small>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <Card className="dashboard-chart" padding="large" as="article">
          <div className="dashboard-chart__header">
            <div>
              <h3>Avanço do funil</h3>
              <p>Progressão acumulada entre as principais etapas.</p>
            </div>
          </div>

          <div className="dashboard-funnel">
            {funnel.map((stage) => {
              const valuePercentage = percentage(stage.value, total)
              return (
                <div className="dashboard-funnel__item" key={stage.label}>
                  <div className="dashboard-funnel__meta">
                    <span>{stage.label}</span>
                    <strong>{formatNumber.format(stage.value)} <small>({valuePercentage}%)</small></strong>
                  </div>
                  <div
                    className="dashboard-funnel__track"
                    role="progressbar"
                    aria-label={stage.label}
                    aria-valuemin={0}
                    aria-valuemax={total}
                    aria-valuenow={stage.value}
                  >
                    <span
                      className="dashboard-funnel__fill"
                      style={{ width: `${valuePercentage}%`, backgroundColor: stage.color }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          <div className="dashboard-chart__summary">
            <Icon name="info" size={18} />
            <p>A conversão considera clientes fechados em relação ao total de leads da base.</p>
          </div>
        </Card>
      </div>
    </section>
  )
}
