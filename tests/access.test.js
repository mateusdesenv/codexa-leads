import test from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { MongoMemoryReplSet } from 'mongodb-memory-server'

test(
  'Hub-only CRM integration: isolation, administration and data integrity',
  { timeout: 180000 },
  async (t) => {
    const replica = await MongoMemoryReplSet.create({
      replSet: { count: 1 },
      binary: process.env.MONGOMS_SYSTEM_BINARY
        ? { systemBinary: process.env.MONGOMS_SYSTEM_BINARY }
        : {},
    })
    process.env.MONGODB_URI = replica.getUri('leads_test')
    process.env.CODEXA_HUB_URL = 'https://hub.test'
    const { User } = await import('../server/lib/user.js')
    const { Lead } = await import('../server/lib/lead.js')
    const { LeadGroup } = await import('../server/lib/lead-group.js')
    const { Audit } = await import('../server/lib/access-control.js')
    const { default: app } = await import('../server/app.js')
    const realFetch = global.fetch
    const identities = {
      admin: {
        uid: 'hub-owner',
        email: 'mateus.desenv@gmail.com',
        name: 'Owner',
      },
      operator: { uid: 'op', email: 'op@example.com', name: 'Operator' },
      reader: { uid: 'ro', email: 'ro@example.com', name: 'Reader' },
      other: { uid: 'other', email: 'other@example.com', name: 'Other' },
      fresh: { uid: 'fresh', email: 'fresh@example.com', name: 'Fresh' },
    }
    const revoked = new Set()
    t.mock.method(global, 'fetch', (url, options) => {
      if (String(url).startsWith('https://hub.test/')) {
        const key = options.headers.Authorization?.replace('Bearer cx_', '')
        const id = identities[key]
        return Promise.resolve(
          new Response(JSON.stringify(id || {}), {
            status: revoked.has(key) ? 403 : id ? 200 : 401,
          }),
        )
      }
      return realFetch(url, options)
    })
    const server = app.listen(0, '127.0.0.1')
    await new Promise((r) => server.once('listening', r))
    const request = (
      url,
      person = 'admin',
      method = 'GET',
      body,
      headers = {},
    ) =>
      realFetch(`http://127.0.0.1:${server.address().port}${url}`, {
        method,
        headers: {
          ...(person ? { Authorization: `Bearer cx_${person}` } : {}),
          'Content-Type': 'application/json',
          ...headers,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })
    const json = async (...args) => {
      const r = await request(...args)
      const data = await r.json()
      assert.ok(r.ok, JSON.stringify({ status: r.status, data }))
      return data
    }
    const snap = () => json('/api/admin/access')
    try {
      await mongoose.connect(process.env.MONGODB_URI)
      await User.create({
        firebaseUid: 'old-owner',
        email: identities.admin.email,
        accessStatus: 'approved',
      })
      await t.test(
        'direct credentials rejected, central identity preserves existing ID, new user needs no second login',
        async () => {
          assert.equal((await request('/api/leads', null)).status, 401)
          assert.equal(
            (
              await request('/api/leads', null, 'GET', undefined, {
                Authorization: 'Bearer firebase-token',
              })
            ).status,
            401,
          )
          for (const p of Object.keys(identities))
            await json('/api/users/me', p, 'PUT')
          assert.equal((await json('/api/users/me')).uid, 'old-owner')
          const fresh = await json('/api/users/me', 'fresh')
          assert.equal(fresh.role, 'reader')
          assert.equal(fresh.accessStatus, 'approved')
          assert.deepEqual(await json('/api/leads', 'fresh'), [])
          revoked.add('fresh')
          assert.equal((await request('/api/leads', 'fresh')).status, 403)
          revoked.delete('fresh')
        },
      )
      await User.updateOne(
        { email: identities.operator.email },
        { $set: { role: 'operator' } },
      )
      await LeadGroup.create([
        {
          groupId: 'a',
          groupTitle: 'A',
          visibility: 'selected',
          viewerUids: ['hub_op', 'hub_ro'],
        },
        {
          groupId: 'b',
          groupTitle: 'B',
          visibility: 'selected',
          viewerUids: ['hub_other'],
        },
        {
          groupId: 'empty',
          groupTitle: 'Empty',
          visibility: 'selected',
          viewerUids: [],
        },
      ])
      await Lead.create([
        { placeId: 'a1', title: 'A1', groupId: 'a', groupTitle: 'A' },
        { placeId: 'a2', title: 'A2', groupId: 'a', groupTitle: 'A' },
        { placeId: 'b1', title: 'B1', groupId: 'b', groupTitle: 'B' },
        { placeId: 'orphan', title: 'Orphan', groupId: null },
      ])
      await t.test(
        'operator and reader only see assigned lists, including direct and mixed-case routes',
        async () => {
          for (const path of ['/api/leads', '/api/LEADS/'])
            assert.deepEqual(
              (await json(path, 'operator')).map((l) => l.placeId).sort(),
              ['a1', 'a2'],
            )
          assert.deepEqual(
            (await json('/api/lead-groups', 'reader')).map((g) => g.groupId),
            ['a'],
          )
          assert.equal((await json('/api/leads')).length, 3)
          for (const person of ['operator', 'reader']) {
            assert.equal(
              (await request('/api/admin/access', person)).status,
              403,
            )
            assert.equal(
              (await request('/api/leads/export', person)).status,
              403,
            )
            assert.equal(
              (
                await request(
                  '/api/leads/b1',
                  person,
                  'PUT',
                  { version: 0, kanbanState: { column: 'perdido' } },
                  { 'X-CRM-Screen': 'dashboard' },
                )
              ).status,
              person === 'reader' ? 403 : 404,
            )
            assert.equal(
              (await request('/api/leads/group/a', person, 'DELETE')).status,
              403,
            )
            assert.equal(
              (
                await request('/api/lead-groups', person, 'POST', {
                  groupTitle: 'No',
                })
              ).status,
              403,
            )
            assert.equal(
              (
                await request('/api/leads/import', person, 'POST', {
                  title: 'No',
                  confirmed: true,
                  leads: [],
                })
              ).status,
              403,
            )
          }
          assert.equal(
            (
              await request('/api/leads/a1', 'reader', 'PUT', {
                version: 0,
                kanbanState: { column: 'contato' },
              })
            ).status,
            403,
          )
          for (const url of ['/api/atlas/early-access', '/api/BRIEFING/LEADS/'])
            assert.equal((await request(url, 'operator')).status, 410)
        },
      )
      await t.test(
        'optimistic versions preserve changes, batches are atomic, responsible must access the list',
        async () => {
          assert.equal(
            (
              await request('/api/leads/a1', 'operator', 'PUT', {
                kanbanState: { column: 'contato' },
              })
            ).status,
            428,
          )
          const changed = await json('/api/leads/a1', 'operator', 'PUT', {
            version: 0,
            kanbanState: { column: 'contato', nextAction: 'Call' },
          })
          assert.equal(changed.version, 1)
          assert.equal(
            (
              await request('/api/leads/a1', 'operator', 'PUT', {
                version: 0,
                kanbanState: { column: 'perdido' },
              })
            ).status,
            409,
          )
          assert.equal(
            (
              await request('/api/leads/a1', 'operator', 'PUT', {
                version: 1,
                kanbanState: { column: 'contato' },
                assigneeUid: 'hub_other',
              })
            ).status,
            400,
          )
          assert.equal(
            (
              await request('/api/leads/batch', 'operator', 'PUT', [
                {
                  placeId: 'a1',
                  version: 1,
                  kanbanState: { column: 'perdido' },
                },
                {
                  placeId: 'b1',
                  version: 0,
                  kanbanState: { column: 'perdido' },
                },
              ])
            ).status,
            404,
          )
          assert.equal(
            (await Lead.findOne({ placeId: 'a1' })).kanbanState.column,
            'contato',
          )
          assert.equal(
            (
              await request('/api/leads/batch', 'operator', 'PUT', [
                {
                  placeId: 'a1',
                  version: 1,
                  kanbanState: { column: 'perdido' },
                },
                {
                  placeId: 'a2',
                  version: 99,
                  kanbanState: { column: 'perdido' },
                },
              ])
            ).status,
            409,
          )
          assert.equal((await Lead.findOne({ placeId: 'a1' })).version, 1)
          const batch = await json('/api/leads/batch', 'operator', 'PUT', [
            { placeId: 'a1', version: 1, kanbanState: { column: 'conversa' } },
            { placeId: 'a2', version: 0, kanbanState: { column: 'contato' } },
          ])
          assert.equal(batch.updated, 2)
          const one = await Lead.findOne({ placeId: 'a1' })
          assert.equal(one.kanbanState.nextAction, 'Call')
          const simultaneous = await Promise.all([
            request('/api/leads/a1', 'operator', 'PUT', {
              version: 2,
              kanbanState: { column: 'followup' },
            }),
            request('/api/leads/a1', 'operator', 'PUT', {
              version: 2,
              kanbanState: { column: 'proposta' },
            }),
          ])
          assert.deepEqual(simultaneous.map((r) => r.status).sort(), [200, 409])
        },
      )
      await t.test(
        'combined access save validates participants, protects owner, detects stale snapshots and logs before/after',
        async () => {
          let s = await snap()
          const before = s.revision
          assert.equal(
            (
              await request('/api/admin/lists/a/access', 'admin', 'PUT', {
                revision: before,
                viewerUids: ['hub_op'],
                assigneeUids: ['hub_other'],
              })
            ).status,
            400,
          )
          assert.equal((await snap()).revision, before)
          const changed = await json(
            '/api/admin/lists/a/access',
            'admin',
            'PUT',
            {
              revision: before,
              viewerUids: ['hub_op', 'hub_ro'],
              assigneeUids: ['hub_op'],
            },
          )
          assert.equal(changed.revision, before + 1)
          assert.equal(
            (
              await request('/api/admin/lists/a/access', 'admin', 'PUT', {
                revision: before,
                viewerUids: [],
                assigneeUids: [],
              })
            ).status,
            409,
          )
          s = await snap()
          assert.equal(
            (
              await request(
                '/api/admin/users/old-owner/access',
                'admin',
                'PUT',
                {
                  revision: s.revision,
                  role: 'reader',
                  accessStatus: 'suspended',
                  listIds: [],
                  responsibleListIds: [],
                },
              )
            ).status,
            403,
          )
          const record = await Audit.findOne({ action: 'list-access' })
          assert.equal(record.actor, identities.admin.email)
          assert.ok(record.before)
          assert.ok(record.after)
          await json('/api/admin/users/hub_op/access', 'admin', 'PUT', {
            revision: s.revision,
            role: 'operator',
            accessStatus: 'suspended',
            listIds: ['a'],
            responsibleListIds: [],
          })
          assert.equal((await request('/api/leads', 'operator')).status, 403)
          assert.equal(
            (await json('/api/users/me', 'operator', 'PUT')).accessStatus,
            'suspended',
          )
          s = await snap()
          await json('/api/admin/users/hub_op/access', 'admin', 'PUT', {
            revision: s.revision,
            role: 'operator',
            accessStatus: 'approved',
            listIds: ['a'],
            responsibleListIds: ['a'],
          })
          s = await snap()
          await json('/api/admin/lists/a/access', 'admin', 'PUT', {
            revision: s.revision,
            viewerUids: ['hub_ro'],
            assigneeUids: [],
          })
          assert.deepEqual(await json('/api/leads', 'operator'), [])
          s = await snap()
          await json('/api/admin/lists/a/access', 'admin', 'PUT', {
            revision: s.revision,
            viewerUids: ['hub_op', 'hub_ro'],
            assigneeUids: ['hub_op'],
          })
        },
      )
      await t.test(
        'archive preserves links, restore recovers visibility, orphan recovery is explicit and versioned',
        async () => {
          let s = await snap()
          await json('/api/admin/lists/a/archive', 'admin', 'PATCH', {
            revision: s.revision,
            archived: true,
          })
          assert.equal((await Lead.findOne({ placeId: 'a1' })).groupId, 'a')
          assert.deepEqual(await json('/api/leads', 'operator'), [])
          s = await snap()
          await json('/api/admin/lists/a/archive', 'admin', 'PATCH', {
            revision: s.revision,
            archived: false,
          })
          assert.equal((await json('/api/leads', 'operator')).length, 2)
          const recovery = await json('/api/admin/recovery')
          assert.equal(recovery.records.length, 1)
          s = await snap()
          await json('/api/admin/recovery', 'admin', 'POST', {
            revision: s.revision,
            groupId: 'a',
            items: [{ placeId: 'orphan', version: 0 }],
          })
          assert.equal((await json('/api/leads', 'operator')).length, 3)
          const lead = await Lead.findOne({ placeId: 'a2' })
          assert.equal(
            (
              await request('/api/leads/a2', 'admin', 'DELETE', {
                version: lead.version,
              })
            ).status,
            204,
          )
          assert.equal((await Lead.findOne({ placeId: 'a2' })).groupId, 'a')
          assert.ok((await Lead.findOne({ placeId: 'a2' })).archivedAt)
          assert.equal((await json('/api/admin/recovery')).records.length, 1)
        },
      )
      await t.test(
        'import previews duplicates and invalid input, never moves or overwrites existing leads, retries safely',
        async () => {
          const leads = [
            { placeId: 'a1', title: 'Do not overwrite' },
            { placeId: 'new-import', title: 'New' },
          ]
          const preview = await json(
            '/api/leads/import/preview',
            'admin',
            'POST',
            { leads },
          )
          assert.equal(preview.existing, 1)
          assert.equal(preview.new, 1)
          assert.equal(
            (
              await request('/api/leads/import', 'admin', 'POST', {
                title: 'Import',
                leads,
              })
            ).status,
            400,
          )
          const imported = await json('/api/leads/import', 'admin', 'POST', {
            title: 'Import',
            leads,
            confirmed: true,
          })
          assert.equal(imported.imported, 1)
          const existing = await Lead.findOne({ placeId: 'a1' })
          assert.equal(existing.title, 'A1')
          assert.equal(existing.groupId, 'a')
          assert.equal(
            (
              await json('/api/leads/import', 'admin', 'POST', {
                title: 'Retry',
                leads,
                confirmed: true,
              })
            ).imported,
            0,
          )
          const counts = await LeadGroup.countDocuments()
          assert.equal(
            (
              await request('/api/leads/import', 'admin', 'POST', {
                title: 'Invalid',
                leads: [
                  { placeId: 'valid', title: 'Valid' },
                  { title: 'Missing ID' },
                ],
                confirmed: true,
              })
            ).status,
            400,
          )
          assert.equal(await LeadGroup.countDocuments(), counts)
          assert.equal(await Lead.countDocuments({ placeId: 'valid' }), 0)
          const p = await json('/api/leads/import/preview', 'admin', 'POST', {
            leads: [leads[1], leads[1], {}],
          })
          assert.deepEqual(p.repeated, [2])
          assert.deepEqual(p.invalid, [3])
        },
      )
      await t.test(
        'structured IDs are rejected and detail/message edits enforce versions',
        async () => {
          const before = await Lead.findOne({ placeId: 'b1' }).lean()
          assert.equal(
            (
              await request('/api/leads/batch', 'operator', 'PUT', [
                {
                  placeId: { $ne: null },
                  version: 0,
                  kanbanState: { column: 'perdido' },
                },
              ])
            ).status,
            400,
          )
          assert.deepEqual(await Lead.findOne({ placeId: 'b1' }).lean(), before)
          const current = await Lead.findOne({ placeId: 'orphan' })
          const details = {
            version: current.version,
            title: 'Recovered contact',
            categoryName: 'Clinic',
            phone: '11999999999',
            website: 'example.com',
            address: 'Test street',
            column: 'contato',
            collectedData: 'Preserved note',
          }
          const updated = await json(
            '/api/leads/orphan/details',
            'operator',
            'PATCH',
            details,
          )
          assert.equal(updated.website, 'https://example.com')
          assert.equal(
            (
              await request(
                '/api/leads/orphan/details',
                'operator',
                'PATCH',
                details,
              )
            ).status,
            409,
          )
          const marked = await json(
            '/api/leads/orphan/message-sent',
            'operator',
            'PATCH',
            { sent: true, version: updated.version },
          )
          assert.ok(marked.messageSentOn)
          assert.equal(marked.kanbanState.collectedData, 'Preserved note')
          assert.equal(
            (
              await request(
                '/api/leads/orphan/message-sent',
                'reader',
                'PATCH',
                { sent: false, version: marked.version },
              )
            ).status,
            403,
          )
          const malformed = await json(
            '/api/leads/import/preview',
            'admin',
            'POST',
            {
              leads: [
                {
                  placeId: 'bad-score',
                  title: 'Invalid number',
                  totalScore: { bad: true },
                },
              ],
            },
          )
          assert.deepEqual(malformed.invalid, [1])
        },
      )
      await t.test(
        'new lists stay private and manual records retain the selected context',
        async () => {
          const list = await json('/api/lead-groups', 'admin', 'POST', {
            groupTitle: 'Manual list',
          })
          assert.deepEqual(list.viewerUids, [])
          assert.ok(
            !(await json('/api/lead-groups', 'operator')).some(
              (g) => g.groupId === list.groupId,
            ),
          )
          const created = await json('/api/leads', 'operator', 'POST', {
            placeId: 'manual-check',
            title: 'Manual contact',
            groupId: 'a',
            kanbanState: { column: 'open' },
            assigneeUid: 'hub_op',
          })
          assert.equal(created.groupId, 'a')
          assert.equal(created.assigneeUid, 'hub_op')
          assert.equal(
            (
              await request('/api/leads', 'operator', 'POST', {
                placeId: 'forbidden-create',
                title: 'Forbidden',
                groupId: 'b',
              })
            ).status,
            404,
          )
          let s = await snap()
          await json('/api/leads/group/' + list.groupId, 'admin', 'PUT', {
            revision: s.revision,
            expectedTitle: 'Manual list',
            groupTitle: 'Renamed list',
          })
          s = await snap()
          assert.equal(
            (
              await request(
                '/api/leads/group/' + list.groupId,
                'admin',
                'PUT',
                {
                  revision: s.revision,
                  expectedTitle: 'Manual list',
                  groupTitle: 'Stale overwrite',
                },
              )
            ).status,
            409,
          )
        },
      )
      await t.test(
        'malformed or duplicate identity cannot obtain owner privileges',
        async () => {
          await User.create({
            firebaseUid: 'duplicate',
            email: identities.reader.email,
            accessStatus: 'approved',
          })
          assert.equal((await request('/api/leads', 'reader')).status, 403)
          assert.equal((await request('/api/leads', 'invalid')).status, 401)
        },
      )
    } finally {
      await new Promise((r) => server.close(r))
      await mongoose.disconnect()
      await replica.stop()
    }
  },
)
