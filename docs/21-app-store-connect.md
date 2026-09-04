# 21 — App Store Connect: tudo que precisa ser preenchido

> **Para que serve este arquivo.** Reunir, num lugar só, (1) os requisitos da
> Apple que se aplicam ao LinKa, (2) o estado real do app em relação a cada um,
> e (3) **o valor exato de cada campo da App Store Connect** — pronto para
> copiar e colar.
>
> Escopo: submissão da **v1.0** com `FEATURES.iap = false`. O recorte de features
> está em [`docs/20-lancamento-v1.md`](./20-lancamento-v1.md), que continua sendo
> a fonte de verdade sobre *o que entra no binário*. Este arquivo trata do que
> vive **fora** do binário.
>
> Auditoria de referência: **02/09/2026**, após as rejeições de 26/08 (2.1(b)),
> 31/08 (5.1.1(ii)) e 01/09 (2.1(b) + 3.1.2(c)).

---

## 0. Situação — auditoria de 02/09/2026

A auditoria encontrou 10 itens. **Todos os corrigíveis por código foram
corrigidos**; o que sobrou vive na App Store Connect e **nenhum commit executa**
— é trabalho manual seu, e está detalhado na Parte C.

> **Uma correção foi revertida.** Travar o iPad em retrato parecia reduzir risco
> de layout, mas a Apple **recusa o upload** de app de iPad que não declare as
> quatro orientações (§2.2 item 6). O `Info.plist` voltou ao que era; a paisagem
> passa a ser item de checklist no TestFlight, não configuração.

### ✅ Corrigido no código (verificar no TestFlight)

| Item | O que era | O que foi feito |
|---|---|---|
| `PrivacyInfo.xcprivacy` | Não existia, e o app usa uma Required Reason API → **upload recusado com ITMS-91053** | Criado com `NSPrivacyAccessedAPICategoryFileTimestamp` / `C617.1` e registrado nos 4 pontos do `pbxproj` |
| Denunciar/bloquear na **DM** | A conversa privada não tinha **nenhum** menu | `UserSafetyDrawer` no header da conversa; bloquear volta para a lista |
| Denunciar/bloquear em **comentários** | Nenhuma ação sobre comentário alheio | Botão "…" por comentário; bloquear recarrega a lista sem o bloqueado |
| **Filtro de conteúdo** (item *a* da 1.2) | Não existia — moderação era 100% reativa | `client/lib/content-filter.ts`, aplicado em post, comentário e DM |
| Canal de contato | Sumia do app sem `VITE_SENTRY_DSN` | Linha **Suporte e contato** em Configurações → Outros, sem depender de env |
| Support URL | Não existia página de suporte | `public/suporte.html` + rewrite → `linkafit.com.br/suporte` |
| Política de privacidade | Sem Sentry, com localização que não é coletada | Sentry documentado, localização corrigida, finalidade dos dados de sessão corrigida |
| `ITSAppUsesNonExemptEncryption` | Ausente → todo build parava em "Missing Compliance" | `<false/>` no `Info.plist` |
| Disclaimer de saúde | Só aparecia se marcasse restrição articular | Permanente na rotina sugerida e no card de calorias |
| Denunciar publicação no detalhe do post | Só dava para denunciar o autor | `content` no `UserSafetyDrawer` → "Denunciar post" |
| Bloquear nos viewers de flow | Só denunciar | Item "Bloquear" nos dois viewers |

Também entraram: ícone 1024×1024 reexportado **sem canal alfa**, toast em
português corrigido em `Community.tsx`, `window.open` → `Browser.open` no
compartilhamento, e os comentários obsoletos de `feature-flags.ts` que mandavam
remover chaves do `Info.plist` que **precisam** ficar lá.

Versão subiu para **1.0.59 (60)** — o build 59 já foi usado na submissão
rejeitada e a Apple recusa número repetido.

### ⏳ Pendente — só você pode fazer, na App Store Connect

| # | Item | Onde | Prazo |
|---|---|---|---|
| 1 | **Responder as perguntas de rede social** do questionário de idade | ASC → Classificação etária | **07/09/2026** |
| 2 | **Remover os produtos de IAP da versão** | ASC → página da versão | Antes de enviar |
| 3 | Preencher a **ficha de privacidade** conforme §3.2 | ASC → Privacidade do app | Antes de enviar |
| 4 | Criar e povoar a **conta de demonstração** | Seu app + ASC → Informações de revisão | Antes de enviar |
| 5 | Colar as **Notes for Review** (§3.5) | ASC → Informações de revisão | Antes de enviar |
| 6 | Decidir o **trader status** da UE | ASC → Informações de negócios | Antes de enviar |
| 7 | Confirmar **`VITE_SENTRY_DSN`** nas variáveis do Appflow | Appflow | Antes do build |
| 8 | **Deploy na Vercel** para `/suporte` ficar no ar | Vercel | Antes de enviar |

---

# Parte A — Os requisitos da Apple

## 1. Diretrizes que se aplicam ao LinKa

