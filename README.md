# Codexa Leads

## Padrão de pesquisa de leads

Na ficha do lead, a aba **Informações do cliente** reúne o cadastro e a pesquisa. Preencha os mesmos campos em todos os segmentos, seguindo o padrão usado na prospecção de Torres.

- **Cadastro** reúne nome, segmento, endereço, telefone comercial, site ou rede social e, quando disponível, avaliação pública. Use os campos cadastrais do lead.
- **Pesquisa** reúne data (`AAAA-MM-DD`), qualificação, perfil do negócio, e-mail público, situação do site, verificação do WhatsApp, hipótese de abordagem, observações e fontes. Em importações, salve em `kanbanState.contactResearch`, com um link por linha em `sources`.
- Registre a origem dos dados e diferencie um número publicado de um canal confirmado. Deixe sem preencher o que não foi encontrado e descreva divergências nas observações.

A aba **Dados** guarda o acompanhamento comercial, como etapa do funil, próxima ação, retorno e anotações internas.

## React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
