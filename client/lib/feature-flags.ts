/**
 * Flags de lançamento — o que entra no v1.0 da App Store.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE ISTO EXISTE
 * ─────────────────────────────────────────────────────────────────────────────
 * O app acumulou features prontas e não validadas em device mais rápido do que
 * conseguimos submetê-las. Nenhuma delas é ruim; várias são ótimas. Mas cada
 * uma que entra no primeiro build soma três custos ao mesmo tempo:
 *
 *   1. Superfície de review — mais caminhos para a Apple achar um bug (foi
 *      exatamente o que aconteceu na submissão 1.2 (56): Guideline 2.1(b),
 *      "unable to load the plans after creating a new account").
 *   2. Superfície de bug em produção — código que nunca rodou em iPhone real.
 *   3. Vazio social — duelo, ranking, shots e vitrine PRECISAM de base de
 *      usuários. No dia 1 aparecem vazios e o app parece abandonado.
 *
 * A regra: nada é apagado. Tudo continua no repositório, compilando, pronto.
 * Uma flag esconde a porta de entrada. Cada release seguinte é uma flag virando
 * `true` — não uma branch de 5 mil linhas voltando para o main.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * COMO USAR
 * ─────────────────────────────────────────────────────────────────────────────
 * Esconda a ENTRADA (rota, item de nav, aba, botão), não o componente inteiro.
 * O código de dentro fica intocado — é isso que torna o retorno barato.
 *
 *     import { FEATURES } from "@/lib/feature-flags";
 *     {FEATURES.shots && <Route path="/shots" ... />}
 *
 * Ao religar uma flag, procure por ela no projeto: cada ponto de uso é um item
 * do checklist de teste daquele release.
 */
