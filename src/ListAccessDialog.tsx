import { useEffect, useState } from 'react'
import { Alert, Button, Dialog } from 'codexa-ui'
import { AccessEditor, type AccessSnapshot } from './UserManagement'
import { loadAccess } from './access-api'
import type { LeadGroup } from './LeadGroupsTable'
export default function ListAccessDialog({
  group,
  onClose,
  onSaved,
}: {
  group: LeadGroup
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [data, setData] = useState<AccessSnapshot | null>(null),
    [error, setError] = useState('')
  useEffect(() => {
    let active = true
    void loadAccess()
      .then((d) => {
        if (active) setData(d)
      })
      .catch(() => {
        if (active) setError('Não foi possível carregar os acessos.')
      })
    return () => {
      active = false
    }
  }, [])
  const list = data?.groups.find((g) => g.groupId === group.groupId)
  if (!data || !list)
    return (
      <Dialog open title="Equipe e acesso" onClose={onClose}>
        {error ? (
          <Alert tone="danger">{error}</Alert>
        ) : (
          <p>
            {data
              ? 'Lista indisponível. Atualize a página.'
              : 'Carregando equipe...'}
          </p>
        )}
        <Button onClick={onClose}>Fechar</Button>
      </Dialog>
    )
  return (
    <AccessEditor
      data={data}
      list={list}
      onClose={onClose}
      onSaved={() => {
        void onSaved()
      }}
    />
  )
}
