# Screenshots da App Store

**São capturas do app de verdade**, não mockups. Um Chromium headless abre o
app rodando em `localhost:8080`, navega até cada tela e fotografa. O que sai é a
árvore de componentes real, com o CSS real, os textos reais e os ícones reais.

Sem legenda de marketing: só a tela.

```
npx vite --port 8080                          # terminal 1
node scripts/appstore/.tooling/capture.mjs    # terminal 2
node scripts/appstore/verify.mjs              # confere dimensão e ausência de alfa
node scripts/appstore/preview.mjs iphone-6.5 420
```

## Como funciona sem login e sem tocar na base

Duas coisas, ambas em `.tooling/capture.mjs`:

1. **Sessão falsa** injetada no `localStorage` antes de a página carregar. O
   app se considera autenticado.
2. **Todo o domínio do Supabase é interceptado** pelo Playwright e respondido
   por `.tooling/fixtures.mjs` — um banco fictício em memória. Nenhum byte sai
   da máquina; a base de produção nunca é lida nem escrita.

O interceptador implementa um PostgREST mínimo (filtros `eq`/`in`/`is`/`gt`…,
`order`, `limit`, o header `Content-Range` das contagens e o `Accept:
vnd.pgrst.object` do `.single()`). Sem isso, telas como o Perfil quebravam com
"Perfil não encontrado" ou mostravam contadores zerados.

## O que sai

| Pasta | Dimensão | Chrome |
|---|---|---|
| `iphone-6.5/` | 1242 × 2688 | Bottom nav de 4 itens |
| `ipad-13/` | 2064 × 2752 | Sidebar |

`viewport × deviceScaleFactor` dá o pixel final exato — não há
redimensionamento depois, então não há perda.

**Os dois conjuntos são obrigatórios**: o app declara
`TARGETED_DEVICE_FAMILY = "1,2"`. O chrome sai diferente sozinho, porque é o
app decidindo — o `AppLayout` troca o bottom nav pela sidebar no breakpoint
`md`, e o iPad em retrato tem 1024pt.

## Conteúdo das telas

O feed mostra **posts de resumo de treino** — carga, séries, volume e duração —
para o revisor da Apple entender do que o app trata sem precisar entrar em nada.
Os avatares são **círculos com as iniciais**, gerados em `capture.mjs` e servidos
como se fossem a foto de perfil (o `UserAvatar` do app só conhece URL).

O card do post é gerado pelo script, não pelo app: é o único pedaço que não sai
do LinKa rodando. Ele reproduz o layout do card real (marca, rótulo em destaque,
número grande, subtítulo e três chips) e entra como **conteúdo** dentro de um
screenshot cuja interface é verdadeira — como seria a foto de um usuário.

## As cinco telas

1. **Metas** — sequência, rotina da semana e metas
2. **Treino** — sessão em andamento (chegamos nela clicando em "Iniciar treino")
3. **Feed** — os seis incentivos
4. **Perfil** — identidade e publicações
5. **Comunidade** — mensagens

Telas atrás de interação são alcançadas por cliques declarados em `SCREENS.acoes`.

## Por que isto vale mais que mockup

Além de ser fiel por construção, a captura **verifica o recorte do v1**: as
screenshots mostram uma rotina só em "Suas rotinas", perfil com a aba Posts
sozinha, Comunidade sem barra de abas e nav de 4 itens sem botão colorido. Se
alguém religar uma flag sem querer, aparece aqui.

Foi assim que se viu que os rótulos reais da sidebar são "Home" e "Nova" — o
mockup anterior chutava "Início" e "Publicar".

## Limitações conhecidas

- O card de resumo dentro do post é desenhado pelo script (ver acima), não
  exportado do app.
- **Os contadores da sessão de treino saem zerados** (duração, volume, séries).
  O script preenche KG e REPS, mas o clique em "Marcar série como concluída"
  não fecha a série no headless — provavelmente depende de gesto de toque real.
  A tela continua verdadeira; só não mostra progresso acumulado.
- Fotos de post e avatares são **gradientes gerados**, nunca imagem de pessoa
  real (`placeholder()` em `capture.mjs`).
- `subscription-review-640x920.png` é a screenshot de review do IAP e está
  **obsoleta** enquanto `FEATURES.iap` estiver desligada. Não anexar.

## Ferramentas

Playwright e sharp vivem em `scripts/appstore/.tooling/`, com `package.json`
próprio e fora do versionamento. É de propósito: dependência nova no
`package.json` do app exigiria regenerar os DOIS lockfiles (npm para o Appflow,
pnpm para a Vercel).

```
cd scripts/appstore/.tooling && npm install && npx playwright install chromium
```