Levantamento a partir das [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
(consultadas em 02/09/2026). Só o que incide sobre este app — as diretrizes de
jogos, apostas, criptomoeda, Kids Category, ARKit, extensões e Mac ficam fora.

### 1.x — Segurança

| Diretriz | O que exige | Onde vive | LinKa |
|---|---|---|---|
| **1.1** Conteúdo censurável | Nada ofensivo, sexual, difamatório | Binário + moderação | ✅ nenhum conteúdo próprio desse tipo |
| **1.2** **UGC** | **Quatro** mecanismos: (a) filtrar material censurável, (b) denunciar + resposta em tempo hábil, (c) bloquear usuários abusivos, (d) contato publicado | Binário + site | ⚠️ **(a) não existe**; (b) e (c) incompletos; (d) frágil — ver §2.2 |
| **1.4.1** Dano físico / saúde | App que dá informação de saúde é revisado com rigor maior; precisa declarar método e limites | Binário + metadados | ⚠️ disclaimer só condicional |
| **1.4.5** Atividade arriscada | Não incentivar atividade fisicamente arriscada | Binário | ✅ |
| **1.5** Informação do desenvolvedor | Forma fácil de contato | ASC (Support URL) + site | ✅ após `/suporte` |
| **1.6** Segurança de dados | Tratamento adequado dos dados | Backend | ✅ RLS ativa; ⚠️ ver §2.2 (chave de serviço) |

### 2.x — Desempenho

| Diretriz | O que exige | LinKa |
|---|---|---|
| **2.1(a)** Completude | Versão final, metadados completos, **URLs funcionais**, testado em device, **conta de demonstração** e backend ligado | ⚠️ conta demo precisa ser criada |
| **2.1(b)** IAP completo | Produtos de compra visíveis e funcionais | ✅ **desde que nenhum produto esteja anexado à versão** — foi a rejeição de 01/09 |
| **2.3.1** Sem features ocultas | Nada dormente ou não documentado; toda feature descrita nas Notes for Review | ✅ as flags são constantes de compilação, não config remota — código morto no binário |
| **2.3.2** IAP na descrição | Se há compra, indicar | n/a (sem IAP no v1) |
| **2.3.3** Screenshots | Mostrar o app **em uso**, não tela de login/arte | ✅ 5 telas reais |
| **2.3.6** Classificação etária honesta | Responder o questionário com sinceridade | ⚠️ questionário novo pendente |
| **2.3.7** Palavras-chave | Nome ≤ 30 caracteres; sem termos de marca, preço ou irrelevantes | ver §3.4 |
| **2.3.8** Nome e ícone | Metadados adequados a 4+; nome/ícone consistentes | ✅ |
| **2.3.10** Outras plataformas | Não citar Android/Google Play em nada | ⚠️ conferir a descrição |
| **2.4** Compatibilidade de hardware | **Rodar bem em iPad quando possível** | ⚠️ as 4 orientações são **obrigatórias** — validar paisagem no TestFlight, ver §2.2 |
| **2.5.4** Background | Só usar modo de fundo para o fim declarado | ✅ `UIBackgroundModes` fora do plist |
| **2.5.14** Consentimento para gravar | Consentimento explícito para gravação | ✅ gravação sempre iniciada pelo usuário |

### 3.x — Negócio

| Diretriz | O que exige | LinKa |
|---|---|---|
| **3.1.1** IAP obrigatório | Conteúdo digital só via compra da Apple; sem mecanismo próprio de desbloqueio; **botão de restaurar compras** | ✅ nenhum pagamento externo no código; paywall pronto para quando religar |
| **3.1.2(c)** Assinatura | Preço, duração, renovação automática, **link funcional de EULA e privacidade** na metadata **e** na tela de compra | ✅ só se aplica quando houver produto anexado — **manter zero produtos** |

### 4.x — Design

| Diretriz | O que exige | LinKa |
|---|---|---|
| **4.2** Funcionalidade mínima | Mais que um site empacotado | ✅ app nativo com plugins, câmera, push |
| **4.8** Serviços de login | Se usa login social de terceiro, precisa oferecer alternativa equivalente (Sign in with Apple) | ✅ **não se aplica** — só e-mail/senha. Não adicionar login social sem adicionar Apple junto |
| **4.5.4** Push | Push não pode ser obrigatório para o app funcionar; marketing exige opt-in | ✅ |

### 5.x — Legal

| Diretriz | O que exige | LinKa |
|---|---|---|
| **5.1.1(i)** Política de privacidade | Link na ASC **e dentro do app**; deve listar dados coletados, usos, **todos os terceiros**, retenção/exclusão e como revogar consentimento | ⚠️ **Sentry ausente da lista de terceiros** |
| **5.1.1(ii)** Permissão | Consentimento para coleta; **purpose strings explicando uso com exemplo concreto** | ✅ corrigido em 31/08 (7 chaves, en + pt-BR) |
| **5.1.1(iii)** Minimização | Só pedir dado relevante ao núcleo | ✅ idade/altura/peso opcionais |
| **5.1.1(iv)** Acesso | Não forçar consentimento desnecessário | ✅ |
| **5.1.1(v)** **Exclusão de conta** | Se cria conta, precisa **excluir dentro do app** — desativar não basta; apaga o registro e os dados | ✅ implementado e endpoint no ar (verificado) |
| **5.1.2** Uso e compartilhamento | Consentimento antes de compartilhar; ATT se houver rastreio | ✅ sem ATT porque não há rastreio |
| **5.1.3** Saúde | Dado de fitness **não pode** ser usado para publicidade ou mineração; não gravar dado falso em HealthKit | ✅ sem anúncios, sem HealthKit |
| **5.1.4** Crianças | Cuidado com dados de menores (COPPA/GDPR) | ⚠️ nenhuma verificação de idade |
| **5.1.5** Localização | Só usar se relevante; consentimento | ✅ não usada no v1 |
| **5.2** Propriedade intelectual | Só conteúdo próprio ou licenciado | ✅ imagens de exercício próprias; UGC licenciado pelos Termos §3 |

## 2. Requisitos que não são diretriz, mas travam o envio

| Requisito | Prazo / desde | Estado |
|---|---|---|
| **Privacy Manifest** (`PrivacyInfo.xcprivacy`) declarando Required Reason APIs | obrigatório desde mai/2024 | ❌ **não existe** |
| **Questionário de idade novo** (controles, capacidades, saúde/bem-estar, violência) | respostas exigidas desde 31/01/2026 | ⚠️ conferir se foi respondido |
| **Perguntas de rede social** no questionário de idade | **exigidas a partir de 07/09/2026** | ❌ pendente |
| **Trader status** (DSA, União Europeia) | desde 17/02/2025 — sem isso o app sai das lojas da UE | ⚠️ decidir — ver §3.1 |
| **Export compliance** | a cada build | ⚠️ resolver com uma chave no `Info.plist` |
| **Screenshots** 6.9" iPhone + 13" iPad | atual | ⚠️ hoje só 6.5" — ver §3.4 |

---

# Parte B — Estado do app

## 2.1. O que já está conforme (verificado em 02/09/2026)

Tudo abaixo foi confirmado lendo o código ou consultando o serviço em produção —
não é suposição.

**Guideline 1.2 — bloqueio**
- `blockUserDb` / `unblockUserDb` em `client/lib/ritmofit-db.ts:5672` e `:5696`; leitura simétrica em `:5605`.
- Filtro aplicado em feed e Descobrir (`client/services/post.service.ts:53`, `:169`), busca (`ritmofit-db.ts:5134`), comentários (`:956`) e conversas (`:7025`).
- Trava real no banco pela policy `messages_insert_not_blocked` — **e a tabela `user_blocks` existe em produção** (verificado por HTTP 200 no PostgREST). A migração `20260826` rodou.
- Desfazer em Configurações → Contas bloqueadas (`settings-drawer.tsx:1699`).

**Guideline 5.1.1(v) — exclusão de conta**
- Fluxo in-app: Configurações → Conta e segurança → Encerrar Conta, com confirmação por digitação (`Profile.tsx:2127`).
- Apaga de verdade: 5 lotes de DELETE respeitando FK + purga do Storage (`ritmofit-db.ts:12137-12243`), depois `POST /api/delete-auth-user` que valida o dono do token e remove de `auth.users` (`api/delete-auth-user.ts:133-152`).
- **O endpoint está no ar**: `https://linkafit.com.br/api/delete-auth-user` responde **HTTP 405** a GET — ou seja, existe e aceita só POST. Era a maior pendência do checklist da v1.

**Guideline 5.1.1(ii) — purpose strings**
- 7 chaves no `Info.plist`, todas com uso + exemplo concreto + quando.
- Traduzidas em `en.lproj` e `pt-BR.lproj`, ambas registradas no `pbxproj` (variant group em `:195-203`, resources phase em `:156`, `knownRegions` com `pt-BR`).
- **Paridade 7/7/7** — nenhuma chave sem tradução.

**Guideline 4.8 — login**
- Só e-mail/senha (`Login.tsx:457`, `:660`). Zero `signInWithOAuth`. **Sign in with Apple não é exigido.**

**Guideline 5.1.2 — rastreio**
- Nenhum SDK de anúncio ou analytics de terceiro. Sem ATT, sem IDFA, sem `NSUserTrackingUsageDescription` — e está correto, porque não há rastreio.

**Guideline 3.1.1 — pagamento**
- Zero ocorrência de Stripe, PIX, MercadoPago, PayPal ou checkout externo. O único link de cobrança aponta para a própria Apple (`subscription-drawer.tsx:27`).
- Com `FEATURES.iap = false`, `PremiumProvider` devolve `isPremium: true` e nunca configura o SDK — nenhuma porta de paywall renderiza.

**Infraestrutura (Guideline 2.1 — backend ligado)**
- Verificado em produção: `user_blocks`, `post_complaint`, `shots_complaint`, `flow_complaint`, `user_complaint`, `profiles`, `posts`, `app_admins`, `screen_time_logs`, `access_sessions`, `push_tokens` — todas respondem HTTP 200.
- `https://linkafit.com.br/termos` e `/privacidade` servem conteúdo real e completo.
- `apple-app-site-association` está no ar com Team ID real (`VR767CPN6R`), então os Universal Links funcionam.

**Binário**
- Nenhum arquivo Swift órfão no `pbxproj` — o build do Appflow não quebra por isso.
- Todo plugin instalado tem sua chave de permissão declarada.
- `LaunchScreen.storyboard` completo; `AppIcon` 1024×1024 presente.
- Screenshots **sem canal alfa** (24bpp RGB) — não serão recusadas por transparência.

## 2.2. Lacunas encontradas — e como cada uma foi fechada

> Mantido como registro: o **porquê** de cada correção é o que impede alguém de
> desfazê-la sem querer. As linhas de código citadas são de antes da correção.

### ✅ 1. `PrivacyInfo.xcprivacy` não existia — e o app usa Required Reason API

`ios/App/App/EditedMediaPlugin.swift:544,549-550,607,612-613` lê
`URLResourceKey.contentModificationDateKey`, que está na lista da Apple sob
**`NSPrivacyAccessedAPICategoryFileTimestamp`**. Sem manifest, o upload é
rejeitado com **ITMS-91053** — o build nem chega ao revisor.

Motivo válido: **`C617.1`** (os timestamps são lidos só dentro do container do
app — os diretórios saem de `.cachesDirectory` em `EditedMediaPlugin.swift:532-537`).

> ⚠️ Criar o arquivo não basta. Como não há Xcode aqui, ele precisa entrar nos
> **4 pontos** do `project.pbxproj`: `PBXFileReference`, `PBXBuildFile`,
> children do group `App` e **`PBXResourcesBuildPhase`**.
> Manifest solto no disco é invisível para o build e falha igual.

**Feito:** [`ios/App/App/PrivacyInfo.xcprivacy`](../ios/App/App/PrivacyInfo.xcprivacy),
registrado nos 4 pontos. O arquivo declara também os `NSPrivacyCollectedDataTypes`,
que precisam dizer **a mesma coisa** que a ficha de privacidade da §3.2 — ao
mudar uma, mude a outra.

### ✅ 2. DM e comentários não tinham denunciar nem bloquear

- **Conversa privada** (`conversation-view.tsx:66-97`): o header tem voltar, avatar e insígnias. **Nenhum menu de opções.**
- E qualquer pessoa pode iniciar DM com qualquer outra — `new-conversation-drawer.tsx:48` usa busca global de usuários.
- **Comentários** (`post-comments-dialog.tsx`): nenhuma ação de denúncia; só a lixeira do próprio autor. Não existe `reportCommentDb`, não existe tabela `comment_complaint`, e o Admin não trata o tipo (`Admin.tsx:299-303`).

Chat aberto com estranhos **sem ponto de segurança na tela onde o abuso
acontece** é o achado 1.2 mais provável num review.

**Feito:**
- **Conversa privada** — botão "…" no header abre o `UserSafetyDrawer` (denunciar + bloquear). Ao bloquear, volta para a lista de conversas.
- **Comentários** — botão "…" em cada comentário de outra pessoa, mesmo drawer. Ao bloquear, a lista recarrega e os comentários do bloqueado somem (o filtro de `user_blocks` já existia no servidor).
- **Detalhe do post** — o `UserSafetyDrawer` ganhou a prop `content`, que acrescenta "Denunciar publicação" acima de "Denunciar usuário". É a tela de destino dos deep links.
- **Viewers de flow** — item "Bloquear" ao lado das duas denúncias, nos dois viewers.

Denunciar **o comentário em si** continua não existindo: exigiria tabela
`comment_complaint`, migração e uma fila nova no Admin. Denunciar o autor e
bloqueá-lo cobre a exigência da 1.2, e bloquear já some com os comentários dele.

### ✅ 3. Nenhum filtro de conteúdo censurável — item (a) da 1.2

Não existe filtro de texto, lista de termos, moderação automática nem
auto-ocultação. `reportPostDb` (`ritmofit-db.ts:9293`) apenas insere uma linha:
**o conteúdo denunciado continua visível para todos** até um dos 3 admins
(`client/lib/admin.ts:9-13`) agir manualmente.

A Apple pede literalmente "*a method for filtering objectionable material from
being posted to the app*". Moderação reativa costuma passar quando há resposta
rápida documentada, mas é a diretriz em que este app está mais descoberto.

**Feito:** [`client/lib/content-filter.ts`](../client/lib/content-filter.ts) —
lista de termos inequívocos (insulto pesado, termo de ódio, sexual explícito e
ameaça direta, em PT e EN) comparada contra o texto **normalizado**: sem acento,
sem leet-speak (`p0rr@`), sem repetição (`PÔRRRA`) e por palavra inteira, para
não bloquear "cuidado" por conter "cu".

Roda em **três** pontos, sempre antes de gravar: legenda do post
(`NewPost.tsx`, imagem e vídeo), comentário (`post-comments-dialog.tsx`) e
mensagem direta (`use-messages.ts`). Bloqueado, o usuário recebe um toast
pedindo para reescrever.

Validado contra 34 casos — 14 que devem ser bloqueados e 20 textos legítimos de
academia ("a abelha me picou", "Passo a passo do agachamento", "Assado de
domingo") — sem nenhum falso positivo.

> O filtro é preventivo e proposital*mente* conservador. Caso ambíguo continua
> indo para a fila de denúncias, que é o mecanismo desenhado para julgamento
> humano. Se quiser reforçar depois, o passo natural é ocultar automaticamente
> conteúdo que atinja N denúncias.

### ✅ 4. O canal de contato in-app podia não existir no binário

`settings-drawer.tsx:2150` só renderiza "Relatar um problema" se
`isMonitoringEnabled()` — que depende de **`VITE_SENTRY_DSN` estar no build**.
Se o Appflow não injetar a variável, o app vai para a loja **sem nenhum canal de
contato interno**, e sobra só o e-mail dentro de uma página web.

**Feito:** Configurações → Outros ganhou a linha **Suporte e contato**, que abre
`SUPPORT_URL` pelo `Browser` do Capacitor. Não depende de variável nenhuma.
"Relatar um problema" continua atrás do Sentry — agora é um extra, não o único
canal.

**Ainda assim, confirme `VITE_SENTRY_DSN` no Appflow**: sem ela o app vai para a
loja sem captura de erro, e o formulário de relato some.

### ✅ 5. Política de privacidade em conflito com a realidade

| Ponto | Arquivo | Problema |
|---|---|---|
| Sentry ausente da lista de terceiros | `public/privacidade.html:143-148` | Cita só Supabase, Apple e RevenueCat. **A 5.1.1(i) exige listar todo terceiro que recebe dado** |
| Dados de sessão | `:156` | Diz "objetivo exclusivo" do timer de uso; também alimentam o painel Admin (`ritmofit-db.ts:14993-15043`) |
| Localização | `:109-111` | Descreve coleta de localização que o v1 **não faz** — e conflita com a ficha de privacidade, que declarará "não coletada" |
| Assinatura Premium | `public/termos.html:88-100` | Descreve assinatura que não existe neste binário |

Um revisor que compare a política com a ficha de privacidade encontra
contradição.

**Feito** em `public/privacidade.html`:
- **Sentry** entrou na lista de terceiros, com uma seção 5.2 própria separando o que vai no erro automático (só o `user.id`; e-mail, usuário e IP são removidos antes do envio) do que vai no relato manual (texto, e-mail **se você informar**, e o ambiente técnico).
- **Localização** passou a dizer explicitamente que **não é coletada**.
- **Dados de sessão** deixaram de ser "objetivo exclusivo" do timer — agora declaram também as métricas internas agregadas.
- **Assinatura** ficou marcada como não aplicável a esta versão, nos dois pontos em que aparece. Isso importa: o revisor de 01/09 procurou um paywall que não existe.
- **Direitos do usuário** ganharam o caminho concreto de exclusão de conta dentro do app e como revogar permissões — é o que a 5.1.1(i) pede.

### ❌ 6. iPad com 4 orientações — **tentativa revertida, não repetir**

`Info.plist`: iPhone é retrato puro, iPad libera as quatro orientações. Como o
revisor testa em iPad (as duas rejeições vieram de um iPad Air 11" M3) e a UI é
mobile-first, a auditoria propôs travar o iPad em retrato.

**Isso não funciona, e custou um upload.** Em 04/09 o Appflow foi recusado na
validação da Apple, antes mesmo do TestFlight:

```
Validation failed (409) Invalid bundle. The "Portrait, PortraitUpsideDown"
orientations were provided for the UISupportedInterfaceOrientations Info.plist
key in the com.linka.meuapp bundle, but you need to include all of the
"Portrait, PortraitUpsideDown, LandscapeLeft, LandscapeRight" orientations to
support iPad multitasking.
```

**A regra:** todo app de iPad que participa da multitarefa é **obrigado** a
declarar as quatro orientações. A única saída seria sair da multitarefa com
`UIRequiresFullScreen = true` — chave que a Apple **depreciou** e que o iPadOS 26
ignora, tornando todo app redimensionável de qualquer forma. Não existe caminho
de plist para travar o iPad em retrato hoje.

**Revertido para as quatro orientações**, com o histórico registrado no
comentário do próprio `Info.plist` para ninguém tentar de novo.

**O que fazer no lugar:** a paisagem no iPad não se evita por configuração —
**valida-se no TestFlight**. Gire o aparelho e confira feed, metas, sessão de
treino, perfil e conversa. O risco de layout continua real; ele só não se
resolve pelo plist.

### ✅ 7. Sem disclaimer médico permanente

O único aviso está em `create-wizard-drawer.tsx:1968-1972` e **só aparece se o
usuário marcar uma restrição articular**. O app prescreve treino, veta
exercícios por lesão (`coach-profile.ts:198-233`) e estima calorias
(`calorie-estimate.ts`) — sem nenhum aviso permanente na UI.

**Feito:** chave `health_disclaimer` (pt + en) em dois lugares permanentes — no
fim da **rotina sugerida**, que é onde a prescrição aparece, e no **card de
calorias** da sessão de treino, que é onde um número de saúde é exibido. O aviso
condicional das restrições articulares continua onde estava.

### ⚠️ 8. Sem verificação de idade — **não corrigido, por ser decisão de produto**

`Login.tsx:2235` aceita idade de 1 a 100 e o campo é **opcional**. Os Termos
declaram 13+ e a Política diz não coletar dados de menores de 13, mas **nada no
app verifica**.

Isto **não é bloqueador**: a Apple não exige verificação de idade num app 13+.
Mas define a resposta do questionário (§3.3): sem trava técnica, a resposta
honesta para "as funções sociais são bloqueadas para menores de 13?" é **não**.
Responder "sim" sem implementar a Declared Age Range API seria declaração falsa,
o que cai na 2.3.6.

Se um dia quiser a exceção da categoria Social Media no Tempo de Uso, aí sim é
preciso implementar a API e bloquear de fato — é trabalho de produto, não de
metadata.

### ✅ 9. Outras — todas corrigidas

| Achado | Correção |
|---|---|
| Bloquear ausente nos dois viewers de flow | Item **Bloquear** ao lado das denúncias; depois de bloquear, o viewer fecha |
| Detalhe do post só denunciava o autor | Prop `content` no `UserSafetyDrawer` → **Denunciar publicação** |
| Ícone 1024×1024 com canal alfa (RGBA, 100% opaco) | Reexportado em 24bpp RGB — some o risco de ITMS-90717 |
| `ITSAppUsesNonExemptEncryption` ausente | `<false/>` no `Info.plist`; nunca mais responder export compliance à mão |
| `window.open` sem fallback (Facebook, X) | `Browser.open` do Capacitor, e os dois passaram a tentar a folha nativa antes — como WhatsApp e Telegram já faziam |
| Toast hardcoded em português (`Community.tsx`) | `t("error_loading_data")`, nas duas línguas |
| Comentários de `feature-flags.ts` mandando remover chaves do `Info.plist` | Reescritos: as chaves **precisam ficar** (ITMS-90683 as exige pelo *link* do SDK) |

**Duas coisas seguem em aberto de propósito:**

- **`UIBackgroundModes` continua fora**, e está certo — modo declarado e não usado cai na 2.5.4. Mas é bomba armada: ao religar `FEATURES.gpsRun`, `allowsBackgroundLocationUpdates = true` **crasha o app** sem o modo `location`. O aviso está agora no próprio comentário da flag.
- **Rotacionar a service role key**, que vazou no histórico do Git (`docs/16-seguranca.md`). Não é diretriz da Apple, mas é a 1.6.

---

# Parte C — App Store Connect, campo a campo

> Tudo abaixo é para **copiar e colar**. Onde há `⟨…⟩`, você precisa preencher.

## 3.1. Informações do app (nível do app, vale para todas as versões)

| Campo | Valor |
|---|---|
| **Nome** (máx. 30) | `Linka: Treino e Progresso` *(25 caracteres)* |
| **Subtítulo** (máx. 30) | `Ficha de treino e evolução` *(26 caracteres)* |
| **Bundle ID** | `com.linka.meuapp` |
| **SKU** | `linka-ios-001` |
| **Apple ID do app** | `6761916728` *(já existente)* |
| **Idioma principal** | Português (Brasil) |
| **Categoria principal** | **Saúde e fitness** |
| **Categoria secundária** | **Rede social** |
| **Direitos autorais** | `2026 Nicholas Muniz` |

> **Sobre o nome:** o `CFBundleDisplayName` do binário é `Linka`, então a tela de
> início mostra "Linka" e a loja mostra o nome completo. Isso é o padrão e está
> conforme a 2.3.8. Não usar acentuação ou grafia diferente entre os dois.

### Direitos de conteúdo (Content Rights)

> Pergunta: *"Seu app contém, exibe ou acessa conteúdo de terceiros?"*

**Responda: Sim.** O app exibe conteúdo gerado por usuários. Você tem a licença
para exibi-lo pela cláusula 3 dos Termos de Uso (`public/termos.html`), que
concede ao Linka "uma licença não exclusiva e gratuita para armazenar e exibir
esse conteúdo".

### Trader status (União Europeia — DSA)

Desde 17/02/2025 a Apple **remove das lojas da UE** todo app sem status de
comerciante declarado. Você precisa decidir:

| Opção | Consequência |
|---|---|
| **Declarar-se trader** | Nome legal, **endereço, telefone e e-mail ficam públicos** na página do app nas lojas da UE. O telefone não pode ser ocultado |
| **Declarar-se não-trader** | Possível enquanto o app for gratuito e sem monetização. **Deixa de valer no dia em que o IAP for ligado** |
| **Remover a UE da disponibilidade** | Evita a exposição do endereço pessoal; o app fica fora dos 27 países da UE |

**Recomendação:** se o LinKa nasce gratuito e o público-alvo é o Brasil, a rota
mais simples é **remover a UE da disponibilidade** (§3.7) e tratar o trader
status quando houver receita e, idealmente, um CNPJ para expor no lugar do
endereço residencial.

## 3.2. Privacidade do app (ficha de privacidade / nutrition labels)

Primeira pergunta: **"Você coleta dados deste app?" → Sim.**

### Rastreio

**"Dados usados para rastrear você": NENHUM.**
Não há SDK de publicidade, IDFA, ATT nem data broker. Confirmado por varredura:
zero ocorrências de `AppTrackingTransparency`, `requestTrackingAuthorization` ou
`NSUserTrackingUsageDescription`.

### Dados coletados — todos **vinculados** ao usuário

Nenhum dado do LinKa é anônimo: tudo está atrelado a uma conta.

| Categoria | Tipo de dado | O que é, no LinKa | Finalidades a marcar |
|---|---|---|---|
| **Informações de contato** | Endereço de e-mail | Login (Supabase Auth) | Funcionalidade do app |
| | Nome | Nome de exibição do perfil | Funcionalidade do app |
| **Conteúdo do usuário** | Fotos ou vídeos | Posts, flows, foto de perfil, mídia em conversas | Funcionalidade do app |
| | Dados de áudio | Mensagens de voz na conversa privada | Funcionalidade do app |
| | E-mails ou mensagens de texto | Conteúdo das mensagens diretas | Funcionalidade do app |
| | Outro conteúdo do usuário | Legendas, comentários, bio, nomes de rotina | Funcionalidade do app |
| **Saúde e fitness** | Fitness | Treinos, séries, carga, repetições, calorias estimadas | Funcionalidade do app, Personalização do produto |
| | Saúde | Peso, altura, idade, gênero, restrições articulares | Funcionalidade do app, Personalização do produto |
| **Identificadores** | ID do usuário | UUID da conta | Funcionalidade do app, Análise |
| | ID do dispositivo | Token APNs para notificações | Funcionalidade do app |
| **Dados de uso** | Interação com o produto | `screen_time_logs` e `access_sessions` (tempo por tela e duração de sessão) | Funcionalidade do app, Análise |
| **Diagnóstico** | Dados de falha | Sentry — evento de erro com `user.id` | Funcionalidade do app, Análise |
| | Dados de desempenho | Sentry | Funcionalidade do app, Análise |

### O que **NÃO** declarar nesta versão

| Tipo | Por quê |
|---|---|
| **Localização** (precisa ou aproximada) | `FEATURES.gpsRun` e `postLocation` estão desligadas; nenhuma API de localização é chamada. As purpose strings existem só porque os SDKs estão **linkados** (ITMS-90683) — purpose string é permissão, ficha é coleta. **Mas corrija a política de privacidade antes**, que hoje descreve coleta de localização |
| **Histórico de compras** | Sem IAP no v1; `Purchases.configure` nunca é chamado |
| **Contatos, Histórico de busca, Info. financeira, Info. sensível** | Não coletados |

> ⚠️ **Marque "Personalização do produto" em Saúde e Fitness com consciência:**
> a 5.1.3 proíbe usar dado de saúde/fitness para publicidade ou mineração. Aqui
> o uso é gerar a rotina individualizada, o que é permitido.

### Links de privacidade

| Campo | Valor |
|---|---|
| **URL da política de privacidade** | `https://linkafit.com.br/privacidade` |
| **URL de opções de privacidade** (opcional) | `https://linkafit.com.br/suporte` |

## 3.3. Classificação etária — o questionário novo

A Apple reformulou o questionário: às faixas 4+ e 9+ juntaram-se **13+, 16+ e
18+**, e entraram perguntas sobre **controles no app, capacidades, temas médicos
ou de bem-estar e temas violentos**. As respostas são exigidas desde 31/01/2026.

E, desde julho/2026, há **perguntas específicas de rede social** —
**obrigatórias para novos envios a partir de 07/09/2026**. O LinKa se enquadra
nelas.

### Respostas recomendadas

| Tema | Resposta | Justificativa |
|---|---|---|
| Violência (realista, de fantasia, sádica) | **Nenhuma** | Não há conteúdo próprio desse tipo |
| Conteúdo sexual ou nudez | **Nenhum** | — |
| Linguagem imprópria / humor adulto | **Nenhum** *(conteúdo próprio)* | O risco vem do UGC, coberto pela pergunta de conteúdo gerado por usuário |
| Álcool, tabaco, drogas | **Nenhum** | O único acerto textual é o hábito "Sem álcool" — abstinência, não consumo |
| Jogos de azar / sorteios | **Não** | — |
| Terror | **Nenhum** | — |
| **Conteúdo gerado por usuário** | **Sim** | Posts, comentários, mídia, mensagens |
| **Comunicação entre usuários / chat** | **Sim, sem restrição** | DM aberta por busca global de usuários |
| **Acesso irrestrito à web** | **Não** | Links externos abrem no `Browser` do Capacitor, sem navegador embutido livre |
| **Temas médicos ou de bem-estar** | **Sim** | Rotina de treino individualizada, estimativa de calorias, coleta de peso/altura/restrições. **Não** é diagnóstico nem tratamento |
| **Controles no app (parental / restrição por idade)** | **Não** | Não há controle parental nem verificação de idade — ver §2.2 item 8 |

### As duas perguntas de rede social

| Pergunta | Resposta | Por quê |
|---|---|---|
| O app redistribui, promove ou expõe conteúdo de usuário a um público amplo (feed, comunidade, busca, recomendações)? | **Sim** | O feed tem aba **Descobrir**, que mostra posts de quem você não segue (`post.service.ts:169`), e há busca global de usuários |
| O acesso às funções sociais é bloqueado para menores de 13 via Declared Age Range API? | **Não** | O app não usa a Declared Age Range API. Responder "sim" sem a trava técnica seria declaração falsa (2.3.6) |

**Resultado esperado: 13+**, com o novo descritor **Social Media** na página do
app. Isso é o correto para este produto — não tente fugir da classificação.

> Se você **quiser** a exceção da categoria Social Media no Tempo de Uso para
> menores de 13, aí sim é preciso implementar a Declared Age Range API e
> bloquear de fato as funções sociais. É trabalho de produto, não de metadata.

## 3.4. Versão 1.0 — metadados

### Descrição

> Reflete **exatamente** o recorte da v1.0. Não cite duelos, ranking, shots,
> vitrine, dieta, insígnias ou Premium — nada disso existe no binário, e a
> Guideline 2.3 exige que a descrição descreva a experiência real.

```
O Linka organiza seu treino e mostra sua evolução.

MONTE SUA ROTINA
Crie a rotina do zero ou responda algumas perguntas e receba uma sugestão
montada para o seu corpo e o seu objetivo — com séries, repetições e descanso
para cada exercício. Marque articulações em cuidado e os exercícios de risco
saem da lista.

REGISTRE ENQUANTO TREINA
Abra a sessão e vá marcando série por série, com carga e repetições. O app
acompanha o tempo, o volume e uma estimativa de calorias. No fim, você recebe um
resumo do treino.

VEJA A CARGA SUBIR
Cada treino registrado vira histórico. Acompanhe a sequência de dias, o
progresso das metas e a evolução de cada exercício ao longo das semanas.

TREINE ACOMPANHADO
Publique o resumo do treino no feed e receba incentivo de quem treina com você.
São seis formas de reagir a um post — porque "curtir" não diz muita coisa para
quem acabou de bater um recorde. Siga amigos, converse por mensagem e acompanhe
quem está mantendo a constância.

SEU ESPAÇO, SUAS REGRAS
Você controla quem vê suas listas de seguidores e suas publicações. Denuncie ou
bloqueie qualquer pessoa em um toque, e desfaça quando quiser em Configurações.
Sua conta pode ser excluída dentro do app, com todos os dados.

Disponível em português e inglês.

O Linka é uma ferramenta de organização e registro de treinos. As rotinas
sugeridas e as estimativas de calorias têm caráter informativo e não substituem
a orientação de um profissional de saúde ou de educação física. Consulte um
médico antes de iniciar um programa de exercícios.
```

### Palavras-chave (máx. 100 caracteres, separadas por vírgula, sem espaço)

```
academia,musculação,hipertrofia,exercício,carga,série,repetição,gym,fitness,personal,amigos
```

*91 caracteres.* Não repetem o que já está no nome e no subtítulo (a Apple já
indexa aqueles). Sem nome de marca, sem preço — 2.3.7.

### Texto promocional (máx. 170, alterável sem novo build)

```
Monte a rotina, registre cada série e veja a carga subir. Publique o treino e
receba incentivo de quem treina com você.
```

### Novidades desta versão

Na 1.0 o campo normalmente não aparece. Se aparecer: `Primeira versão do Linka.`

### URLs

| Campo | Valor | Obrigatório |
|---|---|---|
| **URL de suporte** | `https://linkafit.com.br/suporte` | **Sim** |
| **URL de marketing** | *(deixar vazio)* | Não |
| **URL da política de privacidade** | `https://linkafit.com.br/privacidade` | **Sim** |

> ⚠️ **Não use `https://linkafit.com.br` como URL de suporte.** A raiz serve a
> SPA do app — o revisor abre e cai numa tela de login, o que gera rejeição
> 1.5. A página `/suporte` foi criada para este campo (traz o e-mail, o prazo de
> resposta, como denunciar, como excluir a conta e o disclaimer de saúde, em
> português **e inglês**). **Ela só existe depois do deploy na Vercel** —
> confirme que abre antes de enviar.

### Screenshots

| Slot | Dimensão | Estado |
|---|---|---|
| **iPhone 6.9"** | 1320 × 2868 | ✅ 5 telas, sem alfa — **gerado em 02/09** |
| iPhone 6.5" | 1242 × 2688 | ✅ 5 telas, sem alfa |
| **iPad 13"** | 2064 × 2752 | ✅ 5 telas, sem alfa |

Os três conjuntos vivem em [`docs/appstore/`](./appstore/) e foram conferidos
por `node scripts/appstore/verify.mjs` — dimensão exata e **sem canal alfa**,
que é motivo de recusa automática no upload.

O 6.9" é o slot principal de iPhone hoje; o de 6.5" é aceito como alternativa e
fica como reserva. **iPhone e iPad são os dois obrigatórios** enquanto
`TARGETED_DEVICE_FAMILY` for `"1,2"` — e o app **é revisado em iPad**.

> Se regerar: as telas saem do app rodando de verdade em `localhost:8080`, com
> banco fictício em memória. O processo está em
> [`docs/appstore/README.md`](./appstore/README.md).

> ❌ **Não anexar `subscription-review-640x920.png`.** É a screenshot de review
> do IAP e está obsoleta enquanto `FEATURES.iap` estiver desligada.

## 3.5. Informações de revisão do app

### Contato

| Campo | Valor |
|---|---|
| Nome / Sobrenome | `Nicholas` / `Muniz` |
| Telefone | ⟨seu número com +55⟩ |
| E-mail | `nicholasmuniz19@gmail.com` |

### Login obrigatório: **Sim**

Crie **antes de enviar** uma conta de demonstração já povoada — a rejeição de
26/08 foi exatamente um revisor batendo numa conta recém-criada e vazia.

A conta precisa ter, no mínimo:
- foto de perfil e bio preenchidas;
- **uma rotina de treino criada**, com pelo menos um treino já concluído (para o histórico e a sequência não aparecerem zerados);
- **3 a 5 publicações** no feed, sendo pelo menos uma com resumo de treino;
- **seguir 2 ou 3 outras contas**, para o feed abrir em "Seguindo" com conteúdo;
- **uma conversa** com mensagens trocadas.

| Campo | Valor |
|---|---|
| Nome de usuário | ⟨e-mail da conta demo⟩ |
| Senha | ⟨senha da conta demo⟩ |

### Notas para revisão (Notes for Review)

> **Escreva em inglês.** A rejeição de 31/08 aconteceu com um revisor testando
> um iPad em inglês. Este texto antecipa as três perguntas que já custaram
> rejeição: onde está o IAP, por que existem purpose strings de localização, e
> onde estão os mecanismos da 1.2.

```
Linka is a workout tracking app with a social layer. Users build workout
routines, log each set while training, and share the workout summary with
friends.

DEMO ACCOUNT
Email: ⟨demo email⟩
Password: ⟨demo password⟩
The account is pre-loaded with a routine, workout history, posts and a
conversation, so no content needs to be created to review the app.

SUGGESTED REVIEW PATH
1. Sign in with the demo account. The Feed opens on "Seguindo" (Following).
2. Tap "Metas" (Goals) in the bottom bar -> open the routine -> "Iniciar treino"
   (Start workout). Log a set by entering weight and reps and confirming it.
   Finish the workout to see the summary.
3. Tap "Nova" (New) to create a post.
4. Tap "Comunidade" (Community) to open direct messages.

NO IN-APP PURCHASES IN THIS VERSION
This build ships with monetization disabled. There is no paywall, no purchase
flow and no locked content anywhere in the app - every feature is available to
every account. No In-App Purchase products are attached to this submission.
The RevenueCat SDK is linked in the binary but is never initialized.

ABOUT THE LOCATION AND FACE ID PURPOSE STRINGS
Info.plist declares location and Face ID purpose strings, but the app never
calls those APIs in this version - the corresponding features are disabled.
The strings are required because the Capacitor plugins that reference those
APIs are statically linked into the binary; removing the strings produced
ITMS-90683 warnings on upload. Accordingly, location is NOT declared in the
app privacy information, because no location data is ever collected.
UIBackgroundModes is intentionally not declared.

USER-GENERATED CONTENT SAFETY (Guideline 1.2)
All four required mechanisms are implemented:

1. FILTERING OBJECTIONABLE MATERIAL FROM BEING POSTED
   An automatic content filter runs before anything is stored, on all three
   places a user can publish text: post captions, comments and direct
   messages. It blocks slurs, hate speech, sexually explicit terms and direct
   threats in both Portuguese and English, and it resists evasion (accents,
   leet-speak such as "p0rr@", and repeated letters are normalized away). When
   it triggers, the content is not saved and the user is asked to rewrite it.
   To see it: type an offensive word into any comment box and submit.

2. REPORTING
   The "..." button reports content and/or its author. Available on: any post
   in the Feed, the post detail screen, another user's profile, each comment,
   the direct message conversation, and the flow viewer.

3. BLOCKING ABUSIVE USERS
   Same "..." menu everywhere above. Blocking is symmetric - the blocked user
   disappears from the feed, search, comments and conversations, and is
   prevented from sending direct messages by a database policy, not only by
   the UI. Unblock under Profile -> Settings -> "Contas bloqueadas".

4. PUBLISHED CONTACT INFORMATION
   https://linkafit.com.br/suporte (also reachable in the app under
   Profile -> Settings -> "Suporte e contato") and nicholasmuniz19@gmail.com

Accepting the Terms, which include a zero-tolerance clause for objectionable
content, is mandatory at sign-up (step 1). Reports are reviewed manually every
day through an internal admin panel and acted on within 24 hours; content is
removed and accounts are suspended or banned when warranted.

ACCOUNT DELETION (Guideline 5.1.1(v))
Profile -> Settings -> "Conta e segurança" -> "Encerrar Conta". Deletion is
confirmed by typing DELETAR CONTA and permanently removes the account record
and all associated data, including posts, media, workout history and messages.

HEALTH DISCLAIMER
The app does not diagnose or treat any condition. Suggested routines and
calorie figures are estimates produced from user-provided data (age, height,
weight, goal), not from device sensors, and are presented as informational.

LANGUAGES
The interface is available in Portuguese and English and follows the device
language.
```

## 3.6. Build e conformidade

### Export compliance (encryption)

**Resolvido no binário.** `ITSAppUsesNonExemptEncryption = false` está no
`Info.plist`, porque o app usa apenas HTTPS e a criptografia padrão do sistema,
ambas isentas. A App Store Connect **não vai mais perguntar** a cada build — se
perguntar, algo removeu a chave.

### In-App Purchase

**Nenhum produto anexado a esta versão.** Esta é a linha que foi pulada em
01/09 e custou a rejeição dupla 2.1(b) + 3.1.2(c).

Na página da versão, seção de compras dentro do app: a lista precisa ficar
**vazia**. Desligar `FEATURES.iap` no código **não** desanexa o produto — é ação
manual no ASC, e nenhum commit a executa.

## 3.7. Preço e disponibilidade

| Campo | Valor |
|---|---|
| Preço | **Gratuito** |
| Disponibilidade | Brasil + demais países ⟨decidir sobre a UE — ver §3.1⟩ |
| Distribuição | App Store pública |
| Lançamento da versão | **Manual** — permite conferir a página antes de publicar |

---

## 4. Checklist antes de apertar "Enviar para revisão"

### Já feito no código (02/09/2026) — nada a fazer

- [x] `PrivacyInfo.xcprivacy` criado e registrado nos 4 pontos do `pbxproj`
- [x] `ITSAppUsesNonExemptEncryption = false` no `Info.plist`
- [x] `public/privacidade.html` corrigido (Sentry, localização, dados de sessão, assinatura, direitos do usuário)
- [x] Denunciar/bloquear na conversa privada e nos comentários
- [x] Filtro de conteúdo em post, comentário e DM
- [x] Linha **Suporte e contato** em Configurações, independente do Sentry
- [x] Disclaimer de saúde permanente na rotina sugerida e nas calorias
- [x] Ícone reexportado sem canal alfa
- [x] Versão 1.0.59 / build 60
- [x] `vite build` + `npx cap sync ios` rodados

### Antes do build

- [ ] Confirmar **`VITE_SENTRY_DSN`** nas variáveis do Appflow
- [ ] Commit + push → build no Appflow → TestFlight
- [ ] **Deploy da Vercel** — sem ele, `https://linkafit.com.br/suporte` dá 404 e a Support URL da ASC fica quebrada

### Validar no TestFlight (incluindo iPad — é o device do review)

- [ ] Todo o checklist da seção 8 de [`docs/20-lancamento-v1.md`](./20-lancamento-v1.md)
- [ ] **iPad em paisagem**: girar o aparelho e conferir feed, metas, sessão de treino, perfil e conversa. Não dá para travar em retrato (ver §2.2 item 6) — a única defesa é olhar
- [ ] Configurações → Outros mostra **Suporte e contato**, e o link abre a página
- [ ] Conversa privada: botão "…" no topo, com denunciar e bloquear; bloquear volta para a lista
- [ ] Comentário de outra pessoa: botão "…" com denunciar e bloquear
- [ ] Detalhe do post: o menu oferece **Denunciar publicação** além de denunciar o autor
- [ ] Escrever um palavrão num comentário: aparece o toast "Conteúdo não permitido" e o comentário **não** é publicado
- [ ] Mesmo teste numa mensagem direta e numa legenda de post
- [ ] Rotina sugerida e card de calorias mostram o aviso de saúde
- [ ] Excluir conta funciona de ponta a ponta
- [ ] Nenhum paywall, cadeado ou blur em lugar nenhum

### Na App Store Connect

- [ ] Questionário de classificação etária respondido, **incluindo as perguntas de rede social**
- [ ] Ficha de privacidade preenchida conforme §3.2 — **sem localização**
- [ ] URL de suporte = `/suporte` (não a raiz do domínio)
- [ ] URL da política de privacidade preenchida
- [ ] Descrição, palavras-chave e texto promocional colados
- [ ] Screenshots **iPhone 6.9"** (`docs/appstore/iphone-6.9/`) e **iPad 13"** (`docs/appstore/ipad-13/`) anexadas; `subscription-review-640x920.png` **fora**
- [ ] **Nenhum produto de IAP anexado à versão**
- [ ] Conta de demonstração criada, povoada e **testada num aparelho limpo**
- [ ] Notes for Review coladas, em inglês
- [ ] Export compliance respondido
- [ ] Trader status decidido (ou UE removida da disponibilidade)
- [ ] Direitos de conteúdo: Sim

---

## 5. Quando religar o IAP (v1.5+)

Some com o "não se aplica" de várias linhas acima. O que volta a valer:

- **3.1.2(c)**: a tela de compra precisa de preço, duração, renovação automática e **links funcionais de EULA e privacidade** — o `PaywallDrawer` já tem todos (`paywall-drawer.tsx:272-281`, `:338-340`, `:346`, `:355`), incluindo **Restaurar compras** (`:325-333`).
- **Ficha de privacidade**: acrescentar **Compras → Histórico de compras**.
- **Trader status** deixa de ser opcional na UE.
- **Descrição e screenshots** precisam indicar a compra (2.3.2).
- Testar em **sandbox com conta nova** — foi o cenário exato da rejeição de 26/08.
