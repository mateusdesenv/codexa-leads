import { useState } from 'react'
import { Badge, Button, Card, Icon } from 'codexa-ui'
import type { LeadWithMeta } from './types'

type Suggestion = {
  text: string
  label?: string
  tone?: 'success' | 'neutral' | 'warning' | 'danger' | 'info'
}

const GENERIC_MESSAGE: Suggestion = {
  text: 'Oi, tudo bem? Vi o perfil da clínica de vocês, gostei bastante do trabalho e queria te fazer uma pergunta rápida: hoje vocês conseguem a maioria dos clientes pelo Instagram ou também usam o Google para captar novos clientes?',
  label: 'Genérica',
  tone: 'warning',
}

const MESSAGE_TEMPLATES: Record<LeadWithMeta['websiteKind'], Suggestion[]> = {
  sem: [
    {
      text: 'Olá! Vi que vocês ainda não têm site. Gostariam de ver um modelo sem compromisso para a clínica?',
    },
    {
      text: 'Olá! Vi que a clínica ainda não tem uma presença digital própria. Posso mostrar um modelo de site sem compromisso?',
    },
  ],
  social: [
    {
      text: 'Olá! Vi que vocês estão no Instagram, mas ainda não têm site. Que tal complementar o perfil com uma página profissional para converter mais interessados?',
    },
    {
      text: 'Olá! Vi que vocês usam redes sociais. Um site profissional ajuda a transformar seguidores em clientes. Gostariam de ver um modelo?',
    },
  ],
  proprio: [
    {
      text: 'Olá! Vi que vocês já têm site. Gostariam de uma proposta para melhorar a estrutura e aumentar as conversões?',
    },
    {
      text: 'Olá! Vi que vocês já têm um site. Posso mostrar como deixá-lo mais rápido, moderno e com mais conversão?',
    },
  ],
}

export default function MessageSuggestions({ lead }: { lead: LeadWithMeta }) {
  const [copied, setCopied] = useState<string | null>(null)

  const suggestions: Suggestion[] = [
    GENERIC_MESSAGE,
    ...(MESSAGE_TEMPLATES[lead.websiteKind] ?? MESSAGE_TEMPLATES.sem),
  ]

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(text)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      // ignore
    }
  }

  return (
    <div className="message-suggestions">
      <h3 className="message-suggestions__title">Sugestões de mensagem inicial</h3>
      <div className="message-suggestions__list">
        {suggestions.map((suggestion, index) => (
          <Card key={index} padding="small" className="message-suggestion">
            <div className="message-suggestion__content">
              {suggestion.label && (
                <Badge tone={suggestion.tone ?? 'neutral'} size="small">
                  {suggestion.label}
                </Badge>
              )}
              <p className="message-suggestion__text">{suggestion.text}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="small"
              onClick={() => handleCopy(suggestion.text)}
              leadingIcon={<Icon name="copy" size={14} />}
            >
              {copied === suggestion.text ? 'Copiado' : 'Copiar'}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  )
}
