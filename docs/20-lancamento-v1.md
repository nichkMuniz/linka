# Lançamento v1.0 — o que entra, o que fica guardado

> **Fonte de verdade do escopo da primeira submissão.** Antes de ligar qualquer
> flag ou submeter um build, leia este arquivo.

Data da decisão: **26/08/2026**, depois da rejeição da versão 1.2 (56).

---

## 1. Por que existe um recorte

O app acumulou features prontas mais rápido do que conseguimos validá-las em
device. Cada feature a mais no primeiro build soma três custos ao mesmo tempo:

1. **Superfície de review** — mais caminhos para a Apple achar um bug.
2. **Superfície de bug em produção** — código que nunca rodou em iPhone real.
3. **Vazio social** — duelo, ranking, shots e vitrine precisam de base de
   usuários. No dia 1 aparecem vazios e o app parece abandonado.

A rejeição de 26/08/2026 é o caso 1 acontecendo:

> **Guideline 2.1(b) — Performance: App Completeness**
> "The In-App Purchase products in the app exhibited one or more bugs... we were
> unable to load the plans after creating a new account."
> Review device: **iPad Air 11-inch (M3)**, iPadOS 26.6.1

Dois aprendizados nessa mensagem, não um:

- O IAP quebrou no ambiente de review.
- **O app é revisado num iPad.** Isso não é um defeito a corrigir — o suporte a
  iPad é intencional e há layout de tela grande (a sidebar do `AppLayout`). Mas
  significa que **toda validação antes de submeter precisa incluir iPad**, e não
  só iPhone. Ver seção 6.

---

## 2. Regra do recorte

**Nada é apagado.** Todo código continua no repositório, compilando. Uma flag em
[`client/lib/feature-flags.ts`](../client/lib/feature-flags.ts) esconde a porta
de entrada — rota, item de nav, aba ou botão.

Cada release seguinte é **uma flag virando `true`**, não uma branch de 5 mil
linhas voltando para o `main`. Ao religar uma flag, procure por ela no projeto:
cada ponto de uso é um item do checklist de teste daquele release.

---

## 3. O que É o LinKa 1.0

Um **app de treino com camada social**. Você cria e segue rotinas com prescrição
individualizada, registra treino e alimentação, posta o resultado vinculado à
meta, e seus amigos incentivam com os 6 tipos.

| Tela | Rota | Estado |
|---|---|---|
| Feed | `/` | Completo — abre em **Seguindo**, ou em **Descobrir** se o usuário ainda não segue ninguém |
| Novo Post | `/postar` | Só POST (sem SHOT), com vínculo de meta |
| Metas | `/metas` | Núcleo do produto, modo Simplificado |
| Comunidade | `/comunidade` | Só Mensagens (sem barra de abas) |
| Perfil | `/perfil`, `/usuario/:id` | Só a aba Publicações |
| Buscar | `/buscar` | Só Pessoas (sem barra de abas) |
| Notificações | `/notificacoes` | Completo, sem push de re-engajamento |
| Detalhe do post | `/post/:postId` | Completo — destino dos deep links |
| Login/Cadastro | `/login` | Com aceite de termos, sem biometria |
| Admin | `/admin` | Interno — moderação desde o minuto zero |

---

## 4. Estado de cada flag

