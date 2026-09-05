import { Card, Badge, Button, Icon } from 'codexa-ui'

interface Package {
  name: string
  includes: string
  value: number
}

const PACKAGES: Package[] = [
  {
    name: 'Codexa Start',
    includes: 'Landing page de 1 página',
    value: 797,
  },
  {
    name: 'Site Institucional Essencial',
    includes: 'Site institucional com até 3 telas/páginas',
    value: 1500,
  },
  {
    name: 'Site Institucional Completo',
    includes: 'Site institucional com até 7 telas/páginas',
    value: 2000,
  },
  {
    name: 'Presença Digital Completa',
    includes: 'Site institucional com até 7 telas/páginas + árvore de links personalizada com a identidade visual da clínica',
    value: 2500,
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
            className={`packages__card ${pkg.name === 'Presença Digital Completa' ? 'packages__card--featured' : ''}`}
            padding="large"
            as="article"
          >
            {pkg.name === 'Presença Digital Completa' && (
              <div className="packages__badge">
                <Badge tone="success" size="small">
                  Mais popular
                </Badge>
              </div>
            )}

            <div className="packages__card-icon" aria-hidden="true">
              <Icon name="file" size={32} />
            </div>

            <h3 className="packages__card-title">{pkg.name}</h3>
            <p className="packages__card-description">{pkg.includes}</p>

            <div className="packages__card-price">
              <span className="packages__card-amount">{formatCurrency(pkg.value)}</span>
              <span className="packages__card-period">por projeto</span>
            </div>

            <Button
              type="button"
              variant="primary"
              fullWidth
              leadingIcon={<Icon name="arrow-right" size={16} />}
            >
              Escolher pacote
            </Button>
          </Card>
        ))}
      </div>
    </div>
  )
}
