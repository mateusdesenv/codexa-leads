import { useEffect, useState } from 'react'
import { Alert, Button, Card, Dialog, Input, ConfirmDialog } from 'codexa-ui'
import { apiFetch } from './api'
import { loadAccess, saveAccess } from './access-api'
import type { SessionUser } from './session'
export type Person = {
  uid: string
  email: string
  displayName: string
  role: 'admin' | 'operator' | 'reader'
  isAdmin: boolean
  legacy: boolean
  accessStatus: string
}
export type ManagedList = {
  groupId: string
  groupTitle: string
  viewerUids: string[]
  assignees: { uid: string; name: string }[]
  archivedAt?: string | null
}
export type AccessSnapshot = {
  revision: number
  users: Person[]
  groups: ManagedList[]
}
const roleName = (p: Person) =>
  p.isAdmin ? 'Administrador' : p.role === 'operator' ? 'Operador' : 'Consulta'
const who = (p: Person) => p.displayName || p.email
export function AccessEditor({
  data,
  person,
  list,
  onClose,
  onSaved,
}: {
  data: AccessSnapshot
  person?: Person
  list?: ManagedList
  onClose: () => void
  onSaved: (next: AccessSnapshot) => void
}) {
  const [profile, setProfile] = useState(
    person?.role === 'operator' ? 'operator' : 'reader',
  )
  const [status, setStatus] = useState(person?.accessStatus || 'approved')
  const [selected, setSelected] = useState(
    person
      ? data.groups
          .filter((g) => !g.archivedAt && g.viewerUids.includes(person.uid))
          .map((g) => g.groupId)
      : list?.viewerUids || [],
  )
  const [responsible, setResponsible] = useState(
    person
      ? data.groups
          .filter(
            (g) =>
              !g.archivedAt && g.assignees.some((a) => a.uid === person.uid),
          )
          .map((g) => g.groupId)
      : list?.assignees.map((a) => a.uid) || [],
  )
  const [saving, setSaving] = useState(false),
    [error, setError] = useState(''),
    [dirty, setDirty] = useState(false),
    [discard, setDiscard] = useState(false)
  const toggle = (values: string[], id: string, checked: boolean) =>
    checked ? [...new Set([...values, id])] : values.filter((x) => x !== id)
  const close = () => {
    if (saving) return
    if (dirty) setDiscard(true)
    else onClose()
  }
  const options = person
    ? data.groups
        .filter((g) => !g.archivedAt)
        .map((g) => ({
          id: g.groupId,
          title: g.groupTitle,
          subtitle: '',
          eligible: profile === 'operator' && status === 'approved',
          owner: false,
          active: true,
        }))
    : data.users.map((p) => ({
        id: p.uid,
        title: who(p),
        subtitle: `${p.email} · ${roleName(p)}${p.accessStatus === 'suspended' ? ' · Suspenso' : ''}`,
        eligible:
          p.isAdmin || (p.role === 'operator' && p.accessStatus === 'approved'),
        owner: p.isAdmin,
        active: p.accessStatus === 'approved',
      }))
  const invalid = responsible.some((id) => {
    const p = options.find((o) => o.id === id)
    return !p || !p.eligible || (!p.owner && !selected.includes(id))
  })
  const submit = async () => {
    setSaving(true)
    setError('')
    try {
      const next = await saveAccess(
        person
          ? `/api/admin/users/${encodeURIComponent(person.uid)}/access`
          : `/api/admin/lists/${encodeURIComponent(list!.groupId)}/access`,
        person
          ? {
              revision: data.revision,
              role: profile,
              accessStatus: status,
              listIds: selected,
              responsibleListIds: responsible,
            }
          : {
              revision: data.revision,
              viewerUids: selected,
              assigneeUids: responsible,
            },
      )
      onSaved(next)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar.')
    } finally {
      setSaving(false)
    }
  }
  return (
    <>
      <Dialog
        open
        title={
          person ? `Acesso de ${who(person)}` : `Equipe de ${list?.groupTitle}`
        }
        onClose={close}
      >
        <div className="access-editor">
          <p>
            {person
              ? person.email
              : 'Selecione quem acessa a lista e quem trabalha nela. O administrador sempre tem acesso.'}
          </p>
          {person && (
            <div className="access-profile-fields">
              <label>
                Perfil
                <select
                  value={profile}
                  disabled={saving}
                  onChange={(e) => {
                    setProfile(e.target.value)
                    setDirty(true)
                    if (e.target.value === 'reader') setResponsible([])
                  }}
                >
                  <option value="reader">Consulta — visualizar</option>
                  <option value="operator">
                    Operador — trabalhar nos leads
                  </option>
                </select>
              </label>
              <label>
                Situação
                <select
                  value={status}
                  disabled={saving}
                  onChange={(e) => {
                    setStatus(e.target.value)
                    setDirty(true)
                    if (e.target.value === 'suspended') setResponsible([])
                  }}
                >
                  <option value="approved">Ativo</option>
                  <option value="suspended">Suspenso no Leads</option>
                </select>
              </label>
            </div>
          )}
          <p className="access-editor__note">
            {person
              ? `${selected.length} lista(s) selecionada(s). ${responsible.length} responsabilidade(s). A entrada no aplicativo continua controlada pelo Hub.`
              : 'Responsáveis precisam de perfil Operador ativo e de acesso à lista. Marcar responsabilidade não concede acesso automaticamente.'}
          </p>
          <div className="access-member-grid">
            <div className="access-member-heading">
              <span>{person ? 'Lista' : 'Pessoa'}</span>
              <span>Acesso</span>
              <span>Responsável</span>
            </div>
            {options.map((o) => (
              <div key={o.id} className="access-member-row">
                <span>
                  <strong>{o.title}</strong>
                  <small>{o.subtitle}</small>
                </span>
                <input
                  aria-label={`Acesso: ${o.title} ${o.subtitle}`}
                  type="checkbox"
                  disabled={
                    saving || o.owner || (!o.active && !selected.includes(o.id))
                  }
                  checked={o.owner || selected.includes(o.id)}
                  onChange={(e) => {
                    setSelected(toggle(selected, o.id, e.target.checked))
                    setDirty(true)
                    if (!e.target.checked)
                      setResponsible((r) => r.filter((id) => id !== o.id))
                  }}
                />
                <input
                  aria-label={`Responsável: ${o.title} ${o.subtitle}`}
                  type="checkbox"
                  disabled={
                    saving ||
                    (!responsible.includes(o.id) &&
                      (!o.eligible || (!o.owner && !selected.includes(o.id))))
                  }
                  checked={responsible.includes(o.id)}
                  onChange={(e) => {
                    setResponsible(toggle(responsible, o.id, e.target.checked))
                    setDirty(true)
                  }}
                />
              </div>
            ))}
          </div>
          {invalid && (
            <Alert tone="warning">
              Há responsáveis sem acesso de operação. Desmarque a
              responsabilidade ou ajuste o perfil e a participação antes de
              salvar.
            </Alert>
          )}
          {person && status === 'suspended' && (
            <Alert tone="warning">
              A pessoa não poderá usar o Leads. O histórico será preservado; as
              responsabilidades selecionadas foram removidas.
            </Alert>
          )}
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="access-editor__actions">
            <Button variant="secondary" disabled={saving} onClick={close}>
              Cancelar
            </Button>
            <Button
              disabled={invalid || !dirty}
              loading={saving}
              onClick={() => void submit()}
            >
              Salvar configuração
            </Button>
          </div>
        </div>
      </Dialog>
      <ConfirmDialog
        open={discard}
        onClose={() => setDiscard(false)}
        onConfirm={onClose}
        title="Descartar alterações?"
        description="A configuração ainda não foi salva."
        confirmLabel="Descartar"
        tone="danger"
      />
    </>
  )
}
export default function UserManagement({
  user,
  administrator = false,
}: {
  user: SessionUser
  administrator?: boolean
  readOnly?: boolean
}) {
  const [data, setData] = useState<AccessSnapshot | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(administrator)
  const [tab, setTab] = useState('people'),
    [search, setSearch] = useState(''),
    [person, setPerson] = useState<Person | null>(null),
    [list, setList] = useState<ManagedList | null>(null)
  const [archive, setArchive] = useState<ManagedList | null>(null),
    [busy, setBusy] = useState(false)
  const [history, setHistory] = useState<
    {
      _id: string
      actor: string
      action: string
      target: string
      createdAt: string
    }[]
  >([])
  const [recovery, setRecovery] = useState<
      { placeId: string; title: string; version?: number }[]
    >([]),
    [recoveryIds, setRecoveryIds] = useState<string[]>([]),
    [destination, setDestination] = useState(''),
    [confirmRecovery, setConfirmRecovery] = useState(false)
  const refresh = async () => {
    setLoading(true)
    setError('')
    try {
      setData(await loadAccess())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    if (!administrator) return
    let cancelled = false
    void loadAccess()
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch((e) => {
        if (!cancelled) setError(e.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [administrator])
  const changeTab = async (next: string) => {
    setTab(next)
    setError('')
    try {
      if (next === 'history') {
        const r = await apiFetch('/api/admin/history')
        if (!r.ok) throw Error('Não foi possível carregar o histórico.')
        setHistory(await r.json())
      }
      if (next === 'recovery') {
        const r = await apiFetch('/api/admin/recovery')
        if (!r.ok) throw Error('Não foi possível carregar os registros.')
        setRecovery((await r.json()).records)
        setRecoveryIds([])
      }
    } catch (e) {
      setError((e as Error).message)
    }
  }
  const archiveList = async () => {
    if (!archive || !data || busy) return
    setBusy(true)
    setError('')
    try {
      setData(
        await saveAccess(
          `/api/admin/lists/${encodeURIComponent(archive.groupId)}/archive`,
          { revision: data.revision, archived: !archive.archivedAt },
          'PATCH',
        ),
      )
      setArchive(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const recover = async () => {
    if (!data || busy) return
    setBusy(true)
    setError('')
    try {
      await saveAccess(
        '/api/admin/recovery',
        {
          revision: data.revision,
          groupId: destination,
          items: recovery
            .filter((r) => recoveryIds.includes(r.placeId))
            .map((r) => ({ placeId: r.placeId, version: r.version ?? 0 })),
        },
        'POST',
      )
      setConfirmRecovery(false)
      await refresh()
      await changeTab('recovery')
    } catch (e) {
      setError((e as Error).message)
      setConfirmRecovery(false)
    } finally {
      setBusy(false)
    }
  }
  const activeLists = data?.groups.filter((g) => !g.archivedAt) || []
  const matches = (s: string) =>
    s.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))
  return (
    <section className="user-management">
      <Card padding="medium">
        <h2>{administrator ? 'Acessos do Leads' : 'Meu acesso'}</h2>
        <p>
          {user.displayName} · {user.email}
        </p>
        <p>
          Sua identidade e a entrada no aplicativo são fornecidas pelo Hub
          Codexa.
        </p>
      </Card>
      {administrator && (
        <>
          <div className="access-toolbar">
            {[
              ['people', 'Pessoas'],
              ['lists', 'Listas'],
              ['archived', 'Arquivadas'],
              ['recovery', 'Recuperação'],
              ['history', 'Histórico'],
            ].map(([id, label]) => (
              <Button
                key={id}
                variant={tab === id ? 'primary' : 'secondary'}
                onClick={() => void changeTab(id)}
              >
                {label}
              </Button>
            ))}
            <Button
              variant="ghost"
              loading={loading}
              onClick={() => void refresh()}
            >
              Atualizar
            </Button>
          </div>
          {error && <Alert tone="danger">{error}</Alert>}
          {['people', 'lists', 'archived'].includes(tab) && (
            <Input
              label="Buscar pessoa ou lista"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          )}
          {loading && !data && <p>Carregando acessos...</p>}
          {data && tab === 'people' && (
            <div className="access-directory">
              {data.users
                .filter((p) => matches(`${who(p)} ${p.email}`))
                .map((p) => {
                  const lists = p.isAdmin
                    ? activeLists
                    : activeLists.filter((g) => g.viewerUids.includes(p.uid))
                  const bad = activeLists.filter(
                    (g) =>
                      g.assignees.some((a) => a.uid === p.uid) &&
                      !p.isAdmin &&
                      (!g.viewerUids.includes(p.uid) ||
                        p.role !== 'operator' ||
                        p.accessStatus !== 'approved'),
                  )
                  const state =
                    p.accessStatus !== 'approved'
                      ? 'Suspenso'
                      : p.isAdmin
                        ? 'Acesso completo'
                        : !lists.length
                          ? 'Sem listas'
                          : p.role === 'operator'
                            ? 'Pode trabalhar'
                            : 'Somente consulta'
                  return (
                    <Card key={p.uid} padding="medium">
                      <div className="access-directory-row">
                        <div>
                          <strong>{who(p)}</strong>
                          <small>{p.email}</small>
                          <p>
                            {roleName(p)} · {state} · {lists.length} lista(s)
                          </p>
                          {p.legacy && (
                            <small>
                              Configuração anterior — revise e salve o perfil.
                            </small>
                          )}
                          {bad.length > 0 && (
                            <p className="access-warning">
                              {bad.length} responsabilidade(s) sem acesso
                              operacional.
                            </p>
                          )}
                        </div>
                        <Button
                          variant="secondary"
                          disabled={p.isAdmin}
                          onClick={() => setPerson(p)}
                        >
                          {p.isAdmin
                            ? 'Administrador protegido'
                            : 'Gerenciar acesso'}
                        </Button>
                      </div>
                    </Card>
                  )
                })}
            </div>
          )}
          {data && ['lists', 'archived'].includes(tab) && (
            <div className="access-directory">
              {data.groups
                .filter(
                  (g) =>
                    Boolean(g.archivedAt) === (tab === 'archived') &&
                    matches(g.groupTitle),
                )
                .map((g) => (
                  <Card key={g.groupId} padding="medium">
                    <div className="access-directory-row">
                      <div>
                        <strong>{g.groupTitle}</strong>
                        <p>
                          {g.viewerUids.length} participante(s) além do acesso
                          global · {g.assignees.length} responsável(is)
                        </p>
                      </div>
                      <div className="access-editor__actions">
                        {!g.archivedAt && (
                          <Button
                            variant="secondary"
                            onClick={() => setList(g)}
                          >
                            Equipe e acesso
                          </Button>
                        )}
                        <Button variant="ghost" onClick={() => setArchive(g)}>
                          {g.archivedAt ? 'Restaurar' : 'Arquivar'}
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              {!data.groups.some(
                (g) => Boolean(g.archivedAt) === (tab === 'archived'),
              ) && <p>Nenhuma lista nesta seção.</p>}
            </div>
          )}
          {tab === 'history' && (
            <Card padding="medium">
              <h3>Últimas 100 alterações administrativas</h3>
              {history.map((h) => (
                <p key={h._id}>
                  <time>{new Date(h.createdAt).toLocaleString('pt-BR')}</time> ·{' '}
                  {h.actor} ·{' '}
                  {data?.users.find((p) => p.uid === h.target)?.email ||
                    data?.groups.find((g) => g.groupId === h.target)
                      ?.groupTitle ||
                    h.target}{' '}
                  ·{' '}
                  {(
                    {
                      'user-access': 'Acesso da pessoa',
                      'list-access': 'Equipe da lista',
                      'archive-list': 'Lista arquivada',
                      'restore-list': 'Lista restaurada',
                      'recover-leads': 'Registros recuperados',
                      import: 'Importação',
                      'create-list': 'Lista criada',
                      'rename-list': 'Lista renomeada',
                      'archive-lead': 'Lead arquivado',
                    } as Record<string, string>
                  )[h.action] || h.action}
                </p>
              ))}
              {!history.length && <p>As novas alterações aparecerão aqui.</p>}
            </Card>
          )}
          {tab === 'recovery' && (
            <Card padding="medium">
              <h3>Registros fora da operação</h3>
              <p>
                Até 1.000 registros sem lista válida ou arquivados
                individualmente. Confira antes de recuperar: os participantes da
                lista de destino poderão acessá-los.
              </p>
              <label>
                Lista de destino
                <select
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                >
                  <option value="">Selecione uma lista</option>
                  {activeLists.map((g) => (
                    <option key={g.groupId} value={g.groupId}>
                      {g.groupTitle}
                    </option>
                  ))}
                </select>
              </label>
              <div className="access-recovery-list">
                {recovery.map((r) => (
                  <label key={r.placeId}>
                    <input
                      type="checkbox"
                      checked={recoveryIds.includes(r.placeId)}
                      onChange={(e) =>
                        setRecoveryIds((ids) =>
                          e.target.checked
                            ? [...ids, r.placeId]
                            : ids.filter((id) => id !== r.placeId),
                        )
                      }
                    />
                    {r.title}
                  </label>
                ))}
              </div>
              <Button
                disabled={!destination || !recoveryIds.length}
                onClick={() => setConfirmRecovery(true)}
              >
                Recuperar {recoveryIds.length} selecionado(s)
              </Button>
            </Card>
          )}
          {data && person && (
            <AccessEditor
              key={person.uid}
              data={data}
              person={person}
              onClose={() => setPerson(null)}
              onSaved={setData}
            />
          )}
          {data && list && (
            <AccessEditor
              key={list.groupId}
              data={data}
              list={list}
              onClose={() => setList(null)}
              onSaved={setData}
            />
          )}
          <ConfirmDialog
            open={!!archive}
            onClose={() => {
              if (!busy) setArchive(null)
            }}
            onConfirm={() => void archiveList()}
            title={archive?.archivedAt ? 'Restaurar lista?' : 'Arquivar lista?'}
            description={
              archive?.archivedAt
                ? 'A lista voltará à operação com as permissões que já possuía.'
                : 'A lista sairá da operação. Leads, vínculos e histórico serão preservados.'
            }
            confirmLabel={
              busy
                ? 'Salvando...'
                : archive?.archivedAt
                  ? 'Restaurar'
                  : 'Arquivar'
            }
            tone="primary"
          />
          <ConfirmDialog
            open={confirmRecovery}
            onClose={() => {
              if (!busy) setConfirmRecovery(false)
            }}
            onConfirm={() => void recover()}
            title="Recuperar registros?"
            description={`${recoveryIds.length} registro(s) ficarão disponíveis aos participantes da lista de destino.`}
            confirmLabel={busy ? 'Recuperando...' : 'Recuperar'}
            tone="primary"
          />
        </>
      )}
    </section>
  )
}