| Flag | v1.0 | Motivo de estar guardada |
|---|---|---|
| `iap` | ❌ | Causa direta da rejeição 2.1(b). Ver seção 5 |
| `shots` | ❌ | Feed vertical de vídeo esvazia em 40s com pouco conteúdo; dobra a superfície de vídeo |
| `store` | ❌ | Segundo produto dentro do app; não participa do loop de treino; nasce vazia |
| `duels` | ❌ | Exige 4+ amigos ativos; código de 21/08 não validado em device |
| `ranking` | ❌ | Com base pequena, expõe o tamanho do app |
| `workoutParty` | ❌ | De 26/08, realtime, exige amigo treinando no mesmo horário |
| `expertMode` | ❌ | Profundidade de power user; remove metade da superfície de bug da tela mais complexa |
| `muscleAnatomy` | ❌ | Valor no mês 3, ruído no dia 1 |
| `dietAndHabitRoutines` | ❌ | Rotinas de dieta e hábito (tipos 2 e 3). Cada tipo extra multiplica a superfície da tela mais complexa do app — catálogo, progresso e check-in próprios — para quem ainda não completou a primeira semana de treino |
| `foodDiary` | ❌ | Diário Alimentar + catálogo TACO. Cai junto por construção: era acessível **só** pelo card "Dietas" |
| `badges` | ❌ | Insígnias. Amarradas às duas coisas que saíram: as condições de desbloqueio dependem de rotinas de dieta/hábito, e parte do catálogo é premium (selo 👑) |
| `weightTracking` | ❌ | Registro e histórico de peso. O monitoramento vem num momento próprio |
| `workoutStickerOnFlow` | ❌ | Mini frame de treino colado no flow. Os dados vêm de `routines.last_summary` — quem ainda não treinou pelo app abre um seletor vazio. E o sticker fica gravado em `flow.text_elements`, então um flow criado hoje segue renderizando depois |
| `workoutDetailOnPost` | ❌ | Botão "Ver treino" no post. O comparador é de 26/08 e não foi validado; o detalhe série a série é leitura densa demais para quem acabou de instalar. O card de resumo no post **continua** |
| `gpsRun` | ❌ | Única razão para pedir localização **Always**. Ver seção 6 |
| `hashtags` | ❌ | Função de volume: sem posts suficientes, devolve vazio |
| `postTags` | ❌ | Marcar exige ter em quem marcar |
| `postLocation` | ❌ | Alfinete de localização no post. Dado sensível com retorno nulo no v1 — sem hashtags nem busca por lugar, vira só um texto na legenda. Era a última justificativa de `NSLocationWhenInUseUsageDescription` |
| `routineSearch` | ❌ | Idem — sem rotinas públicas, a busca parece quebrada |
| `profileExtraTabs` | ❌ | 4 abas vazias num perfil novo = sinal de app abandonado |
| `signupSuggestions` | ❌ | Já estava fora do fluxo; a flag registra a decisão |
| `biometricLogin` | ❌ | Superfície nativa a mais; o usuário acabou de digitar a senha que criou |
| `reengagementPush` | ❌ | Push não solicitado na 1ª semana gera opt-out irreversível. **Não controla nada no cliente** — o interruptor real é não agendar a edge function |

---

## 5. Monetização desligada — e por que os gates ABREM

Com `FEATURES.iap = false`, o `PremiumProvider` devolve `isPremium: true` para
todo mundo e **nunca configura o SDK da loja**. Como os gates no app inteiro são
escritos como `!isPremium && <bloqueio>`, todos abrem sozinhos — nenhum call site
precisou mudar.

Isso não é um "modo grátis improvisado", é a leitura correta do estado do
produto: **sem loja, todo usuário tem acesso a tudo.** E importa para o review —
um gate fechado sem caminho de compra é funcionalidade quebrada aos olhos da
Apple, e vira rejeição por conta própria.

Duas consequências que precisaram de tratamento explícito:

- **Configurações → Assinatura** apareceria para todos (a condição era
  `isPremium &&`). Ganhou o guard `FEATURES.iap &&`.
- **Termos e Política de Privacidade** só existiam **dentro do paywall**. Com o
  paywall fora, o app ficaria sem nenhum link legal — inaceitável para a Apple,
  que exige a política acessível de dentro do app. Foram para
  **Configurações → Outros**.

### Para religar (v1.1+)

1. Paid Apps Agreement aceito em App Store Connect (Business).
2. Produtos criados e aprovados.
3. EULA e política de privacidade linkados no paywall (Guideline 3.1.2).
4. Teste real em **sandbox**, com **conta nova** — foi exatamente o cenário que
   reprovou.

---

## 6. Mudanças nativas (exigem `npx cap sync ios` + build no Appflow)

