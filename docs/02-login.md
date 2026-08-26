# Tela: Login / Cadastro

**Rota:** `/login`
**Arquivo:** `client/pages/Login.tsx`
**Layout:** Sem AppLayout (tela pública)

---

## Objetivo

Tela de entrada do aplicativo. Permite ao usuário fazer login com email e senha, criar uma nova conta em fluxo multi-etapas e recuperar senha esquecida.

---

## Animação de Apresentação (Splash)

Ao abrir `/login`, antes do formulário aparecer, é exibida por ~3.2s uma animação de apresentação em tela cheia (fundo preto, fade-out no final).

- **Estado:** `showSplash` (React.useState, some após `setTimeout` de 3200ms em `Login.tsx`)
- **Componente ativo:** `LoginSplashOriginal` em `client/components/shared/login-splash-original.tsx`
  - Assets: `public/linka-reveal-symbol.png`, `public/linka-reveal-wordmark.png`
- **Componente da campanha da Copa do Mundo 2026 (preservado, fora de uso):** `LoginSplashCopaReveal` em `client/components/shared/login-splash-copa-reveal.tsx`
  - Baseado no design "Linka Copa Reveal" (claude.ai/design, projeto "Linka")
  - Assets: `public/linka-copa-reveal-word.png` (wordmark), `public/linka-copa-reveal-k.png` (K em destaque, verde/amarelo), `public/linka-copa-reveal-ball.png` (bola de futebol)
  - Sequência: aura entra → K em destaque aparece com brilho → bola "chuta" saindo de trás do K, gira e assenta ao lado → wordmark completo emerge → tudo assenta com respiração/brilho contínuo até o fade-out
  - **Não está em uso no momento** — trocar `LoginSplashOriginal` por `LoginSplashCopaReveal` na importação/render de `Login.tsx` para reativar.
- Ambos respeitam `prefers-reduced-motion` e as safe areas do iOS (padding via `env(safe-area-inset-*)`).

---

## Estrutura Visual

```
┌──────────────────────────────────┐
│  Logo RitmoFit / LinKa           │
├──────────────────────────────────┤
│  Tabs: [Entrar] [Criar conta]    │
├──────────────────────────────────┤
│  Conteúdo da Tab ativa           │
│  (formulário)                    │
└──────────────────────────────────┘
```

---

## Tab: Entrar (Login)

### Campos
| Campo | Tipo | Validação |
|---|---|---|
| Email | Input email | Obrigatório |
| Senha | Input password | Mínimo 6 caracteres |

### Botões
- **Entrar** — desabilitado se campos inválidos, sem conexão ou Supabase inacessível
- **Esqueci minha senha** — abre formulário de recuperação

### Recuperação de Senha
- Campo de email
- Botão "Enviar link de recuperação"
- Feedback via toast (sucesso ou erro)
- Link para voltar ao login

---

## Login por Biometria (Face ID / Touch ID)

Login biométrico nativo via plugin Capacitor `@capgo/capacitor-native-biometric` (somente em build iOS/Android; degrada graciosamente na web). A lógica fica isolada em `client/lib/biometric-auth.ts`.

### Premissa de segurança
- O **primeiro acesso é sempre com email + senha** — não há atalho biométrico até o usuário se autenticar uma vez.
- As credenciais (email/senha) são gravadas no **Keychain do iOS**, e o acesso a elas é protegido por um gate biométrico (`verifyIdentity`). A flag de opt-in fica em `localStorage` (`linka_biometric_enabled`). **Nada vai para o banco.**
- `server` do Keychain = `com.linka.meuapp` (appId) → um par de credenciais por device.

