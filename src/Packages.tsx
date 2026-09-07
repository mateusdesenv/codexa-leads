import { Card, Badge, Button, Icon } from 'codexa-ui'

interface Package {
  name: string
  label: string
  description: string
  included: string[]
  excluded: string[]
  value: number
  featured?: boolean
}

const PACKAGES: Package[] = [
  {
    name: 'Codexa Start',
    label: 'Para começar',
    description: 'Uma presença objetiva para apresentar sua oferta e captar novos contatos.',
    included: [
      'Landing page de 1 página',
      'Estrutura em página única',
    ],
    excluded: [
      'Site institucional multipágina',
      'Árvore de links personalizada',
    ],
    value: 797,
  },
  {
    name: 'Site Institucional Essencial',
    label: 'Estrutura essencial',
    description: 'O formato ideal para organizar as informações centrais da clínica.',
    included: [
      'Site institucional multipágina',
      'Até 3 telas/páginas',
    ],
    excluded: [
      'Estrutura expandida de até 7 páginas',
      'Árvore de links personalizada',
    ],
    value: 1500,
  },
  {
    name: 'Site Institucional Completo',
    label: 'Mais conteúdo',
    description: 'Mais espaço para apresentar serviços, diferenciais e gerar confiança.',
    included: [
      'Site institucional multipágina',
      'Até 7 telas/páginas',
    ],
    excluded: [
      'Árvore de links personalizada',
    ],
    value: 2000,
  },
  {
    name: 'Presença Digital Completa',
    label: 'Ecossistema completo',
    description: 'Site e canais digitais conectados em uma experiência visual consistente.',
    included: [
      'Site institucional multipágina',
      'Até 7 telas/páginas',
      'Árvore de links personalizada',
      'Identidade visual da clínica na árvore de links',
    ],
    excluded: [],
    value: 2500,
    featured: true,
  },
]

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export default function Packages() {
  return (
    <div className="packages-page">
      <header className="packages-page__header">
        <span className="packages-page__eyebrow">Soluções Codexa</span>
        <h2>Presença digital que transforma interesse em agenda.</h2>
        <p>Escolha o formato ideal para cada etapa de crescimento da clínica.</p>
      </header>

      <div className="packages__grid">
        {PACKAGES.map((pkg) => (
          <Card
            key={pkg.name}
            className={`packages__card ${pkg.featured ? 'packages__card--featured' : ''}`}
            padding="large"
            as="article"
          >
            <header className="packages__card-header">
              <div className="packages__card-topline">
                <div className="packages__card-icon" aria-hidden="true">
                  <Icon name={pkg.featured ? 'star' : 'file'} size={24} />
                </div>

                {pkg.featured && (
                  <div className="packages__badge">
                    <Badge tone="success" size="small">
                      Mais popular
                    </Badge>
                  </div>
                )}
              </div>

              <span className="packages__card-label">{pkg.label}</span>
              <h3 className="packages__card-title">{pkg.name}</h3>
              <p className="packages__card-description">{pkg.description}</p>
            </header>

            <div className="packages__card-price">
              <span className="packages__card-amount">{formatCurrency(pkg.value)}</span>
              <span className="packages__card-period">por projeto</span>
            </div>

            <div className="packages__card-features">
              <section className="packages__feature-group" aria-label={`Itens incluídos no pacote ${pkg.name}`}>
                <div className="packages__feature-heading">
                  <h4>O que está incluído</h4>
                  <span>{pkg.included.length}</span>
                </div>
                <ul className="packages__feature-list">
                  {pkg.included.map((feature) => (
                    <li key={feature}>
                      <span className="packages__feature-icon packages__feature-icon--included" aria-hidden="true">
                        <Icon name="check" size={13} />
                      </span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className={`packages__feature-group ${pkg.excluded.length === 0 ? 'packages__feature-group--complete' : ''}`} aria-label={`Itens não incluídos no pacote ${pkg.name}`}>
                <div className="packages__feature-heading">
                  <h4>O que não está incluído</h4>
                  <span>{pkg.excluded.length}</span>
                </div>
                {pkg.excluded.length > 0 ? (
                  <ul className="packages__feature-list packages__feature-list--excluded">
                    {pkg.excluded.map((feature) => (
                      <li key={feature}>
                        <span className="packages__feature-icon packages__feature-icon--excluded" aria-hidden="true">
                          <Icon name="x" size={12} />
                        </span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="packages__feature-complete">
                    <Icon name="check-circle" size={17} />
                    Nenhum item deste comparativo fica de fora.
                  </p>
                )}
              </section>
            </div>

            <Button
              type="button"
              className="packages__card-cta"
              variant="primary"
              fullWidth
              trailingIcon={<Icon name="arrow-right" size={16} />}
            >
              Escolher pacote
            </Button>
          </Card>
        ))}
      </div>
    </div>
  )
}