| Arquivo | Mudança | Motivo |
|---|---|---|
| `Info.plist` | Removido `NSLocationAlwaysAndWhenInUseUsageDescription` | Localização **Always** é a permissão mais escrutinada da loja. Existia só para o GPS de corrida (`FEATURES.gpsRun`) |
| `Info.plist` | Removido `UIBackgroundModes: [location]` | Idem — `location` era o único modo declarado |
| `Info.plist` | **Mantidas** `NSLocationWhenInUse`, `NSLocationAlwaysAndWhenInUse` e `NSFaceID` | Ver "Purpose strings" abaixo — são obrigatórias mesmo com as features desligadas |

### Purpose strings: obrigatórias mesmo sem usar a feature

O TestFlight devolveu **ITMS-90683** em duas chaves de localização depois que
elas foram removidas. A causa está na própria mensagem da Apple:

> *"If you're using external libraries or SDKs, they may reference APIs that
> require a purpose string. While your app might not use these APIs, a purpose
> string is still required."*

Três plugins continuam **linkados no binário** via SPM, e é o link que dispara a
verificação estática — não a chamada:

| Plugin (`CapApp-SPM/Package.swift`) | Chave exigida |
|---|---|
| `CapacitorGeolocation` | `NSLocationWhenInUseUsageDescription` |
| `CapgoBackgroundGeolocation` | `NSLocationAlwaysAndWhenInUseUsageDescription` |
| `CapgoCapacitorNativeBiometric` | `NSFaceIDUsageDescription` |

As três foram **restauradas**. Isto corrige uma orientação anterior deste
documento: "permissão declarada e nunca solicitada é questionada no review"
estava errado para este caso. Declarar a string é o estado que a Apple exige; o
usuário só vê o alerta se o app chamar a API, e com as flags desligadas ele
nunca chama.

> ⚠️ **`UIBackgroundModes` continua FORA, e isso é diferente.** Background mode é
> uma *capability*, não uma purpose string. A Apple verifica se o modo declarado
> é de fato usado, e declarar `location` sem usar é risco real pela Guideline
> 2.5.4. O aviso do TestFlight não pediu essa chave — só as purpose strings.

**A ficha de privacidade não muda.** Purpose string é permissão; nutrition label
é coleta. O app não coleta localização, então continua marcada como não
coletada.

**Alternativa mais limpa, para quando houver apetite:** remover
`@capacitor/geolocation` e `@capgo/background-geolocation` do `package.json`.
Sem os pacotes, o SPM não linka os frameworks, a verificação não dispara e as
chaves deixam de ser necessárias. O custo é tornar dinâmicos os imports em
`run-tracker.ts` e `NewPost.tsx`, regenerar os DOIS lockfiles e rodar um build
no Appflow às cegas — e um erro de Swift só aparece lá. Por isso não foi feito
agora.

### iPad: mantido de propósito

`TARGETED_DEVICE_FAMILY` continua `"1,2"` e as orientações de iPad continuam no
Info.plist. Chegou-se a cogitar tornar o app iPhone-only por causa do device de
review (iPad Air M3), mas **existe layout específico para tela grande** — a
sidebar do `AppLayout` (68px ↔ 244px, breakpoint `md+`) foi feita para isso.
Tirar o iPad jogaria fora um layout que já funciona.

Consequência prática: **o app É revisado em iPad**, e continuará sendo. Toda
validação de TestFlight deve incluir pelo menos uma passada em tela grande, e
os screenshots da App Store precisam cobrir iPad também.

O predicado `isOutdoorRun()` em `workout-session-dialog.tsx` devolve `false` com
a flag desligada — as ~12 ramificações de `isRunExercise` caem no caminho de
exercício comum e o `run-tracker` jamais é iniciado. É o único ponto que precisou
mudar, e é o que permite tirar a permissão do Info.plist.

---

## 7. Guideline 1.2 — o que faltava e foi construído

Todo app com conteúdo de usuário precisa de **quatro** mecanismos. O LinKa tinha
dois:

