# CLAUDE.md — Guia de Trabalho para o Projeto LinKa

Este arquivo define como o Claude deve trabalhar neste projeto. Leia sempre antes de iniciar qualquer tarefa.

---

## 0a. Ambiente do Desenvolvedor: Windows + Ionic Appflow (Sem Mac)

> **REGRA CRÍTICA:** O desenvolvedor **não tem acesso a um Mac**. Trabalha no **Windows** e usa o **Ionic Appflow** para gerar builds iOS e enviar à Apple. Isso muda completamente o que pode e o que não pode ser pedido a ele.

### Implicações práticas

- **Não peça para abrir o Xcode.** "Abre o Xcode e marca tal target membership", "vai no File Inspector", "Clean Build Folder" — nada disso é executável. Se a tarefa exigir mudança no projeto Xcode, **edite `ios/App/App.xcodeproj/project.pbxproj` diretamente** (PBXBuildFile, PBXFileReference, group children, sources phase, etc.).
- **Não peça para rodar simulador iOS / `xcodebuild` / `pod install` localmente.** Esses passos só rodam no Appflow (cloud). Validação visual de mudanças nativas só acontece via Appflow + TestFlight ou device físico.
- **Capacitor sync (`pnpm build && npx cap sync ios`) é OK** — roda no Windows e atualiza arquivos JS/config dentro de `ios/`.
- **Sem compilador Swift local.** Erros Swift só aparecem no log do Appflow — escreva código conservador, com tipos explícitos e `@available` correto.
- **Edits em `.pbxproj` são primeira classe.** Formato plist OpenStep, UUIDs hex de 24 chars. Ao adicionar/remover arquivo, atualize **4 lugares**: `PBXBuildFile`, `PBXFileReference`, `PBXGroup` (children) e `PBXSourcesBuildPhase`/`PBXResourcesBuildPhase` (files). Sem isso o Appflow falha.
- **Capabilities/permissões** = editar `Info.plist` e `App.entitlements` direto, não via aba "Signing & Capabilities".
- **Fluxo padrão ao concluir mudanças nativas:** `pnpm build` → `npx cap sync ios` → commit → push → build no Appflow → TestFlight.

### O que continua sendo possível no Windows

Todo o código TypeScript/React, Swift, Info.plist, entitlements, project.pbxproj. Rodar `pnpm dev`, `pnpm build`, `npx cap sync ios`. Validar tudo que é JS/CSS/HTML no navegador.

---

## 0. Plataforma Alvo: Aplicativo iOS (Apple App Store)

> **REGRA CRÍTICA:** Este projeto **não é mais uma aplicação web**. É um **aplicativo mobile nativo/híbrido voltado exclusivamente para a Apple App Store (iOS)**. Toda e qualquer decisão de implementação deve ser tomada com essa premissa.

### O que isso significa na prática

- **Não pensar em browser:** Não há suporte a múltiplos navegadores, extensões, ou comportamentos de desktop. O alvo é exclusivamente iPhone/iPad via iOS.
- **Capacitor/Xcode é o runtime:** O app roda via Capacitor dentro de um WebView nativo. Qualquer funcionalidade que dependa de API de browser deve ser validada quanto ao suporte no WebView do iOS.
- **Apple Guidelines obrigatórias:** Qualquer funcionalidade nova deve ser compatível com as [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/). Isso inclui privacidade, compras, permissões, e conteúdo.
- **Permissões iOS:** Toda API que exija permissão do sistema (câmera, microfone, localização, notificações, HealthKit, etc.) deve usar o plugin Capacitor correspondente e declarar a chave de permissão no `Info.plist`.
- **Safe Area é obrigatória:** Regras da seção 8 deste arquivo são ainda mais críticas no iOS — notch, Dynamic Island e home indicator devem sempre ser respeitados.
- **Sem links externos abertos no browser:** Navegação deve ser feita com `Browser` plugin do Capacitor ou dentro do próprio app. Nunca `window.open` sem controle.
- **Performance mobile-first:** Animações, listas longas e carregamento de imagens devem ser otimizados para dispositivos móveis — não para desktop. Nada de layouts que só funcionam bem em tela grande.
- **Testes em dispositivo real / simulador iOS:** Antes de considerar qualquer tarefa concluída, a funcionalidade deve ser validada no simulador iOS ou em dispositivo físico via Xcode/TestFlight.
- **Sem PWA assumptions:** O app não é PWA. Funcionalidades como service workers, manifest, ou instalação via browser não se aplicam.
- **In-App Purchases:** Qualquer funcionalidade paga deve usar o sistema de compras da Apple (StoreKit) via plugin Capacitor — nunca processamento de pagamento externo para conteúdo digital, conforme exige a Apple.