### Fluxo
```
1º login (email/senha) com sucesso
  └─ Se há biometria disponível e ainda não ativada
       └─ Dialog "Ativar {Face ID}?" (AlertDialog)
            ├─ Ativar  → verifyIdentity → setCredentials no Keychain → flag = 1 → entra
            └─ Agora não → entra direto

Aberturas seguintes (biometria ativada)
  └─ Ao sair o splash, sem sessão ativa, na aba "Entrar"
       └─ Dispara Face ID automaticamente (1x)
            ├─ Sucesso → getCredentials → signInWithPassword → entra
            ├─ Cancelar/falhar → fallback: botão "Entrar com {Face ID}" + formulário manual
            └─ Senha inválida (mudou em outro device) → desativa biometria + toast + login manual
```

### Ações
| Ação | Onde | Efeito |
|---|---|---|
| Ativar Face ID | AlertDialog pós-login | `enableBiometric()` — grava credenciais no Keychain |
| Entrar com Face ID | Botão na aba "Entrar" (só se ativado) | `authenticateWithBiometric()` → `signInWithPassword` |
| Auto-login | Ao abrir a tela de login | Dispara o fluxo acima automaticamente, 1x |
| Desativar | Configurações → Conta e Segurança (toggle) | `disableBiometric()` — limpa Keychain + flag |

### Observações
- **Logout manual mantém** a biometria (entra direto na próxima vez). Só o toggle em Conta e Segurança desativa.
- Religar a biometria a partir das Configurações orienta o usuário a ativar no próximo login (a senha não é mantida em tela de settings).
- `Info.plist`: requer a chave `NSFaceIDUsageDescription`.

---

## Tab: Criar Conta (Signup)

Fluxo multi-etapas com 5 passos:

### Step 1 — Dados da Conta
| Campo | Tipo | Validação |
|---|---|---|
| Email | Input email | Obrigatório |
| Senha | Input password | Senha forte obrigatória: mínimo 8 caracteres, 1 letra maiúscula e 1 caractere especial. Exibe checklist de requisitos em tempo real enquanto o usuário digita. Toggle show/hide. |
| Confirmar senha | Input password | Deve coincidir com senha, toggle show/hide |

**Verificação de email duplicado:** Feita no Step 3 ao tentar `supabase.auth.signUp()`. Se o email já existe, o Supabase retorna erro `"User already registered"` e o usuário é informado via toast destrutivo.

**Botão "Próximo"** — avança para Step 2

---

### Step 2 — Perfil
| Campo | Tipo | Descrição |
|---|---|---|
| Nome completo | Input text | Obrigatório |
| @ de usuário | Input text | Obrigatório, **mínimo 3 caracteres** e **único** (ver abaixo). Só permite letras, números, `_` e `.`. Sem espaços/caracteres especiais. Salvo em `profiles.handle` **sem** o prefixo `@` (o `@` é apenas visual/exibição). |
| Foto de perfil | File upload | Imagem (upload para bucket `posts`), opcional |
| Bio | Textarea | Descrição pessoal, opcional |
| Perfil comercial | Toggle | Ativa campos de negócio |

**Handle único (trava anti-duplicidade):** enquanto o usuário digita o `@`, é feita uma verificação com debounce (500ms) via RPC `check_handle_exists` (`checkHandleExistsDb`). Feedback inline: "Verificando disponibilidade…" / "❌ Esse @ já está em uso" / "✓ @ disponível". O botão **Próximo** (e o atalho "Personalizar depois") ficam desabilitados até o `@` ter ≥3 caracteres e estar disponível. A unicidade é garantida no banco por um índice único case-insensitive (`profiles_handle_unique_idx`); numa corrida rara, o `INSERT`/`UPDATE` retorna `23505` e o usuário é avisado. O mesmo `check_handle_exists` cobre a edição de handle nas Configurações.

**⭐ Causa raiz da foto que não gravava (correção 2026-07-21b):** o `profilePayload` incluía `email` (`profilePayload.email = authUser.email`), mas a tabela `profiles` **não tem coluna `email`** (o email vive em `auth.users`; só `commercial_profiles` tem `business_email`). No PostgREST, um UPDATE que cita coluna inexistente **falha a instrução inteira** (`PGRST204`), então **nada** do payload gravava — nem `photo`, nem `handle`, nem `nickname`. O nome e o @ apareciam mesmo assim porque quem os grava é o trigger `handle_new_user` (a partir do metadata); a foto não, porque o trigger nunca a define. **Fix: remover o campo `email` do payload.** As proteções abaixo (retry/erros) continuam válidas, mas não resolviam sozinhas — o payload estava "envenenado".

