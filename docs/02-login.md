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
| @ de usuário | Input text | Obrigatório. Só permite letras, números, `_` e `.`. Sem espaços ou caracteres especiais. Salvo no campo `handle` de `profiles`. |
| Foto de perfil | File upload | Imagem (upload para Supabase Storage), opcional |
| Bio | Textarea | Descrição pessoal, opcional |
| Perfil comercial | Toggle | Ativa campos de negócio |

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