### Stack mobile

- **Runtime:** Capacitor 6+
- **Projeto nativo:** `ios/App/` (Xcode)
- **Build:** `pnpm build && npx cap sync ios && npx cap open ios`
- **Plugins nativos:** definidos em `capacitor.config.ts` e `ios/App/`

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
| `client/pages/Store.tsx` | `docs/11-vitrine.md` |
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
| Implementar feature completa end-to-end (UI + backend + nativo iOS), diagnosticar bugs iOS, editar Info.plist/pbxproj, integrar plugins Capacitor | `fullstack-ios-agent` | `skills/fullstack-ios-agent.md` |

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
2. Ler docs/15-design-system.md para garantir consistência visual
      ↓
3. Ler a(s) skill(s) relevante(s) para o tipo de tarefa
      ↓
4. Verificar client/components/ — reutilizar componentes existentes antes de criar novos (ver seção 9)
      ↓
5. Implementar a funcionalidade
      ↓
6. Atualizar o arquivo docs/ com o que foi adicionado
      ↓
7. (Se nova tela) Criar novo docs/*.md e atualizar docs/00-overview.md
      ↓
8. (Se nova tabela ou alteração de schema) Atualizar docs/14-database-schema.md
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

---

## 9. Reutilização de Componentes (Obrigatório)

**Antes de criar qualquer novo componente**, verificar se já existe um equivalente na pasta `client/components/`.

### Estrutura da pasta de componentes

| Subpasta | Conteúdo |
|---|---|
| `client/components/ui/` | Componentes Shadcn (Button, Input, Drawer, Dialog, etc.) — nunca recriar |
| `client/components/shared/` | Componentes reutilizáveis entre múltiplas telas (ReportDrawer, ImageZoomDrawer, PostIncentiveButton, etc.) |
| `client/components/goals/` | Drawers e dialogs específicos da tela de Metas |
| `client/components/community/` | Drawers e dialogs específicos da tela de Comunidade |
| `client/components/profile/` | Drawers e dialogs específicos da tela de Perfil |
| `client/components/post/` | Componentes relacionados a posts (EditPostDrawer, PostCarousel, etc.) |

### Regra de prioridade ao implementar um drawer, dialog ou formulário

```
1. Verificar client/components/shared/ — existe algo reutilizável?
      ↓
2. Verificar a subpasta da feature (ex: client/components/goals/) — existe o componente?
      ↓
3. Verificar outras subpastas — o componente existe em outra feature e pode ser aproveitado?
      ↓
4. Somente se não existir nada equivalente → criar novo componente
```

### O que verificar antes de criar

- **Drawers de edição de texto/descrição** → verificar `EditShotDescriptionDrawer` (em `shots/`), `EditPostDrawer` (em `post/`)
- **Drawers de report/denúncia** → verificar `ReportDrawer` em `shared/`
- **Drawers de compartilhamento** → verificar `ShareDrawer` em `shared/`
- **Drawers de crop de imagem** → verificar `ImageCropperDrawer` em `shared/`
- **Criação de meta/rotina** → verificar `CreateWizardDrawer` em `goals/`
- **Detalhe de rotina** → verificar `RoutineDetailDrawer` em `goals/`
- **Sessão de treino** → verificar `WorkoutSessionDialog` em `goals/`
- **Dialog de meta concluída** → verificar `GoalCompletedDialog` em `shared/`

> **Regra:** Criar um componente duplicado que faz o mesmo que um já existente é proibido. Se o componente existente não atender 100% mas for parecido, estender via props adicionais ou adaptá-lo — nunca duplicar.

---

## 7. Design System (Obrigatório)

**Antes de implementar qualquer elemento visual**, ler `docs/15-design-system.md`.

O design system é a fonte de verdade para:
- Paleta de cores e tokens semânticos
- Escala tipográfica
- Padrões de botões, cards, formulários, modais
- Tamanhos e ícones (Lucide)
- Regras de espaçamento e arredondamento
- Animações e transições
- Comportamento em dark mode

> **Regra:** Nenhum elemento visual deve ser criado sem consultar o design system. Qualquer novo padrão descoberto durante a implementação deve ser adicionado ao `docs/15-design-system.md`.

---

## 8. Safe Area do iPhone (Obrigatório)

O app usa `viewport-fit=cover` para funcionar como PWA no iPhone. Isso significa que o conteúdo pode renderizar atrás do notch e do home indicator se não houver tratamento correto.

### Regras para qualquer elemento fixo ou popup

- **Nunca** posicionar um elemento fixo sem considerar `env(safe-area-inset-top/bottom/left/right)`
- Usar sempre `max(Xrem, env(safe-area-inset-*))` para garantir espaço mínimo mesmo em dispositivos sem notch
- Para dialogs/modais centrados: usar um wrapper `fixed inset-0 flex items-center justify-center pointer-events-none` com padding safe area, e `pointer-events-auto` no conteúdo interno
- Para drawers que sobem de baixo: `padding-bottom: env(safe-area-inset-bottom)`
- Para sheets laterais ou superiores: padding no lado correspondente
- Para toasts (Sonner): `--offset: max(1rem, env(safe-area-inset-bottom))`

### Padrão de implementação

```tsx
// Dialog / Modal centrado
<div
  className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
  style={{
    paddingTop: "max(1rem, env(safe-area-inset-top))",
    paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
    paddingLeft: "max(1rem, env(safe-area-inset-left))",
    paddingRight: "max(1rem, env(safe-area-inset-right))",
  }}
>
  <div className="pointer-events-auto max-h-full overflow-y-auto ...">
    {/* conteúdo */}
  </div>
