import 'dotenv/config'
import dotenv from 'dotenv'
import express from 'express'
import { randomUUID } from 'node:crypto'
import { centralIdentity } from './lib/central-access.js'
import { connectToDatabase } from './lib/db.js'
import { User } from './lib/user.js'
import { Lead } from './lib/lead.js'
import { LeadGroup } from './lib/lead-group.js'
import { QnA } from './lib/qna.js'
import { getMessageDay } from '../shared/message-day.js'
import {
  canViewGroup,
  canOperate,
  resolvePermissions,
} from '../shared/permissions.js'
import {
  owner,
  publicUser,
  fail,
  transaction,
  snapshot,
  audit,
  Audit,
  versionFilter,
  editableLead,
  eligibleAssignee,
  validateMembers,
  uids,
} from './lib/access-control.js'
dotenv.config({ path: '.env.local', quiet: true })
const app = express()
app.use(express.json({ limit: '10mb' }))
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store')
  next()
})
const route = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res)).catch(next)
app.get('/api/health', (_req, res) =>
  res.json({ ok: true, authentication: 'hub-only' }),
)
app.use('/api', (req, res, next) => {
  ;(async () => {
    const token = req.get('authorization')?.match(/^Bearer (.+)$/)?.[1]
    if (!token?.startsWith('cx_')) fail(401, 'Entre pelo Hub Codexa.')
    const identity = await centralIdentity(token, 'leads')
    await connectToDatabase()
    const email = identity.email.trim().toLowerCase()
    const matches = await User.find({
      $or: [{ email }, { hubUid: identity.uid }],
    }).limit(3)
    if (
      matches.length > 1 ||
      (matches[0]?.hubUid && matches[0].hubUid !== identity.uid)
    )
      fail(
        403,
        'Conta ambígua. O administrador precisa revisar o vínculo com o Hub.',
      )
    const existing = matches[0]
    req.firebaseUser = {
      localId: existing?.firebaseUid || 'hub_' + identity.uid,
      hubUid: identity.uid,
      email,
      displayName: identity.name || email,
    }
    req.isAdmin = owner(req.firebaseUser)
    req.crmUser = existing
    // Authentication has no independent Firebase/password fallback.
  })()
    .then(() => next())
    .catch(next)
})
app.put(
  '/api/users/me',
  route(async (req, res) => {
    const identity = req.firebaseUser
    const data = {
      email: identity.email,
      hubUid: identity.hubUid,
      displayName: identity.displayName,
      providerId: 'hub',
    }
    if (!req.crmUser || req.crmUser.accessStatus === 'pending' || req.isAdmin)
      data.accessStatus = 'approved'
    const user = await User.findOneAndUpdate(
      { firebaseUid: identity.localId },
      {
        $set: data,
        $setOnInsert: { role: 'reader', firebaseUid: identity.localId },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    )
    res.json(publicUser(user))
  }),
)
app.get(
  '/api/users/me',
  route(async (req, res) => {
    if (!req.crmUser)
      fail(401, 'Reabra o Leads pelo Hub para sincronizar sua conta.')
    res.json(publicUser(req.crmUser))
  }),
)
app.use('/api', (req, res, next) => {
  if (!req.isAdmin && req.crmUser?.accessStatus !== 'approved')
    return res.status(403).json({
      code: 'ACCESS_SUSPENDED',
      error: 'Seu acesso ao Leads está suspenso. Fale com o administrador.',
    })
  next()
})
const admin = (req, _res, next) => {
  if (!req.isAdmin)
    return next(
      Object.assign(new Error('Acesso restrito ao administrador.'), {
        statusCode: 403,
      }),
    )
  next()
}
const revision = (req) => {
  if (!Number.isSafeInteger(req.body?.revision) || req.body.revision < 0)
    fail(428, 'Recarregue os acessos antes de salvar.')
  return req.body.revision
}
app.get(
  '/api/admin/access',
  admin,
  route(async (_req, res) => res.json(await snapshot())),
)
app.get(
  '/api/users',
  admin,
  route(async (_req, res) => res.json((await snapshot()).users)),
)
app.get(
  '/api/admin/history',
  admin,
  route(async (_req, res) =>
    res.json(await Audit.find({}).sort({ createdAt: -1 }).limit(100).lean()),
  ),
)
app.put(
  '/api/admin/users/:uid/access',
  admin,
  route(async (req, res) => {
    const {
      role: profile,
      accessStatus,
      listIds,
      responsibleListIds,
    } = req.body ?? {}
    if (
      !['operator', 'reader'].includes(profile) ||
      !['approved', 'suspended'].includes(accessStatus)
    )
      fail(400, 'Perfil ou situação inválida.')
    const lists = uids(listIds),
      responsibilities = uids(responsibleListIds)
    if (
      responsibilities.some((id) => !lists.includes(id)) ||
      (responsibilities.length &&
        (profile !== 'operator' || accessStatus !== 'approved'))
    )
      fail(
        400,
        'Responsáveis precisam de perfil Operador ativo e acesso às listas.',
      )
    await transaction(
      req,
      async (session) => {
        const target = await User.findOne({
          firebaseUid: req.params.uid,
        }).session(session)
        if (!target) fail(404, 'Pessoa não encontrada.')
        if (owner(target)) fail(403, 'O administrador mantém acesso completo.')
        if (
          lists.some(
            (id) =>
              !req.savedGroups.some((g) => g.groupId === id && !g.archivedAt),
          )
        )
          fail(400, 'Uma lista não está mais disponível.')
        const before = {
          user: publicUser(target),
          lists: req.savedGroups
            .filter((g) => g.viewerUids.includes(target.firebaseUid))
            .map((g) => g.groupId),
          responsibleLists: req.savedGroups
            .filter((g) =>
              g.assignees.some((a) => a.uid === target.firebaseUid),
            )
            .map((g) => g.groupId),
        }
        target.role = profile
        target.accessStatus = accessStatus
        target.screenPermissions = resolvePermissions(target)
        await target.save({ session })
        for (const group of req.savedGroups.filter((g) => !g.archivedAt)) {
          group.viewerUids = group.viewerUids.filter(
            (uid) => uid !== target.firebaseUid,
          )
          group.assignees = group.assignees.filter(
            (a) => a.uid !== target.firebaseUid,
          )
          if (lists.includes(group.groupId))
            group.viewerUids.push(target.firebaseUid)
          if (responsibilities.includes(group.groupId))
            group.assignees.push({
              uid: target.firebaseUid,
              name: target.displayName || target.email,
            })
          group.visibility = 'selected'
          await group.save({ session })
        }
        await audit(session, req, 'user-access', target.firebaseUid, before, {
          role: profile,
          accessStatus,
          listIds: lists,
          responsibleListIds: responsibilities,
        })
      },
      revision(req),
    )
    res.json(await snapshot())
  }),
)
app.put(
  '/api/admin/lists/:groupId/access',
  admin,
  route(async (req, res) => {
    await transaction(
      req,
      async (session) => {
        const group = req.savedGroups.find(
          (g) => g.groupId === req.params.groupId && !g.archivedAt,
        )
        if (!group) fail(404, 'Lista não encontrada.')
        const before = group.toObject()
        Object.assign(
          group,
          await validateMembers(
            req.body.viewerUids,
            req.body.assigneeUids,
            session,
          ),
        )
        await group.save({ session })
        await audit(
          session,
          req,
          'list-access',
          group.groupId,
          before,
          group.toObject(),
        )
      },
      revision(req),
    )
    res.json(await snapshot())
  }),
)
app.patch(
  '/api/admin/lists/:groupId/archive',
  admin,
  route(async (req, res) => {
    if (typeof req.body.archived !== 'boolean')
      fail(400, 'Informe a ação de arquivamento.')
    await transaction(
      req,
      async (session) => {
        const group = req.savedGroups.find(
          (g) => g.groupId === req.params.groupId,
        )
        if (!group) fail(404, 'Lista não encontrada.')
        const before = group.toObject()
        group.archivedAt = req.body.archived ? new Date() : null
        await group.save({ session })
        await audit(
          session,
          req,
          req.body.archived ? 'archive-list' : 'restore-list',
          group.groupId,
          before,
          group.toObject(),
        )
      },
      revision(req),
    )
    res.json(await snapshot())
  }),
)
app.get(
  '/api/admin/recovery',
  admin,
  route(async (_req, res) => {
    const groups = await LeadGroup.find({}).lean()
    const records = await Lead.find({
      $or: [
        { groupId: { $nin: groups.map((g) => g.groupId) } },
        { archivedAt: { $ne: null } },
      ],
    })
      .select('placeId title groupId groupTitle version archivedAt')
      .limit(1000)
      .lean()
    res.json({ records, limit: 1000 })
  }),
)
app.post(
  '/api/admin/recovery',
  admin,
  route(async (req, res) => {
    const items = req.body.items
    if (
      !Array.isArray(items) ||
      !items.length ||
      items.length > 1000 ||
      items.some((i) => !i || typeof i.placeId !== 'string')
    )
      fail(400, 'Selecione até 1.000 registros.')
    await transaction(
      req,
      async (session) => {
        const group = req.savedGroups.find(
          (g) => g.groupId === req.body.groupId && !g.archivedAt,
        )
        if (!group) fail(400, 'Escolha uma lista ativa.')
        for (const item of items) {
          const lead = await Lead.findOne({ placeId: item.placeId }).session(
            session,
          )
          if (
            !lead ||
            (!lead.archivedAt &&
              req.savedGroups.some((g) => g.groupId === lead.groupId))
          )
            fail(
              409,
              'Um registro já está vinculado. Recarregue a recuperação.',
            )
          const updated = await Lead.findOneAndUpdate(
            { placeId: item.placeId, ...versionFilter(item.version) },
            {
              $set: {
                groupId: group.groupId,
                groupTitle: group.groupTitle,
                archivedAt: null,
              },
              $inc: { version: 1 },
            },
            { session, returnDocument: 'after' },
          )
          if (!updated)
            fail(409, 'Um registro mudou. Nenhum registro foi recuperado.')
        }
        await audit(session, req, 'recover-leads', group.groupId, null, {
          ids: items.map((i) => i.placeId),
        })
      },
      revision(req),
    )
    res.json({ recovered: items.length })
  }),
)
// Old permission/delete endpoints cannot bypass the versioned administration workflow.
app.all(
  [
    '/api/users/:uid/permissions',
    '/api/users/:uid/approve',
    '/api/users/:uid',
    '/api/lead-groups/:groupId/access',
    '/api/lead-groups/:groupId/assignees',
  ],
  admin,
  (_req, res) =>
    res.status(410).json({
      error:
        'Use Acessos do Leads para revisar e salvar a configuração completa.',
    }),
)
app.all(['/api/atlas/early-access', '/api/briefing/leads'], (_req, res) =>
  res.status(410).json({
    error:
      'Esta integração não faz mais parte do Leads. Abra o aplicativo correspondente pelo Hub.',
  }),
)
app.use('/api', (req, _res, next) => {
  ;(async () => {
    req.savedGroups = await LeadGroup.find({})
    const visible = req.savedGroups
      .filter(
        (g) =>
          !g.archivedAt &&
          canViewGroup(g, req.firebaseUser.localId, req.isAdmin),
      )
      .map((g) => g.groupId)
    req.leadFilter = { groupId: { $in: visible }, archivedAt: null }
    const permissions = resolvePermissions(req.crmUser, req.isAdmin)
    const p = req.path.toLowerCase().replace(/\/+$/, '')
    if (/^\/(leads|lead-groups|lead-assignees)(\/|$)/.test(p)) {
      if (!['dashboard', 'table', 'kanban'].some((id) => permissions[id].read))
        fail(403, 'Nenhuma tela comercial liberada.')
      if (
        !['GET', 'HEAD'].includes(req.method) &&
        !canOperate(req.crmUser, req.isAdmin)
      )
        fail(403, 'Seu perfil permite somente consulta.')
    }
  })()
    .then(() => next())
    .catch(next)
})
app.get(
  '/api/lead-groups',
  route(async (req, res) => {
    const counts = await Lead.aggregate([
      { $match: req.leadFilter },
      { $group: { _id: '$groupId', count: { $sum: 1 } } },
    ])
    res.json(
      req.savedGroups
        .filter((g) => req.leadFilter.groupId.$in.includes(g.groupId))
        .map((g) => ({
          groupId: g.groupId,
          groupTitle: g.groupTitle,
          count: counts.find((c) => c._id === g.groupId)?.count || 0,
          assignees: g.assignees,
          ...(req.isAdmin && {
            visibility: g.visibility,
            viewerUids: g.viewerUids,
          }),
        })),
    )
  }),
)
app.get(
  '/api/leads',
  route(async (req, res) => res.json(await Lead.find(req.leadFilter))),
)
app.get(
  '/api/leads/export',
  admin,
  route(async (req, res) => {
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="codexa-leads.json"',
    )
    res.json(await Lead.find(req.leadFilter))
  }),
)
app.get(
  '/api/lead-assignees',
  route(async (req, res) => {
    const group = req.savedGroups.find(
      (g) =>
        g.groupId === req.query.groupId &&
        canViewGroup(g, req.firebaseUser.localId, req.isAdmin) &&
        !g.archivedAt,
    )
    if (!group) return res.json([])
    const users = await User.find({ accessStatus: 'approved' })
    res.json(
      users
        .filter(
          (u) =>
            canOperate(u, owner(u)) &&
            canViewGroup(group, u.firebaseUid, owner(u)),
        )
        .map((u) => ({
          uid: u.firebaseUid,
          name: `${u.displayName || u.email} (${u.email})`,
        })),
    )
  }),
)
app.post(
  '/api/lead-groups',
  admin,
  route(async (req, res) => {
    const title = req.body.groupTitle?.trim()
    if (!title || title.length > 120)
      fail(400, 'Informe um nome de até 120 caracteres.')
    const group = await transaction(req, async (session) => {
      const [group] = await LeadGroup.create(
        [
          {
            groupId: 'group-' + randomUUID(),
            groupTitle: title,
            visibility: 'selected',
            viewerUids: [],
            assignees: [],
          },
        ],
        { session },
      )
      await audit(session, req, 'create-list', group.groupId, null, { title })
      return group
    })
    res.status(201).json({
      groupId: group.groupId,
      groupTitle: title,
      count: 0,
      viewerUids: [],
      assignees: [],
      visibility: 'selected',
    })
  }),
)
const columns = [
  'open',
  'em_contato',
  'mensagem_enviada',
  'contato',
  'conversa',
  'followup',
  'proposta',
  'negociacao',
  'fechado',
  'perdido',
]
const stateKeys = [
  'column',
  'nextAction',
  'dueDate',
  'lostReason',
  'proposalValue',
  'proposalReturnDate',
  'collectedData',
  'contactResearch',
  'interest',
  'budget',
  'returnDate',
  'order',
]
const cleanState = (value) => {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some((k) => !stateKeys.includes(k)) ||
    (value.column !== undefined && !columns.includes(value.column))
  )
    fail(400, 'Acompanhamento inválido.')
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => ['kanbanState.' + k, v]),
  )
}
app.post(
  '/api/leads',
  route(async (req, res) => {
    const result = await transaction(req, async (session) => {
      if (!canOperate(req.crmUser, req.isAdmin))
        fail(403, 'Seu perfil permite somente consulta.')
      const group = req.savedGroups.find(
        (g) =>
          g.groupId === req.body.groupId &&
          req.leadFilter.groupId.$in.includes(g.groupId),
      )
      if (!group) fail(404, 'Lista não encontrada.')
      const data = await cleanLead(req.body)
      const [lead] = await Lead.create(
        [
          {
            ...data,
            groupId: group.groupId,
            groupTitle: group.groupTitle,
            ...(await eligibleAssignee(
              req,
              req.body.assigneeUid,
              group.groupId,
              session,
            )),
          },
        ],
        { session },
      )
      return lead
    })
    res.status(201).json(result)
  }),
)
async function cleanLead(item) {
  if (
    !item ||
    typeof item.title !== 'string' ||
    !item.title.trim() ||
    typeof item.placeId !== 'string' ||
    !item.placeId.trim() ||
    item.placeId.length > 500
  )
    fail(400, 'Nome e identificador do lead são obrigatórios.')
  const fields = [
    'title',
    'subTitle',
    'categoryName',
    'address',
    'neighborhood',
    'street',
    'city',
    'state',
    'postalCode',
    'website',
    'phone',
    'phoneUnformatted',
    'totalScore',
    'reviewsCount',
    'permanentlyClosed',
    'temporarilyClosed',
    'categories',
    'placeId',
  ]
  const data = Object.fromEntries(
    fields.filter((k) => item[k] !== undefined).map((k) => [k, item[k]]),
  )
  if (item.kanbanState) {
    cleanState(item.kanbanState)
    data.kanbanState = item.kanbanState
  }
  try {
    await new Lead(data).validate()
  } catch {
    fail(400, 'Dados do lead inválidos. Confira os campos antes de importar.')
  }
  return data
}
async function importPreview(body, session) {
  if (!Array.isArray(body.leads) || body.leads.length > 5000)
    fail(400, 'Envie até 5.000 leads.')
  const valid = [],
    invalid = [],
    seen = new Set(),
    repeated = []
  for (const [index, item] of body.leads.entries()) {
    try {
      const data = await cleanLead(item)
      if (seen.has(data.placeId)) repeated.push(index + 1)
      else {
        valid.push(data)
        seen.add(data.placeId)
      }
    } catch {
      invalid.push(index + 1)
    }
  }
  const existing = await Lead.find({
    placeId: { $in: valid.map((i) => i.placeId) },
  })
    .select('placeId')
    .session(session || null)
    .lean()
  const existingIds = new Set(existing.map((i) => i.placeId))
  return {
    records: valid.filter((i) => !existingIds.has(i.placeId)),
    summary: {
      total: body.leads.length,
      new: valid.length - existing.length,
      existing: existing.length,
      invalid,
      repeated,
    },
  }
}
app.post(
  '/api/leads/import/preview',
  admin,
  route(async (req, res) => res.json((await importPreview(req.body)).summary)),
)
app.post(
  '/api/leads/import',
  admin,
  route(async (req, res) => {
    const title = req.body.title?.trim()
    if (!title || title.length > 120 || req.body.confirmed !== true)
      fail(400, 'Confira a prévia e confirme a importação.')
    const result = await transaction(req, async (session) => {
      const { records, summary } = await importPreview(req.body, session)
      if (summary.invalid.length || summary.repeated.length)
        fail(400, 'Corrija as linhas inválidas ou repetidas antes de importar.')
      if (!records.length) return { imported: 0, summary }
      const groupId = 'group-' + randomUUID()
      await LeadGroup.create(
        [
          {
            groupId,
            groupTitle: title,
            visibility: 'selected',
            viewerUids: [],
          },
        ],
        { session },
      )
      await Lead.insertMany(
        records.map((r) => ({ ...r, groupId, groupTitle: title })),
        { session },
      )
      await audit(session, req, 'import', groupId, null, summary)
      return { imported: records.length, groupId, groupTitle: title, summary }
    })
    res.json(result)
  }),
)
app.put(
  '/api/leads/batch',
  route(async (req, res) => {
    if (
      !Array.isArray(req.body) ||
      req.body.length > 2000 ||
      req.body.some(
        (i) => !i || typeof i.placeId !== 'string' || !i.placeId.trim(),
      ) ||
      new Set(req.body.map((i) => i.placeId)).size !== req.body.length
    )
      fail(400, 'Lote inválido.')
    await transaction(req, async (session) => {
      for (const item of req.body) {
        await editableLead(req, item.placeId, session, item.version)
        cleanState(item.kanbanState)
      }
      for (const item of req.body)
        await Lead.updateOne(
          {
            ...req.leadFilter,
            placeId: item.placeId,
            ...versionFilter(item.version),
          },
          { $set: cleanState(item.kanbanState), $inc: { version: 1 } },
          { session, runValidators: true },
        )
    })
    res.json({
      updated: req.body.length,
      leads: await Lead.find(req.leadFilter),
    })
  }),
)
app.patch(
  '/api/leads/:placeId/message-sent',
  route(async (req, res) => {
    if (typeof req.body.sent !== 'boolean')
      fail(400, 'Informe a marcação da mensagem.')
    res.json(
      await transaction(req, async (session) => {
        await editableLead(req, req.params.placeId, session, req.body.version)
        return Lead.findOneAndUpdate(
          { placeId: req.params.placeId, ...versionFilter(req.body.version) },
          {
            $set: { messageSentOn: req.body.sent ? getMessageDay() : null },
            $inc: { version: 1 },
          },
          { session, returnDocument: 'after' },
        )
      }),
    )
  }),
)
app.patch(
  '/api/leads/:placeId/details',
  route(async (req, res) => {
    const input = req.body
    const fields = [
      'title',
      'categoryName',
      'phone',
      'website',
      'address',
      'column',
      'collectedData',
    ]
    if (
      fields.some((k) => typeof input[k] !== 'string') ||
      !input.title.trim() ||
      !columns.includes(input.column)
    )
      fail(400, 'Informe os dados válidos do lead.')
    res.json(
      await transaction(req, async (session) => {
        const lead = await editableLead(
          req,
          req.params.placeId,
          session,
          input.version,
        )
        const phone = input.phone.trim() || null,
          website = input.website.trim()
        return Lead.findOneAndUpdate(
          { placeId: lead.placeId, ...versionFilter(input.version) },
          {
            $set: {
              ...(await eligibleAssignee(
                req,
                input.assigneeUid,
                lead.groupId,
                session,
              )),
              title: input.title.trim(),
              categoryName: input.categoryName.trim() || null,
              phone,
              phoneUnformatted: phone?.replace(/\D/g, '') || null,
              website: website
                ? /^https?:\/\//i.test(website)
                  ? website
                  : 'https://' + website
                : null,
              address: input.address.trim() || null,
              'kanbanState.column': input.column,
              'kanbanState.collectedData': input.collectedData.trim(),
            },
            $inc: { version: 1 },
          },
          { session, returnDocument: 'after', runValidators: true },
        )
      }),
    )
  }),
)
app.put(
  '/api/leads/group/:groupId',
  admin,
  route(async (req, res) => {
    const title = req.body.groupTitle?.trim()
    if (!title || title.length > 120)
      fail(400, 'Informe um nome de até 120 caracteres.')
    await transaction(
      req,
      async (session) => {
        const group = req.savedGroups.find(
          (g) => g.groupId === req.params.groupId && !g.archivedAt,
        )
        if (!group) fail(404, 'Lista não encontrada.')
        if (req.body.expectedTitle !== group.groupTitle)
          fail(409, 'O nome da lista mudou. Reabra a edição para revisar.')
        const before = group.groupTitle
        group.groupTitle = title
        await group.save({ session })
        await Lead.updateMany(
          { groupId: group.groupId },
          { $set: { groupTitle: title }, $inc: { version: 1 } },
          { session },
        )
        await audit(session, req, 'rename-list', group.groupId, before, title)
      },
      revision(req),
    )
    res.json({ updated: true })
  }),
)
app.delete('/api/leads/group/:groupId', admin, (_req, res) =>
  res.status(410).json({
    error:
      'Arquive a lista em Acessos do Leads. Seus registros serão preservados.',
  }),
)
app.put(
  '/api/leads/:placeId',
  route(async (req, res) => {
    const state = cleanState(req.body.kanbanState)
    res.json(
      await transaction(req, async (session) => {
        const lead = await editableLead(
          req,
          req.params.placeId,
          session,
          req.body.version,
        )
        return Lead.findOneAndUpdate(
          { placeId: lead.placeId, ...versionFilter(req.body.version) },
          {
            $set: {
              ...state,
              ...(await eligibleAssignee(
                req,
                req.body.assigneeUid,
                lead.groupId,
                session,
              )),
            },
            $inc: { version: 1 },
          },
          { session, returnDocument: 'after', runValidators: true },
        )
      }),
    )
  }),
)
app.delete(
  '/api/leads/:placeId',
  admin,
  route(async (req, res) => {
    await transaction(req, async (session) => {
      const lead = await editableLead(
        req,
        req.params.placeId,
        session,
        req.body.version,
      )
      await Lead.updateOne(
        { placeId: lead.placeId, ...versionFilter(req.body.version) },
        { $set: { archivedAt: new Date() }, $inc: { version: 1 } },
        { session },
      )
      await audit(
        session,
        req,
        'archive-lead',
        lead.placeId,
        { groupId: lead.groupId },
        null,
      )
    })
    res.status(204).end()
  }),
)
app.get('/api/qna', async (_req, res) => {
  try {
    await connectToDatabase()
    const items = await QnA.find({}).sort({ isFavorite: -1, createdAt: -1 })
    res.json(items)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao buscar perguntas' })
  }
})

