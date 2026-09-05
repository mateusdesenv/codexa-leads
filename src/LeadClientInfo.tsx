import { Card, Badge, Tag, Icon, Link } from 'codexa-ui'
import type { LeadWithMeta } from './types'

const WEBSITE_KIND: Record<LeadWithMeta['websiteKind'], { label: string; tone: 'success' | 'warning' | 'neutral' }> = {
  proprio: { label: 'Próprio', tone: 'success' },
  social: { label: 'Rede social', tone: 'warning' },
  sem: { label: 'Sem site', tone: 'neutral' },
}

function formatWebsite(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function getPhoneHref(phone: string, phoneUnformatted: string | null | undefined): string {
  const unformatted = phoneUnformatted ?? phone.replace(/\D/g, '')
  return `tel:${unformatted}`
}

function getWebsiteHref(website: string): string {
  return website.match(/^https?:\/\//) ? website : `https://${website}`
}

interface LeadClientInfoProps {
  lead: LeadWithMeta
}

export default function LeadClientInfo({ lead }: LeadClientInfoProps) {
  const websiteHref = lead.website ? getWebsiteHref(lead.website) : null
  const phoneHref = lead.phone ? getPhoneHref(lead.phone, lead.phoneUnformatted) : null

  return (
    <Card className="lead-client-info" padding="medium" as="article">
      <h4 className="lead-client-info__title">Dados do cliente</h4>

      <div className="lead-client-info__grid">
        <div className="lead-client-info__item">
          <span className="lead-client-info__label">Nome</span>
          <span className="lead-client-info__value">{lead.title}</span>
        </div>

        {lead.subTitle && (
          <div className="lead-client-info__item">
            <span className="lead-client-info__label">Subtítulo</span>
            <span className="lead-client-info__value">{lead.subTitle}</span>
          </div>
        )}

        {lead.categoryName && (
          <div className="lead-client-info__item">
            <span className="lead-client-info__label">Categoria</span>
            <Tag tone="neutral">
              {lead.categoryName}
            </Tag>
          </div>
        )}

        {lead.phone && (
          <div className="lead-client-info__item">
            <span className="lead-client-info__label">Telefone</span>
            <Link href={phoneHref ?? undefined} variant="subtle">
              <Icon name="send" size={14} /> {lead.phone}
            </Link>
          </div>
        )}

        {lead.website && websiteHref && (
          <div className="lead-client-info__item lead-client-info__item--wide">
            <span className="lead-client-info__label">Site</span>
            <div className="lead-client-info__website">
              <Link href={websiteHref ?? undefined} variant="subtle" external>
                <Icon name="external-link" size={14} /> {formatWebsite(lead.website)}
              </Link>
              <Badge tone={WEBSITE_KIND[lead.websiteKind].tone} size="small">
                {WEBSITE_KIND[lead.websiteKind].label}
              </Badge>
            </div>
          </div>
        )}

        {lead.address && (
          <div className="lead-client-info__item lead-client-info__item--wide">
            <span className="lead-client-info__label">Endereço</span>
            <span className="lead-client-info__value">{lead.address}</span>
          </div>
        )}

        {lead.street && (
          <div className="lead-client-info__item lead-client-info__item--wide">
            <span className="lead-client-info__label">Rua</span>
            <span className="lead-client-info__value">{lead.street}</span>
          </div>
        )}

        {lead.neighborhood && (
          <div className="lead-client-info__item">
            <span className="lead-client-info__label">Bairro</span>
            <span className="lead-client-info__value">{lead.neighborhood}</span>
          </div>
        )}

        {lead.city && (
          <div className="lead-client-info__item">
            <span className="lead-client-info__label">Cidade</span>
            <span className="lead-client-info__value">{lead.city}</span>
          </div>
        )}

        {lead.state && (
          <div className="lead-client-info__item">
            <span className="lead-client-info__label">Estado</span>
            <span className="lead-client-info__value">{lead.state}</span>
          </div>
        )}

        {lead.postalCode && (
          <div className="lead-client-info__item">
            <span className="lead-client-info__label">CEP</span>
            <span className="lead-client-info__value">{lead.postalCode}</span>
          </div>
        )}

        {lead.totalScore !== null && lead.totalScore !== undefined && (
          <div className="lead-client-info__item">
            <span className="lead-client-info__label">Avaliação</span>
            <span className="lead-client-info__value">
              <Icon name="star" size={14} /> {lead.totalScore.toFixed(1)} ({lead.reviewsCount ?? 0} avaliações)
            </span>
          </div>
        )}

        {lead.permanentlyClosed ? (
          <div className="lead-client-info__item">
            <span className="lead-client-info__label">Status</span>
            <Badge tone="danger" size="small">
              Fechado permanentemente
            </Badge>
          </div>
        ) : lead.temporarilyClosed ? (
          <div className="lead-client-info__item">
            <span className="lead-client-info__label">Status</span>
            <Badge tone="warning" size="small">
              Fechado temporariamente
            </Badge>
          </div>
        ) : (
          <div className="lead-client-info__item">
            <span className="lead-client-info__label">Status</span>
            <Badge tone="success" size="small">
              Em atividade
            </Badge>
          </div>
        )}

        {lead.groupTitle && (
          <div className="lead-client-info__item">
            <span className="lead-client-info__label">Lista</span>
            <Tag tone="neutral">
              {lead.groupTitle}
            </Tag>
          </div>
        )}

        {lead.categories.length > 0 && (
          <div className="lead-client-info__item lead-client-info__item--wide">
            <span className="lead-client-info__label">Categorias</span>
            <div className="lead-client-info__tags">
              {lead.categories.map((category) => (
                <Tag key={category} tone="neutral">
                  {category}
                </Tag>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
