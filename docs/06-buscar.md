# Tela: Buscar

**Rota:** `/buscar`
**Arquivo:** `client/pages/Search.tsx`
**Layout:** AppLayout

---

## Objetivo

Tela de descoberta. Permite ao usuário encontrar outros usuários para seguir e descobrir rotinas criadas pela comunidade para copiar e usar no próprio perfil.

---

## Estrutura Visual

```
┌──────────────────────────────────┐
│  Tabs: [Usuários] [Rotinas]      │
├──────────────────────────────────┤
│  [Campo de busca]                │
├──────────────────────────────────┤
│  Lista de resultados             │
└──────────────────────────────────┘
```

---

## Tab: Usuários

### Campo de Busca
- Input de texto com debounce e placeholder dinâmico por aba:
  - Aba Pessoas: "Busque por pessoas"
  - Aba Treinos: "Busque por treinos"
  - Aba Dietas: "Busque por dietas"
- Ao digitar, filtra usuários via `searchUsersDb(query)`
- Lista inicial carregada com todos os usuários via `getAllUsersDb()`

### Card de Usuário

Cada usuário exibe:
| Elemento | Descrição |
|---|---|
| Avatar | Foto de perfil (fallback: div cinza) |
| Nome / Nickname | Clicável — navega para `/usuario/:userId` |
| Botão Follow/Unfollow | Toggle de seguimento |

**Botão Follow:**
- Ícone `UserPlus` (não seguindo) → chama `followUserDb`
- Ícone `UserCheck` (seguindo) → chama `unfollowUserDb`
- Estado inicial carregado via `getFollowingIdsDb()`

### Comportamento
- Ao clicar no nome/avatar → navega para o perfil público do usuário
- Ao clicar no botão follow → atualiza estado localmente (otimístico)
- Toast de confirmação após follow/unfollow

---

## Tab: Rotinas

### Campo de Busca
- Input de texto
- Busca via `searchRoutinesDb(query)`

### Card de Rotina (`RoutineCard`)

Cada rotina exibe:
| Elemento | Descrição |
|---|---|
| Nome da rotina | Destaque em `font-semibold` |
| Avatar + nickname do criador | Clicável — navega para perfil |
| Botão Copiar | Copia a rotina para o usuário logado |
| Botão Expandir/Recolher | Mostra/esconde os itens da rotina |

**Botão Copiar:**
- Ícone `Copy`
- Chama `copyRoutineToUserDb(routineId)`
- Toast de sucesso após copiar
- Rotinas próprias não mostram o botão de copiar (`isOwn: true`)
- Apenas rotinas originais aparecem na busca (`follower_id IS NULL` no `searchRoutinesDb`)

**Expandir Rotina:**
- Ícone `ChevronDown` / `ChevronUp`
- Ao expandir pela primeira vez, carrega os itens lazy:
  - Exercícios via `getRoutineWorkoutsDb(routineId)`
  - Dietas via `getRoutineDietsDb(routineId)`
- Exibe lista de exercícios e refeições com nome e detalhes básicos

### Seção de Exercícios (expandida)
```
Exercícios:
  • Supino Reto — 3 séries × 12 reps
  • Agachamento — 4 séries × 10 reps

Dietas:
  • Café da Manhã — 400 kcal
  • Almoço — 600 kcal
```

---

## Dados Carregados

| Dado | Função DB |
|---|---|
| Todos os usuários (inicial) | `getAllUsersDb()` |
| Busca de usuários | `searchUsersDb(query)` |
| IDs que o usuário segue | `getFollowingIdsDb()` |
| Busca de rotinas | `searchRoutinesDb(query)` |
| Exercícios de uma rotina | `getRoutineWorkoutsDb(routineId)` |
| Dietas de uma rotina | `getRoutineDietsDb(routineId)` |

---

## Internacionalização

- Usa `useLanguage()` para textos traduzíveis
- `loadingText` exibido enquanto carrega itens da rotina

---

## Estados da Tela

| Estado | Comportamento |
|---|---|
| Carregando usuários | Lista vazia com spinner |
| Sem resultados | Mensagem "Nenhum usuário encontrado" |
| Carregando itens de rotina | Spinner no card da rotina |
| Copiando rotina | Botão em estado de loading |
| Sucesso ao copiar | Toast de confirmação |
| Erro ao copiar | Toast destrutivo |

---

## Observações Técnicas

- `RoutineCard` é um componente interno isolado para melhor performance
- Status de follow/unfollow é gerenciado localmente em um Set de IDs
- Itens de rotina são carregados sob demanda e cacheados em estado local (`Record<string, RoutineItemRow[]>`)