| Exigência | Antes | Agora |
|---|---|---|
| Denunciar conteúdo | ✅ só no menu de post/shot/flow do feed | ✅ + no perfil e no detalhe do post |
| Filtrar/moderar | ✅ `admin_delete_content`, banir | ✅ |
| **Bloquear usuário abusivo** | ❌ **não existia** | ✅ `user_blocks` (migração 20260826) |
| **Aceite de EULA no cadastro** | ❌ **não existia** | ✅ checkbox no step 1 |

### Bloquear usuário

Ver [`docs/14-database-schema.md → user_blocks`](./14-database-schema.md#user_blocks)
para o modelo completo. O essencial:

- **Simétrico na leitura, unilateral na escrita.** Quem bloqueia some para o
  bloqueado e vice-versa; só quem bloqueou pode desfazer. Uma direção só não
  protege ninguém.
- **Enforcement real de DM no banco** — a policy `messages_insert_not_blocked`
  substitui `messages_insert_own`. Filtro de UI se contorna; policy, não.
- **Bloquear desfaz o follow nos dois sentidos**, por trigger.
- Filtro aplicado em: feed, Descobrir, busca de usuários, comentários de post e
  lista de conversas.

**UI:**

| Onde | Componente |
|---|---|
| Feed → "..." do post | Item **Bloquear** direto no `DropdownMenu`, ao lado das duas denúncias. É a superfície principal: o post é onde o incômodo aparece, não o perfil. Ao bloquear, o feed recarrega sem skeleton e o card some |
| Detalhe do post → "..." | `UserSafetyDrawer`. Esta tela é o destino dos deep links e não tinha **nenhuma** ação de segurança — um link compartilhado de post abusivo abria só com "Compartilhar" |
| Perfil de outro usuário → "..." | `UserSafetyDrawer` (denunciar + bloquear) |
| Confirmação | `BlockUserDialog` (AlertDialog, não Drawer — bloquear é destrutivo e não pode fechar por arrasto acidental) |
| Desfazer | Configurações → **Contas bloqueadas** (`BlockedAccountsDrawer`) |

O caminho de volta não é opcional: como o bloqueado desaparece de todas as outras
superfícies, essa lista é o **único** lugar de onde é possível desbloquear.

### Aceite de termos

Checkbox obrigatório no **step 1** do cadastro, com links para Termos e
Privacidade abertos via `Browser.open()` do Capacitor, e a frase de tolerância
zero a conteúdo abusivo. O botão fica desabilitado sem o aceite, e a validação do
step 1 tem backstop — o form também submete pelo Enter do teclado iOS.

---

## 7.1. Revisão de cobertura — furos encontrados depois

Esconder a porta de entrada óbvia não basta: quase toda feature tem uma segunda
porta. A revisão de 27/08/2026 achou estes, todos já corrigidos, e o padrão
vale para qualquer flag futura.

| Furo | Por que passou despercebido |
|---|---|
| **Posts de treino sumiram do perfil** | O split `feedPosts` / `workoutPosts` filtrava os canvas para a aba "Treinos". Escondida a aba, os posts não voltaram para "Publicações" — ficaram sem tela nenhuma. Com `profileExtraTabs` desligada, "Publicações" volta a receber tudo |
| **Modo Expert podia ser LIGADO** | O wizard já não oferecia, mas o detalhe da rotina tinha um seletor Simplificado/Expert que reabria a superfície inteira numa rotina existente |
| **Perfil comercial no cadastro** | O Step 2.5 é um wizard de 3 passos de Vitrine. Sem a tela, a pessoa se declarava profissional e não aparecia em lugar nenhum |
| **Notificações órfãs** | Builds do TestFlight criaram shots e promoções que continuam no banco. As notificações delas abriam rotas mortas — o toque caía no catch-all e jogava no feed, sem explicação. Filtradas da lista (não do banco: `markNotificationsAsReadDb` continua zerando o badge) |
| **Queries de duelo em background** | `useDuels` segue montado pelo contador de solicitações, disparando duas queries — uma sem cache, por desenho — a cada abertura da Comunidade, para uma aba que ninguém abre |
| **Anatomia em 3 telas** | O card em Metas era só um dos pontos; `ExerciseAnatomy` também aparecia no detalhe do item, no detalhe da rotina e na sessão de treino |
| **"com fulano" nos posts** | Marcar estava desligado e a aba "Marcações" escondida, mas posts antigos ainda exibiam a linha e o drawer da lista |

### Segunda passada

Aplicando a regra acima de forma sistemática, mais seis:

| Furo | Onde |
|---|---|
| **Marcar pessoas no flow** | O criador de flow tinha o botão "@" intacto. Era a última porta de `postTags` aberta: dava para marcar alguém, gerando uma notificação tipo 16 que a lista filtra e o push redireciona — a marcação existiria e ninguém seria avisado |
| **Marcados exibidos nos dois viewers de flow** | Fileira de avatares e, junto com ela, o **repost** — que só é oferecido a quem foi marcado (`isTaggedViewer`) |
| **Shot compartilhado em DM** | `SharedContentMessage` abria `/shots`. Mensagens assim existem de builds anteriores. Passou a usar o estado "indisponível" que o componente já tinha para conteúdo apagado |
| **Deep link do push** | `notificationDeepLink` ainda mandava para `/vitrine` e `/comunidade?checkin=`. **Não é redundante com o filtro da lista**: aquele limpa o app aberto, este trata o toque no push, que chega com o app fechado e não passa por lá |
| **Banner de push em primeiro plano** | Aparecia para tipos filtrados; ao tocar, a pessoa caía numa lista onde a notificação não está. O banco é o mesmo do TestFlight, e um testador com build antiga ainda gera esses eventos |
| **Quatro queries por abertura de perfil** | `getUserShotsDb`, `getCommercialProfileDb`, `getCommercialOffersByUserIdDb`, `getCommercialPlansDb` e `getTaggedPostsDb` rodavam para abas e frames que ninguém vê |

### Terceira passada

| Furo | Onde |
|---|---|
| **Modo Expert continuava no "+"** | O wizard já pulava o passo internamente, mas `Goals.tsx` abre o wizard **direto** em `routine-mode` quando `createType === 1` — o caminho mais usado de todos nunca passava pela bifurcação corrigida |
| **Sticker de treino no flow** | Ícone de halter na barra do criador de flow, em duas etapas (captura e revisão), mais o drawer seletor. Virou a flag `workoutStickerOnFlow` |
| **"Treinar junto" ANTES de começar o treino** | A barra dentro da sessão estava escondida, mas o convite principal acontece antes: `WorkoutPartyDrawer` aberto por `onTrainTogether` a partir da aba Rotinas, da lista e do detalhe da rotina |
| **Footer com coluna fantasma** | `grid-cols-5` fixo no bottom nav. Com Shots escondido sobraram 4 itens em 5 colunas — os quatro encostados à esquerda e um vazio à direita |

Nota sobre o `onTrainTogether`: a prop é **opcional**, e `routines-tab`,
`routine-list-drawer` e `routine-detail-drawer` só desenham o botão quando ela
existe. Passar `undefined` no `Goals.tsx` apagou os três de uma vez — vale
procurar esse padrão antes de sair guardando cada callsite.

**Regra que sai disso:** ao religar ou desligar uma flag, procure por **quatro**
coisas — o ponto que **cria** o dado, o que o **exibe**, o que **navega** até
ele, e o que o **busca**. Os três últimos foram os que escaparam. E lembre de
dois padrões que enganam:

- **Push tem dois caminhos independentes** (lista dentro do app × toque no push
  com o app fechado): tapar um não tapa o outro.
- **Fluxo com passos pode ser aberto no meio.** Corrigir a navegação interna de
  um wizard não basta se outra tela o abre direto num passo (`initialStep`).
  Foi o que manteve o Modo Expert vivo por duas rodadas.

---

## 7.2. Corte de 27/08 — Metas enxuta

Quatro remoções pedidas depois da terceira passada, todas reversíveis por flag.

### Rotinas: só exercício

`dietAndHabitRoutines` esconde os tipos 2 e 3. "Suas rotinas" fica com **um**
card. O wizard já criava apenas rotina de treino pelo passo "o quê" — dieta e
hábito só nasciam pelos cards de tipo, que agora não existem.

O filtro decisivo não está na lista de cards, e sim em `cards` (o `useMemo` que
chama `buildRoutineCards`). É de lá que saem o Hoje, as listas por tipo, os
detalhes e o progresso — filtrar na fonte é o que impede uma rotina de dieta
criada por uma build antiga do TestFlight de reaparecer em alguma delas. **Nada
é apagado no banco.**

### Diário Alimentar: cai junto, por construção

O card "Dietas" **sempre** abriu o Diário — a rotina de dieta só nascia de
dentro dele, pelo "transformar / Minha rotina". Não havia como manter um sem o
outro sem inventar uma porta nova.

> ⚠️ **Ao religar:** ligar `foodDiary` sozinho não torna o Diário alcançável —
> `dietAndHabitRoutines` precisa voltar junto, ou é preciso dar a ele uma
> entrada própria. O catálogo TACO no banco não é afetado pela flag.

### Insígnias

`badges` some do card de streak, do drawer de acervo, do diálogo de desbloqueio
e das três — na verdade **quatro** — superfícies que exibem a insígnia do
usuário: perfil, post viewer, card do feed e a conversa privada.

O corte foi feito **dentro do `UserInsignias`** (retorna `null` com a flag
desligada), não nos callsites. Foi a decisão certa: a quarta superfície
(`conversation-view.tsx`) só apareceu na varredura posterior, e já estava
coberta.

Motivo do adiamento: as condições de desbloqueio dependem de rotinas de dieta e
hábito, e parte do catálogo é premium. Com o IAP desligado, as insígnias premium
ficariam livres para todos — e voltariam a trancar quando o paywall subisse, o
que é pior do que nunca as ter mostrado. **`user_badges` continua intocada** —
a flag esconde a UI, o acervo permanece.

### Peso

`weightTracking` remove o card em Metas, o ícone ⚖️ no card de streak e o
histórico em Configurações → Dados pessoais.

O **campo** de peso no cadastro e em Dados pessoais **continua**: ele alimenta a
prescrição individual da rotina sugerida, que é outra coisa que acompanhar
evolução.

### Botão central do nav sem cor

"Novo post" era o botão-herói: círculo com gradiente, sombra colorida e sem o
ponto de item ativo. Aquele destaque fazia sentido com 5 itens, em que ele
ocupava o centro exato. Com 4 ele deixou de ser o meio, e o gradiente virou só
um item gritando mais alto. Agora se comporta como os demais (`isCenter = false`
em `app-layout.tsx`) — **ao religar `FEATURES.shots`, considere restaurá-lo.**

---

## 7.3. Auditoria final (27/08/2026)

Varredura tela por tela antes de submeter. Achados, todos corrigidos:

| Achado | Gravidade |
|---|---|
| **Marcar pessoas no RESUMO DO TREINO** | Alta — estava no loop principal: todo mundo que termina um treino passa por ali. Era a superfície de `postTags` mais alcançável que sobrava |
| **Marcar pessoas ao EDITAR um post** | Média — `edit-post-drawer` permitia mudar marcações mesmo sem poder criá-las |
| **`NSFaceIDUsageDescription` no Info.plist** | Média — permissão declarada e **nunca solicitada** (o suporte a biometria é zerado na origem). Permissão sem uso é questionada no review. Removida; volta com `FEATURES.biometricLogin` |
| **Slide de água no "Em foco"** | Média — o registro de água mora no Diário Alimentar; sem ele o slide virava um controle órfão. Contas novas nunca chegariam a `water > 0`, mas quem já tinha água registrada hoje veria |
| **Queries de dieta, hábito, insígnias e peso** | Baixa — seis queries por carga da tela mais pesada do app, alimentando o que ninguém vê |

### O que foi verificado e está correto

- **Sem bug de grade.** `RoutineTypeCards` é `flex-col`, então um card só não desalinha (o problema do footer era `grid-cols-5` fixo). O `StreakBadgesCard` mantém o chevron à direita, então não sobra caixa vazia sem badges nem ⚖️.
- **Numeração do cadastro.** O indicador mostra 1→2→3→4 corretamente com o passo comercial fora; `totalSteps` continua 4.
- **`TodayDashboard`** consome `cards`, que já é filtrado na fonte — as ramificações de tipo 2 e 3 nunca executam.
- **`UserInsignias`** cobre quatro superfícies pela guarda interna, incluindo a conversa privada.
- **Permissões restantes todas exercidas** — e sobraram só quatro: câmera e
  microfone (gravação de flows) e galeria leitura/escrita (o `EditedMediaPlugin`
  grava com `PHPhotoLibrary` `.addOnly`). **Nenhuma permissão de localização, e
  nenhum `UIBackgroundModes`.** Para um app social de fitness, essa é uma ficha
  de privacidade notavelmente enxuta — e cada permissão a menos é uma pergunta
  a menos no review.

### Conformidade Apple — estado final

| Item | Estado |
|---|---|
| 2.1(b) — IAP quebrado | ✅ Não há IAP no fluxo (`FEATURES.iap = false`) |
| 1.2 — denunciar | ✅ Post, shot, flow, perfil e detalhe do post |
| 1.2 — moderar | ✅ Painel Admin |
| 1.2 — bloquear | ✅ Menu do post, detalhe do post, perfil + lista para desfazer |
| 1.2 — EULA no cadastro | ✅ Checkbox obrigatório com tolerância zero declarada |
| 5.1.1(v) — excluir conta | ✅ Na UI — **depende do endpoint em produção** (ver checklist) |
| Política de privacidade in-app | ✅ Configurações → Outros |
| Permissões sem uso | ✅ Nenhuma |

---

## 8. Checklist antes de submeter

### Banco (SQL Editor do Supabase)
- [ ] Rodar `docs/migrations/20260826-user-blocks.sql`
- [ ] Rodar `docs/migrations/20260827-messages-update-realtime.sql` — sem ela, reação e "visualizado" não atualizam ao vivo
- [ ] Rodar as demais migrações pendentes (ver `MEMORY.md`)

### Infraestrutura
- [ ] **Rotacionar a service role key** (vazou no histórico do Git — ver `docs/16-seguranca.md`)
- [ ] Confirmar que `https://linkafit.com.br/api/delete-auth-user` responde em produção — **exclusão de conta quebrada = rejeição 5.1.1(v)**
- [ ] Confirmar que `/termos` e `/privacidade` servem conteúdo real

### App Store Connect
- [ ] Privacy nutrition labels: declarar apenas o que o app **coleta** — e ele não coleta localização. As purpose strings de localização e Face ID existem no Info.plist porque os SDKs as exigem (ver seção 6), mas **não** viram nutrition label
- [ ] Screenshots de iPhone **e iPad** — subir `npx vite --port 8080` e rodar `node scripts/appstore/.tooling/capture.mjs`. São capturas do app REAL, sem legenda; saem em `docs/appstore/` (ver o README de lá). **NÃO** anexar `subscription-review-640x920.png`: é a screenshot de review do IAP, que não existe mais nesta versão
- [ ] Nenhum produto de IAP anexado à versão

### Build
- [ ] `pnpm build && npx cap sync ios`
- [ ] Regenerar **os dois** lockfiles se houver dep nova (Appflow lê `package-lock`, Vercel lê `pnpm-lock`)
- [ ] Build no Appflow → TestFlight

### Validar em device (TestFlight)
- [ ] Criar conta nova: aceite de termos trava o avanço, e o cadastro conclui
- [ ] Bottom nav com 4 itens, sem Shots; header sem Vitrine
- [ ] **Em iPad**: sidebar, drawers e safe areas sem quebra — é o device do review
- [ ] Feed abre em "Seguindo" para conta que já segue alguém, e em "Descobrir" para conta nova
- [ ] Bloquear pelo "..." do post no feed faz o card sumir; idem no detalhe do post
- [ ] Perfil: posts de treino (canvas) aparecem em "Publicações" junto com os demais
- [ ] Nenhum botão "Ver treino" nos posts
- [ ] Detalhe da rotina não oferece trocar para Modo Expert
- [ ] Botão "+" → nova rotina de treino: **não** pergunta Simplificado × Expert
- [ ] Criar flow: sem ícone de halter (sticker de treino) nas duas etapas
- [ ] Aba Rotinas, lista e detalhe: nenhum botão "Treinar junto"
- [ ] Bottom nav: 4 itens distribuídos por igual, sem espaço sobrando à direita
- [ ] Bottom nav: "Novo post" sem círculo colorido, igual aos outros três
- [ ] Metas: "Suas rotinas" mostra só o card Exercícios
- [ ] Metas: sem card de peso, sem ⚖️ no card de streak, sem insígnias
- [ ] Perfil, feed e conversa: nenhuma insígnia ao lado do nome
- [ ] Terminar um treino: o resumo **não** tem seção "Marcar pessoas"
- [ ] Editar um post: sem seção de marcações
- [ ] iOS não pede Face ID em nenhum momento
- [ ] Descobrir: posts do mais recente para o mais antigo, autores misturados
- [ ] Flow aberto pelo perfil = mesma aparência do aberto pelo feed (sem botão play/pause)
- [ ] Treino: registrar mais carga/reps aumenta as calorias, não só o tempo
- [ ] Resumo do treino: sem seção "Conquistas desbloqueadas"; "Compartilhar no feed" leva ao feed
- [ ] Conversa privada: reação e double check aparecem ao vivo nos dois aparelhos
- [ ] Configurações: sem "Histórico" no peso e sem criar perfil comercial
- [ ] Novo post: sem alfinete de localização na barra da legenda
- [ ] iOS não pede localização nem Face ID em momento nenhum (as chaves existem, mas as APIs nunca são chamadas)
- [ ] Configurações → Dados pessoais: campo de peso existe, botão "Histórico" não
- [ ] Cadastro não pergunta sobre perfil comercial
- [ ] Criar um flow: sem botão "@" de marcar pessoas
- [ ] Conversa antiga com shot compartilhado mostra "conteúdo indisponível", não um card que não abre
- [ ] Bloquear um usuário: some do feed, da busca e das conversas; DM falha
- [ ] Configurações → Contas bloqueadas → desbloquear devolve tudo
- [ ] Nenhum cadeado, blur ou paywall em lugar nenhum
- [ ] Treino completo do início ao fim no modo Simplificado
- [ ] Excluir conta funciona de verdade

---

## 9. Ordem sugerida dos updates

Uma flag por release, cada uma com seu ciclo de TestFlight:

| Release | Flag | Por que nessa ordem |
|---|---|---|
| 1.1 | `expertMode` + `workoutDetailOnPost` | Serve quem já está treinando — o usuário que ficou |
| 1.1+ | `weightTracking` | Barato e autocontido; o primeiro a voltar quando houver gente treinando com constância |
| 1.2+ | `dietAndHabitRoutines` + `foodDiary` | Precisam voltar **juntos** (o card é a única porta do Diário) |
| junto do `iap` | `badges` | As condições dependem de dieta/hábito e parte do catálogo é premium — religar antes do paywall cria insígnias que depois trancam |
| 1.2 | `hashtags` + `postTags` + `routineSearch` | Descoberta passa a funcionar quando há conteúdo |
| 1.3 | `shots` | Só com gente postando com frequência |
| 1.4 | `duels` + `ranking` | Precisam de densidade social |
| 1.5 | `iap` | Com dados reais de quem usa o quê, o gate certo fica óbvio |
| depois | `store`, `gpsRun`, `workoutParty`, `workoutStickerOnFlow`, `muscleAnatomy`, `biometricLogin`, `reengagementPush` | Conforme demanda observada |
