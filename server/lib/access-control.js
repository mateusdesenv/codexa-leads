import mongoose from 'mongoose'
import { User } from './user.js'
import { Lead } from './lead.js'
import { LeadGroup } from './lead-group.js'
import {
  resolvePermissions,
  resolveRole,
  canViewGroup,
  canOperate,
} from '../../shared/permissions.js'
export const OWNER = 'mateus.desenv@gmail.com'
export const owner = (user) => user?.email?.toLowerCase() === OWNER
export const Control =
  mongoose.models.AccessControl ||
  mongoose.model(
    'AccessControl',
    new mongoose.Schema({
      _id: String,
      revision: { type: Number, default: 0 },
      serial: { type: Number, default: 0 },
    }),
  )
export const Audit =
  mongoose.models.AccessAudit ||
  mongoose.model(
    'AccessAudit',
    new mongoose.Schema(
      {
        actor: String,
        action: String,
        target: String,
        before: mongoose.Schema.Types.Mixed,
        after: mongoose.Schema.Types.Mixed,
      },
      { timestamps: true },
    ),
  )
export const fail = (status, message) => {
  throw Object.assign(new Error(message), { statusCode: status })
}
export const publicUser = (u) => ({
  uid: u.firebaseUid,
  email: u.email,
  displayName: u.displayName,
  isAdmin: owner(u),
  role: resolveRole(u, owner(u)),
  legacy: !u.role && !owner(u),
  accessStatus: u.accessStatus,
  screenPermissions: resolvePermissions(u, owner(u)),
})
export async function initializeControl() {
  await Promise.all([
    User.init(),
    Lead.init(),
    LeadGroup.init(),
    Control.init(),
    Audit.init(),
  ])
  await Control.updateOne(
    { _id: 'access' },
    { $setOnInsert: { revision: 0, serial: 0 } },
    { upsert: true },
  )
}
export async function audit(session, req, action, target, before, after) {
  await Audit.create(
    [{ actor: req.firebaseUser.email, action, target, before, after }],
    { session },
  )
}
export async function transaction(req, operation, revision) {
  await initializeControl()
  return mongoose.connection.transaction(async (session) => {
    const filter = {
      _id: 'access',
      ...(revision === undefined ? {} : { revision }),
    }
    const lock = await Control.findOneAndUpdate(
      filter,
      {
        $inc: { serial: 1, ...(revision === undefined ? {} : { revision: 1 }) },
      },
      { session, returnDocument: 'after' },
    )
    if (!lock)
      fail(
        409,
        'Os acessos mudaram. Recarregue antes de salvar; suas alterações ainda não foram aplicadas.',
      )
    const u = await User.findOne({
      firebaseUid: req.firebaseUser.localId,
    }).session(session)
    if (!req.isAdmin && (!u || u.accessStatus !== 'approved'))
      fail(403, 'Seu acesso ao Leads está suspenso.')
    req.crmUser = u
    req.savedGroups = await LeadGroup.find({}).session(session)
    for (const group of req.savedGroups) {
      if (!Array.isArray(group.viewerUids)) group.viewerUids = []
      if (!Array.isArray(group.assignees)) group.assignees = []
    }
    const visible = req.savedGroups
      .filter(
        (g) =>
          !g.archivedAt &&
          canViewGroup(g, req.firebaseUser.localId, req.isAdmin),
      )
      .map((g) => g.groupId)
    req.leadFilter = { groupId: { $in: visible }, archivedAt: null }
    return operation(session)
  })
}
export async function snapshot() {
  await initializeControl()
  return mongoose.connection.transaction(async (session) => {
    const control = await Control.findById('access').session(session)
    const users = await User.find({})
      .sort({ displayName: 1, email: 1 })
      .session(session)
      .lean()
    const groups = await LeadGroup.find({})
      .sort({ groupTitle: 1 })
      .session(session)
      .lean()
    return {
      revision: control.revision,
      users: users.map(publicUser),
      groups: groups.map((g) => ({
        groupId: g.groupId,
        groupTitle: g.groupTitle,
        visibility: g.visibility,
        // lean() does not apply schema defaults to records created before these fields existed.
        viewerUids: Array.isArray(g.viewerUids) ? g.viewerUids : [],
        assignees: Array.isArray(g.assignees) ? g.assignees : [],
        archivedAt: g.archivedAt,
      })),
    }
  })
}
export function versionFilter(version) {
  if (!Number.isSafeInteger(version) || version < 0)
    fail(428, 'Reabra este lead antes de salvar. A versão é obrigatória.')
  return version === 0
    ? { $or: [{ version: 0 }, { version: { $exists: false } }] }
    : { version }
}
export async function editableLead(req, id, session, version) {
  if (!canOperate(req.crmUser, req.isAdmin))
    fail(403, 'Seu perfil permite somente consulta.')
  const lead = await Lead.findOne({ ...req.leadFilter, placeId: id }).session(
    session,
  )
  if (!lead) fail(404, 'Lead não encontrado.')
  versionFilter(version)
  if ((lead.version ?? 0) !== version)
    fail(
      409,
      'Este lead foi atualizado por outra pessoa. Seu rascunho foi mantido; copie suas alterações e reabra a ficha para revisar.',
    )
  return lead
}
export async function eligibleAssignee(req, uid, groupId, session) {
  if (uid === undefined) return {}
  if (uid === null || uid === '')
    return { assigneeUid: null, assigneeName: null }
  if (typeof uid !== 'string') fail(400, 'Responsável inválido.')
  const user = await User.findOne({
    firebaseUid: uid,
    accessStatus: 'approved',
  }).session(session)
  const group = req.savedGroups.find((g) => g.groupId === groupId)
  if (
    !user ||
    !canOperate(user, owner(user)) ||
    !canViewGroup(group, uid, owner(user))
  )
    fail(400, 'O responsável precisa poder operar esta lista.')
  return { assigneeUid: uid, assigneeName: user.displayName || user.email }
}
export function uids(value) {
  if (
    !Array.isArray(value) ||
    value.length > 500 ||
    value.some((x) => typeof x !== 'string' || !x.trim() || x.length > 128)
  )
    fail(400, 'Seleção de pessoas inválida.')
  return [...new Set(value)]
}
export async function validateMembers(viewerUids, assigneeUids, session) {
  const users = await User.find({}).session(session)
  const viewers = uids(viewerUids),
    responsible = uids(assigneeUids)
  for (const uid of [...viewers, ...responsible]) {
    const u = users.find((u) => u.firebaseUid === uid)
    if (!u || u.accessStatus !== 'approved')
      fail(400, 'Selecione somente pessoas ativas.')
    if (
      responsible.includes(uid) &&
      (!canOperate(u, owner(u)) || (!owner(u) && !viewers.includes(uid)))
    )
      fail(
        400,
        'Cada responsável precisa ser operador com acesso à lista. Revise a seleção.',
      )
  }
  return {
    viewerUids: viewers,
    visibility: 'selected',
    assignees: responsible.map((uid) => ({
      uid,
      name:
        users.find((u) => u.firebaseUid === uid).displayName ||
        users.find((u) => u.firebaseUid === uid).email,
    })),
  }
}
