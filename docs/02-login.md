# Tela: Login / Cadastro

**Rota:** `/login`
**Arquivo:** `client/pages/Login.tsx`
**Layout:** Sem AppLayout (tela pública)

---

## Objetivo

Tela de entrada do aplicativo. Permite ao usuário fazer login com email e senha, criar uma nova conta em fluxo multi-etapas, recuperar senha esquecida e configurar autenticação biométrica (WebAuthn).

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
- **Entrar com biometria** — visível se WebAuthn disponível e biometria cadastrada

### Recuperação de Senha
- Campo de email
- Botão "Enviar link de recuperação"
- Feedback via toast (sucesso ou erro)
- Link para voltar ao login

### Autenticação Biométrica (WebAuthn)
- Detecta automaticamente se o dispositivo suporta autenticação de plataforma
- Se o usuário já registrou biometria, exibe opção "Entrar com biometria"
- Após login bem-sucedido, oferece cadastrar biometria (showBiometricSetup)

---

## Tab: Criar Conta (Signup)

Fluxo multi-etapas com 4 passos:

### Step 1 — Dados da Conta
| Campo | Tipo | Validação |
|---|---|---|
| Nome de usuário | Input text | Obrigatório |
| Email | Input email | Verificação de unicidade em tempo real |
| Senha | Input password | Mínimo 6 caracteres, com toggle show/hide |
| Confirmar senha | Input password | Deve coincidir com senha, toggle show/hide |

**Verificação de email:**
- Enquanto digita, verifica se o email já está cadastrado (`emailCheckStatus`)
- Estados: `idle` → `checking` → `valid` | `exists`
- Feedback visual inline

**Botão "Próximo"** — avança para Step 2

---

### Step 2 — Perfil
| Campo | Tipo | Descrição |
|---|---|---|
| Foto de perfil | File upload | Imagem (upload para Supabase Storage) |
| Bio | Textarea | Descrição pessoal, opcional |
| Perfil comercial | Toggle | Ativa campos de negócio |

**Se perfil comercial ativado → abre wizard comercial (Step 2.5) com 3 sub-etapas:**

**Sub-etapa 1 — Essenciais:**
| Campo | Tipo | Obrigatório |
|---|---|---|
| Segmento do negócio | Select | ✓ |
| Nome do negócio | Input | ✓ |
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

Exibe resumo do perfil comercial antes de concluir. Botão "Pular por agora" disponível nas sub-etapas opcionais.

**Botões:** Voltar | Próximo / Concluir

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

### Step 4 — Seguir Pessoas
- Lista de usuários sugeridos carregada via `getAllUsersDb()`
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
  └─ supabase.auth.signUp()
       └─ Sucesso → signIn → upsert profiles (photo, bio, objectives) → insert commercial_profiles → navega para /
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
