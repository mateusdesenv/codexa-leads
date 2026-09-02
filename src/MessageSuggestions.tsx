import { useState } from 'react'
import { Button, Card, Icon } from 'codexa-ui'
import type { LeadWithMeta } from './types'

const MESSAGE_TEMPLATES: Record<LeadWithMeta['websiteKind'], string[]> = {
  sem: [
    'Olá! Vi que vocês ainda não têm site. Gostariam de ver um modelo sem compromisso para a clínica?',
    'Olá! Vi que a clínica ainda não tem uma presença digital própria. Posso mostrar um modelo de site sem compromisso?',
  ],
  social: [
    'Olá! Vi que vocês estão no Instagram, mas ainda não têm site. Que tal complementar o perfil com uma página profissional para converter mais interessados?',
    'Olá! Vi que vocês usam redes sociais. Um site profissional ajuda a transformar seguidores em clientes. Gostariam de ver um modelo?',
  ],
  proprio: [
    'Olá! Vi que vocês já têm site. Gostariam de uma proposta para melhorar a estrutura e aumentar as conversões?',
    'Olá! Vi que vocês já têm um site. Posso mostrar como deixá-lo mais rápido, moderno e com mais conversão?',
  ],
}

export default function MessageSuggestions({ lead }: { lead: LeadWithMeta }) {
  const [copied, setCopied] = useState<string | null>(null)

  const messages = MESSAGE_TEMPLATES[lead.websiteKind] ?? MESSAGE_TEMPLATES.sem

  const handleCopy = async (message: string) => {
    try {
      await navigator.clipboard.writeText(message)
      setCopied(message)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      // ignore
    }
  }

  return (
    <div className="message-suggestions">
      <h3 className="message-suggestions__title">Sugestões de mensagem inicial</h3>
      <div className="message-suggestions__list">
        {messages.map((message, index) => (
          <Card key={index} padding="small" className="message-suggestion">
            <p className="message-suggestion__text">{message}</p>
            <Button
              type="button"
              variant="ghost"
              size="small"
              onClick={() => handleCopy(message)}
              leadingIcon={<Icon name="copy" size={14} />}
            >
              {copied === message ? 'Copiado' : 'Copiar'}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  )
}
