# CLAUDE.md — Guia de Trabalho para o Projeto LinKa

Este arquivo define como o Claude deve trabalhar neste projeto. Leia sempre antes de iniciar qualquer tarefa.

---

## 1. Consultar a Documentação Antes de Alterar

Antes de modificar, criar ou refatorar qualquer tela, **sempre consulte o arquivo `.md` correspondente na pasta `docs/`**.

### Mapeamento de telas → documentação

| Tela / Arquivo | Documento |
|---|---|
| `client/pages/Index.tsx` | `docs/01-feed.md` |
| `client/pages/Login.tsx` | `docs/02-login.md` |
| `client/pages/Shots.tsx` | `docs/03-shots.md` |
| `client/pages/NewPost.tsx` | `docs/04-novo-post.md` |
| `client/pages/Goals.tsx` | `docs/05-metas.md` |
| `client/pages/Search.tsx` | `docs/06-buscar.md` |
| `client/pages/Community.tsx` | `docs/07-comunidade.md` |
| `client/pages/Profile.tsx` | `docs/08-perfil.md` |
| `client/pages/PostDetail.tsx` | `docs/09-post-detalhe.md` |
| `client/pages/Notifications.tsx` | `docs/10-notificacoes.md` |
| `client/pages/Store.tsx` | `docs/11-loja.md` |
| `client/pages/NotFound.tsx` | `docs/12-not-found.md` |
| Layouts e componentes compartilhados | `docs/13-layouts-e-componentes.md` |
| Visão geral do produto | `docs/00-overview.md` |

> **Regra:** Não faça suposições sobre o que uma tela faz. Leia a doc primeiro para entender o contexto, os fluxos existentes e os componentes em uso.

---

## 2. Atualizar a Documentação Após Cada Implementação

**A cada nova funcionalidade implementada**, o arquivo `.md` correspondente na pasta `docs/` deve ser atualizado para refletir a mudança.

### O que atualizar

- Nova seção ou sub-seção adicionada à tela → adicionar na estrutura visual e na descrição
- Novo botão ou ação → adicionar na tabela de ações
- Novo dado carregado do banco → adicionar na tabela de dados
- Novo componente utilizado → adicionar na tabela de componentes
- Mudança de fluxo → atualizar o fluxo descrito
- Nova tela criada → criar um novo arquivo `.md` na pasta `docs/` e registrar no `docs/00-overview.md`

> **Regra:** A documentação nunca deve estar desatualizada. Ela é a fonte de verdade sobre o que cada tela faz.

---

## 3. Usar as Skills Disponíveis na Pasta `skills/`

O projeto tem agentes especializados na pasta `skills/`. **Use o agente que faz sentido para o tipo de tarefa** antes ou durante a implementação.

### Guia de uso das skills

| Situação | Skill a usar | Arquivo |
|---|---|---|
| Nova funcionalidade, novo recurso, melhoria de produto (fitness/treinos) | `fitness-growth-agent` ou `product-growth-agent` | `skills/fitness-growth-agent.md` / `skills/product-growth-agent.md` |
| Nova funcionalidade de nutrição, alimentação, dieta ou modo profissional para nutricionistas | `nutrition-growth-agent` | `skills/nutrition-growth-agent.md` |
| Reorganizar arquivos, mover componentes, criar estrutura de pastas por feature | `file-organizer-agent` | `skills/file-organizer-agent.md` |
| Design de interface, experiência do usuário, fluxos de tela | `uiux-senior-agent` | `skills/uiux-senior-agent.md` |
| Problemas de desempenho, lentidão, otimização de queries | `performance-agent` | `skills/performance-agent.md` |
| Testar funcionalidade, validar fluxos, encontrar bugs | `qa-senior-agent` | `skills/qa-senior-agent.md` |
| Lógica de backend, rotas de API, queries no Supabase, segurança | `backend-senior-agent` | `skills/backend-senior-agent.md` |
| Remover código morto, imports/variáveis não usadas, melhorias cirúrgicas em código ativo | `frontend-cleanup-agent` | `skills/frontend-cleanup-agent.md` |

### Como usar uma skill

Ao identificar a necessidade, leia o arquivo `.md` da skill correspondente e adote a **mentalidade, critérios e checklist** descritos nele antes de tomar decisões de implementação.

> **Exemplos práticos:**
> - Implementando um sistema de conquistas → ler `fitness-growth-agent.md` para entender como gamificação impacta retenção
> - Adicionando animações ao feed → ler `performance-agent.md` para garantir que não prejudica o FCP/LCP
> - Criando um novo drawer de comentários → ler `uiux-senior-agent.md` para validar o fluxo e a hierarquia visual
> - Após implementar qualquer funcionalidade nova → ler `qa-senior-agent.md` e passar pelos critérios de qualidade listados

---

## 4. Fluxo de Trabalho Padrão

Para qualquer tarefa de implementação, siga esta ordem:

```
1. Ler o arquivo docs/ da tela envolvida
      ↓
2. Ler a(s) skill(s) relevante(s) para o tipo de tarefa
      ↓
3. Implementar a funcionalidade
      ↓
4. Atualizar o arquivo docs/ com o que foi adicionado
      ↓
5. (Se nova tela) Criar novo docs/*.md e atualizar docs/00-overview.md
```

---

## 5. Referência Rápida da Stack

- **Frontend:** React + TypeScript + Tailwind CSS + Shadcn UI
- **Roteamento:** React Router v6 (SPA)
- **Backend / BaaS:** Supabase (Auth, Database, Storage, Realtime)
- **Ícones:** Lucide React
- **Tema:** next-themes (dark/light)
- **Package manager:** pnpm
- **Dev server:** `pnpm dev` (porta 8080)
- **Banco de dados (funções):** todas centralizadas em `client/lib/ritmofit-db.ts`
- **Componentes UI:** `client/components/ui/` (Shadcn)
- **Componentes customizados:** `client/components/`

---

## 6. Regras Gerais

- Preferir editar arquivos existentes a criar novos
- Não duplicar lógica já presente em `ritmofit-db.ts`
- Sempre usar o componente `ImageWithFallback` ao renderizar imagens de usuário
- Toasts de feedback são obrigatórios em qualquer ação assíncrona (sucesso e erro)
- Estados de loading devem usar os componentes de `animated-loading.tsx`
- Manter consistência visual com os padrões já existentes nas telas (cards, botões, drawers, dialogs)