app.post('/api/qna', admin, async (req, res) => {
  try {
    await connectToDatabase()
    const { question, answer, tags, isFavorite } = req.body
    if (!question || !answer) {
      return res
        .status(400)
        .json({ error: 'Pergunta e resposta são obrigatórias' })
    }
    const item = await QnA.create({
      question: question.trim(),
      answer: answer.trim(),
      tags: Array.isArray(tags) ? tags.filter(Boolean) : [],
      isFavorite: isFavorite === true,
    })
    res.status(201).json(item)
  } catch (err) {
    console.error(err)
    res.status(400).json({
      error: err instanceof Error ? err.message : 'Erro ao criar pergunta',
    })
  }
})

app.put('/api/qna/:id', admin, async (req, res) => {
  try {
    await connectToDatabase()
    const { question, answer, tags, isFavorite } = req.body
    if (!question || !answer) {
      return res
        .status(400)
        .json({ error: 'Pergunta e resposta são obrigatórias' })
    }
    const item = await QnA.findByIdAndUpdate(
      req.params.id,
      {
        question: question.trim(),
        answer: answer.trim(),
        tags: Array.isArray(tags) ? tags.filter(Boolean) : [],
        isFavorite: isFavorite === true,
      },
      { returnDocument: 'after' },
    )
    if (!item) return res.status(404).json({ error: 'Pergunta não encontrada' })
    res.json(item)
  } catch (err) {
    console.error(err)
    res.status(400).json({
      error: err instanceof Error ? err.message : 'Erro ao atualizar pergunta',
    })
  }
})

