import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const API = process.env.QNA_API_URL || 'http://localhost:3001/api/qna'

const sectionMap = {
  'sobre o site': 'site',
  'sobre resultados': 'resultados',
  'sobre o projeto': 'projeto',
  'sobre preço': 'preco',
  'preço': 'preco',
  'sobre você e sua empresa': 'empresa',
  'você e sua empresa': 'empresa',
}

const keywordTags = [
  ['instagram', 'instagram'],
  ['google', 'google'],
  ['site', 'site'],
  ['whatsapp', 'whatsapp'],
  ['cliente', 'clientes'],
  ['clientes', 'clientes'],
  ['agendamento', 'agendamentos'],
  ['agendamentos', 'agendamentos'],
  ['procedimento', 'procedimentos'],
  ['procedimentos', 'procedimentos'],
  ['resultado', 'resultados'],
  ['resultados', 'resultados'],
  ['tráfego', 'trafego'],
  ['orgânico', 'organico'],
  ['custo', 'investimento'],
  ['valor', 'investimento'],
  ['mensalidade', 'mensalidade'],
  ['hospedagem', 'hospedagem'],
  ['domínio', 'dominio'],
  ['manutenção', 'manutencao'],
  ['contrato', 'contrato'],
  ['pagamento', 'pagamento'],
  ['imagem', 'imagens'],
  ['imagens', 'imagens'],
  ['foto', 'imagens'],
  ['fotos', 'imagens'],
  ['avaliação', 'avaliacoes'],
  ['avaliações', 'avaliacoes'],
  ['portfolio', 'portfolio'],
  ['portfólio', 'portfolio'],
  ['suporte', 'suporte'],
  ['equipe', 'equipe'],
  ['experiência', 'experiencia'],
  ['experiencia', 'experiencia'],
  ['confiança', 'confianca'],
  ['decisão', 'decisao'],
  ['conversão', 'conversao'],
  ['canais', 'canais'],
  ['conteúdo', 'conteudo'],
  ['texto', 'conteudo'],
  ['responsivo', 'responsivo'],
  ['celular', 'responsivo'],
  ['atualização', 'atualizacao'],
  ['diferencial', 'diferenciais'],
  ['diferenciais', 'diferenciais'],
]

function extractTags(sectionName, text) {
  const tags = new Set()
  const lowerSection = sectionName.toLowerCase()
  for (const [key, tag] of Object.entries(sectionMap)) {
    if (lowerSection.includes(key)) tags.add(tag)
  }
  const lower = text.toLowerCase()
  for (const [word, tag] of keywordTags) {
    if (lower.includes(word)) tags.add(tag)
  }
  if (tags.size === 0) tags.add('prospeccao')
  return Array.from(tags)
}

function sectionForNumber(number) {
  if (number >= 11 && number <= 17) return 'Sobre resultados'
  if (number >= 18 && number <= 27) return 'Sobre o projeto'
  if (number >= 28 && number <= 37) return 'Sobre preço'
  if (number >= 38) return 'Sobre você e sua empresa'
  return 'Sobre o site'
}

function unquote(str) {
  return str.replace(/^[“"]+|[”"]+$/g, '').trim()
}

const source = fs.readFileSync(path.join(__dirname, 'qna-seed-source.md'), 'utf8')

const normalized = source.replace(/[“”]/g, '"')
const questionRegex = /^## +(\d+)\. +"(.+?)"\s*\n\n\*\*Resposta:\*\* *"(.+?)"$/gms
const items = []
let match

while ((match = questionRegex.exec(normalized)) !== null) {
  const number = parseInt(match[1], 10)
  const question = unquote(match[2])
  const answer = unquote(match[3])
  const section = sectionForNumber(number)
  const tags = extractTags(section, `${question} ${answer}`)
  items.push({ question, answer, tags })
}

console.log(`Encontradas ${items.length} perguntas.`)

async function seed() {
  let created = 0
  let failed = 0
  for (const item of items) {
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      })
      if (!res.ok) throw new Error(await res.text())
      created++
      process.stdout.write('.')
    } catch (err) {
      failed++
      console.error(`\nErro ao cadastrar "${item.question.slice(0, 40)}...": ${err}`)
    }
  }
  console.log(`\n\nCadastradas: ${created}/${items.length} (${failed} falhas).`)
  process.exit(failed ? 1 : 0)
}

seed()