**Foto de perfil no cadastro — cadeia de falhas silenciosas (correção 2026-07-21):** a foto subia no Step 2 mas o usuário caía no feed com o avatar padrão. Eram vários pontos que falhavam **sem emitir erro**, todos corrigidos:

| Ponto | Falha silenciosa | Correção |
|---|---|---|
| `getUser()` logo após o `signUp` | Se a sessão ainda não estava pronta, vinha `null` e **todo** o bloco de gravação (foto + dados) era pulado sem aviso | Retenta 1x após 800ms; se ainda faltar, avisa por toast |
| Upload no bucket `posts` | `if (!uploadError)` **engolia** o erro → `photoUrl` ficava `undefined` | `withNetworkRetry` (2 tentativas, `upsert: true`) + `console.error` + toast |
| Extensão do arquivo | Usava a extensão do original (no iOS costuma ser `.heic`) para um conteúdo que o cropper sempre exporta em **JPEG** | Key fixa `.jpg` + `contentType: "image/jpeg"` |
| `UPDATE` em `profiles` | Um UPDATE barrado por RLS — ou numa linha inexistente — afeta **0 linhas sem retornar erro** (mesmo no-op do DELETE) | `.select("photo, handle")` para detectar 0 linhas; nesse caso faz `upsert` criando o perfil |
| `user_metadata.avatar_url` | Nunca era preenchido; se a linha de `profiles` não existisse, quem a criava era o `ensureProfile()` do feed, que tira a foto justamente desse campo → perfil nascia **sem foto** | Após o upload, espelha a URL em `auth.updateUser({ data: { avatar_url } })` |

> Regra: nenhuma etapa da gravação do cadastro pode engolir erro. Todo `error` de storage/PostgREST é logado e, quando afeta o usuário, vira toast.

**Persistência de foto + handle no cadastro (correção 2026-07-20):** a gravação do perfil no fim do cadastro (`handleSignupStep3`) usa `UPDATE` na linha já criada pelo trigger `handle_new_user` (policy `profiles_update_own`). Antes usava `upsert`, cujo braço de `INSERT` era barrado pelo RLS (não havia policy de INSERT) e falhava **em silêncio** — por isso a foto não virava avatar e o handle escolhido não sobrescrevia o valor do trigger (que era gravado com `@`, causando exibição com a 1ª letra "comida"). A migração `20260720` adiciona a policy `profiles_insert_own`, normaliza handles legados (remove `@`) e passa o trigger a gravar o handle sem `@`. Após o `UPDATE`, o cache do perfil é invalidado (`invalidateProfileCache`) para o feed ler os dados novos.

**Se perfil comercial ativado → abre wizard comercial (Step 2.5) com 4 sub-etapas:**

**Sub-etapa 1 — Essenciais:**
| Campo | Tipo | Obrigatório |
|---|---|---|
| Segmento do negócio | Select | ✓ |
| Nome do negócio | Input | ✓ |
| Logo do negócio | File upload (imagem) | — |
| Descrição | Textarea | — |

**Sub-etapa 2 — Contato:**
| Campo | Tipo |
|---|---|
| Telefone comercial | Input (máscara) |
| Email comercial | Input |

**Sub-etapa 3 — Presença online:**
| Campo | Tipo |
|---|---|
| Site / Portfolio | Input URL |

Exibe resumo do perfil comercial antes de concluir.

**Sub-etapa 4 — Planos e Serviços:**
| Campo | Tipo |
|---|---|
| Nome do plano | Input |
| Preço (R$) | Input number (null = "sob consulta") |
| Descrição do plano | Input |

