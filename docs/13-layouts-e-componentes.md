# Layouts e Componentes Compartilhados

> **Bottom nav — colunas dinâmicas (27/08/2026)**
> A grade do nav mobile usa `gridTemplateColumns: repeat(n, minmax(0,1fr))` via
> `style`, com `n = mainNavItems.length`. Era `grid-cols-5` fixo, e quando uma
> flag esconde um item (Shots, no v1) sobrava uma coluna fantasma: os quatro
> restantes encostavam à esquerda e ficava um vazio à direita.
>
> Vai em `style` e **não** em classe de propósito: nome de classe montado em
> runtime (`grid-cols-${n}`) não sobrevive à purga do Tailwind e sairia sem
> regra nenhuma no build de produção.
>
> **O botão "Novo post" perdeu o destaque na mesma passada.** Ele era o
> botão-herói do nav — círculo com gradiente, sombra colorida e sem o ponto de
> item ativo. Isso fazia sentido com 5 itens, em que ele ocupava o centro
> exato; com 4 ele deixou de ser o meio e o gradiente virou só um item gritando
> mais alto que os outros. Hoje `isCenter` é `false` fixo em `app-layout.tsx`,
> com o estilo original preservado nas ramificações — **ao religar
> `FEATURES.shots`, considere restaurá-lo.**

---

## Estrutura de Pastas (`client/components/`)

```
client/components/
├── ui/             ← Shadcn UI (não mexer)
├── layout/         ← Componentes estruturais globais (AppLayout, PageTransition, ThemeProvider)
├── shared/         ← Componentes reutilizáveis em 2+ domínios (ImageWithFallback, AnimatedLoading, PostIncentiveButton, ExerciseImage, DietImage, EmojiPicker, InlineCropPreview, RouteMap, RunSplitsList, CheckInCalendarGrid, ReportDrawer, ReportProblemDrawer, IncomingMessageToast, ShotThumb)
├── modals/         ← Modais e Dialogs globais (PostCommentsDialog, PostLikesModal, FlowViewerModal, FlowCreationDialog)
├── community/      ← Comunidade, uma pasta por aba: messages/ (useMessages, ConversationView, MessagesTab), duels/ (useDuels, DuelsTab, DuelGroupView, DuelsOverlays), requests-tab, ranking-tab e os drawers compartilhados
├── post/           ← Componentes de post (PostCarousel)
├── shots/          ← Componentes de shots/flows (FlowCarousel)
└── profile/        ← Componentes de perfil (UserInsignias)
```

---

## Layouts

### AppLayout
**Arquivo:** `client/components/layout/app-layout.tsx`
**Usado por:** Todas as telas exceto Login e Shots

#### Estrutura
```
┌──────────────────────────────────┐
│  Header                          │
│  [Avatar][Logo] [Buscar][Vitrine][Notif]          │
├──────────────────────────────────┤
│  Conteúdo da tela atual          │
│                                  │
├──────────────────────────────────┤
│  Bottom Navigation (mobile)      │
│  [Home][Shots][Nova][Metas][Comunidade]│
└──────────────────────────────────┘
```

#### Funcionalidades
- **Header:** Avatar (→ Perfil) + logo + ícones de navegação secundária (Buscar, Vitrine, Notificações)
- **~~Ícone "Seja Premium"~~ (2026-07-15 → removido em 07/09/2026):** a coroa âmbar do header/sidebar e o `PaywallDrawer` global saíram do `AppLayout` junto com todo o código de compras. O app não vende nada — ver `docs/17-premium.md`
- **Hierarquia da navegação (2026-07-13):** a **Comunidade** (mensagens + duelos + ranking) ocupa o 5º slot do bottom nav; a **Vitrine**, de consulta ocasional, desceu para o header. Antes era o inverso: a superfície social mais rica do app vivia atrás de um ícone de 36px no header — que ainda por cima **some no scroll**, levando junto o acesso e o badge de mensagens não lidas
- **Badge de mensagens não lidas:** contador numérico sobre o ícone de Comunidade **no bottom nav** (sempre visível, ao contrário do header). Era um ponto de 7px
- **Badge de notificações:** contador numérico sobre o ícone de Notificações no header. Era um ponto de 7px
- **Cor única dos contadores de não lidas (2026-09-30):** sino do header, ícone da Comunidade no bottom nav, sidebar, contador de cada conversa e o selo de solicitações da Comunidade usam **o mesmo coral** — token `unread` (`--unread: 13 100% 67%` = `#ff7a59`, classe `bg-unread`/`text-unread`). Antes eram quatro cores (coral no header, azul no menu, vermelho na sidebar, `bg-brand` nas conversas)
- **`isolate` no container raiz (2026-09-30):** o `div` raiz do layout (`min-h-dvh bg-background`) abre um stacking context próprio. Sem ele, qualquer camada `fixed inset-0 -z-10` das telas (as auras do Feed e de Notificações) era pintada **atrás** do `bg-background` e nunca aparecia
- **`--app-header-offset` (2026-09-30):** a faixa que o `<main>` reserva no topo para o header flutuante (`max(14px, safe-area-top + 6px) + 52px + 12px`) virou variável CSS em `global.css` (`html`). O `<main>` usa como `padding-top`, e telas que querem um fundo **por trás** do header sobem esse mesmo valor com margem negativa (capa do Perfil — ver `docs/08-perfil.md`). Mudar a altura do header = mudar só a variável
- **Alvos de toque:** os ícones do header são `40×40` (eram `36×36`), aproximando-se do mínimo de 44pt da Apple HIG
- **Toque no logo:** `navigate("/")` quando fora do feed; no feed, dispara `ritmofit-refresh-feed`. **Nunca** `window.location.href` — isso recarregava a WebView inteira (perde cache de feed, remonta a app, refaz auth), que era a maior quebra de fluidez do app
- **Limite diário atingido:** o botão "Ignorar hoje" é `variant="ghost"` (ação terciária). Como ele derrota o propósito do limite, não pode ser o CTA em destaque — os botões de adiar (5/10/30 min) são os `outline`
- **Vibração ao receber notificação:** A subscription realtime (`app-layout-notif-push`, canal `notifications`) dispara `hapticSuccess()` (`client/lib/haptics.ts`) para qualquer INSERT na tabela `notifications` do usuário logado — independentemente do tipo (follow, incentivo, comentário, duelo, reação) e da tela em que o usuário está, inclusive na própria tela de Notificações. Roda antes da checagem que pula o pop up visual (`showIncomingNotificationToast`, que desde 2026-09-27 substitui o `LocalNotifications.schedule` — o iOS não exibe notificação local em primeiro plano) quando o usuário já está em `/notificacoes`, então a vibração sempre ocorre mesmo quando o banner é suprimido. Sem efeito fora do runtime nativo (Capacitor) — `hapticSuccess()` é no-op no browser. **Exceção: mensagem privada (`type 10`)** sai do handler antes da vibração — quem avisa DM em primeiro plano é o canal de `messages` (item seguinte), e vibrar nos dois seria aviso duplo da mesma mensagem
- **Pop up de mensagem recebida (2026-08-06):** a subscription `app-layout-messages` (INSERT em `messages` com `following_id = usuário logado`) dispara `hapticLight()` — vibração leve, em qualquer tela — e publica no pub/sub `client/lib/incoming-message-toast.ts`, exibido pelo `IncomingMessageToast` montado ao lado dos outros overlays globais. O banner mostra avatar, apelido e preview da mensagem; toque abre `/comunidade?user=<remetente>`. **Suprimido** (só vibra) quando a conversa daquele remetente já está aberta na tela — `getActiveConversationUserId()`. Disparado **fora** do debounce de 1s que existe nesse handler: o debounce protege só a query do badge, o aviso precisa ser instantâneo. Detalhes em `docs/10-notificacoes.md`
- **Convite para treinar junto (2026-08-26):** a mesma subscription `app-layout-notif-push` trata o **tipo 19** de forma própria: vibra, busca a party (`getWorkoutPartyInviteByIdDb`, id em `post_id`) e abre o `WorkoutPartyInviteDialog` — **sem** o banner local, que seria um aviso genérico para algo que precisa dos exercícios e dos botões de aceitar/recusar à vista. O diálogo mora no layout (e não na tela de Metas) porque o convite é para **agora**: quem está no feed tem de vê-lo na hora. Ao montar, o layout ainda procura um convite pendente (`getPendingWorkoutPartyInviteDb`), cobrindo o toque no push e o app aberto do zero. Aceitar só repassa o convite (`pendingPartyJoin` no `workout-context`) e navega para `/metas`, que é quem sabe iniciar um treino — mesmo padrão do `pendingReopen`. Ver `docs/05-metas.md`
- **Refresh global do app (29/09/2026, substitui o antigo `ritmofit-refresh-badges`):** todo pedido de atualização passa por `requestAppRefresh(reason, source?)` (`client/lib/app-refresh.ts`), que (1) chama `invalidateVolatileQueryCache()` — derruba **todo** o cache de consultas (memória + `lk:q:` no localStorage), preservando só os catálogos `CACHE_TTL_STATIC` e a semente de conversa — e (2) dispara `lk:app-refresh`. Quem está montado escuta com `useAppRefresh`: o `AppLayout` relê contadores de mensagens/notificações **e** a foto do header; Feed, Perfil, Notificações e Comunidade relêem o próprio conteúdo. Gatilhos: pull-to-refresh do **Feed, Perfil e Notificações**, toque no logo/home no feed e **volta do background** após ≥5 min (`RESUME_REFRESH_AFTER_MS`; era 3 min até 01/10/2026 — `appStateChange` no nativo, `visibilitychange` na web; entre 15 s e 5 min só os contadores do header/footer são relidos, sem derrubar o cache das telas — 15 s derrubava tudo a cada troca rápida de app e Perfil/Metas abriam com esqueleto) — o iOS suspende o WebView e o realtime não entrega o que chegou nesse meio-tempo. Dois gatilhos em menos de 1,5s viram um. A tela que disparou o refresh passa `source` e ignora o próprio evento (não busca duas vezes). **Por que:** antes cada tela invalidava só as próprias chaves — o pull do feed não tocava no cache dos contadores (TTL 30s + disco) nem no do perfil, então header/footer e a próxima tela aberta continuavam velhos.
  - **Ausência > 5 min atualiza o app inteiro (2026-10-01).** Dois caminhos, mesmo limite:
    1. **App suspenso que volta** (`AppLayout`): `requestAppRefresh("resume")`.
    2. **App que o iOS fechou em segundo plano e abre do zero:** o instante em que o app saiu de cena fica no **disco** (`lk:backgroundedAt`, gravado no `visibilitychange`/`pagehide` e no `appStateChange`; apagado ao voltar sem ser fechado). `refreshIfLongAbsenceOnLaunch()` roda em `App.tsx` **antes do primeiro render** e, passados 5 min, chama `invalidateVolatileQueryCache()`. Sem isto o `cached()` servia a cópia do disco (até 24h) e revalidava por trás sem a tela reler — a pessoa via dado velho até navegar. Custo aceito: essa abertura mostra esqueleto em vez da cópia instantânea.
  - **Telas que escutam o `"resume"`:** Feed, Perfil, Notificações, Comunidade (conversas), header/footer e, desde 01/10/2026, **Metas** (`loadData`, a mesma carga do retorno do offline), **Busca** (pessoas + treinos/dietas já carregados, por trás), **Detalhe do post**, **Hashtag** (sem esqueleto se já há itens), **Vitrine** (aba aberta) e **Shots** — este **só se a pessoa está no primeiro shot**, mesma regra do feed (no meio da lista, trocar a ordem tiraria o vídeo do lugar). Para telas que carregam num `useEffect`, `useAppRefreshTick()` devolve um contador que sobe a cada refresh e entra nas dependências do efeito.
- **Canais realtime por usuário (29/09/2026):** o efeito dos canais `app-layout-notif-push`/`app-layout-messages` rodava com `[]` — se o layout montasse antes da sessão ficar pronta, os canais nunca eram criados e os badges só mudavam no refresh manual. Agora depende de `user?.id`, usa nome único por execução (`:{userId}:{random}`) e limpa com `removeChannel`.
- **Leitura em voo não sobrescreve invalidação:** `invalidateQueryCache`/`invalidateVolatileQueryCache` marcam as leituras que estavam em voo (`_discardedInflight`); quando chegam, não gravam no cache. Antes, uma leitura antiga terminando depois do refresh regravava o dado velho.
- **Gravação do cache em disco adiada (29/09/2026):** `persistWrite` não grava mais na hora — `JSON.stringify` + `localStorage.setItem` (até 250 KB) rodavam no thread principal bem quando a tela montava. As gravações entram numa fila por chave (`_pendingPersist`, a última vence) e saem no `requestIdleCallback` (fallback `setTimeout` 300 ms), ou na hora se o app for para o background. `persistRead` consulta a fila antes do disco; `persistDelete`/`invalidateVolatileQueryCache` descartam o que estiver na fila das chaves invalidadas (senão o dado velho voltaria ao disco depois do refresh).
- **Invalidação no realtime dos badges (performance):** os handlers realtime chamam `invalidateQueryCache("unreadMsgCount"/"conversations")` **antes** de reler o contador. `getUnreadMessageCountDb`/`getUnreadNotificationsCountDb` são cacheadas (30s); sem invalidar, o evento realtime relia a própria entrada em cache e o badge só acertava quando o TTL vencia — o realtime virava no-op
- **Tempo de tela bufferizado (performance):** a troca de rota **não vai mais ao banco**. `bufferScreenTime(tela, segundos)` acumula em `localStorage` (somado por dia+tela) e `flushScreenTimeDb(userId)` envia tudo num **único insert em lote** quando o app vai para background (`appStateChange`/`visibilitychange`), no logout (`settings-drawer`, antes do `signOut` por causa do RLS) e na abertura seguinte (resíduo de sessão encerrada abruptamente). Antes: 1 INSERT por navegação
- **Limite diário sem polling (performance):** a mudança do limite é sinalizada pelo evento `lk:daily-limit-changed` (disparado pelo `settings-drawer` ao salvar) + revalidação no `visibilitychange` (cobre a virada do dia). Substituiu um `setInterval` de 5s que rodava em toda tela, para sempre, só para vigiar uma chave de `localStorage` — o evento nativo `storage` não serve, pois só dispara em outra aba
- **Treino não conta como tempo de uso (2026-09-27):** enquanto a tela de registrar treino está aberta (`workoutModalOpen` do `workout-context`; **minimizado conta**, pois o usuário está navegando), os três relógios do `AppLayout` ficam parados: o **limite diário** (o bloqueio nunca interrompe um treino), a **sessão de acesso** (`access_sessions`) e o **tempo por tela** (`screen_time_logs`). Cada relógio tem um "desde" próprio (`sessionWorkoutSinceRef`/`screenWorkoutSinceRef`): durante o treino o tempo corrido é descontado ao vivo (`sessionActiveMs`/`screenActiveMs`); ao fechar, o início do relógio é empurrado pelo tempo de treino — também no `sessionStorage` (`ritmofit_session_start`/`ritmofit_screen_start`), que é o que o logout do `settings-drawer` lê. Todo reset de relógio passa por `resetSessionClock`/`resetScreenClock`
- **Limite diário acumula o dia inteiro (corrigido 2026-09-27):** o uso do dia fica em `localStorage` (`lk:dailyUsage` = `{ date, seconds, snooze }`, zera sozinho na virada do dia local). Antes o acumulado era lido de uma chave de `sessionStorage` (`ritmofit_usage_seconds_today`) que **nunca era gravada** — o limite contava só desde a última abertura, e fechar/reabrir o app zerava o contador; além disso a restauração comparava com a data em que o limite foi **configurado**, não com hoje. Agora um tick de 1s soma o tempo real desde o tick anterior, só com o app visível e fora da tela de registrar treino; um intervalo > 5s entre ticks (WebView suspenso) é descartado. O **adiar** (5/10/30 min) também é persistido no mesmo objeto — reabrir o app não traz o bloqueio de volta. O contador só roda com limite configurado: ativar o limite no meio do dia começa a contar daquele momento
- **Toast de sincronização offline (2026-07-11):** escuta o evento global `linka-offline-synced` (`OUTBOX_SYNCED_EVENT` de `client/lib/offline-outbox.ts`) e mostra o toast `goals_sync_done_title/desc` em qualquer tela quando a fila de escritas feitas sem internet (treinos/check-ins da tela de Metas) termina de sincronizar — ver "Modo offline" em `docs/05-metas.md`
- **Foto de perfil:** Carregada dinamicamente no ícone de Perfil
- **Bottom Navigation (mobile):** 5 itens fixos na parte inferior
- **Side Navigation (desktop):** Navegação lateral em telas grandes, com botão para **expandir/colapsar** entre 244px (com rótulos) e 68px (só ícones), persistido em `localStorage` (`ritmofit_sidebar_expanded`). **Expansão instantânea (sem animação de largura):** o `<aside>` e o wrapper de conteúdo **não** têm `transition` de largura/margem. Antes, animar o `width` de 68→244px reflui os rótulos enquanto o container ainda está estreito, fazendo as letras "montarem" verticalmente para depois virar horizontal. Agora a barra dá **snap** direto e os nomes das telas já aparecem posicionados. Rótulos usam `whitespace-nowrap` como reforço contra qualquer reflow
- **Timer de uso diário:** Monitora tempo de sessão
- **Limite diário:** Se o usuário configurou um limite, bloqueia o app ao atingir
- **Floating Action Menu:** Menu flutuante arrastável (mobile)
- **Swipe da borda esquerda → voltar (mobile):** Arrastar da borda esquerda para a direita volta para a **tela anterior visitada** (history back). Implementado pelo hook `useEdgeSwipeBack` (`client/hooks/use-edge-swipe-back.ts`), aplicado ao `<main>` do AppLayout via `mainRef`. O conteúdo desliza acompanhando o dedo (header e bottom nav ficam fixos), e ao soltar acima do limiar (~32% da largura ou flick rápido) dispara `hapticLight()` + `navigate(-1)`, animando a tela anterior deslizando da esquerda. Só inicia na faixa de 30px da borda esquerda (para não sequestrar carrosséis horizontais internos), ignora scroll vertical (trava de direção), não dispara com dialog/drawer aberto nem quando não há histórico anterior (`history.state.idx === 0`, evita sair do app). **Desligado em `/postar`** (voltar perderia o rascunho do novo post).