export const FEATURES = {
  // ───────────────────────────────────────────────────────────────────────────
  // Monetização
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Compras no app (RevenueCat + StoreKit).
   *
   * DESLIGADO NO V1 — causa direta da rejeição 2.1(b) de 26/08/2026.
   *
   * Com `false`, `PremiumProvider` devolve `isPremium: true` para todo mundo e
   * nunca toca no SDK da loja. Todos os gates abrem sozinhos, porque no app
   * inteiro eles são escritos como `!isPremium && <bloqueio>`. Não existe
   * paywall, produto, nem restauração de compra no binário — a categoria
   * inteira de rejeição por IAP deixa de ser alcançável.
   *
   * IMPORTANTE: religar exige, ANTES da submissão — Paid Apps Agreement aceito
   * em App Store Connect, produtos aprovados, EULA e política de privacidade
   * linkados no paywall (Guideline 3.1.2) e teste real em sandbox.
   */
  iap: false,

  // ───────────────────────────────────────────────────────────────────────────
  // Telas inteiras
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Shots — feed vertical de vídeo curto.
   *
   * Adiado: é a tela que mais depende de volume de conteúdo. Com ~15 vídeos o
   * usuário chega ao fim em 40 segundos. Some o teto de players de vídeo do
   * iOS (já corrigido uma vez) e o custo de banda. Volta quando houver gente
   * postando. Com `false` o bottom nav fica com 4 itens.
   */
  shots: false,

  /**
   * Vitrine — promoções e diretório de profissionais.
   *
   * Adiado: é um segundo produto dentro do app. Não participa do loop de
   * motivar treino, nasce vazia, e adiciona superfície de review (UGC
   * comercial, preços, links externos).
   */
  store: false,

  // ───────────────────────────────────────────────────────────────────────────
  // Comunidade
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Duelos — grupos, check-in, avaliação, classificação.
   *
   * Adiado: exige 4+ amigos ativos para não ser constrangedor, e é código de
   * 21/08 ainda não validado em device. A aba Mensagens sozinha já justifica
   * o item Comunidade no nav.
   */
  duels: false,

  /**
   * Ranking global.
   *
   * Adiado: com base pequena, mostra ao usuário exatamente quão pequeno o app
   * é. É a feature que mais se beneficia de esperar.
   */
  ranking: false,

  // ───────────────────────────────────────────────────────────────────────────
  // Metas / treino
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Treinar junto — sessão de treino compartilhada com amigos.
   *
   * Adiado: de 26/08, realtime, e exige um amigo treinando no mesmo horário.
   */
  workoutParty: false,

  /**
   * Modo Expert — técnicas (bi-set, drop-set, rest-pause), três tipos de
   * recorde, aquecimento por rampa, variações de exercício.
   *
   * Adiado: profundidade de power user. O modo Simplificado entrega o loop
   * inteiro. Desligar remove metade da superfície de bug da tela mais complexa
   * do app sem tirar nada de essencial.
   */
  expertMode: false,

  /**
   * Anatomia muscular e cobertura semanal (séries efetivas, mapa corporal).
   *
   * Adiado: valor real no mês 3, ruído no dia 1.
   */
  muscleAnatomy: false,

  /**
   * Rotinas de **dieta** e de **hábito** (tipos 2 e 3 em `routines`).
   *
   * O v1 fica só com rotina de exercício. Cada tipo extra multiplica a
   * superfície da tela mais complexa do app — catálogo próprio, progresso
   * próprio, check-in próprio — para um usuário que ainda nem completou a
   * primeira semana de treino.
   *
   * Com a flag desligada, "Suas rotinas" mostra um card só (Exercícios). O
   * wizard já criava apenas rotina de treino pelo passo "o quê"; dieta e
   * hábito só nasciam pelos cards de tipo, que agora não existem.
   */
  dietAndHabitRoutines: false,

  /**
   * Diário Alimentar — registro do que comeu, kcal/macros e o catálogo TACO
   * (597 alimentos brasileiros com macro oficial).
   *
   * Adiado junto com as rotinas de dieta, por decisão de escopo: era acessível
   * SÓ pelo card "Dietas", então os dois caem juntos por construção.
   *
   * ⚠️ Ao religar, lembre que o card "Dietas" (`FEATURES.dietAndHabitRoutines`)
   * é a única porta do diário — ligar `foodDiary` sozinho não o torna
   * alcançável. O catálogo TACO no banco não é afetado pela flag.
   */
  foodDiary: false,

  /**
   * Insígnias / conquistas — acervo, seleção da exibida no perfil e o diálogo
   * de desbloqueio.
   *
   * Adiado porque o sistema está amarrado às duas coisas que também saíram do
   * v1: as condições de desbloqueio dependem de rotinas de dieta e hábito, e
   * parte do catálogo é premium (selo 👑). Com o IAP desligado, as insígnias
   * premium ficariam livres para todos — e voltariam a trancar quando o
   * paywall subisse, o que é pior do que nunca as ter mostrado.
   *
   * O acervo (`user_badges`) NÃO é apagado — a flag esconde a UI. Ver
   * `docs/14-database-schema.md` e a nota de que user_badges nunca se limpa.
   */
  badges: false,

  /**
   * Registro e histórico de peso corporal.
   *
   * Adiado a pedido: o monitoramento de peso vem num momento próprio, com mais
   * do que um número e um gráfico. Sai o card na tela de Metas, o ícone ⚖️ no
   * card de streak e o histórico dentro de Configurações → Dados pessoais.
   * O CAMPO de peso no cadastro e em Dados pessoais continua — ele alimenta a
   * prescrição individual da rotina sugerida, que não tem a ver com
   * acompanhar evolução.
   */
  weightTracking: false,

  /**
   * Mini frame de treino no flow — o sticker com o resumo da última execução
   * de uma rotina, colado sobre a foto/vídeo.
   *
   * Adiado junto com o resto do aprofundamento de treino no social: os dados
   * vêm de `routines.last_summary`, então quem ainda não treinou pelo app abre
   * um seletor vazio. E, como o sticker é gravado em `flow.text_elements`, um
   * flow criado com ele hoje continua renderizando depois — mais um motivo
   * para não deixar criar antes da hora.
   */
  workoutStickerOnFlow: false,

  /**
   * Botão "Ver treino" nos posts — abre o detalhe da sessão que gerou o post,
   * com o "Comparar" dentro do drawer.
   *
   * Adiado: o comparador é de 26/08 e não foi validado em device, e o detalhe
   * expõe série a série de um treino de outra pessoa — leitura densa demais
   * para quem acabou de instalar o app. O post continua mostrando o card de
   * resumo do treino normalmente; o que sai é o aprofundamento.
   */
  workoutDetailOnPost: false,

  /**
   * Corrida ao ar livre com GPS em background.
   *
   * Adiado, e essa é a flag de maior retorno em risco: ela é a única razão
   * de EXERCER a permissão `NSLocationAlwaysAndWhenInUseUsageDescription`, a
   * mais escrutinada da App Store. Com `false`, a API nunca é chamada e o
   * usuário nunca vê o alerta.
   *
   * ⚠️ A chave **continua** no `Info.plist` e deve continuar: o TestFlight
   * devolveu **ITMS-90683** quando ela foi removida. Quem exige a string é o
   * *link* do `CapgoBackgroundGeolocation` no binário, não a chamada.
   * Purpose string é permissão; ficha de privacidade é coleta — e o app não
   * coleta localização, então a ficha segue sem ela.
   *
   * ⚠️ **Ao religar, `UIBackgroundModes = ["location"]` é obrigatório no
   * Info.plist.** Hoje ele não está lá, de propósito (Guideline 2.5.4: modo
   * declarado precisa ser usado). Sem ele, `allowsBackgroundLocationUpdates =
   * true` **lança exceção e crasha o app** — não é aviso, é crash.
   */
  gpsRun: false,

  // ───────────────────────────────────────────────────────────────────────────
  // Social / descoberta (dependem de densidade de base)
  // ───────────────────────────────────────────────────────────────────────────

  /** Hashtags: aba em Buscar, rota /tag/:tag e o botão # na legenda. */
  hashtags: false,

  /** Marcar pessoas em posts e flows. */
  postTags: false,

  /**
   * Marcar a localização numa publicação (o alfinete na barra da legenda).
   *
   * Adiado: publicar onde você está é dado sensível, e o retorno no v1 é nulo —
   * sem hashtags nem busca por lugar, a localização vira só um texto na
   * legenda. Não vale pedir uma permissão de sistema por isso.
   *
   * ⚠️ `NSLocationWhenInUseUsageDescription` **continua** no `Info.plist` e
   * deve continuar: o `@capacitor/geolocation` está linkado no binário, e é o
   * link que dispara a verificação estática (ITMS-90683). Com a flag desligada
   * a API nunca é chamada, então o usuário nunca vê o alerta.
   */
  postLocation: false,

  /** Aba "Rotinas" em Buscar — precisa de rotinas públicas suficientes. */
  routineSearch: false,

  // A aba inicial do feed NÃO é uma flag: é decidida por usuário, a cada
  // abertura, em Index.tsx (`loadFeed`). Quem já segue alguém abre em
  // "Seguindo"; só quem ainda não segue ninguém cai em "Descobrir". Uma flag
  // global erraria com metade da base — ver docs/01-feed.md.

  /** Abas Treinos, Vitrine, Shots e Marcações no perfil. Fica só Posts. */
  profileExtraTabs: false,

  /**
   * Step "Seguir pessoas" no fim do cadastro.
   *
   * Já estava fora do fluxo antes desta faxina — `handleSignupStep3` conclui o
   * cadastro direto. A flag existe para registrar a decisão (com base pequena
   * o passo sugere ninguém) e para dar um lugar de onde religá-lo.
   */
  signupSuggestions: false,

  // ───────────────────────────────────────────────────────────────────────────
  // Outros
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Login por Face ID / Touch ID.
   *
   * Adiado: superfície nativa a mais, com valor perto de zero no dia 1 — o
   * usuário acabou de digitar a senha que criou.
   *
   * ⚠️ `NSFaceIDUsageDescription` **continua** no `Info.plist` e deve
   * continuar: o `CapgoCapacitorNativeBiometric` está linkado no binário
   * (ITMS-90683 apareceu quando a chave foi removida). Com a flag desligada a
   * API nunca é chamada e o iOS nunca pede Face ID.
   */
  biometricLogin: false,

  /**
   * Push proativo de re-engajamento (agendado).
   *
   * ⚠️ **Esta flag não controla nada no cliente** — e é proposital que ela
   * exista mesmo assim. O disparo vive inteiramente no servidor
   * (`supabase/functions/reengagement-push`, agendada no Supabase), então o
   * interruptor real é **não fazer o deploy da função / não criar o cron**.
   * A flag está aqui como registro da decisão, para que ninguém agende a
   * função achando que ela já estava prevista para o v1.
   *
   * Adiado por estratégia, não por bug: push não solicitado na primeira semana
   * de um app desconhecido é a receita para opt-out em massa — e opt-out de
   * push é irreversível na prática. Ligue quando souber quem fica.
   */
  reengagementPush: false,
} as const;

export type FeatureFlag = keyof typeof FEATURES;