Permite adicionar múltiplos planos via botão "Adicionar plano". Cada plano pode ser removido individualmente. Botão "Adicionar planos depois →" permite pular. Os planos são salvos na tabela `commercial_plans` via `saveCommercialPlansDb`. A logo é enviada para o Supabase Storage e a URL salva em `business_logo_url`.

**Botões:** Voltar | Próximo / Concluir

---

### Step 2.8 — Dados Físicos (nova etapa após Step 2 / 2.5)

| Campo | Tipo | Descrição |
|---|---|---|
| Sexo | Botões de seleção (Masculino / Feminino / Outro) | Opcional. Salvo em `profiles.gender`. |
| Idade | Input number | Opcional. Salvo em `profiles.age`. |
| Altura (cm) | Input number | Opcional. Salvo em `profiles.height`. |
| Peso (kg) | Input number | Opcional. Salvo em `profiles.weight`. |

Todos os campos são opcionais. O botão "Próximo" sempre avança para o Step 3 (objetivos).

---

### Step 3 — Objetivos
Seleção de objetivos fitness (múltipla escolha). Os valores selecionados são salvos no campo `objectives` (text[]) da tabela `profiles` e também no `localStorage` para personalização do feed.

| ID | Label |
|---|---|
| fitness | 🏋️ Fitness & Musculação |
| cardio | 🏃 Cardio & Corrida |
| diets | 🥗 Dietas & Nutrição |
| habits | 🎯 Hábitos & Mindfulness |
| yoga | 🧘 Yoga & Flexibilidade |
| sports | ⚽ Esportes |

**Botões:** Voltar | Próximo

---

### Step 4 — Seguir Pessoas (antigo Step 4, agora Step 5)
- Lista de usuários sugeridos carregada via `getAllUsersDb()`, filtrada para excluir o próprio usuário
- Carregamento com guard de cancelamento (`cancelled` flag) para evitar atualizações de estado após desmontagem
- Campo de busca para filtrar usuários
- Botão follow/unfollow em cada usuário
- Exibe foto e nome de cada usuário

**Botões:** Voltar | **Criar conta** (finaliza cadastro)

---

## Teclado iOS (campos acima do teclado)

Com `Keyboard: { resize: 'none' }` o WebView não encolhe quando o teclado abre, então os campos de email/senha ficavam **atrás do teclado**, sem o usuário ver o que digitava.

Correção **local à tela** (a assistência global de `keyboard.ts` usa `window.scrollBy`, que é no-op aqui porque o contêiner da tela tem `overflow-y-auto` próprio):

- O contêiner rolável (`scrollContainerRef`) recebe `padding-bottom: calc(safe-area + var(--keyboard-height))`. Como o formulário é centralizado com `my-auto`, reservar a altura do teclado o **ergue acima do teclado** e cria espaço de rolagem.
- Um efeito assina `subscribeKeyboardHeight` + `focusin` no contêiner e rola **o próprio contêiner** (`container.scrollBy`) para revelar o campo focado acima de `innerHeight − keyboardHeight − 16` — útil para os campos mais abaixo nos passos de cadastro.
- Inputs dentro de drawers/dialogs (`[role="dialog"]`, ex.: cropper de imagem) são ignorados — eles se erguem sozinhos via a arquitetura de teclado.
- A transição de `padding-bottom` (0.25s) sincroniza a subida com a animação do teclado. `var(--keyboard-height, 0px)` = 0 na web, então o comportamento é inerte fora do iOS.

> Regra: não alterar `client/lib/keyboard.ts` para resolver isso — a correção é sempre local ao componente com contêiner rolável próprio.

---

## Detecção de Rede

O componente monitora:
- **Conexão com internet** — via `addNetworkStatusListener`
- **Alcançabilidade do Supabase** — via `checkSupabaseReachability`

Se offline ou Supabase inacessível:
- Botão de login/cadastro é desabilitado
- Exibe badge/aviso de status de conexão

---

## Fluxo de Autenticação

