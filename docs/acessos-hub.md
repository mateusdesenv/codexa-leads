# Acesso central e verificação local

A entrada é exclusivamente pelo Hub (`client=leads`). O servidor valida cada token central por `/api/introspect/leads`. Não existe autenticação Firebase independente; `firebaseUid` é somente o nome histórico da chave local, preservada para manter os vínculos existentes.

## Configuração

Use `.env.example` como referência. `MONGODB_URI` é segredo somente do servidor. `CODEXA_HUB_URL` configura a introspecção e `VITE_CODEXA_HUB_URL` a navegação do cliente. O padrão de ambas é `https://hub.codexa-web.online`. Não exponha a conexão do banco em variáveis `VITE_*`.

A base requer suporte a transações (replica set/Atlas). `AccessControl` guarda a revisão administrativa e serializa escritas. `AccessAudit` guarda alterações administrativas. Leads antigos sem `version` são tratados como versão zero; sem `archivedAt`, como ativos.

## Política

Administrador é a conta principal existente. Pessoa nova autorizada pelo Hub começa em Consulta sem listas. A suspensão local prevalece sobre uma nova entrada. Operador/Consulta precisam de participação explícita na lista. Responsabilidade não concede participação. Configurações legadas explícitas são conservadas até a revisão administrativa; ausência de política não dá escrita.

## Verificações

```sh
npm ci
npm run build
npm run lint
npm test
```

Os testes sobem um replica set descartável via `mongodb-memory-server`; nunca usam a base real. Para usar um binário MongoDB já instalado, informe `MONGOMS_SYSTEM_BINARY` e, opcionalmente, `MONGOMS_VERSION` correspondente.

## Revisão visual descartável

```sh
node scripts/preview-fixture.mjs
```

Abra `http://127.0.0.1:4300/?codexa_launch=1`. O script sobe interface, API e Hub simulado apenas no loopback (portas 4300–4302), usa banco descartável e oferece quatro contas fictícias. Não publique esse script. Encerre com Ctrl+C. A simulação valida a navegação e o cliente; a criptografia e concessões do Hub real são responsabilidade do próprio Hub.

## Publicação

Publique cliente e servidor juntos. Atualize abas antigas porque gravações agora exigem versão. Confirme entrada pelo Hub com o administrador e um membro, depois revise perfis/listas na tela Acessos do Leads. Não execute o seed de demonstração na base real. Não reverta apenas o cliente: versões antigas não enviam a revisão necessária.

Registros fora das listas são recuperados explicitamente em Acessos do Leads. Arquivar não apaga vínculos. Restaure listas somente depois de conferir as participações preservadas.