#### Desktop — frame de conteúdo
Em desktop (md+), o conteúdo é limitado a `max-w-[680px]` centralizado após a sidebar (244px). Todas as sobreposições fixas (Dialogs, Drawers) respeitam esse frame usando a classe `md-modal-centered` / `md-drawer-centered` definida em `global.css`, que ajusta o `left` para `calc(50vw + 122px)` (centro do frame de conteúdo).

#### Header/Bottom Nav flutuantes (mobile) — bounce elástico do iOS
Header e Bottom Nav são `position: fixed` com `top`/`bottom` calculados a partir de `env(safe-area-inset-*)`. No WKWebView do iOS, o bounce elástico nativo (rubber-band) pode deslocar/"descolar" momentaneamente elementos fixos durante o overscroll — mais perceptível em telas com safe area maior (Dynamic Island). Como o Feed já implementa seu próprio gesto de pull-to-refresh via touch handlers (`Index.tsx`), o bounce nativo é redundante e foi desativado globalmente com `overscroll-behavior-y: none` em `html`/`body` (`global.css`), eliminando o glitch sem afetar o pull-to-refresh custom.

#### Header flutuante — auto-ocultar ao rolar (mobile)
Nas rotas `/`, `/shots`, `/vitrine`, `/metas`, `/perfil` e `/usuario/:id`, o header pill flutuante some ao rolar para baixo (>96px de scroll e delta > 30px) e reaparece ao rolar para cima (delta < -30px), controlado pelo estado `headerHidden` em `AppLayout` (classe `-translate-y-[200%]` quando oculto). O listener é sempre no `window` (a página inteira rola — `Goals.tsx` usa fluxo normal de documento, sem container de altura fixa).

> **`/comunidade` está fora de propósito (2026-07-21).** A Comunidade tinha um caminho próprio: como a tela é um container de altura fixa com scroll interno, o `AppLayout` escutava `scroll` em fase de captura no `document` filtrando pelo atributo `data-community-scroll-container`, e a `Community.tsx` espelhava a mesma lógica para esconder a barra de abas. **Tudo isso foi removido** — o header e as abas atrapalhavam mais do que ajudavam ali: com uma aba montada por vez e vários containers roláveis (lista de conversas, duelos, ranking, grupo), o header ia e vinha em transições que não eram scroll do usuário, e a barra de abas — que é a navegação principal da tela — sumia justo quando se queria trocar de aba. Não reintroduzir o atributo `data-community-scroll-container`.

---

### ShotsLayout
**Arquivo:** `client/components/layout/shots-layout.tsx`
**Usado por:** Rota `/shots`

Layout especializado para visualização de vídeos em tela cheia:
- Remove o AppLayout padrão
- Footer customizado com navegação específica para Shots
- Badges de notificação mantidos
- Integração com perfil do usuário

---

## Componentes Customizados

### FlowCarousel
**Arquivo:** `client/components/shots/flow-carousel.tsx`
**Usado em:** Feed (Index)

Carrossel horizontal de stories (Flows).
- Primeiro item: story do usuário logado (com botão de criação)
- Demais: stories dos usuários seguidos
- Anel colorido em torno do avatar para story não visto
- Auto-scroll para o início quando abre

---

### FlowCreationDialog
**Arquivo:** `client/components/modals/flow-creation-dialog.tsx`
**Usado em:** Feed (Index)

Dialog para criar um novo story:
- **Redesenho de 2026-09-30:**
  - **Câmera:** topo só com o fechar; embaixo, grade `galeria | obturador | virar câmera` (a galeria mostra a **miniatura da última foto do rolo** via `PhotoLibrary.getLibrary` — só consulta com permissão já concedida; sem ela, ícone) e o seletor **"Câmera · Texto"** abaixo do obturador (o modo texto saiu do "T Aa" do topo).
  - **Voltar com confirmação:** no modo texto e na legenda o X virou **seta de voltar**; se houver algo feito, abre "Descartar este flow?" (`discardDialog`, overlay próprio em `z-[140]` — o `AlertDialog` do app ficaria atrás deste portal `z-[100]`). Antes o X apagava foto, textos, marcações e treino sem perguntar.
  - **Barras só com ícones de 44px** (`ICON_BTN`): marcar (@ com contador), treino, um único **"Aa"** (sai o "T + Aa") e **rascunho** (download) — "Salvar rascunho" deixou de ser um 2º botão largo no rodapé.
  - **Editando texto:** topo com alinhamento (um botão que alterna esquerda/centro/direita), fundo do texto e "Pronto" — sem o X ao lado do "Pronto"; **cores e fontes acima do teclado** (`editingBottomControls`, `bottom: calc(var(--keyboard-height) + …)`), cores com alvo de 44px e fontes com **nome em português** (`FONT_OPTIONS[].labelKey` → `flow_font_*`).
  - **Publicar:** modo texto com botão principal **branco** "Compartilhar flow"; na legenda, **rodapé compacto** — descrição que começa em 1 linha e cresce até ~4 (`useLayoutEffect` ajusta a altura) + botão branco redondo de enviar.
  - Dicas traduzidas (`flow_hint_caption_idle`/`_text`, sem o "belisque"); `aria-label` das cores/alinhamento traduzidos. A etapa `preview` (nunca acionada) foi removida.
  - **Pinça no card não mexe a foto (2026-09-30):** na legenda sobre a foto, o dono do gesto é quem foi tocado **primeiro** — mesma regra que a legenda já seguia. Se um card (treino/post) está sendo tocado, o 2º dedo que cai na foto (`handleMediaPointerDown`) entra no gesto **do card** (`stickerGestureRef`) e os `move/up` desse dedo são repassados a `handleStickerPointer*`; o inverso também vale (foto/legenda sendo mexida e o 2º dedo cai no card → vai para o gesto da foto). Antes o 2º dedo abria um gesto próprio da foto e pinçar o card movia os dois.
  - **Fundo do texto igual na edição e no resultado (2026-09-30):** o campo de edição (`editingField`, único para modo texto e legenda) desenha o realce numa **camada espelho** idêntica ao texto confirmado (`renderTextInner`: `<span>` com `box-decoration-break: clone`, padding `0.08em 0.26em`, raio `0.28em`), na mesma célula de grid do `<textarea>` — que fica com o texto transparente e só o cursor visível. Antes o fundo ia no `<textarea>` inteiro (3 linhas, largura total) e parecia que o realce ficaria enorme. O campo agora também cresce com o texto (`rows={1}`), sem as 2 linhas vazias de antes.
  - **Lixeira (arrastar para apagar, estilo Instagram):** ao arrastar com um dedo uma **frase** (modo texto ou sobre a foto) ou um **card** (mini frame de treino, moldura de post), aparece uma lixeira embaixo, no centro, e as barras de cima/baixo somem. Com o dedo a até 64px do centro dela, ela cresce e fica vermelha (+ vibração leve); **soltar ali apaga o elemento**. Os três caminhos de gesto (`handleTextPointer*`, `handleMediaPointer*` quando o alvo é texto, `handleStickerPointer*`) chamam `trackTrash(x, y)` ao mover e `endTrashDrag()` ao soltar. No card, a lixeira só aparece depois de um arraste de verdade (>4px), para tocar nos botões do card não acioná-la. O X dos cards continua existindo.
- Câmera com obturador inteligente: **toque = foto**, **segurar = grava vídeo** (`MediaRecorder`, áudio opcional, máx. 30s/50MB, indicador de gravação)
- Upload de imagem/vídeo da galeria — **abre a Fototeca direto** (2026-09-30): no app nativo o botão chama `PhotoLibrary.pickMedia` (PHPicker do iOS, 1 item, foto ou vídeo, sem pedir acesso à biblioteca inteira) em `openGallery`; o arquivo copiado pelo plugin é lido e reembalado num `File` com `type` explícito e segue por `processPickedFile` (o mesmo caminho de antes: limite de tamanho, duração do vídeo, compressão 720p). Antes era um `<input type="file">`, que mostrava a folha "Fototeca / Tirar foto / Escolher arquivo"; ele ficou só como reserva no navegador de dev e se o plugin não existir no binário (`UNIMPLEMENTED`). Cancelar o seletor não faz nada.
  - **Vídeo da galeria não carregava (corrigido em 01/10/2026):** o `PhotoLibrary.pickMedia` do `@capgo/capacitor-photo-library` 7.2.11 perdia **todo vídeo** — copia o arquivo de `loadFileRepresentation` dentro de um `queue.async`, mas o iOS apaga esse arquivo temporário assim que o callback retorna; a cópia falhava, o asset virava `nil` e o JS recebia lista vazia, que o `openGallery` lia como "cancelou" (nada acontecia, sem erro no Sentry). Foto funcionava porque vem como `UIImage` em memória. **Agora** o seletor é o do nosso plugin: `EditedMedia.pickMedia` (`EditedMediaPlugin.swift`, PHPicker com `preferredAssetRepresentationMode = .current`) copia o vídeo **dentro** do callback para `Caches/LinkaPickedMedia` (só a escolha atual fica lá) e grava foto como JPEG; o wrapper `pickGalleryMedia()` (`native-media.ts`) devolve um `File` com tipo explícito (`null` = cancelou). O `PhotoLibrary.pickMedia` ficou só como reserva para binário sem o método (`UNIMPLEMENTED`). Não dá para corrigir dentro do `node_modules` (o install do Appflow sobrescreve).
- Modo texto/gradiente
- **Enquadramento da mídia na tela de compartilhar:** pinça para redimensionar + arraste para mover (estilo Instagram). Imagem → composta via canvas (`bakeTransformedImage`); vídeo → enquadramento persistido em `flow.media_transform` (%), reaplicado no `FlowViewer`. A camada de gestos também bloqueia gestos nativos do iOS sobre o `<video>`
- Preview/legenda antes de publicar
- **Salvar rascunho** (botão abaixo de "Compartilhar flow"): grava o flow como ele está na **galeria do celular**, sem publicar. Imagem/gradiente são compostos num canvas (`buildDraftCanvas` → `bakeTransformedCanvas` + `drawTextsOnCanvas` / `paintCssGradient`); vídeo é salvo como está, sem as frases. A escrita usa `saveMediaToPhotos` (`client/lib/native-media.ts`)
- **Citar um treino (mini frame, 2026-08-21):** botão `Dumbbell` na etapa de compartilhar → `WorkoutStickerPickerDrawer` → cola um `FlowWorkoutSticker` arrastável/redimensionável sobre o flow, salvo em `flow.text_elements` como `{ kind: "workout", ... }` (ver `docs/01-feed.md`)
- Botão confirmar: chama `createStoryDb`

---

### FlowWorkoutSticker / FlowElementView (2026-08-21)
**Arquivo:** `client/components/shared/flow-workout-sticker.tsx`
**Usado em:** `FlowCreationDialog`, `WorkoutStickerPickerDrawer`, `FlowViewer`, `FlowViewerModal`