```
Login
  └─ supabase.auth.signInWithPassword()
       ├─ Sucesso → navega para /
       └─ Erro "email not confirmed" → alerta de verificação de email

Cadastro
  └─ Step 1: email, senha
  └─ Step 2: nome, @handle, foto, bio, perfil comercial
  └─ Step 2.5 (opcional): wizard comercial (3 sub-etapas)
  └─ Step 2.8: dados físicos (sexo, idade, altura, peso) — todos opcionais
  └─ Step 3 (handleSignupStep3):
       ├─ isCompletingSignup = true  ← inibe navegação automática
       ├─ supabase.auth.signUp()
       │    └─ Erro "User already registered" → toast + abort
       ├─ supabase.auth.signInWithPassword()
       ├─ upsert profiles (photo, bio, objectives, handle, gender, age, height, weight)
       ├─ insert commercial_profiles (se aplicável)
       └─ setSignupStep(4)
  └─ Step 4 (handleSignupComplete):
       ├─ isCompletingSignup = false
       └─ navega para /
```

---

## Tema

- Botão para alternar dark/light theme (via `useTheme`)
- Logo muda conforme o tema:
  - Dark: `logo-horizontal-icone-branco.png`
  - Light: `logo-horizontal-icone-preto.png`

---

## Estados e Feedback

| Situação | Feedback |
|---|---|
| Campos inválidos | Botão desabilitado |
| Enviando requisição | Estado `busy` — botão com loading |
| Erro de autenticação | Toast destrutivo com mensagem do Supabase |
| Email já cadastrado | Indicador inline no campo |
| Sem conexão | Badge de status + botão desabilitado |
| Cadastro concluído | Navega automaticamente para o feed |

---

## Internacionalização (21/08/2026)

A tela era a **única do app 100% fixa em português** — `Login.tsx` não importava
`useLanguage` nenhuma vez em 2.358 linhas. Agora todo texto visível passa por
`t()`: **211 chaves `login_*`** em `client/lib/i18n.ts`, nos dois idiomas.

Cobre a autenticação, as cinco etapas do cadastro (conta, perfil, wizard
comercial, dados físicos, objetivos), o fluxo de recuperação de senha, o diálogo
de biometria, todos os toasts e as validações inline.

### Detalhes que valem lembrar

- **`FITNESS_SEGMENTS` guarda `labelKey`, não texto.** É uma constante de módulo
  e não alcança o `t()`, que só existe dentro do componente — a tradução acontece
  no render (`t(segment.labelKey)`). O mesmo vale para qualquer lista nova ali.
- **Strings com variável** usam `{placeholder}` + `.replace()`:
  `login_step_of` (`{step}`/`{total}`), `login_forgot_code_sent_to` (`{email}`),
  `login_plan_n` (`{n}`) e as três de biometria (`{method}`).
- **O que segue em português de propósito:** mensagens de `console.error` (são
  dev-facing, e o resto do código loga em PT), o símbolo `R$` e a máscara de
  telefone `(11) 9 9999-9999` — ambos amarrados ao formato brasileiro que o
  `formatPhoneDisplay` aplica.

### Idioma inicial vem do aparelho

Antes o padrão era `"pt"` fixo em `language-context.tsx`. Como a troca manual de
idioma vive em **Perfil → Configurações** — ou seja, **só depois do login** —,
quem instalasse o app não tinha como escolher inglês antes de ver o Login e o
cadastro inteiro: a tradução destas telas seria inalcançável.

`detectDeviceLanguage()` resolve isso: sem escolha salva em
`localStorage["ritmofit-language"]`, o idioma sai de `navigator.languages` /
`navigator.language`. Qualquer variante de português (`pt`, `pt-BR`, `pt-PT`)
fica em `pt`; todo o resto cai em `en`. **A escolha do usuário sempre vence** — o
valor salvo é consultado primeiro.

> Como o app roda em WKWebView, `navigator.language` reflete o idioma do iOS.
> Vale conferir no TestFlight com o aparelho em inglês.