app.patch('/api/qna/:id/favorite', admin, async (req, res) => {
  try {
    await connectToDatabase()
    const current = await QnA.findById(req.params.id)
    if (!current)
      return res.status(404).json({ error: 'Pergunta não encontrada' })
    const item = await QnA.findByIdAndUpdate(
      req.params.id,
      { isFavorite: !current.isFavorite },
      { returnDocument: 'after' },
    )
    res.json(item)
  } catch (err) {
    console.error(err)
    res.status(400).json({
      error: err instanceof Error ? err.message : 'Erro ao favoritar pergunta',
    })
  }
})

app.delete('/api/qna/:id', admin, async (req, res) => {
  try {
    await connectToDatabase()
    const item = await QnA.findByIdAndDelete(req.params.id)
    if (!item) return res.status(404).json({ error: 'Pergunta não encontrada' })
    res.status(204).end()
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao remover pergunta' })
  }
})

app.use((_req, res) => res.status(404).json({ error: 'Não encontrado.' }))
app.use((error, _req, res, _next) => {
  const status =
    error.statusCode ||
    (error.code === 11000 ? 409 : error.name === 'ValidationError' ? 400 : 500)
  res.status(status).json({
    error:
      status === 500
        ? 'Não foi possível concluir. Tente novamente.'
        : error.code === 11000
          ? 'Este registro já existe. Refaça a prévia.'
          : error.message,
  })
})
export default app