- `FlowWorkoutSticker` — o **mini frame do treino citado** no flow (estilo "repost" do Instagram): rotina, dia, chips de séries/volume/duração/**calorias** (🔥, desde 21/08/2026)/recordes e a lista de exercícios com `séries × carga`. Os chips **quebram linha** (`flex-wrap`) — o desenho no canvas do rascunho (`drawWorkoutStickerOnCanvas`, no `FlowCreationDialog`) passou a quebrar igual e a somar as linhas extras na altura do card, senão o rascunho ficava mais baixo que o preview e os últimos chips sumiam. Largura FIXA em px (`WORKOUT_STICKER_WIDTH`) escalada por `transform: scale()`, então autor e espectador veem o mesmo tamanho em qualquer aparelho. **Sem `backdrop-filter`** de propósito (fica sobre vídeo em reprodução — ver `docs/15-design-system.md` §0.3)
- `FlowElementView` — renderiza **um elemento de `flow.text_elements`** já posicionado (x/y em %), decidindo entre **frase** e **mini frame** (`kind: "workout"`). Fonte única dos dois viewers, que antes duplicavam o mesmo JSX em 4 lugares
- Helpers exportados (`formatStickerVolume`, `formatStickerDuration`, `formatStickerDate`, `MIN/MAX_STICKER_SCALE`, `MAX_STICKER_EXERCISES`) são reusados pelo desenho do rascunho no canvas (`drawWorkoutStickerOnCanvas`, no `FlowCreationDialog`)

---

### FlowRepostFrame (2026-09-27)

`client/components/shared/flow-repost-frame.tsx` — moldura de **repost de flow** estilo Instagram, usada pelos dois viewers (`FlowViewer.tsx` e `FlowViewerModal`). Recebe o `story` e, como `children`, as mesmas camadas que o viewer desenha para um flow comum (mídia, spinner, frases). Se `story.reposted_from` estiver vazio, devolve os filhos sem moldura.

- O "palco" original inteiro é reduzido como um bloco (`transform: scale(0.8)`, `FRAME_SCALE`) dentro de um card arredondado (28px, borda branca translúcida, sombra) sobre um gradiente escuro azul→roxo. Escalar o bloco (em vez de redimensionar a mídia) mantém as frases/stickers **exatamente** onde o autor os colocou.
- Chip do **autor original** no topo esquerdo do card (avatar + apelido de `repostedFromNickname`/`repostedFromPhoto`); sem autor (conta apagada → `reposted_from_user = null`) mostra ícone `Repeat2` + `t("flow_repost_badge")`. O chip é `pointer-events-none` — as zonas de toque de navegação ficam por cima.
- Nada muda na barra de progresso, no vídeo ou no `mediaReady`: os filhos são os mesmos elementos.

### FlowPostCard (2026-09-27)

`client/components/shared/flow-workout-sticker.tsx` — moldura de um **post do feed** compartilhado no flow (`StoryTextElement.kind === "post"`), renderizada por `FlowElementView`. Mesma linguagem da moldura de repost: card `min(80vw, 380px)`, cantos 26px, borda clara, sombra, chip do autor (avatar + apelido + **selo de verificação** desde 02/10/2026 — `StoryPostSticker.authorVerifiedTier`, copiado de `isVerified`/`verifiedTier` do post no `buildPostSticker`, como a legenda; flows antigos ficam sem selo) no topo e a foto do post (referenciada, `maxHeight: 56dvh`). **Legenda (2026-10-01):** abaixo da foto, "**autor** legenda" em até 3 linhas (`-webkit-line-clamp`), vinda de `StoryPostSticker.caption` — copiada do post no compartilhamento (`buildPostSticker` em `use-post-reshare.ts`, até 300 caracteres); editar o post depois não muda o flow, e flows antigos sem `caption` só não mostram. Com `interactive` (viewers) mostra "Toque para ver o post ›". Foto que não carrega (post apagado) → "Post indisponível". Alvo de toque: `data-flow-post-sticker` — as zonas de navegação do `FlowViewer` testam o retângulo e navegam para `/post/:postId` (no modo embutido fecham o viewer antes).

### FlowWorkoutDetailDrawer (2026-09-27)

`client/components/shared/flow-workout-detail-drawer.tsx` — drawer glass aberto ao tocar no sticker de treino de um flow (`FlowViewer` e `FlowViewerModal`). Props: `workout` (o `StoryWorkoutSticker`, null = fechado), `authorId`/`authorNickname` (dono da rotina — num repost, o autor original) e `onClose`. Mostra chips da sessão (séries, volume, duração, kcal, PRs), a lista numerada **só dos exercícios feitos na sessão** (séries×kg — sessão completa via `getFlowWorkoutSessionDb` quando `last_summary` ainda é a mesma sessão; senão, os até 8 do sticker + "+N") e o botão **"Copiar rotina"** para quem não é o autor. O `FlowWorkoutSticker` expõe `data-flow-workout-sticker` (alvo de toque) e a prop `interactive` (dica "Toque para ver o treino ›"), repassada por `FlowElementView`.

### Desafio de treino — ChallengeInviteDialog / ChallengeComparison / ChallengeResultDialog (2026-10-02)

`client/components/goals/workout-challenge.tsx`. **`ChallengeInviteDialog`** (desafiado): modal centrado `z-[10001]` (mesma casca do convite de treinar junto) com quem desafiou, o treino e os exercícios com nº de séries — sem números —, "Aceitar e treinar" / "Recusar" / fechar ("Depois"); com treino em andamento só deixa recusar. **`ChallengeComparison`** (`outcome`, `perspective`, `opponentName`): veredito ("Você venceu! 🏆" verde / "Você perdeu" vermelho / "Empate" âmbar), placar "N × M" e uma linha por exercício com carga × reps de cada lado, vencedor destacado com 🏆 — usado no resumo do desafiado e no resultado de quem desafiou. **`ChallengeResultDialog`**: o placar para quem desafiou (push 25), lendo os dois resultados — e, desde 02/10/2026, um botão "Compartilhar no feed" (prop `onSharedToFeed`; sem prévia nem legenda editável — a legenda sai do resultado). O card mora em **`challenge-card.ts`** (`drawChallengeCanvas`, `renderChallengeCardBlob`) e as fotos dos cards de canvas em **`canvas-avatars.ts`** (`loadCanvasAvatar`, `drawCanvasAvatar`) — os dois saíram do `workout-summary-overlay.tsx`, que agora importa deles. Regras em `client/lib/workout-challenge.ts`. O seletor de seguidores é o **`WorkoutPartyDrawer`** com a prop nova **`copy`** (`{ title, subtitle?, cta, alreadyIn?, empty? }`) e **`mutualsOnly`** (05/10/2026: lista só seguidores que o usuário também segue e desliga a busca no app inteiro — a busca só filtra essa lista) — não há um seletor próprio do desafio. O treinar junto segue sem `mutualsOnly` (seguidores + busca geral). Quem está em `alreadyInvitedIds` aparece **no topo** da lista (travado, com o rótulo `alreadyIn` ou "já foi convidado").

### PartyTurnStatus + useWorkoutPartyMembers (2026-10-02)

`client/components/goals/workout-party-live.tsx` — "vez de quem" no treinar junto. `useWorkoutPartyMembers(partyId)` é a fonte única dos participantes (fetch fresco + realtime em `workout_party_members`, canal com sufixo aleatório) — usado pela sessão (que repassa `members` à pílula e ao modal de descanso) e pelo resumo. `partnerTurn(member, now)` deriva `resting | lifting | finished | starting`; `turnText`, `TURN_COLORS`/`TURN_TINTS`, `isRestingNow`, `useNow` e `fmtSecs` são compartilhados com a pílula. `PartyTurnStatus` só existe no **modal de descanso** (uma linha por amigo, com avatar) desde 02/10/2026 — os modos `bar`/`compact` saíram junto com a faixa do topo. Ver `docs/05-metas.md` → "A vez de cada um".

### WorkoutSessionContextPill (2026-10-02)

`client/components/goals/workout-session-context.tsx` — a **pílula de contexto** embaixo do título da sessão de treino (treinar junto ou desafio) + a folha que ela abre ("Treinando junto" / "Desafio de Fulano"). Props: `members`, `currentUserId`, `selfResting`, `progressDone`/`progressTotal`, `challenge`, `routineName`. Some sozinha quando não há o que mostrar. Folha com `wrapperClassName="z-[10000]"` (a sessão é overlay 9999). Ver `docs/05-metas.md` → "Pílula de contexto da sessão" e o padrão em `docs/15-design-system.md` §6.7.

### QuickWorkoutButton (2026-10-02)

`client/components/goals/quick-workout-button.tsx` — botão animado "Treino rápido" (ícone `Dumbbell`) da tela de Metas — sempre visível fora de um treino, com ou sem rotina. Props: `onStart`. Fixo no canto inferior direito acima da navegação; ciclo **fresta (30%, mín. 44px) → inteiro na borda direita com o rótulo (~3,2 s) → fresta**, uma vez por montagem, com spring do framer-motion; na fresta, brilho "respirando". `useReducedMotion` → fica parado no canto, inteiro. Mede a própria largura e a da tela (`resize`) para calcular as duas posições. Ver `docs/05-metas.md` → "Treino rápido".

### WorkoutStickerPickerDrawer (2026-08-21)
**Arquivo:** `client/components/modals/workout-sticker-picker-drawer.tsx`
**Usado em:** `FlowCreationDialog`

- Drawer glass que lista os **treinos recentes finalizados** (`getRecentWorkoutSessionsDb`, que lê `routines.last_summary`), cada linha já renderizada como o próprio mini frame (seleção WYSIWYG)
- Estado vazio para quem ainda não finalizou treino; a escolha volta ao pai como `StoryWorkoutSticker` via `onSelect`

---

### FlowViewer (viewer único de flows) — ~~FlowViewerModal~~ removido em 2026-09-27
**Arquivo:** `client/pages/FlowViewer.tsx`
**Usado em:** rota `/flows/:storyId` (ring do feed, notificações, deep links) e **Perfil** (modo embutido)

Existe **um** viewer de flows. O `FlowViewerModal` (`client/components/modals/flow-viewer-modal.tsx`) era uma cópia paralela aberta pelo perfil que divergia do feed em layout e funções (doca, marcados, repost, segurar para esconder, etc.) — foi apagado. Agora o perfil renderiza o próprio `FlowViewer` com a prop `embedded`:

- `embedded = { stories, storyId, onNavigate(id), onClose(), onDeleted?(id) }` — em vez de ler a URL e carregar o ring (`getActiveStoriesDb`), usa a lista recebida e devolve a navegação por callback. Sem a prop, é a rota de sempre.
- Toda navegação interna passa por `goToStory(id)` / `closeViewer()`; saídas para outra tela (perfil de quem visualizou, menção num comentário) chamam `leaveViewer()` antes — o Perfil é o mesmo componente para qualquer `/usuario/:id` e manteria o viewer aberto.
- Embutido: `z-[200]` (acima do header/bottom nav `z-50` e do timer de descanso `z-150`, abaixo dos drawers `z-300/310`) e trava o scroll do `body` enquanto aberto.
- Embutido é renderizado por **portal no `<body>`** (`createPortal`, helper `mount`). Sem isso, o `PageTransition` (framer, com `transform`) vira o *containing block* do `position: fixed`: o viewer abria medido a partir do conteúdo do perfil e um pedaço do header do app ficava visível no topo. Qualquer overlay `fixed` aberto de dentro de uma página tem o mesmo problema.
- No Perfil é carregado com `React.lazy` (mesmo chunk da rota).

**Regra:** qualquer mudança visual ou de comportamento no viewer vale para os dois lugares automaticamente — não recriar um viewer separado.

---

### PostCarousel
**Arquivo:** `client/components/post/post-carousel.tsx`
**Usado em:** Feed (Index), Perfil, PostDetail, Comunidade (modal de detalhe do check-in de duelo)

Carrossel de imagens de um post:
- Navegação com setas esquerda/direita
- Indicador de posição (dots ou números)
- Swipe em mobile
- Imagens com `ImageWithFallback`
- **Frame sempre 1:1 (2026-10-02):** `aspect-square` + `object-cover` em todo lugar. Toda imagem de post nasce 1:1 (recorte quadrado do Novo Post, fotos do resumo, cards de treino 1620×1620, mapa/parciais 1080×1080), então a foto preenche 100% do frame sem cortar, esticar ou deixar borda. Imagem antiga fora de 1:1 é cortada no centro, nunca esticada. **Removidos:** a prop `tall` (altura `calc(100dvh - 314px)` — a proporção do frame mudava de aparelho para aparelho), o fit adaptativo `contain` + fundo desfocado (`adaptiveFit`/`loadedPhotoFit`) e a prop `objectFit` (já era ignorada). A largura do frame no feed vem do card: `FEED_POST_CARD_STYLE` em `client/lib/post-visuals.tsx`.
- Prop `fill`: preenche 100% do container pai via `h-full` — o pai já é um quadrado (card da tela de Detalhe do Post, dimensionado por medição)
- Hooks (ref + listener de swipe) declarados **antes** dos `return` de 1 foto — antes ficavam depois, e um post que passasse de 1 para 2+ fotos quebrava o React ("Rendered more hooks")
- **Prop `priority` (2026-07-02):** força `loading="eager"` na primeira/única foto em vez de `"lazy"` — usar quando o carrossel já monta visível dentro de um modal/drawer (ex: detalhe do check-in de duelo), onde "lazy" só atrasa o fetch sem nenhum ganho (não há scroll para "chegar" até a imagem). Não usar em contextos de lista/feed, onde "lazy" evita baixar fotos fora da viewport.
- **Fade-in ao carregar (2026-07-02):** a imagem interna (`ZoomableImage`) começa em `opacity: 0` e transiciona para `1` no `onLoad`, em vez de aparecer abruptamente — o fundo do frame já preenche o espaço, então não há flash de conteúdo vazio.
- **Constantes exportadas `POST_PHOTO_WIDTH`/`POST_PHOTO_QUALITY`:** usadas por quem quiser pré-aquecer (`new Image().src = cdnImg(url, { width: POST_PHOTO_WIDTH, quality: POST_PHOTO_QUALITY })`) a mesma URL que o carrossel vai pedir — ver o prefetch de fotos de check-in em `Community.tsx`, que evita o usuário sentir a latência do primeiro fetch ao abrir o modal de detalhe. Desde 2026-08-14 `cdnImg` devolve a URL original (ver *Pipeline de imagens* abaixo), então o prefetch aquece o próprio objeto no CDN — o padrão de uso não muda.

---

### PostIncentiveButton
**Arquivo:** `client/components/shared/post-incentive-button.tsx`
**Usado em:** Feed, Shots, PostDetail, Perfil

Botão de reação/incentivo:
- 6 tipos diferentes, cada um com ícone e cor distintos
- Estado ativo/inativo visual
- Estado de loading durante a requisição
- Props: `type`, `isActive`, `onClick`, `loading`, `burst`

Os 6 botões ficam enfileirados na barra de ação de vidro do post (feed e `PostDetail`), e o `QuickIncentiveOverlay` (duplo toque na mídia) oferece os mesmos 6 como atalho.

---

### PostCommentsDialog

**Autor do comentário (2026-09-28):** tocar na **foto** ou no **nome** de quem comentou fecha o drawer e abre o perfil (`/usuario/:id`; o próprio usuário vai para `/perfil`). É o mesmo caminho da @menção. Vale também para o drawer de comentários do `FlowViewer`, que além disso sai do viewer (`leaveViewer`). Os comentários de Shots já faziam isso.

**Ícone do gatilho:** **três estados**: sem comentários = contorno apagado; **com comentários = balão preenchido em branco**; dono com comentário não lido = azul preenchido. **Sem número ao lado desde 29/09/2026** (colava os ícones da barra e o toque caía no vizinho); a contagem segue viva via `onCountChange` — é ela que decide preenchido/contorno — e vai no `aria-label`.
**Arquivo:** `client/components/modals/post-comments-dialog.tsx`
**Usado em:** Feed, PostDetail, Perfil

Dialog de comentários de um post:
- Lista de comentários com avatar, nome e texto
- Campo para adicionar comentário com **EmojiPicker** integrado
- Contagem de comentários no botão trigger
- Badge de comentário não lido (para o dono do post)
- Deletar comentário próprio — abre um **`AlertDialog` de confirmação** (título `comments_delete_title`, descrição `comments_delete_desc`, botão de ação em `bg-destructive` com estado de carregamento `comments_deleting`), padronizado para ser idêntico ao modal de exclusão de comentário da tela de Shots. Não usa mais o `confirm()` nativo do navegador
- **`onCountChange?: (count: number) => void`** — callback opcional que reporta ao pai a contagem real de comentários sempre que ela muda (após o load inicial, ao adicionar e ao excluir). Só dispara depois do primeiro load real, para não zerar o contador do trigger com o `[]` inicial. Usado pelo Perfil para manter o contador do post viewer sincronizado
- **Altura fixa** (`height: min(60dvh, viewportHeight - 8px)`, não apenas `maxHeight`) — o drawer sempre nasce no mesmo tamanho, com ou sem comentários, para evitar que o drawer "pule" de tamanho quando o primeiro comentário é postado (o novo comentário nascia atrás do input). A lista interna centraliza o estado vazio/loading verticalmente quando não há comentários. `PromotionCommentsDrawer` segue o mesmo padrão.

---

### PostLikesModal
**Arquivo:** `client/components/modals/post-likes-modal.tsx`
**Usado em:** Feed, Perfil

Modal com lista de usuários que curtiram/incentivaram o post:
- Avatar e nome de cada usuário
- Clicável → navega para o perfil
- Agrupado por tipo de incentivo (opcional)

---

### ExerciseImage
**Arquivo:** `client/components/shared/exercise-image.tsx`
**Usado em:** Metas, Perfil

Card visual de exercício do catálogo:
- Imagem do exercício
- Nome
- Grupo muscular (badge)
- Séries × Repetições configuráveis

---

### DietImage
**Arquivo:** `client/components/shared/diet-image.tsx`
**Usado em:** Metas, Perfil

Card visual de refeição do catálogo:
- Imagem da refeição
- Nome
- Calorias
- Descrição nutricional

---

### HighlightTextarea (#hashtag e @menção em azul enquanto digita)
**Arquivo:** `client/components/shared/highlight-textarea.tsx`
**Usado em:** legenda do Novo Post (post e shot), descrição do resumo de treino, `EditPostDrawer`, edição de post no viewer do Perfil, descrição do flow e `EditShotDescriptionDrawer` (2026-09-28)

- **Técnica da camada espelho:** um `<textarea>` não colore trechos do próprio texto. Uma `<div>` atrás, com a **mesma** `className`/`style`, desenha o texto colorido (`renderHighlightedInput` em `client/lib/post-visuals.tsx`), e o textarea real fica por cima com o texto transparente (`color` + `-webkit-text-fill-color`); só o cursor e a seleção aparecem. A rolagem do espelho segue a do campo.
- **Para o cursor não desalinhar:** o espelho muda **só a cor** (`#9db8ff`), nunca o peso da fonte. O espelho ganha `display:block` (o `flex` do shadcn quebraria o texto em itens), e `.hl-textarea-mirror` herda a mesma fonte-base de 16px que o `global.css` dá ao textarea.
- **Placeholder:** desenhado no espelho (prop `placeholderColor`). O do campo fica transparente via `.hl-textarea-input::placeholder`.
- O `ref` aponta para o textarea real, então `MentionSuggestions` e os hooks de teclado funcionam sem mudança. Para substituir o `Textarea` do shadcn, passar `className={cn(SHADCN_TEXTAREA_CLASS, ...)}`.
- **Não usar** nos textos grandes estilizados do flow ("T + Aa"): lá o texto é o próprio conteúdo visual.

**Exibição (mesma cor):** `renderWithHashtags` (feed, detalhe do post, shots e, desde 28/09/2026, a legenda do viewer de post do Perfil) e `renderWithMentions`, que agora também pinta hashtags nos **comentários** (post, shot, flow). Em comentário a hashtag só é destacada, sem toque, porque navegar de dentro do drawer o deixaria aberto por cima.

### EmojiPickerDrawer (seletor com todos os emojis)
**Arquivo:** `client/components/shared/emoji-picker-drawer.tsx`
**Usado em:** Novo Post (legenda) e `CommentReactions` (botão "+" da barra rápida de reações: comentários de post, shot, flow e check-in)

> O antigo `shared/emoji-picker.tsx` (popover de 4 categorias) não existe mais. Este é o **único** seletor de emojis do app; não criar outro.

Drawer no formato do teclado de emojis do iPhone (reescrito em 28/09/2026):
- **Todos os emojis até o Unicode Emoji 15.0** (iOS 16.4+; os mais novos virariam quadrado em aparelho antigo), ~1.870, nas categorias do teclado: Carinhas e pessoas, Animais e natureza, Comidas e bebidas, Atividades, Viagens e lugares, Objetos, Símbolos, Bandeiras.
- Desenhados pela fonte do sistema: no iPhone são os glyphs da Apple, idênticos ao teclado. **Por que não abrir o teclado de emojis do sistema:** o iOS não deixa um app abrir o teclado direto na aba de emojis.
- **Busca** em PT e EN, sem acento ("coracao", "heart", "fogo"...), e **"Usados recentemente"** (`localStorage` `lk:emoji-recents`, até 24, por aparelho). A barra rápida de reações também alimenta os recentes.
- **Abas de categoria no rodapé**, que acompanham a rolagem, com safe area. Seções fora da tela usam `content-visibility: auto`.
- **Dados:** `client/lib/emoji-data.json`, gerado do `emojibase-data@16` (CLDR, PT + EN), com `[emoji, palavras-chave]` por categoria. É importado sob demanda (`import()`, ~170 KB, ~50 KB comprimido) só na primeira abertura, então não pesa no bundle inicial. Exigiu `resolveJsonModule` no `tsconfig.json`. **Sem dependência npm nova.**
- Tons de pele ficam de fora (emoji base amarelo).
- Props: `open`, `onOpenChange`, `onSelect(emoji)`, `closeOnSelect` (padrão `false`: o Novo Post insere vários seguidos; as reações passam `true`) e `selected` (emojis já escolhidos, destacados em azul, como as reações do próprio usuário).

---

### CheckInCalendarGrid
**Arquivo:** `client/components/shared/check-in-calendar-grid.tsx`
**Usado em:** Metas (`CheckInCalendarModal`), Comunidade (`MemberCheckInsDrawer`)

Grade mensal de check-ins — navegação de mês, cabeçalho de dias da semana e os dias marcados (gradiente laranja; hoje contornado). Só apresentação: quem usa define a moldura (modal em Metas, drawer na Comunidade) e o rodapé.
- Props: `checkInDates` (dias `YYYY-MM-DD` **locais**), `monthsBack` (default 2), `footer(checkInsNoMêsVisível)`
- Exporta `localDateStr(date)` — dia local; nunca usar `toISOString().slice(0,10)`, que devolve o dia em UTC e erra a data a oeste de Greenwich
- O mês visível é estado interno, então **desmontar ao fechar** já reabre em hoje. O `footer` é render prop justamente para o consumidor mostrar a contagem do mês visível sem duplicar esse estado.

---

### ImageWithFallback
**Arquivo:** `client/components/shared/image-with-fallback.tsx`
**Usado em:** Feed, PostDetail, Perfil

Wrapper de imagem com tratamento de erro:
- Exibe imagem original se disponível
- Exibe imagem fallback se a original falhar
- Props: `src`, `alt`, `fallback`, `className`
- Props `cdnWidth`/`cdnHeight`/`cdnQuality`/`cdnResize`: repassadas a `cdnImg()`. **Inertes desde 2026-08-14** — ver *Pipeline de imagens* abaixo. Mantidas porque descrevem o tamanho real de exibição de cada uso e voltam a valer se a flag for religada.

---

### Performance de carregamento (29/09/2026)

- **Inglês sob demanda:** o dicionário EN mora em `client/lib/i18n-en.ts` (chunk próprio, ~133 KB) e só é baixado por quem usa o app em inglês — `loadLanguage(lang)`. O português fica embutido (fonte dos tipos e fallback de toda chave). O `App.tsx` espera `loadLanguage(resolveLanguage())` antes do primeiro render (arquivo local: milissegundos; em PT resolve na hora) para a tela não nascer em português e trocar; `setLanguage` grava a escolha na hora e só troca a tela quando o dicionário estiver na memória. Chunk de entrada: 457 KB → 324 KB.
- **`resolveLanguage()` é a fonte única do idioma** (escolha salva, senão o aparelho). Corrigiu um bug: só o `language-context` olhava o aparelho — num iPhone em inglês sem escolha salva, a tela saía em EN e o que é traduzido fora do React (notificações, Face ID, card de treino, nomes do catálogo via `getUiLanguage`, "há 5 min") saía em PT.
- **Sentry fora da abertura:** o `@capacitor/core` tem chunk próprio (`vendor-capacitor`, 8 KB) no `manualChunks` do `vite.config.ts`. Sem isso o Rollup o colocava dentro do `vendor-sentry` (o `@sentry/capacitor` depende dele) e, como o app usa o Capacitor desde o primeiro frame, a entrada importava os ~490 KB do Sentry estaticamente — anulando o import dinâmico do `monitoring.ts`.
- **Service Worker desligado** (`selfDestroying: true` no `VitePWA`): no app nativo não roda; na web engolia páginas estáticas. O `sw.js` publicado se desregistra e limpa os caches de quem tinha o antigo.
- **Limite diário de uso:** o contador vive num store com seletor (`useUsageClock`) — o layout observa só o estado (normal/urgente/expirado) e apenas `DailyTimerLabel` re-renderiza a cada segundo (antes: header/footer inteiros).
- **Sem `backdrop-filter` fixo nos itens do feed:** botão ⋮ do post, contador de fotos do carrossel e legenda expandida usam fundo escuro sólido — cada post tinha uma camada de blur reamostrada pela GPU a cada frame da rolagem.

### UserSafetyDrawer congela o alvo (corrigido 29/09/2026)

`client/components/shared/user-safety-drawer.tsx` (menu denunciar/bloquear, usado em 5 telas). Tocar numa linha fecha o menu e abre o `ReportDrawer`/`BlockUserDialog`. Alguns pais zeram o próprio estado ao fechar — o drawer de comentários faz `setSafetyTarget(null)` —, e o `userId` chegava `null` aos filhos: o `ReportDrawer` só desenha os motivos com alvo, então abria **vazio** ("sem opção nenhuma"), e o bloqueio abria sem ninguém para bloquear. Agora cada linha chama `freeze()` antes de fechar: o menu guarda uma cópia de `userId`/`userName` e os filhos usam a cópia. **Regra:** filho que abre depois do menu fechar nunca deve ler o alvo direto das props do pai.

### Tradução fora do React (`tUi` em `client/lib/i18n.ts`) — 2026-09-29

Código que não tem acesso ao `useLanguage()` — notificação local (timer de descanso), prompt do Face ID, mensagens de erro/validação do `ritmofit-db` que chegam ao toast via `err.message`, nomes reserva ("Usuário", "Treino", "Hábito desconhecido") — usa `tUi("chave")`, que lê o mesmo idioma que o `language-context` grava no localStorage. `workout-context.tsx` usa `tUi` em vez de `getUiLanguage` do `ritmofit-db` porque não pode importar valores daquele módulo (iria para o chunk de entrada).

Ficam em português **de propósito**: valores gravados no banco e traduzidos só na exibição (motivos de denúncia, medidas de porção, categorias da loja), chaves de catálogo (grupos musculares, categorias TACO, nomes de exercício do gerador), listas do filtro de conteúdo, nomes dos estados, o painel Admin (ferramenta interna) e erros internos que só vão para o log.

**Cards gerados (canvas) — 2026-09-29:** o texto desenhado nos cards do resumo do treino (`workout-summary-overlay.tsx`: padrão, PR, máquina zerada, equivalência, impacto, superação, em números), no card de cardio (`cardio-canvas.ts`: título, frases por marca de distância, painéis) e a data do cabeçalho (`canvas-card.ts`) saem de `tUi()` — chaves `card_*`. Em PT os valores são **idênticos** aos anteriores (rótulos em caixa alta sem acento, padrão visual dos cards). `CARDIO_KIND_META.headline/milestones[].text/timePhrase` e `COMPARISON_ITEMS.singular/plural` agora guardam CHAVES. O grupo muscular do catálogo (sempre PT no banco) passa por `cardMuscleLabel` no "foco em …". Números e decimais seguem `card_number_locale` (pt-BR/en-US). O efeito que desenha o card depende de `language`, então trocar o idioma com o resumo aberto redesenha o card. "Rotina de Exercícios" no `ritmofit-db` também fica: além de nome, é chave da detecção de check-in duplicado.

### Cache das imagens (`client/lib/storage-cache.ts`) — 2026-09-29

**Sintoma:** trocar de tela (feed → perfil, metas, conversas) recarregava as imagens devagar, mesmo as já vistas.

**Causa:** o cache das imagens é o do próprio WebView, guiado pelo `Cache-Control` que o Storage devolve — e esse cabeçalho é gravado **no upload**. Nenhum upload do app passava `cacheControl`, então tudo ficou com o padrão da Supabase, `max-age=3600`: passada 1 hora o WebView precisava revalidar cada imagem com o servidor antes de exibi-la (~300 ms por imagem). As imagens do catálogo de exercícios estavam piores — `no-cache` (revalida sempre, e a CDN não guardava nada).

**Correção:**
- Todo upload do app passa `cacheControl: IMMUTABLE_CACHE_CONTROL` (1 ano). Seguro porque todo caminho de upload é **novo** (timestamp/UUID no nome) — trocar a foto de perfil gera outra URL. Exceção: flows seguem com 24h (`86400`, vivem 1 dia).
- Scripts do catálogo (`migrate-exercise-images.mjs`, `upload-lote-images.mjs`) passam `CATALOG_CACHE_CONTROL` = **7 dias**, não 1 ano: eles sobrescrevem o MESMO caminho (`upsert`) ao corrigir uma imagem.
- Acervo antigo: `scripts/storage-cache-backfill.mjs` regrava o cabeçalho arquivo a arquivo (baixa e reenvia no mesmo caminho — a API não tem "atualizar só metadados"). Dry-run por padrão; `--bucket`/`--only` para ir por partes; `--apply` para gravar. Diagnóstico de 29/09/2026: `posts` 256 arquivos a regravar (388 MB — média 1,5 MB, fotos anteriores a 14/08) e `exercises` 472 (276 MB — média ~580 KB por miniatura).
- Exibição: `ImageWithFallback` decodifica com `decoding="async"`; o `PostCarousel` lembra, por URL, as fotos já carregadas na sessão (`loadedPhotos`) — ao voltar para uma tela a foto aparece direto, sem o fade de entrada.

**Regra para upload novo:** sempre `cacheControl: IMMUTABLE_CACHE_CONTROL` em caminho novo; nunca em caminho reaproveitado com `upsert`.

### Miniaturas no aparelho (`client/lib/thumb-cache.ts`) — 2026-09-29

**Sintoma que sobrou depois do cache HTTP:** todas as telas menos o feed seguiam lentas. **Causa (medida no acervo):** as imagens são servidas no tamanho original — avatar com mediana de **841 KB**, foto de exercício do catálogo (`exercises/manual`) com **975 KB**, foto de post com 683 KB, foto de exercício custom com 2,5 MB. O feed mostra uma foto grande por vez; perfil, metas e conversas mostram dezenas de MINIATURAS, e cada uma baixava e decodificava uma foto de megapixels a cada montagem da tela. As transformações da Supabase seguem desligadas (cota), e recomprimir o original no mesmo caminho não adiantaria: os aparelhos acabaram de guardá-lo com cache de 1 ano.

**Como funciona:** na primeira exibição pequena de uma imagem do Storage, o app baixa (CORS `*`), reduz num canvas (lado MENOR = degrau de 96/192/384/768 px de dispositivo, JPEG 0.82, fundo branco para PNG transparente) e guarda o JPEG no IndexedDB (`lk-thumbs`). Depois: memória (síncrono, sem piscar) na sessão e IndexedDB entre aberturas. Nunca amplia; arquivo ≤ 48 KB ou miniatura maior que o original → usa o original. No máximo 3 gerações simultâneas; acervo podado acima de 1.500 entradas (mais antigas primeiro). Falha de rede/CORS/IndexedDB → URL original, como antes. Nada é gravado no Storage (sem RLS, sem órfão).

**Onde vale:** `useThumbSrc(src, maiorLadoCss)`. `ImageWithFallback` usa com a prop `thumbSize` — ou, sem ela, `cdnWidth`/`cdnHeight` (por isso **todo `UserAvatar`** já sai em miniatura). `ExerciseImage`/`DietImage` (`thumbSize` padrão 64; o detalhe do item passa 400), miniaturas dos diálogos "Ver treino"/"Comparar", foto do exercício no card do treino (`SessionExercisePhoto`, 360) e as 3 grades do perfil (`GRID_THUMB_PX = 160`).

**Regra:** miniatura nova (lista, grade, avatar) → passar o tamanho de exibição; foto que ocupa a tela (feed, detalhe do post, viewer) → original, sem `thumbSize`.

### Pipeline de imagens (`client/lib/image-url.ts` + `image-compress.ts`) — 2026-08-14

**A regra:** a imagem sobe do tamanho em que vai ser exibida. Nada é redimensionado na entrega.

Antes, o app subia o original grande (2160px q0.92) e pedia miniaturas ao endpoint `/storage/v1/render/image/public/` da Supabase via `cdnImg()`. A Supabase cobra **Image Transformations por imagem de origem distinta transformada no mês** — não por requisição. Como todo avatar, toda foto de post e todo flow passavam por lá, o contador crescia linear com a base de usuários e estourou a cota (113/100). Cache de CDN e dedup de request não movem esse número: só reduzir **quantos arquivos diferentes** passam pelo endpoint.

| Origem | Onde o tamanho é definido | Teto | Qualidade |
|---|---|---|---|
| Foto de post, check-in de duelo, capa de grupo, foto do resumo de treino | `inline-crop-preview.tsx` → `applyTransformToBlob` | 1440px | 0.82 |
| Capa de perfil, foto de promoção | `image-cropper-drawer.tsx` (padrão) | 1440px | 0.82 |
| Avatar e logo comercial | `image-cropper-drawer.tsx` via `maxExport={AVATAR_MAX_EXPORT}` | 512px | 0.82 |
| Foto de flow (câmera e galeria) | `flow-creation-dialog.tsx` → `PHOTO_MAX_DIM`/`PHOTO_JPEG_QUALITY` | 1280px | 0.85 |
| Card de resumo de treino e de meta concluída | `canvas-card.ts` → `cardCanvasToBlob()` | 1620px (`CANVAS_SCALE` 3) | 0.92 |
| Arquivo cru do seletor: foto de exercício custom, imagem de conversa privada, foto adicionada no `EditCheckInDrawer` | `image-compress.ts` → `compressImageFile()` | 1440px | 0.82 |

- **`cdnImg()` virou pass-through** — a flag `STORAGE_TRANSFORMS_ENABLED` (em `image-url.ts`) está `false` e a função devolve a URL do objeto. Os call sites (`ImageWithFallback`, `PostCarousel`, `FlowViewer`, `today-dashboard`, `Community`) continuam chamando de propósito: religar a flag restaura o comportamento antigo sem tocar em tela nenhuma.
- **`compressImageFile(file, maxDim?, quality?)`** é a rede de segurança para os fluxos que sobem o arquivo direto do seletor, sem cropper: adicionar foto no `EditCheckInDrawer`, o fallback da capa de grupo no wizard de duelo (quando o frame nunca foi medido), a foto de exercício custom (`uploadCustomExercisePhotoDb`) e a imagem de conversa privada (`uploadMessageImageDb`). Nunca lança — se o WebView não decodificar (HEIC exótico, arquivo corrompido), devolve o arquivo original: melhor subir grande do que impedir o usuário de publicar.
- **Ao criar um upload novo:** passe pelo cropper, por `applyTransformToBlob`, por `compressImageFile` ou — se for um card em canvas — por `cardCanvasToBlob`. Subir um `File` cru do `<input type="file">` (ou um `toBlob("image/png")`) é o antipadrão: sem o transform na entrega, o app baixa o arquivo inteiro para desenhar uma miniatura.
- **Imagens publicadas antes de 2026-08-14** continuam grandes no bucket. Não quebram nada, só gastam mais banda até serem substituídas.
- **Ciclo de vida — excluir conteúdo apaga o arquivo (2026-08-14):** `deletePostDb`, `deleteShotDb`, `deleteStoryDb` e `deleteGroupCheckInDb` leem as colunas de mídia **antes** do DELETE e chamam `removeStorageObjects()`. Exige a migração `20260814-storage-delete-policies.sql` — sem a policy, `storage.remove()` volta 200 com lista vazia e não apaga nada. Detalhes (formatos de caminho, quem limpa o quê, a armadilha do repost) em `docs/14-database-schema.md`, seção *Bucket `posts` — remoção de mídia*.

---

### InlineCropPreview
**Arquivo:** `client/components/shared/inline-crop-preview.tsx`
**Usado em:** NewPost (Etapa 1, foto de post), WorkoutSummaryOverlay (foto do resumo de treino), Comunidade (capa do duelo — wizard Passo 1 e hero do grupo)

> **Frames não-quadrados (2026-07-16):** o módulo assumia frame **quadrado** — `clampedOffset` e `applyTransformToBlob` usavam a largura nos dois eixos. Funcionava por acidente: os dois consumidores originais são 1:1 (NewPost `aspectRatio: 1/1`, WorkoutSummary `540/540`). A capa do duelo é um retângulo largo, então o módulo foi generalizado:
> - `coverBase(imgW, imgH, frameW, frameH)` centraliza o cálculo de "cover" comparando o aspecto da imagem com o **do frame** (antes, com 1). Em frame quadrado o resultado é idêntico ao anterior — verificado para foto 4:3, retrato, 16:9 e 1:1.
> - `InlineCropPreview` **mede as duas dimensões** (`clientWidth`/`clientHeight`) em vez de assumir quadrado. Frames 1:1 não mudam de comportamento, pois lá altura == largura.
> - `clampedOffset(img, containerW, **containerH**, scale, ox, oy)` — parâmetro novo. Era interno; nenhum consumidor importava.
> - `applyTransformToBlob(dataUrl, transform, frameW, frameH?)` — `frameH` **omitido = quadrado**, mantendo as chamadas existentes intactas.
> - Prop nova `containerHeightRef`: obrigatória em frame não-quadrado, para repassar a altura ao `applyTransformToBlob`. Sem ela, o recorte exportado não bate com o preview.
>
> **Bug corrigido junto:** o teto de export clampava largura e altura **independentemente** (`Math.min` em cada), o que **achata** a imagem quando só um lado passa do limite. Invisível em 1:1 (os dois lados são iguais e clampam junto). Agora é um fator único aplicado aos dois eixos. O mesmo tratamento foi aplicado ao `ImageCropperDrawer` em 2026-08-14.

> **Teto de export (2026-08-14):** `MAX_EXPORT` caiu de 2160 → **1440px** e a qualidade JPEG de 0.92 → **0.82** (`JPEG_QUALITY`). O card do feed tem ~430px CSS no iPhone (~900px depois do DPR), então 1440 sobra; o que existia acima disso só servia para o endpoint de transform da Supabase encolher de novo na entrega. Ver *Pipeline de imagens*.

Zoom/pan direto no frame quadrado da foto (pinch-to-zoom + arraste), **sem** passar por uma tela de crop separada (2026-07-02, extraído do `NewPost.tsx` para reuso). Exporta:
- `InlineCropPreview` — componente (canvas) que desenha a foto com o `CropTransform` atual e captura gestos de pointer/touch (drag = pan, pinch = zoom, `MIN_SCALE`–`MAX_SCALE` = 1–5)
- `CropTransform` (`{ scale, offsetX, offsetY }`) e `DEFAULT_TRANSFORM`
- `applyTransformToBlob(dataUrl, transform, containerWidth)` — gera o `Blob` já recortado (JPEG) para upload, replicando visualmente o que o usuário viu no frame
- `getCachedImage(src)` — cache de `HTMLImageElement` decodificado, evita re-decodificar a mesma foto entre re-renders

Cada foto tem seu próprio `CropTransform` guardado por índice (`Record<number, CropTransform>`), reindexado ao remover/reordenar fotos. Como o frame captura o gesto de arraste para pan, telas com múltiplas fotos não podem depender de swipe nativo para navegar entre elas — precisam de setas/dots clicáveis (ver `NewPost.tsx` e `workout-summary-overlay.tsx`).

---

### RouteMap / renderRouteMapImage
**Arquivo:** `client/components/shared/route-map.tsx`
**Usado em:** WorkoutSessionDialog (resumo pós-corrida GPS da "Corrida ao Ar Livre") e WorkoutSummaryOverlay (slide de mapa compartilhável no resumo do treino) — ver `docs/05-metas.md`

Mapa **estático** do trajeto de uma corrida GPS, sem dependências de biblioteca de mapas: `computeRouteLayout` calcula o zoom que enquadra o bbox do trajeto e a grade de tiles **CARTO dark** (`basemaps.cartocdn.com/dark_all`, @2x — combina com o tema glass escuro; atribuição "© OpenStreetMap © CARTO" obrigatória no canto). A mesma matemática alimenta **duas saídas**:
- **`<RouteMap/>`** (DOM): tiles em `<img>` + **polyline** SVG por cima (azul `#5b8cff` com glow; início = ponto verde, fim = laranja). Props: `path: RunPoint[][]` (segmentos — quebra a cada pausa→retomada, sem reta ligando os trechos), `height` e `emptyLabel` (estado vazio quando há < 2 pontos).
- **`renderRouteMapImage(path, stats, size=1080)`** (async → `Blob | null`): desenha o mapa num **canvas quadrado** e devolve **JPEG pronto para upload** (slide compartilhável do resumo do treino). Tiles carregados com `crossOrigin:"anonymous"` para não "sujar" o canvas (tile sem CORS é pulado); rodapé com **distância/tempo/ritmo** sobre gradiente escuro (rótulos localizados vêm em `stats.labels`; valores formatados por `formatRunTime`/`formatRunPace` de `run-tracker.ts`) e atribuição no canto. Se `toBlob` falhar por canvas tainted, **redesenha sem tiles** (rota sobre fundo escuro) — a imagem continua válida offline.

Estático de propósito (sem pan/zoom): é um resumo pós-corrida, não um mapa navegável. Requer rede para os tiles (sem CSP no app).

---

### RunSplitsList
**Arquivo:** `client/components/shared/run-splits.tsx`
**Usado em:** WorkoutSessionDialog (resumo pós-corrida GPS) e WorkoutSummaryOverlay (seção "Corrida ao ar livre" do resumo do treino) — ver `docs/05-metas.md`

Lista das **parciais por km** de uma corrida GPS (`RunSplit[]` de `run-tracker.ts`), na linguagem dos apps de corrida: colunas **Km · Tempo · Ritmo (/km)**, uma linha por quilômetro. Cada linha tem uma **barra proporcional à velocidade do trecho** (`fastestPace / paceSecPerKm`, com piso de 28% para o km mais lento continuar visível), o **km mais rápido** ganha o selo ⚡ (calculado só entre os km **fechados** — um trecho parcial de 80 m não é comparável a um km inteiro) e o **trecho final incompleto** aparece com a distância percorrida (ex.: `0,4`) e o selo `parcial`.

Props: `splits`, `accent` (cor das barras/destaques — quem chama passa a cor do contexto: azul da sessão ou o acento do template escolhido no resumo) e `maxRows` (0 = todas; > 0 mostra N linhas com "Ver todos/Mostrar menos"). Renderiza `null` sem parciais. Tokens de cor **fixos em branco translúcido**: as duas telas que o usam são shells "liquid glass" escuros independentemente do tema.

---

### WorkoutDetailButton
**Arquivo:** `client/components/shared/workout-detail-dialog.tsx`
**Usado em:** Feed (`PostCard`), Perfil (viewer de post), PostDetail

Pill **"Ver treino"** + drawer glass **simplificado** de detalhe do treino. No Feed e no PostDetail é só o ícone, dentro da pílula do autor (`variant="icon"`, ver abaixo); renderizado apenas em posts que carregam um `workout_summary` (posts de resumo de treino compartilhados no feed). Props: `summary: PostWorkoutSummary` (tipo em `client/lib/workout-summary-types.ts`), `className` (posicionamento do pill) e — desde 26/08/2026 — `authorId`/`authorNickname`/`authorPhoto`, que habilitam o botão **"Comparar com o meu treino"** dentro do drawer (ver `WorkoutCompareContent` abaixo); sem eles, ou quando o autor é o próprio usuário, o drawer segue sendo só a lista. O drawer (padrão glass §9.4) mostra **só** a lista de exercícios: cada linha com a **miniatura do exercício** (`ExerciseImage`, fallback gradiente/emoji por grupo quando sem foto), nome + grupo muscular e as **séries em chips `{kg}kg × {reps}`** — sem stats/banners (o overlay completo é o `WorkoutSummaryOverlay` na tela de Metas). **Única exceção (21/08/2026):** um chip `🔥 {n} kcal` no canto direito do cabeçalho quando o snapshot tem `caloriesKcal` — duração/séries/volume continuam de fora (estão no card gerado que acompanha o post), mas o gasto calórico é o número que as pessoas comparam e vale ter em texto, não só queimado na imagem. Optou-se por pill dedicado em vez de tornar a imagem inteira clicável, para não conflitar com o duplo-toque de incentivo, o pinch-zoom e o swipe de carrossel já existentes na imagem do post. Ver `docs/01-feed.md` (Detalhe do treino) e `docs/14-database-schema.md` (`posts.workout_summary`).

---

### WorkoutCompareContent
**Arquivo:** `client/components/shared/workout-compare-dialog.tsx` (regra pura em `client/lib/workout-compare.ts`)
**Usado em:** exclusivamente **dentro** do drawer do `WorkoutDetailButton` — logo, no Feed, no Perfil (viewer de post) e no PostDetail

View de **confronto exercício a exercício** entre o resumo de treino de um post e a **minha última execução** de cada um daqueles exercícios (26/08/2026). Não tem shell próprio: é o corpo que o drawer "Ver treino" renderiza no lugar da lista quando a pessoa toca em **"Comparar com o meu treino"**. Props: `active` (dispara a leitura de banco — uma vez só, quando a view fica visível), `summary`, `authorNickname`, `authorPhoto`. O helper `canCompareWorkout(summary, authorId, viewerId)` é exportado junto e concentra a regra de quando o botão aparece: precisa de sessão, de exercícios no resumo e de o autor ser **outra** pessoa.

- **Por que não é um segundo drawer:** empilhar dois `Drawer` do vaul deixaria duas alças na tela e faria os dois sheets disputarem o scroll-lock do `body` no iOS. Uma `view` dentro do mesmo `DrawerContent` mantém um scroll, uma alça e um `‹` explícito de volta. Fechar o drawer reseta para a lista.
- **Casamento estrito por exercício:** `workout_id` do catálogo (campo `workoutId` de cada exercício do snapshot), com fallback por **nome normalizado** (`getWorkoutNameIdIndexDb`, que indexa `name` e `name_eng`) para posts anteriores a 26/08/2026. Exercício que não resolve para um id é descartado — supino nunca compara com leg press.
- **Meu lado:** `getLastExerciseSessionsDb` (última sessão registrada daquele exercício, só séries de trabalho, mesma janela de 2s do pré-preenchimento — `groupLastSessionByWorkout`).
- **Veredito:** força → carga → volume → repetições; cardio → distância → tempo. O chip `+Xkg` só aparece quando a **primeira** métrica decidiu.
- **Layout:** placar com os dois avatares (`3 × 2`) no topo; por exercício, um card com miniatura + nome + chip de veredito e duas colunas (dele | minha), cada uma com a melhor série em destaque e `séries · volume` embaixo; coluna vencedora em verde. Exercício que eu nunca fiz vai para a seção **"Sem comparação"** com placeholder tracejado e **não** entra no placar.

Ver `docs/01-feed.md` (Comparar treino) e `docs/14-database-schema.md` (`posts.workout_summary`).

---

### MentionSuggestions (2026-09-27)

`client/components/shared/mention-suggestions.tsx` — autocomplete de **menção "@"** para qualquer `<input>`/`<textarea>`. Ao digitar `@` (no início ou depois de espaço), lista até 5 pessoas — **só quem o usuário segue** (`getFollowingDb`, filtrado por handle/apelido; desde 2026-09-30 não há mais busca global — `searchMentionUsersDb` foi removida) — e troca o `@termo` por `@handle ` mantendo o cursor. Vale para todo campo: legendas de post e flow, edição de post, resumo do treino, comentários, resposta de flow e legenda de clipes.

- Props: `inputRef` (o campo), `value`/`onChange` (texto controlado), `onPick?(user)`, `placement` (`"above"` para docas no rodapé, `"below"` para campos no topo). O **pai precisa ser `relative`**.
- **Não tira o foco do campo** ao tocar numa sugestão (`onTouchEnd`/`onMouseDown` com `preventDefault`) — no iOS perder o foco fecharia o teclado.
- `addMentionToTagged(prev, user, max)`: helper para legendas que aceitam marcação — a pessoa escolhida entra nos marcados (e a marcação notifica, types 9/16).
- Onde está: legenda do Novo Post, `EditPostDrawer`, descrição do resumo de treino, descrição do flow e texto do flow (**"T + Aa"**, nos dois editores — só texto e sobre mídia) (com `onPick` → marcação); comentários de post (`PostCommentsDialog`, no campo novo **e na edição**), shot e flow (os dois viewers) — lá a notificação é o type 20, gerado pelo banco (só no INSERT: editar não renotifica).
- A lista para a propagação de toques (`pointerdown`/`touchstart`/`touchend`/`click`): no editor "T + Aa" um toque fora confirma o texto, e nos viewers um toque avança o flow. No "T + Aa" a lista fica abaixo do texto com `max-h-[168px]` e rolagem, para caber acima do teclado.
- Render: `renderWithMentions(text, onClick)` (comentários) e o 3º parâmetro de `renderWithHashtags` (legendas), em `client/lib/post-visuals.tsx`, destacam `@handle` em azul; o toque usa `useOpenProfileByHandle` (`client/hooks/use-open-profile-by-handle.ts`, resolve handle → id via `getUserIdByHandleDb`).

### TagPeopleDrawer
**Arquivo:** `client/components/shared/tag-people-drawer.tsx`
**Usado em:** NewPost (Etapa 2 — "Marcar pessoas"), EditPostDrawer (seção "Pessoas marcadas" — abre por cima do drawer de edição), WorkoutSummaryOverlay (marcar quem treinou junto antes de publicar o resumo no feed) e FlowCreationDialog

- **Só quem o usuário segue (2026-09-30, em TODAS as telas):** a lista é a de seguidos e a busca só filtra essa lista, por nome ou @ (placeholder "Buscar entre quem você segue...", vazio "Ninguém com esse nome entre quem você segue") — não há mais busca global (`searchUsersDb`). O `MentionSuggestions` segue a mesma regra em todos os campos (marcação e menções de comentário, resposta de flow e clipes). A regra é de interface: `post_tags`/`flow_tags` e o gatilho de menção em comentário não restringem no banco — um @handle digitado à mão, sem usar a sugestão, ainda vira texto.

- **"Encontrar pessoas" para quem não segue ninguém (2026-09-27):** com a lista de seguidos vazia e sem busca digitada, o drawer mostra "Você ainda não segue ninguém. Encontre e siga pessoas para poder marcá-las." (`tag_people_no_following`) + botão **"Encontrar pessoas"** (`feed_find_people`), que fecha o drawer e leva à tela **Buscar** (`/buscar`) para procurar e seguir gente. O rascunho do Novo Post sobrevive à navegação (`sessionStorage` + `imageDraft`), e seguir alguém invalida o cache `following` — ao voltar e reabrir o drawer, os recém-seguidos já aparecem. Vale em todos os usos do drawer

Drawer glass de **marcação de pessoas em um post** (estilo Instagram). Seleção controlada pelo pai via `selected: SearchUser[]` / `onChange`:
- Ao abrir, lista quem o usuário segue (`getFollowingDb`); a busca filtra os seguidos **e** procura qualquer pessoa do app (`searchUsersDb`, debounce 300ms), mesclando sem duplicatas e excluindo o próprio usuário
- Cada linha: `UserAvatar` + nickname + check circular (gradiente azul→roxo quando selecionado)
- Limite exportado `MAX_TAGGED_PEOPLE = 10` — exceder mostra toast destrutivo
- Botão "Concluir (n)" apenas fecha (a seleção já está no pai)
- Props: `open`, `onOpenChange`, `selected`, `onChange`, `wrapperClassName?`
- **`wrapperClassName`** repassa classes ao **lift wrapper do portal** do `DrawerContent` (novo prop, 17/08/2026). É o único jeito de abrir o drawer por cima de um overlay de z alto: o wrapper tem `transform` (para subir com o teclado), o que faz dele um **stacking context** — subir o z-index do conteúdo/overlay só reordena *dentro* dele e o drawer inteiro continua pintando no `z-[310]` do wrapper, atrás do overlay. O resumo do treino (`zIndex 9500`) passa `z-[9600]`. Note que isso é diferente do caso de drawer-sobre-drawer (Comunidade), onde os dois estão no mesmo wrapper e `className="z-[330]" + overlayClassName="z-[320]"` resolvem.

---

### ShareDrawer
**Arquivo:** `client/components/shared/share-drawer.tsx`
**Usado em:** Feed (`Index.tsx`), `PostDetail.tsx`, `Profile.tsx`

Drawer glass de compartilhamento externo: share sheet nativa do iOS (`@capacitor/share`) + atalhos de WhatsApp, Instagram, Facebook, Telegram, X, "mais opções" e copiar link. Props: `open`, `onOpenChange`, `text`, `url?`, `title?`, `onSendToFriend?`.

O card de prévia mostra só o `text` — a URL (com o id do post) **não é exibida** no drawer desde 2026-09-26, a pedido do produto. O link continua sendo enviado normalmente nos atalhos e no "copiar link".

As URLs vêm de `client/lib/share-url.ts`, que reexporta a fonte única `shared/share-config.ts`. **O que acontece do outro lado do link** — Universal Links, custom scheme, prévia Open Graph e landing de instalação — está em `docs/19-compartilhamento-e-deep-links.md`.

---

- **"Seu flow" (2026-09-27):** prop opcional `onShareToFlow?: () => Promise<void>` → botão com borda em gradiente e ícone `CirclePlus` logo após "Amigos" (spinner enquanto roda; fecha o drawer quando a promise resolve, fica aberto se ela rejeitar). O pai decide quando oferecer — hoje só no **próprio post com foto** (Feed e Detalhe do post). A publicação é `sharePostToFlow(post)` (`client/lib/post-to-flow.ts`): cria um flow **sem mídia própria** — fundo `POST_FLOW_BACKGROUND` (gradiente da moldura de repost) e um único elemento `kind: "post"` em `text_elements` (`StoryPostSticker`: `postId`, 1ª foto, autor). O viewer desenha a **moldura do post** ao vivo (`FlowPostCard`) e o toque nela abre `/post/:id`. Referência e não cópia de propósito: sem `media_url`, apagar o flow não toca no Storage (reaproveitar a foto do post como mídia faria apagar o flow apagar a foto do post).
- **"Postar agora" ou "Editar antes" (2026-09-29):** prop opcional `onEditFlow?: () => void`. Com ela, tocar em "Seu flow" troca o conteúdo do drawer por uma escolha (`share_flow_choice_title`): **Postar agora** (`onShareToFlow`, o comportamento de antes, com spinner) ou **Editar antes de postar** (fecha o drawer e chama `onEditFlow`), mais "Voltar". Sem a prop, "Seu flow" continua postando direto. A escolha volta para a lista de destinos sempre que o drawer reabre. Quem passa hoje: Feed, Detalhe do post e Perfil, via `usePostReshare().editFlow`, que navega para `/` com `state.createFlowSeed.postSticker` — o Feed abre o `FlowCreationDialog` no modo texto com a moldura do post colada (ver `docs/01-feed.md`, "Semente do criador").
- **"Seu feed" (repost de post marcado):** `onRepostToFeed` + `repostedToFeed`; desde 2026-10-05 também `onUndoRepostToFeed` — já repostado, o botão mostra check verde e "Remover do feed" e desfaz o repost. Sem `onUndoRepostToFeed` o estado repostado fica travado como antes.

### RepostedBy (2026-10-05)
`client/components/post/reposted-by.tsx` — chip "🔁 {nome} repostou" / "{nome} e mais {n} repostaram" de um post que outras pessoas adicionaram ao perfil (`post.repostedBy`, tabela `post_reposts`). Um nome → perfil; 2+ → `FollowListDrawer` com a lista ("Repostado por"), que o próprio componente abre. Usado no `PostCard` (feed e viewer do perfil) e no `PostDetail`. Substituiu o `RepostAttribution` ("Repost de {autor}") do modelo antigo, em que o repost era uma cópia do post.

### SendToFriendDrawer (2026-07-12)
**Arquivo:** `client/components/shared/send-to-friend-drawer.tsx`
**Usado em:** Feed (via `ShareDrawer` → botão "Amigos"), PostDetail (avião de papel na barra de ações) e Shots (avião de papel na coluna de ações)

Drawer glass de **envio de post/shot para amigos via mensagem privada** (estilo Instagram):
- Ao abrir, lista **conversas recentes primeiro** (`getConversationsDb`) seguidas de quem o usuário segue (`getFollowingDb`), sem duplicatas; busca global via `searchUsersDb` (debounce 300ms) permite enviar para quem não é seguido
- **Conversas bloqueadas são puladas** (`conv.isBlocked`). Desde 14/09/2026 elas continuam na lista da Comunidade (o histórico é preservado de propósito), mas aqui seriam um **destino de envio** — e a policy `messages_insert_not_blocked` recusa a inserção, então a ação só poderia falhar
- Preview compacto do conteúdo no topo (thumbnail do post ou frame do vídeo do shot + @autor)
- Multi-seleção (mesmo padrão visual do `TagPeopleDrawer`, limite 10 destinatários) + campo de **mensagem opcional**
- Ao enviar: `sendMessageDb(recipientId, "[post]:<id>" | "[shot]:<id>")` por destinatário (em paralelo); se houver texto opcional, é enviado como segunda mensagem; toast de sucesso/erro
- Props: `open`, `onOpenChange`, `content: SendableContent | null` (`{ kind: "post" | "shot", id, previewImage?, authorNickname? }`)
- No chat da Comunidade, essas mensagens são renderizadas pelo **`SharedContentMessage`** (`client/components/community/shared-content-message.tsx`): card clicável com autor, thumbnail, descrição e "Ver post"/"Ver shot"; conteúdo apagado mostra "Conteúdo indisponível". Ver `docs/07-comunidade.md`
- **`ShareDrawer`** ganhou a prop opcional `onSendToFriend?: () => void` — quando presente, exibe o botão "Amigos" (gradiente do app + `SendHorizontal`) como primeira opção da fileira de apps; o pai fecha o share e abre este drawer

---

### useFlowPrivateReply / FlowReplyMessage (2026-08-17)
**Arquivos:** `client/hooks/use-flow-private-reply.ts`, `client/lib/flow-reply.ts`, `client/components/community/flow-reply-message.tsx`
**Usado em:** os **dois** viewers de flow — a tela `/flows/:storyId` (`client/pages/FlowViewer.tsx`) e o modal aberto pelo perfil (`client/components/modals/flow-viewer-modal.tsx`) — e o chat da Comunidade

Responder um flow **em privado**: o texto digitado na doca do viewer, em vez de virar comentário público (balão flutuante), vai como **mensagem direta para o autor**, com a miniatura do flow respondido na conversa.

- **Hook `useFlowPrivateReply(story, isOwner)`** → `{ isSendingPrivateReply, sendPrivateReply(text) }`. Concentra validação (teto de 900 chars — `sendMessageDb` rejeita acima de 1000 e o payload ainda leva prefixo + id), haptic, toasts de sucesso/erro e `reportHandledError`. Devolve `true` quando gravou, e só então o chamador limpa o campo. Existe como hook porque as duas docas são cópias uma da outra: a lógica não podia nascer duplicada uma terceira vez.
- **Doca:** botão circular de vidro com `MessageCircle` **antes** do avião de envio (que segue sendo o comentário público). Só aparece em flow de outra pessoa (`!isOwner`). Como os dois botões agem sobre o mesmo campo, uma linha de dica (`flow_reply_hint`) surge assim que há texto digitado.
- **Protocolo:** `[flowreply]:<flowId>|<texto>` (`buildFlowReplyPayload`/`parseFlowReply` em `client/lib/flow-reply.ts`), na mesma família de `[audio]:`/`[image]:`/`[post]:`/`[shot]:`. **Sem migração** — mas o push usa a notificação **tipo 17** ("respondeu ao seu flow"), então **exige redeploy da `send-push-notification`**. `sendMessageDb` ganhou um 3º parâmetro opcional (`SendMessageContext`: `notificationType` + `flowId`) só para escolher o texto do push; a mensagem em si continua uma linha normal em `messages`.
- **`FlowReplyMessage`** renderiza a bolha no chat: rótulo de contexto, miniatura vertical 68×104 e o texto. Ver `docs/07-comunidade.md` para os estados (flow apagado, flow expirado) e o memo de sessão que evita refetch.

---

### MultiPhotoBadge (2026-09-30)
**Arquivo:** `client/components/shared/multi-photo-badge.tsx`
**Usado em:** Perfil (grades Posts e Marcações), Hashtag

Selo "post com várias fotos" das grades: pílula de vidro escuro (`rgba(10,11,18,.55)` + borda `white/18`, **sem** `backdrop-filter` — dezenas por grade) com o ícone `GalleryHorizontalEnd` e a quantidade; `aria-label` "{n} fotos" (`post_photo_count_aria`). Substitui o quadradinho branco com emoji 📷. Toda grade nova com posts de várias fotos usa este selo.

### ScreenAura (2026-09-30)
**Arquivo:** `client/components/shared/screen-aura.tsx`
**Usado em:** Feed (`feed`), Metas (`goals`), Notificações (`notifications`), Busca e Comunidade (`neutral`)

Brilho de fundo padrão das telas: `div aria-hidden fixed inset-0 -z-10` com `radial-gradient` pintado direto. Começa no topo da tela, por trás do vidro do header, em todas as telas. **Não** criar aura `absolute` no container da página (começa abaixo do header → faixa preta com corte reto). Depende do `isolate` no raiz do `AppLayout`. Na Busca fica **fora** do `space-y-4` (como 1º filho empurraria o campo 16px).

### WorkoutDetailButton — `variant="icon"` (2026-09-30)
No Feed e no PostDetail o botão é só o halter, num selo do tamanho do "🎯 80%" da meta, **dentro** da pílula do autor (área de toque ampliada com `-m-1.5 p-1.5`). O viewer de post do Perfil segue com a pílula com rótulo (`variant="pill"`, padrão).

### ProfilePostsViewer (2026-09-30)
**Arquivo:** `client/components/profile/profile-posts-viewer.tsx`
**Usado em:** Perfil (abas Publicações, Treinos e Marcações)

Publicações em tela cheia com o **`PostCard` do feed**, rolada até o post tocado (substitui o drawer próprio do Perfil). Recebe os posts da aba (`PostWithUser`, dados embutidos) e completa incentivos/comentários com `withPostStats`. Tem os próprios `PostLikesModal`, `GoalDetailDrawer` (leitura), `ReportDrawer`, `BlockUserDialog`, `EditPostDrawer` e confirmação de exclusão; compartilhar vem do Perfil (`onShare`). `z-[45]` + `data-fullscreen-step` (ver `docs/08-perfil.md`).

### SectionHeader (2026-09-30)
**Arquivo:** `client/components/shared/section-header.tsx`
**Usado em:** Metas (`TodayDashboard`, `RoutineTypeCards`, `LifeGoalsSection`)

Título de seção padrão do app: `h2` 20px bold branco (`tracking-[-0.01em]`) + ação opcional em texto azul (`text-primary`, 14px semibold, com ícone Lucide opcional) à direita. Props: `title`, `action?: { label, onClick, icon?: LucideIcon }`, `className`. Substituiu quatro estilos soltos (rótulo "EM FOCO · HOJE" em maiúsculas, 18px/740, título + etiqueta "opcional"). Usar em qualquer seção nova — ver `docs/15-design-system.md` §2.5.

### FollowButton — hierarquia Seguir/Seguindo (2026-09-30)
**Arquivo:** `client/components/shared/follow-button.tsx`

Na variante `default` (perfil, busca, listas, notificações, sugestões do feed): **"Seguir"** é branco (`bg-white text-[#0a0b12]`, ação principal) e **"Seguindo"** é secundário (`bg-white/[.09] text-white/85`, sem borda). Antes: `default`/`outline` do Shadcn, em que o "Seguindo" escuro parecia o botão mais forte. A variante `overlay` (sobre foto/vídeo) não mudou.

**Confirmação ao deixar de seguir (2026-09-30).** Tocar em "Seguindo" não desfaz mais o follow na hora: abre um `AlertDialog` (z-[360], acima de drawers e viewers).
- **Título:** "Deixar de seguir {nome}?", com o nome vindo da prop opcional `targetName`. Sem ela, o título é "Deixar de seguir esta pessoa?".
- **Descrição:** "Você pode voltar a seguir quando quiser."
- **Botões:** "Deixar de seguir" (destrutivo) e "Cancelar".
- **Onde passa o nome:** Buscar, sugestões do feed, notificações, perfil e `FollowListDrawer` passam `targetName`.
- **Seguir continua direto,** sem confirmação.
- **Único caminho de unfollow:** todo unfollow do app passa por aqui. A variante `overlay` some quando já segue, então não tem unfollow.
- **Isolamento dos cliques:** o diálogo fica num `<span className="contents">` que para `click`/`pointerdown`. Eventos React sobem pelo portal até os pais, e sem isso tocar no diálogo acionava o card em volta (ex.: a notificação navegava).
- **i18n:** `follow_unfollow_confirm_*`.

### FollowListDrawer (estendido para listas genéricas de usuários)
**Arquivo:** `client/components/profile/follow-list-drawer.tsx`
**Usado em:** Perfil (seguidores/seguindo), Feed (`PostCard`), PostDetail (lista "Pessoas marcadas" de um post) e `FlowViewer` (marcados de um flow com 2+, aberto pelo chip do cabeçalho)

Além do uso original com `type: "followers" | "following"`, aceita `title` e `emptyMessage` opcionais que sobrescrevem os textos derivados de `type` — é assim que o feed/detalhe reutilizam o drawer para mostrar os marcados de um post (2+ pessoas). Quando o pai não passa `followStatus` em batch, o `FollowButton` de cada linha busca o próprio status (`initialIsFollowing` fica `undefined`). Strings padrão traduzidas via `t()` (`profile_followers`, `profile_following`, `follow_list_empty_*`).

---

### UserInsignias
**Arquivo:** `client/components/profile/user-insignias.tsx`
**Usado em:** Feed, Perfil

Exibe badges/conquistas do usuário:
- Ícones coloridos representando conquistas
- Tooltip com nome da conquista
- Baseadas em pontos, streaks, número de posts, etc.

---

### IncomingMessageToast (2026-08-06)
**Arquivo:** `client/components/shared/incoming-message-toast.tsx`
**Usado em:** `AppLayout` (montado uma única vez, aparece sobre qualquer tela)

> **Desde 2026-09-27 também exibe notificações sociais** (incentivo, comentário, seguidor, marcação, menção…) via `showIncomingNotificationToast` — `Banner.kind = "notification"`: 1ª linha = título, 2ª = texto pronto do `notification-copy.ts`, selo de sino laranja (DM segue com o balão azul) e o toque vai para o deep link da notificação. Um banner novo substitui o anterior.

Pop up glass no topo avisando que chegou uma mensagem privada com o app aberto:
- **Conteúdo:** avatar + apelido do remetente + preview da mensagem (via `conversationPreviewText`, o mesmo helper da lista de conversas — resolve `[audio]:`, `[image]:`, `[post]:`, `[shot]:` e respostas `↩`)
- **Entrada:** pub/sub `client/lib/incoming-message-toast.ts`, alimentado pelo canal realtime de `messages` do `AppLayout` — nunca por props
- **Saída:** some em 5s, arrasta para cima para dispensar, toque abre `/comunidade?user=<remetente>`
- **Safe area:** `top: max(12px, env(safe-area-inset-top))`, `z-[9999]`, wrapper `pointer-events-none` com o botão `pointer-events-auto`
- A **vibração não fica aqui** — mora no `AppLayout`, porque deve ocorrer inclusive quando o banner é suprimido (conversa já aberta)

---

### BannedScreen (2026-08-11)
**Arquivo:** `client/components/shared/banned-screen.tsx`
**Usado em:** `RequireAuth` (`client/App.tsx`) — substitui o `<Outlet/>` inteiro quando a conta está banida

Tela cheia de conta suspensa: ícone `ShieldBan`, título, explicação e botão "Sair" (`resetSupabaseAuth`). Textos traduzidos (`banned_title`, `banned_description`).

- **A trava real não é esta tela** — é o `banned_until` do GoTrue, gravado por `admin_set_banned` (ver `docs/18-admin.md`). Ela cobre a janela em que o access token já emitido ainda vale (até 1h).
- O guard `useBanGuard` **não bloqueia o primeiro render**: consulta `is_current_user_banned()` em background e só então troca a tela. Travar o boot atrás de uma ida ao servidor penalizaria todo mundo pelo caso raro.
- `ritmofit-db` entra por **import dinâmico** dentro do guard — `App.tsx` é o chunk de entrada e não importa o módulo em nenhum outro ponto, de propósito.
- Não redireciona para `/login`: sair sem explicação vira "o app parou de funcionar" no review da App Store.

---

### LazyMount (2026-08-11)
**Arquivo:** `client/components/shared/lazy-mount.tsx`
**Usado em:** `client/pages/Index.tsx` — envolve cada `PostCard` das abas "Seguindo" e "Descobrir"

Mantém no DOM só o que está perto da viewport. Item longe → conteúdo desmontado e substituído por um espaçador com a altura medida antes de sair.

| Prop | Padrão | Descrição |
|---|---|---|
| `estimatedHeight` | `480` | Altura do espaçador enquanto o item nunca foi medido |
| `rootMargin` | `"150%"` | Folga ao redor da viewport que ainda conta como "perto" |

- **O ganho não é re-render** — o `memo` do `PostCard` já cobre isso. É contagem de nós, decodificação de imagem, layout, pintura e composição do `backdrop-filter`, que o WKWebView paga mesmo para o que está a dez telas de distância.
- **Começa montado** de propósito: o feed restaura a posição de scroll ao voltar de outra tela, e com alturas estimadas essa restauração cairia no lugar errado. O observer recolhe no frame seguinte, já com alturas reais.
- **Sem `content-visibility: auto`**, que resolveria com uma linha de CSS: só existe do Safari 18 em diante, e o `IPHONEOS_DEPLOYMENT_TARGET` é 15.0.
- **Sem biblioteca de virtualização**: as existentes assumem altura fixa, e dependência nova exige regenerar os dois lockfiles (npm/Appflow + pnpm/Vercel).
- Sem `IntersectionObserver` no ambiente, vira passthrough — tudo montado, como antes.

> **Não usar em chat.** A conversa privada é capada em 200 mensagens e é ancorada embaixo; desmontar bolhas de altura variável faria o scroll pular.

---

### ShotThumb (2026-08-13)
**Arquivo:** `client/components/shared/shot-thumb.tsx`
**Usado em:** `pages/Profile.tsx` (aba Shots), `pages/Search.tsx` e `pages/Hashtag.tsx` (itens `kind: "shot"` da grade)

Miniatura de um shot nas grades. Substituiu o `<video src={videoPosterSrc(...)} preload="metadata">` que estava duplicado nas três telas.

| Prop | Descrição |
|---|---|
| `videoUrl` | URL do vídeo do shot; `null`/vazio renderiza o elemento sem fonte |
| `className` | Classes do `<video>` (as três telas passam variações de `h-full w-full object-cover`) |

- **Poster sem coluna no banco:** o `src` sai de `videoPosterSrc()` (`lib/video-thumb.ts`), que anexa `#t=0.1` para o WebView fazer *seek* e pintar aquele frame.
- **Gerencia o player de vídeo do iOS**, que é o motivo real de o componente existir. O WKWebView tem um **teto de players simultâneos** e cada `<video>` da grade ocupa um. Estourado o teto, o próximo vídeo a tocar vem **sem faixa de vídeo** — o áudio sai, a tela fica preta. Duas travas:
  - `src` anexado só quando a célula entra na viewport (`rootMargin: 400px`) e solto 2s depois de sair → players vivos acompanham o que está na tela, não o total de shots.
  - `releaseVideoElement` (`lib/media-prefetch.ts`) na limpeza do efeito → ao navegar para `/shots`, todos os players da grade são devolvidos **antes** de o vídeo em tela cheia pedir o dele. Tirar o `<video>` do DOM não basta: o WebKit só solta o recurso na coleta de lixo.
- Sem `IntersectionObserver` no ambiente, carrega tudo direto — a liberação no desmonte, que é a trava principal, continua valendo.

> **Sempre use `releaseVideoElement` ao desmontar um `<video>`** em qualquer tela nova. A tela de Shots faz o mesmo no componente `ShotVideo` (ver `docs/03-shots.md`).

---

### AnimatedLoading
**Arquivo:** `client/components/shared/animated-loading.tsx`

Componentes de estado de loading:
- `LoadingSpinner` — spinner circular animado
- `PostSkeleton` — skeleton de card de post
- Outros skeletons para diferentes contextos

---

### ~~FloatingActionMenu~~ (removido em 21/08/2026)

Menu de ação flutuante e arrastável que duplicava os atalhos da bottom nav.
**Apagado junto com o hook `useLayoutMode`.**

Era **código inalcançável**: só renderizava com `layoutMode === "novo"`, e nada
no app chamava `setLayoutMode`/`toggleLayoutMode` — o único jeito de ligá-lo era
escrever `ritmofit-layout-mode` na mão no localStorage. Além disso ainda listava
a navegação antiga (com Vitrine, sem Comunidade) em português fixo, e o
`useLayoutMode` era um `useState` comum, não um contexto: as três chamadas
(`App.tsx`, `app-layout.tsx`, o próprio menu) tinham estado independente e
dessincronizariam se o toggle voltasse a existir.

Com o hook fora, as duas condições `layoutMode === "default"` do `AppLayout`
(padding inferior do `<main>` e exibição da bottom nav) passaram a depender só
de `!hideNav`.

---

### ThemeProvider
**Arquivo:** `client/components/layout/theme-provider.tsx`

Provedor de tema dark/light:
- Wraps a aplicação inteira
- Persiste preferência em localStorage
- Integrado com `next-themes`

---

## Hooks Customizados

### useAuth
**Arquivo:** `client/hooks/useAuth.ts` (contexto em `client/lib/auth-context.tsx`)

Gerencia estado de autenticação:
- `user` — usuário logado (ou null)
- `loading` — se ainda está verificando a sessão
- Integrado com Supabase Auth

**`loading` só é `true` quando NÃO há sessão em disco (2026-08-11).** O provider lê a chave `sb-*-auth-token` do localStorage no estado inicial; se ela traz um usuário, a árvore renderiza na hora e a verificação assíncrona corrige depois.

- **Por quê:** `loading` começava sempre `true`, e o app inteiro ficava atrás da tela vazia do `AuthLoadingScreen` até `getUserSafe()` resolver. Só que `getSession()` **não é local** quando o access token venceu (vive 1h — ou seja, quase todo cold start): com `autoRefreshToken`, ele espera o refresh na rede, e esse fetch ainda passa pelo `fetchWithRetry` (até 4 tentativas, ~2,1 s de backoff em rede ruim).
- **O `null` da verificação inicial não desloga.** `getUserSafe()` também devolve `null` em falha de rede; aceitá-lo jogaria no login quem abriu o app sem internet — justamente o cenário do modo offline. Quem desloga é o `onAuthStateChange` (SIGNED_OUT).
- **A identidade de `user` só muda quando a pessoa muda.** Cada refresh de token entregava um objeto novo com o mesmo id, invalidando todo `useCallback` que depende de `user` — e, por tabela, os `useEffect` de carga das telas: um refresh de token disparava refetch em cascata pelo app inteiro.

---

### ~~useLayoutMode~~ (removido em 21/08/2026)

Guardava o modo de layout e a posição do FAB em localStorage
(`ritmofit-layout-mode`, `ritmofit-fab-position`). Apagado junto com o
`FloatingActionMenu` — ver a seção dele acima. Para detectar mobile, use
`use-mobile` logo abaixo.

---

### use-mobile
**Arquivo:** `client/hooks/use-mobile.tsx`

Hook simples para detectar mobile:
- Baseado em `window.innerWidth`
- Retorna `true` se largura < breakpoint

---

### route-prefetch (2026-08-11)
**Arquivo:** `client/lib/route-prefetch.ts`
**Usado por:** AppLayout (dois efeitos, montados uma vez)

Aquece o chunk de uma tela antes de ela ser necessária. Todas as páginas são `React.lazy`, então sem isto o chunk só começa a ser buscado quando a rota já mudou — é esse intervalo que dá a sensação de que o app "pensa" antes de trocar de página.

| Export | Quando dispara | O que faz |
|---|---|---|
| `prefetchRoute(path)` | `pointerdown` em qualquer `<a href="/…">` | Carrega o chunk daquela rota |
| `prefetchPrimaryRoutes()` | `requestIdleCallback` (fallback `setTimeout` 2 s) | Aquece `/`, `/metas`, `/comunidade`, `/shots`, uma de cada vez |

- **Um listener delegado no `document`**, em `capture` + `passive`, em vez de um handler por `<Link>`: pega menu, sidebar, header e links dentro das páginas de uma vez, e continua valendo para links criados depois.
- **`pointerdown`, não `click`:** entre encostar e soltar o dedo passam ~100 ms e a navegação só acontece no clique — o chunk viaja dentro dessa folga.
- **Os `import()` são duplicados de propósito** entre este arquivo e o `App.tsx`. O bundler casa chunks pelo especificador **literal**; um wrapper genérico com caminho em variável geraria outro chunk (ou nenhum). Ao adicionar uma tela nova ao menu, adicione aqui também.
- `requestIdleCallback` não existe no WKWebView do iOS — o `setTimeout` é o caminho real no device.

---

### useEdgeSwipeBack
**Arquivo:** `client/hooks/use-edge-swipe-back.ts`
**Usado por:** AppLayout (aplicado ao `<main>`)

Gesto de "voltar" estilo iOS — arrastar da borda esquerda para a direita retorna à tela anterior visitada:
- **Assinatura:** `useEdgeSwipeBack(ref, enabled)` — `ref` do elemento que desliza; `enabled` para desligar por rota
- **Lógica de voltar:** `navigate(-1)` (history back). Como toda navegação entre telas usa `<Link>` (empilha histórico), voltar uma entrada é sempre a última tela visitada
- **Só edge-swipe:** o toque precisa iniciar nos primeiros 30px da borda esquerda, evitando conflito com carrosséis horizontais internos (PostCarousel, FlowViewer, InlineCropPreview)
- **Trava de direção:** se o movimento inicial for mais vertical que horizontal, trata como scroll e cancela
- **Confirmação:** solta acima de ~32% da largura da tela (mín. 70px) **ou** flick rápido (≥ 0.5px/ms) → `hapticLight()` + `navigate(-1)`
- **Feedback visual:** desliza o `<main>` com o dedo (transform GPU, sem re-render); ao confirmar, anima a tela anterior deslizando da esquerda até 0
- **Guardas:** não dispara se `history.state.idx === 0` (sem tela anterior, evita sair do app) nem com dialog/drawer aberto (`[role="dialog"]`/`[role="alertdialog"]`/`[vaul-drawer]`)

---

## Serviços

### post.service.ts
**Arquivo:** `client/services/post.service.ts`

Funções de acesso a dados para posts:
- `getFeedPosts()` — posts do feed (seguindo)
- `getDiscoverPosts()` — posts para descoberta
- `togglePostLike(postId, type)` — toggle de incentivo
- Tipo `PostWithStats` — post com contagens de likes/comentários

---

## Bibliotecas Principais

### ritmofit-db.ts
**Arquivo:** `client/lib/ritmofit-db.ts`
**Tamanho:** ~173KB (arquivo mais grande do projeto)

Centraliza **todas** as funções de acesso ao banco de dados Supabase.
Organizado por domínio:
- Usuários (perfil, follow, stats)
- Posts (CRUD, likes, comentários)
- Shots (CRUD, incentivos, comentários)
- Stories/Flows
- Metas e rotinas
- Treinos, dietas, hábitos
- Comunidade (mensagens, duelos, ranking)
- Notificações
- Check-ins e pontuação
- Perfil comercial

---

### supabase.ts
**Arquivo:** `client/lib/supabase.ts`

Cliente Supabase configurado:
- `supabase` — instância do cliente
- `hasSupabaseConfig` — boolean se variáveis de ambiente estão presentes

---

### exercise-catalog.ts / diet-catalog.ts
**Arquivos:** `client/lib/exercise-catalog.ts`, `client/lib/diet-catalog.ts`

Catálogos locais de exercícios e refeições:
- `fetchExerciseCatalog()` — retorna lista de exercícios com imagem, nome e grupo muscular
- `fetchMealCatalog()` — retorna lista de refeições com imagem, nome e calorias

---

### admin.ts / clipboard.ts (2026-08-17)
**Arquivos:** `client/lib/admin.ts`, `client/lib/clipboard.ts`

- `admin.ts` — `ADMIN_USER_IDS`, `isAdminUser(userId)`, `useIsAdmin(userId)` e `anatomySqlSnippet(...)`. `useIsAdmin` define admin como a lista **ou** o selo oficial e devolve `null` enquanto lê o perfil; carrega o `ritmofit-db` por import dinâmico, porque o arquivo entra no chunk de entrada. **Guarda de UI, não autorização**: quem autoriza escrita é `is_app_admin()` no servidor (`docs/18-admin.md`). Consumido pelo `RequireAdmin` e pelo aviso de anatomia faltante em `ExerciseAnatomy`.
- `clipboard.ts` — `copyToClipboard(text)` com fallback `<textarea>` + `execCommand` para o WKWebView (onde `navigator.clipboard` falha sem gesto/contexto seguro). Estava duplicado dentro de `Store.tsx`; agora é fonte única.

---

### password-rules.ts (regra de senha forte — 2026-09-14)
**Arquivo:** `client/lib/password-rules.ts`

Fonte única da regra de senha: **8 caracteres, 1 maiúscula, 1 caractere especial**. Vale no cadastro (`Login.tsx`), no "salvar nova senha" da recuperação por código e na troca de senha das Configurações — esta última exigia só 6 caracteres, ou seja, dava para criar a conta com senha forte e rebaixá-la pelo drawer de settings.

- `passwordRules(pwd)` → `{ key, ok }[]` com as chaves de i18n na ordem de exibição (`pwd_rule_min`, `pwd_rule_upper`, `pwd_rule_special`), para as duas telas renderizarem o mesmo checklist ao vivo
- `isStrongPassword(pwd)` é **derivada** de `passwordRules` — o checklist que o usuário vê e a trava que libera o botão não têm como discordar
- `PASSWORD_MIN_LENGTH` exportada para quem precisar do número

---

### physical-data.ts (faixas de idade/altura/peso — 2026-09-14)
**Arquivo:** `client/lib/physical-data.ts`

Fonte única das faixas aceitas para os dados físicos do perfil e dos helpers de digitação correspondentes. Nasceu porque os mesmos três campos são editados em **quatro** lugares — cadastro (`Login.tsx`, Step 2.8), Configurações → Meu Perfil → Pessoal, quiz de rotina sugerida (`create-wizard-drawer.tsx`) e histórico de peso (`weight-history-drawer.tsx`) — e cada um carregava a sua cópia da faixa. Elas divergiram: as Configurações aceitavam 30–300 kg e 10–120 anos, o cadastro barrava fora de 20–200 kg e 1–100 anos, e o histórico de peso aceitava qualquer coisa abaixo de 1000 kg (saindo em silêncio quando não aceitava).

- `PHYSICAL_LIMITS` — idade 1–100, altura 100–300 cm, peso 20–200 kg. Limites de **sanidade, não clínicos**
- `isAgeOutOfRange` / `isHeightOutOfRange` / `isWeightOutOfRange` — `true` só quando o campo está **preenchido** e fora da faixa (os três dados são opcionais em todas as telas, então vazio nunca é erro)
- `sanitizeIntInput` — só dígitos (idade e altura)
- `sanitizeDecimalInput` — vírgula→ponto, um separador só, preservando o texto cru enquanto digita (peso). Ver a memória `decimal-number-inputs-ios`: input controlado por número descarta o "." no iOS
- Mensagens: `physical_age_range` / `physical_height_range` / `physical_weight_range` (prefixo neutro justamente por não pertencerem a uma tela só)

---

### network-status.ts
**Arquivo:** `client/lib/network-status.ts`

Monitora conectividade:
- `getNetworkStatus()` — estado atual (`isOnline`, `isSupabaseReachable`)
- `addNetworkStatusListener(callback)` — escuta mudanças
- `checkSupabaseReachability()` — teste de conexão com Supabase

---

### monitoring.ts (captura de erros — 2026-08-05)
**Arquivos:** `client/lib/monitoring.ts`, `client/App.tsx` (ErrorBoundary + `MonitoringBridge`), `client/components/shared/report-problem-drawer.tsx`

**Por que existe:** o app roda dentro de um WKWebView. Um erro de JavaScript **não é um crash do processo iOS** — o relatório automático da Apple (Xcode Organizer / App Store Connect) nunca enxerga esses erros, que são a esmagadora maioria dos bugs reais do app. Sem esta camada, um erro em produção só chegava até nós como review na loja.

**SDK:** `@sentry/capacitor` (nativo + JS) no device, `@sentry/react` no navegador. Configurado por `VITE_SENTRY_DSN`; **sem a variável o módulo inteiro vira no-op** e o Vite tree-shaka o SDK do bundle (custo zero quando não configurado; ~36 kB gzip quando ativo).

| Função | Uso |
|---|---|
| `initMonitoring()` | Chamada no topo de `App.tsx`, **antes de qualquer render** — erro no primeiro frame também precisa chegar |
| `setMonitoringUser(id)` | Só o `id`, nunca e-mail/nome/IP (ver privacidade abaixo) |
| `setMonitoringScreen(path)` | Tag `screen` + breadcrumb de navegação |
| `reportHandledError(err, where)` | Erro que o app **já tratou** (`catch` que só mostra toast). Sem isto, "deu erro" para o usuário = "nunca aconteceu" para nós |
| `reportFatalError(err, stack)` | Usada pelo ErrorBoundary; devolve o `eventId` exibido na tela |
| `sendProblemReport({...})` | Relato manual do usuário, tag `report_source: in_app`, fingerprint único por relato |
| `flushMonitoring()` | Garante que o evento saiu antes de fechar a tela |

**Filtro de ruído (`ignoreErrors` + `beforeSend`):** rede indisponível (`Failed to fetch`, `Load failed`, …) **não é bug** — o app tem modo offline e já trata isso com a fila `lk:outbox`. Também são descartados aborts intencionais, `ResizeObserver loop`, `play() request was interrupted` (Shots/flows) e erros de sessão expirada que o app já resolve redirecionando ao login. Sem esse filtro a cota gratuita do Sentry queima em dias.

**Eventos automáticos de `pnpm dev` são descartados (2026-08-14):** a primeira coisa que o `beforeSend` faz é devolver `null` quando `import.meta.env.DEV` é true, **exceto** para o relato manual (tag `report_source: in_app`, que continua saindo para dar como testar o drawer sem buildar). Motivo: o hot reload executa estados **intermediários de edição** — declaração já cortada, referência ainda no JSX — e o painel enchia de `ReferenceError` que parece bug de produção. Os sete primeiros issues não resolvidos do projeto eram exatamente isso. Ao triar um issue antigo, o critério manual continua valendo: **nome de variável legível na mensagem = ruído de dev**, porque o build de produção é minificado (`ReferenceError: Ce is not defined`).

**Exceção ao critério acima — `Can't find variable: EmptyRanges` (2026-09-14):** nome legível **e** produção, porque o script nem é nosso. É bug do próprio WebKit: os getters `buffered`/`played`/`seekable` de `MediaController.NullMedia` (`modern-media-controls`) leem um `EmptyRanges` solto, que só existe como estático da classe. Dispara quando o `<video>` já foi coletado e o controle nativo ainda consulta os ranges — ou seja, ao **desmontar tela com vídeo** (Shots, viewer de flows, carrossel de post). Assinatura: `mechanism: onerror`, **sem stack**, `filename: undefined`, sempre `undefined:1705:541` (é builtin do WebKit, o mesmo `1705:541` aparece em apps de terceiros sem relação nenhuma com o nosso código). Corrigido em [bugs.webkit.org/318284](https://bugs.webkit.org/show_bug.cgi?id=318284) (`316507@main`, 04/07/2026), mas o **iOS 26.6 ainda embarca a versão com o bug** e não há nada a fazer do lado do app — entrou em `IGNORED_ERRORS`.

**Privacidade (relevante para a nutrition label da App Store):** nenhum evento automático carrega e-mail, nome ou IP — `beforeSend` apaga esses campos e `sendDefaultPii: false`. O e-mail só sai do app quando a própria pessoa o digita no `ReportProblemDrawer`, que exibe a lista do que será enviado junto antes do envio.

**Source maps:** `vite.config.ts` só ativa o `@sentry/vite-plugin` quando `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` + `SENTRY_PROJECT` estão no ambiente (lugar delas: env vars do Appflow). Nesse modo os `.map` são gerados, enviados e **apagados do `dist`** — sem isso viajariam dentro do binário e entregariam o código-fonte. Sem as variáveis o build é idêntico ao de antes, só com stack trace minificado. Falha de upload nunca reprova o build.

**Versão:** `import.meta.env.VITE_APP_VERSION` é lida do `MARKETING_VERSION` do `project.pbxproj` em tempo de build — não existe um segundo lugar a manter em sincronia.

---

### ErrorBoundary raiz (`client/App.tsx`)

Última linha de defesa: um erro de render derrubaria a árvore inteira e deixaria tela branca. Mostra uma tela explicável com **"Tentar novamente"** (reseta o state) e **"Reiniciar o app"** (`location.reload()`), respeita safe area, e reporta via `reportFatalError` exibindo os 8 primeiros caracteres do `eventId` — é o código que o usuário cita no suporte e que nos leva direto ao evento.

O **stack trace só é renderizado em `import.meta.env.DEV`**. Em produção seria um paredão de código para o usuário — e um risco de rejeição na review da Apple. Como o boundary vive **fora** do `LanguageProvider`, o idioma é lido direto de `localStorage["ritmofit-language"]` e traduzido com a função `t(lang, key)` standalone do `i18n.ts`.

**`MonitoringBridge`** (dentro do `BrowserRouter` e do `AuthProvider`) sincroniza usuário e rota atual para o Sentry. **`unhandledrejection`** mantém a supressão de `Failed to fetch` do Supabase e reporta todo o resto — antes só fazia `console.error`, que no device não existe para ninguém.

---

### ReportProblemDrawer
**Arquivo:** `client/components/shared/report-problem-drawer.tsx`

Relato manual de bug. **Por que existe além da captura automática:** o SDK só pega erro que *estoura*. Boa parte dos bugs não estoura — o treino não salvou, a foto subiu girada, o contador veio errado. Para o usuário "está bugado"; para o SDK, nunca aconteceu nada.

| Campo | Regra |
|---|---|
| O que aconteceu? | Textarea, mín. 10 caracteres, máx. 1000 |
| E-mail para contato | Opcional, pré-preenchido com o e-mail da conta |
| Contexto técnico | Anexado sozinho e **exibido antes do envio**: versão + build (`CapApp.getInfo()`), tela (`location.pathname`), plataforma, idioma, online, user agent, viewport |

Bloqueia o envio quando `!navigator.onLine` (senão o relato se perderia em silêncio e o usuário acharia que enviou) e aguarda `flushMonitoring()` antes de fechar. Padrão visual e de teclado idêntico aos demais drawers (glass, `useKeyboardAwareHeight`, `paddingBottom` com `--keyboard-height`).

---

### ReportDrawer (denúncia de conteúdo)
**Arquivo:** `client/components/shared/report-drawer.tsx`
**Usado em:** Feed, Shots e os **dois viewers de flow** (`FlowViewer.tsx` e `flow-viewer-modal.tsx`, ver `docs/01-feed.md`)

Drawer único de denúncia. Seletor de motivo (radio) + botões Cancelar / Enviar denúncia.

| Prop | Descrição |
|---|---|
| `type` | `"user"` \| `"post"` \| `"shot"` \| `"flow"` — define título, subtítulo e a tabela de destino |
| `target` | `{ id, userId, userName, description? }` — `id` é o post/shot/flow denunciado, `userId` é o autor |

| `type` | Título | Função DB | Tabela |
|---|---|---|---|
| `user` | Denunciar usuário | `reportUserDb(userId, reason)` | `user_complaint` |
| `post` | Denunciar post | `reportPostDb(postId, reason)` | `post_complaint` |
| `shot` | Denunciar shots | `reportShotDb(shotId, reason)` | `shots_complaint` |
| `flow` | Denunciar flow (2026-08-17) | `reportFlowDb(flowId, reason)` | `flow_complaint` |

- Motivos: Conteúdo inadequado, Spam, Assédio ou bullying, Violação de direitos autorais, Outro
- **Rótulos traduzidos (PT/EN), valor gravado sempre em PT** — a fila de moderação do Admin (`admin_complaints_view`) precisa de `reason` comparável entre usuários de idiomas diferentes
- Todas as strings do drawer passaram a usar `t()` em 2026-08-06 (antes eram hardcoded em PT)

---

### i18n.ts / language-context.tsx
**Arquivos:** `client/lib/i18n.ts`, `client/lib/language-context.tsx`

Sistema de internacionalização (PT e EN):
- Hook `useLanguage()` → `{ language, setLanguage, t }`; `t(key)` traduz
- As chaves ficam em `translations.pt` e `translations.en` — **sempre nas duas**
- A escolha do usuário persiste em `localStorage["ritmofit-language"]` e é feita
  em **Perfil → Configurações** (portanto só existe depois do login)

**Idioma da primeira abertura (21/08/2026):** sem valor salvo, `detectDeviceLanguage()`
lê `navigator.languages`/`navigator.language` — variantes de português ficam em `pt`,
o resto cai em `en`. Antes o padrão era `"pt"` fixo, o que tornava a tradução do
Login e do cadastro **inalcançável**: são as telas anteriores ao login, e o seletor
de idioma mora atrás dele. O valor salvo é checado primeiro, então a escolha manual
sempre vence.

---

### DrawerContent (comportamento com teclado iOS)
**Arquivos:** `client/components/ui/drawer.tsx`, `client/lib/keyboard.ts`, `client/hooks/use-keyboard-aware-height.ts`, `client/global.css`

Todos os drawers (bottom sheets) do app são renderizados por `DrawerContent`. Desde **2026-07-06**, o teclado do iOS é tratado com **`resize: 'none'` + ergonomia via CSS var** (substituiu o `resize: 'native'` de 2026-07-03, que causava delay de ~1s + piscada — o resize do frame do WKWebView acontecia *depois* da animação do teclado e forçava relayout/repaint da página inteira):

- **`capacitor.config.ts` → `Keyboard: { resize: 'none' }`**: o frame do WKWebView **nunca** muda quando o teclado abre — o teclado apenas sobrepõe o webview. Zero reflow global, zero piscada. `window.innerHeight` e unidades `dvh` ficam constantes.
- **`client/lib/keyboard.ts` (tracker global, singleton iniciado em `App.tsx`)**: escuta os eventos nativos `keyboardWillShow`/`keyboardWillHide` (disparam no **início** da animação do teclado, já com `keyboardHeight`) e publica:
  - CSS var **`--keyboard-height`** no `<html>` (px; `0px` fechado);
  - classe **`kb-open`** no `<html>` enquanto o teclado está visível;
  - subscribers JS (usados por `useKeyboardAwareHeight`);
  - *scroll assist*: para inputs no fluxo normal da página (fora de drawers/dialogs — ex.: Login, NewPost, Search), rola a janela o suficiente para o campo ficar acima do teclado.
- **Lift wrapper em `drawer.tsx`**: o sheet do vaul é envolvido por um `div fixed inset-0 pointer-events-none` com `transform: translateY(calc(-1 * var(--keyboard-height)))` + `transition` (curva do teclado iOS, 0.28s). Como um ancestral com transform vira o *containing block* de descendentes `fixed`, o sheet inteiro sobe em sincronia com o teclado, via GPU. **Nunca aplicar transform/transition no elemento do próprio vaul** — o vaul muta `transform`/`transition` inline para abrir/fechar/arrastar e qualquer estilo nosso ali briga com ele.
- **Clamp em `global.css`**: `html.kb-open [data-vaul-drawer][data-vaul-drawer-direction="bottom"] { max-height: calc(100dvh - var(--keyboard-height) - 12px) !important }` — garante que nenhum sheet erguido estoure o topo da tela, mesmo drawers com `maxHeight: 90dvh` estático.
- **Dialogs centrados (`dialog.tsx`)**: o wrapper de centralização soma `var(--keyboard-height)` ao padding inferior (com transition), recentralizando o dialog na área visível acima do teclado.
- **`useKeyboardAwareHeight`** agora retorna `window.innerHeight - getKeyboardHeight()` (do tracker) — continua sendo "a área visível acima do teclado", atualizada em sincronia com a animação. Consumidores não mudam: `maxHeight: min(XXdvh, ${viewportHeight - 8}px)` + `flex-1 min-h-0` na área scrollável.
- O `repositionInputs` do vaul continua **explicitamente desligado** (`repositionInputs={false}`) — depende de eventos de `visualViewport` instáveis no WKWebView. **Não reativar.** Também continua valendo: nenhum componente deve rodar handler próprio de `visualViewport` para mover drawers.

#### `useKeyboardInputScroll` — revelar input no meio de um scroll (2026-07-20)

**Arquivo:** `client/hooks/use-keyboard-input-scroll.ts`

O lift wrapper ergue o **sheet inteiro** acima do teclado, mas não rola o **conteúdo interno** até o campo em foco. Quando um input (ou textarea) fica **no meio de uma área `overflow-y-auto` própria** — formulário rolável de drawer, overlay `position:fixed` de tela cheia, ou corpo rolável de página — o iOS deixava o campo atrás do teclado ("o teclado sobe mas eu não vejo o que digito"). O scroll-assist global de `keyboard.ts` (`scrollPageInputIntoView`) não cobre esses casos: usa `window.scrollBy` (no-op num container com scroll próprio) e ainda pula qualquer `[role="dialog"]`.

Este hook é a peça que faltava. Ao focar um campo / abrir o teclado, ele rola o **container interno** até o campo ficar acima do teclado:

- **API:** `useKeyboardInputScroll(scrollRef?, enabled = true)`.
  - Com `scrollRef`: rola aquele container (passe `enabled` = estado `open` do drawer para só escutar quando aberto).
  - **Sem ref** (ref-less): sobe do campo em foco até o ancestral rolável mais próximo. Ideal para telas com **vários** containers roláveis independentes (ex.: `settings-drawer`, um sub-drawer por seção; `Community`, dezenas de drawers de formulário) — uma única chamada cobre todos.
- **Sempre combine com** `paddingBottom: "calc(<folga> + var(--keyboard-height, 0px))"` no MESMO container rolável — sem esse espaço extra não há para onde rolar o último campo.
- **Imune ao lift do drawer:** a referência de "área visível" é `min(fundo do container, linha do teclado)`. Como container e input são medidos no mesmo instante, a conta é invariante ao `transform` do lift — não há dupla contagem mesmo medindo no meio da animação. A mesma fórmula serve para overlay fixo que não sobe (a linha do teclado vence).
- **Não briga com campos já tratados:** um input que **não** está dentro de um `overflow-y-auto` (rodapé fixo `shrink-0`, campo centralizado, barra com `translateY(--keyboard-height)` própria) faz o hook não encontrar container rolável → no-op. Por isso é seguro chamar o ref-less numa tela que já trata o campo principal de outro jeito (ex.: `Community` trata o chat encolhendo o container; `flow-viewer` ergue a barra de resposta).

**Quando NÃO precisa do hook:** (1) input é **rodapé fixo** do drawer (`shrink-0` fora do scroll) — o lift já o mantém acima do teclado (ex.: `post-comments-dialog`, `promotion-comments-drawer`, `send-to-friend-drawer`); (2) input fica **no topo** fixo (busca em `new-conversation`, `tag-people`, `add-members`); (3) `<input type="time"/date>` — abre o **picker de roda** do iOS, não teclado; (4) página que rola com **`window`** (o `scrollPageInputIntoView` global já cobre — ex.: `Admin`).

**Campos centrados / barras próprias** (não-scroll) têm solução própria, não o hook: somar `var(--keyboard-height)` ao `padding-bottom` do wrapper de centralização (`ResetPassword`, `dialog.tsx`, `alert-dialog.tsx`) ou aplicar `transform: translateY(calc(-1 * var(--keyboard-height)))` na barra (`flow-creation-dialog`, `flow-viewer`).

> **Referências pré-existentes** com a mesma lógica inline (não migradas, funcionam): `workout-session-dialog.tsx` (overlay de registrar treino) e `Login.tsx` (form de cadastro rolável). Código novo deve usar o hook.

#### Swipe para fechar — vale no sheet inteiro (2026-08-06)

**Regra:** arrastar para baixo a partir de **qualquer ponto do corpo** do drawer fecha o drawer. Não existe "zona de fechar" no topo — o gesto é o mesmo que o iOS ensina em qualquer sheet, independente de onde o dedo está. Duas coisas quebravam isso e foram removidas:

| Causa | Onde estava | Correção |
|---|---|---|
| `handleOnly` no `<Drawer>` + `<DrawerContent>` | `create-wizard-drawer`, `food-diary-card`, `goal-detail-drawer`, `routine-detail-drawer`, `goal-share-drawer` | prop removida — só a pílula (~38px) arrastava |
| `onPointerDown={(e) => e.stopPropagation()}` no container rolável do corpo | `Store` (3 drawers de promoção), `Shots` (comentários), `promotion-comments-drawer`, `post-comments-dialog`, `item-detail-drawer`, `routine-list-drawer` | handler removido — o `pointerdown` nunca chegava ao `DrawerContent`, então o vaul não iniciava arraste |

- **O vaul já protege o scroll sozinho** — não é preciso ajudá-lo. O `shouldDrag` cancela o dismiss quando o container rolável **não está no topo** (`scrollTop !== 0`) e quando o arraste é para **cima**. Por isso remover o `stopPropagation` não quebra rolagem: o gesto de rolar continua rolando, e só o "puxar para baixo já no topo" fecha.
- **Exceção 1 — campos de formulário (automática):** o `DrawerContent` marca `input`/`textarea`/`[contenteditable]` com **`data-vaul-no-drag`** no *capture* do `pointerdown` (roda antes do handler do próprio vaul). Puxar para baixo a partir de um campo — tipicamente com o teclado aberto — não fecha o drawer nem joga fora o que estava sendo digitado. Vale para **todos** os drawers e para campos renderizados dinamicamente; não é preciso anotar campo por campo.
- **Exceção 2 — widgets com arraste próprio (manual):** quem tem gesto próprio leva `data-vaul-no-drag` no elemento: `inline-crop-preview`, o frame do `image-cropper-drawer` e o `Slider` (`ui/slider.tsx`). Sem isso, arrastar a foto arrastaria o sheet junto. **Ao criar qualquer área com arraste próprio dentro de um drawer, adicione o atributo.**
- **`handleOnly` continua existindo** como escape hatch no `<Drawer>` + `<DrawerContent>` (default `false`, **desligado em todo o app**). Nesse modo o `onPointerDown`/`onPointerMove` do corpo retorna cedo e só o `<DrawerPrimitive.Handle>` arrasta — por isso o `DrawerContent`, com `handleOnly`, renderiza a alça como `Drawer.Handle` (a única que o vaul reconhece) em vez do `<div>` decorativo, com a pílula forçada por `!` (o vaul injeta estilos default de `[data-vaul-handle]` em runtime). Preferir sempre `data-vaul-no-drag` cirúrgico a ligar `handleOnly`.
- As outras formas de fechar seguem inalteradas: **tocar no overlay**, botões **Cancelar/fechar** e o **voltar** do sistema.

#### Empilhamento (z-index) — regra do overlay dentro do lift wrapper (2026-07-13)

O lift wrapper tem `transform`, e todo elemento com `transform` cria um **stacking context**. Por isso o `z-index` que um sheet declara (`className="z-[500]"`, `z-[330]`, …) só vale **dentro** do wrapper — para o resto da página o sheet continua valendo `z-[310]` (o z do wrapper). Enquanto o overlay ficou **fora** do wrapper, qualquer overlay com z > 310 (ex.: `!z-[490]` do `ImageCropperDrawer`, `z-[320]` dos drawers empilhados de Comunidade) era pintado **por cima do próprio sheet** — tela escura/fosca e nenhum toque funcionando.

- **O `DrawerOverlay` é renderizado dentro do lift wrapper**, junto com o sheet. Overlay e sheet compartilham o mesmo stacking context, então `overlay z-490` + `content z-500` volta a significar o que o autor escreveu.
- O overlay leva `pointer-events-auto` (o wrapper é `pointer-events-none`) e `bottom: calc(-1 * var(--keyboard-height))`, para continuar cobrindo a tela inteira quando o wrapper sobe com o teclado.
- **Empilhar drawers** (um drawer aberto por cima de outro): não é preciso mexer em z-index — todos os wrappers são `z-[310]` e o portal aberto por último entra depois no DOM, logo pinta por cima. Só use z-index custom para ordenar overlay × conteúdo **do mesmo drawer**.

> **Regra prática (2026-07-16): não declare z-index no `DrawerContent`.** O padrão (content `z-[310]` > overlay `z-[300]`) já está certo, e o `cn()` usa `twMerge` — então um `className="z-[100]"` **substitui** o `z-[310]` da base e enterra o conteúdo sob o próprio overlay.
>
> Foi exatamente o que aconteceu: os drawers nasceram com `z-[100]` para empatar com o overlay da época (`z-[100]`/content `z-[110]`), vencendo por ordem no DOM. O commit `3cb0b34` (2026-05-15) subiu a base para `z-[300]`/`z-[310]` e não atualizou quem fixava o valor na mão — desde então `AddMembers`, `NewConversation`, `EditCheckIn`, `SendToFriend` e `TagPeople` abriam **escurecidos e sem aceitar toque** (overlay `bg-black/80` por cima), e o `ClassificationsDrawer` abria visível mas **engolia os toques** (overlay `bg-transparent`). Corrigido em 2026-07-16 removendo o override dos seis.
>
> Sintoma típico: drawer abre fosco/escuro, ou visível mas todo toque fecha em vez de acionar. Primeiro lugar a olhar: z-index no `DrawerContent`.

---

## Estilos de Drawer Glass (`client/lib/glass-styles.ts`)

Fonte única de verdade para o **padrão glass escuro** dos drawers (promoções, duelos, comentários). Em vez de repetir estilos inline, importe os tokens:

| Export | Tipo | Uso |
|---|---|---|
| `GLASS_SHEET_PROPS` | props | Spread no `DrawerContent` — handle branco + `!rounded-t-[32px] !border-0` |
| `GLASS_SHEET_STYLE` | `CSSProperties` | `style` do `DrawerContent` — gradiente escuro + blur + `maxHeight: 90dvh` |
| `GLASS_FIELD_STYLE` / `GLASS_FIELD_CLASS` | style/classe | Inputs, Textareas e SelectTrigger |
| `GLASS_PRIMARY_BTN_STYLE` | `CSSProperties` | Botão principal (gradiente azul → roxo) |
| `GLASS_PANEL_STYLE` | `CSSProperties` | Cards / containers translúcidos **dentro** de um sheet |
| `GLASS_CARD_STYLE` | `CSSProperties` | Card / superfície de vidro **sobre a página** (fora de sheets) — tem `backdrop-filter` próprio |
| `GLASS_LABEL_CLASS` | classe | Labels de formulário |

Detalhes e exemplo completo: `docs/15-design-system.md` §9.4. Consumidores atuais: `Store.tsx` (drawers de promoção), `Community.tsx` (drawers de duelos + toda a tela do grupo/histórico de check-ins, via `GLASS_CARD_STYLE`) e os componentes `ClassificationsDrawer` / `AddMembersDrawer` / `EditCheckInDrawer`.