</div>

// Drawer (bottom sheet)
style={{
  paddingBottom: "env(safe-area-inset-bottom)",
  paddingLeft: "env(safe-area-inset-left)",
  paddingRight: "env(safe-area-inset-right)",
}}
```

> **Regra:** Qualquer novo popup, drawer, dialog, sheet ou elemento fixo criado deve respeitar as safe areas. Os componentes base em `client/components/ui/` (drawer, dialog, alert-dialog, sheet, sonner) já aplicam isso — não remover.

---

## 11. Internacionalização / Traduções (Obrigatório)

O app suporta PT e EN via `client/lib/i18n.ts` + `client/lib/language-context.tsx`. **Toda string visível ao usuário deve usar o sistema de tradução** — nunca texto hardcoded em português ou inglês diretamente no JSX ou em chamadas de `toast()`.

### Como funciona

- Todas as chaves ficam em `client/lib/i18n.ts`, nos objetos `translations.pt` e `translations.en`
- Nos componentes: `const { t } = useLanguage()` → `t("chave")`
- Nos toasts: `toast({ title: t("chave"), description: t("outra_chave") })`

### Regras obrigatórias

1. **Nova tela ou feature** → adicionar todas as strings novas em `i18n.ts` nas duas línguas (pt e en) antes de implementar
2. **Tela existente sem tradução** → ao tocar na tela por qualquer motivo, verificar se há strings hardcoded e traduzi-las na mesma tarefa
3. **Nunca** escrever texto em PT ou EN diretamente em JSX — qualquer string que o usuário veja deve ter uma chave em `i18n.ts`
4. **Nomes de chaves**: usar prefixo da tela/contexto (ex: `profile_`, `goals_`, `feed_`, `shots_`, `settings_`, `community_`)
5. **Strings com variáveis**: usar `{placeholder}` na chave e `.replace("{x}", valor)` no código (ex: `t("profile_incentives_label").replace("{n}", String(count))`)

### Checklist ao implementar qualquer coisa

```
- [ ] Todos os textos visíveis ao usuário usam t("chave")?
- [ ] As chaves foram adicionadas tanto em translations.pt quanto em translations.en?
- [ ] Toasts de sucesso e erro usam t()?
- [ ] Placeholders de inputs usam t()?
- [ ] Títulos de dialogs/drawers usam t()?
- [ ] Mensagens de estado vazio usam t()?
```

> **Regra:** Ao encontrar qualquer string hardcoded em português em qualquer tela que você tocar durante uma tarefa, traduza na mesma entrega. Não deixe para depois.

---

## 10. Database Schema (Obrigatório)

**Sempre que uma nova tabela for criada, sugerida ou alterada**, atualizar `docs/14-database-schema.md`.

### O que atualizar

- Nova tabela → adicionar definição completa (colunas, tipos, constraints, RLS)
- Nova coluna em tabela existente → atualizar a definição da tabela
- Nova função ou trigger → documentar no arquivo
- Nova política RLS → registrar junto à tabela correspondente
- Relação entre tabelas alterada → atualizar o diagrama/descrição de relações

> **Regra:** O `docs/14-database-schema.md` é a fonte de verdade do banco. Nunca implemente uma query ou função sem verificar se a tabela/coluna existe conforme documentado.
