import { User } from './user.js'

export async function resolveLeadAssignee(uid) {
  if (uid === undefined) return {}
  if (uid === null || uid === '') return { assigneeUid: null, assigneeName: null }
  if (typeof uid !== 'string') {
    const error = new Error('Selecione um responsável válido')
    error.statusCode = 400
    throw error
  }
  const user = await User.findOne({ firebaseUid: uid, accessStatus: 'approved' })
  if (!user) {
    const error = new Error('O responsável precisa ter acesso liberado ao CRM')
    error.statusCode = 400
    throw error
  }
  return { assigneeUid: user.firebaseUid, assigneeName: user.displayName?.trim() || user.email }
}
