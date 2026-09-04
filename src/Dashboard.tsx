import { Badge, Button, Card, Icon } from 'codexa-ui'
import type { IconName } from 'codexa-ui'

import type { ColumnId, LeadWithMeta } from './types'

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
}

const formatNumber = new Intl.NumberFormat('pt-BR')

function percentage(value: number, total: number) {
  return total === 0 ? 0 : Math.round((value / total) * 100)
}

export default function Dashboard({ leads, columns, onOpenKanban }: DashboardProps) {
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
          <Badge tone="success" size="small">Visão geral</Badge>
          <h2 id="dashboard-title">Acompanhe seu funil comercial</h2>
          <p>Métricas atualizadas com os status atuais dos leads.</p>
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
