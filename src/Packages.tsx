import { DataTable } from 'codexa-ui'
import type { DataTableColumn } from 'codexa-ui'

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
  const columns: DataTableColumn<Package>[] = [
    {
      key: 'name',
      header: 'Pacote',
      render: (pkg) => <span className="packages__name">{pkg.name}</span>,
    },
    {
      key: 'includes',
      header: 'Inclui',
      render: (pkg) => <span className="packages__includes">{pkg.includes}</span>,
    },
    {
      key: 'value',
      header: 'Valor',
      align: 'end',
      render: (pkg) => <span className="packages__value">{formatCurrency(pkg.value)}</span>,
    },
  ]

  return (
    <div className="packages-page">
      <header className="packages-page__header">
        <h2>Pacotes Codexa</h2>
        <p>Opções de sites e presença digital para clínicas de estética</p>
      </header>

      <DataTable
        columns={columns}
        rows={PACKAGES}
        rowKey={(pkg) => pkg.name}
        emptyState={<p className="packages-page__empty">Nenhum pacote encontrado.</p>}
      />
    </div>
  )
}
