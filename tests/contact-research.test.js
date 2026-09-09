import test from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { Lead } from '../api/lib/lead.js'
import { parseContactResearch, getContactResearchBackfill, isMetropolitanClinicsGroup } from '../shared/contact-research.js'

const notes = `Pesquisa: 2026-09-09. Pré-qualificação por dados públicos; interesse comercial não confirmado.
Perfil: Clínica de reabilitação com telefone e WhatsApp em diretório comercial.
Hipótese para abordagem: Investigar agendamento de sessões recorrentes. Site próprio não localizado nesta pesquisa; confirmar antes de oferecer criação de site.
E-mail público: contato@example.com
WhatsApp publicado na fonte; entrega não testada.
Observações: Telefone não testado por ligação ou mensagem.
Fontes: https://example.com/fonte | https://example.org/cnpj
Identificador interno manual; não é Google Place ID. Avaliações Google não coletadas.`

test('extracts research without inventing verification and retains all original details', () => {
  const result = parseContactResearch(notes)
  assert.equal(result.researchDate, '2026-09-09')
  assert.equal(result.qualification, 'Pré-qualificação por dados públicos; interesse comercial não confirmado.')
  assert.equal(result.profile, 'Clínica de reabilitação com telefone e WhatsApp em diretório comercial.')
  assert.equal(result.approach, 'Investigar agendamento de sessões recorrentes.')
  assert.equal(result.websiteNotes, 'Site próprio não localizado nesta pesquisa; confirmar antes de oferecer criação de site.')
  assert.equal(result.whatsappStatus, 'WhatsApp publicado na fonte; entrega não testada.')
  assert.equal(result.publicEmail, 'contato@example.com')
  assert.equal(result.sources, 'https://example.com/fonte\nhttps://example.org/cnpj')
  assert.equal(result.observations, 'Telefone não testado por ligação ou mensagem.')
  assert.equal(result.recordNotes, 'Identificador interno manual; não é Google Place ID. Avaliações Google não coletadas.')
  const unconfirmed = parseContactResearch('Canal WhatsApp deste telefone não confirmado.')
  assert.equal(unconfirmed.whatsappStatus, 'Canal WhatsApp deste telefone não confirmado.')
  assert.equal(unconfirmed.publicEmail, undefined)
  assert.equal(unconfirmed.websiteNotes, undefined)
})

test('migration is limited to the exact named group and does not overwrite previously edited or cleared forms', () => {
  const lead = { groupId: 'target', groupTitle: 'Clínicas região metropolitana', kanbanState: { collectedData: notes } }
  assert.ok(getContactResearchBackfill(lead))
  assert.ok(isMetropolitanClinicsGroup(' CLINICAS  REGIAO METROPOLITANA '))
  for (const groupTitle of ['Leads clínicas', 'Clínicas região metropolitana antiga', '', null]) {
    assert.equal(getContactResearchBackfill({ ...lead, groupTitle }), null)
  }
  assert.equal(getContactResearchBackfill({ ...lead, groupId: null }), null)
  for (const contactResearch of [{}, { publicEmail: '' }, { profile: 'Revisado' }]) {
    assert.equal(getContactResearchBackfill({ ...lead, kanbanState: { ...lead.kanbanState, contactResearch } }), null)
  }
  assert.equal(getContactResearchBackfill({ ...lead, kanbanState: { collectedData: '' } }), null)
})

test('parser preserves multiline sources and notes, and empty input stays empty', () => {
  assert.deepEqual(parseContactResearch(null), {})
  assert.deepEqual(parseContactResearch(''), {})
  assert.deepEqual(parseContactResearch('Observações: Primeira linha\nSegunda linha\nFontes: https://example.com\nhttps://example.org'), {
    observations: 'Primeira linha\nSegunda linha', sources: 'https://example.com\nhttps://example.org',
  })
})

test('database model retains every contact field and leaves other leads without research', () => {
  const research = parseContactResearch(notes)
  const lead = new Lead({ title: 'Clínica', placeId: 'test', kanbanState: { column: 'open', collectedData: notes, contactResearch: research } })
  assert.deepEqual(lead.toObject().kanbanState.contactResearch, research)
  const cast = mongoose.cast(Lead.schema, { 'kanbanState.contactResearch.publicEmail': 'edited@example.com' })
  assert.equal(cast['kanbanState.contactResearch.publicEmail'], 'edited@example.com')
  assert.equal(new Lead({ title: 'Outra', placeId: 'other' }).toObject().kanbanState.contactResearch, undefined)
})
