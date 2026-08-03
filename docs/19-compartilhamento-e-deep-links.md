# 19 — Compartilhamento e Deep Links

Como um conteúdo do LinKa vira um link, o que acontece quando alguém toca nesse link, e o que precisa estar hospedado para o ciclo fechar.

---

## Visão geral do ciclo

```
Usuário toca em "Compartilhar"
      ↓
ShareDrawer monta a URL (https://<domínio>/post/<id>)
      ↓
Share sheet nativa do iOS → WhatsApp / Instagram / etc.
      ↓
┌─ Amigo TEM o app ────────────────────────────────────────────┐
│  Safari / iMessage → Universal Link → abre no app na tela     │
│  WhatsApp / Instagram (navegador embutido) → landing page →   │
│    botão "Abrir no LinKa" (custom scheme) → abre no app       │
└───────────────────────────────────────────────────────────────┘
┌─ Amigo NÃO tem o app ────────────────────────────────────────┐
│  landing page com a prévia do conteúdo → botão App Store      │
└───────────────────────────────────────────────────────────────┘
```

---

## Fonte única do domínio

`shared/share-config.ts` concentra domínio, custom scheme, ID da App Store, construtores de URL e o parser de deep link. É importado pelo client (via `client/lib/share-url.ts`), pelo `server/` e pela função serverless em `api/`.

**Trocar de domínio = mudar `SHARE_DOMAIN` em `shared/share-config.ts`.** Dois arquivos não conseguem importar dele e precisam ser editados à mão na mesma troca:

| Arquivo | O que mudar |
|---|---|
| `ios/App/App/App.entitlements` | `applinks:<domínio>` — listar apex **e** `www` |
| `public/.well-known/apple-app-site-association` | `appIDs` = `<TeamID>.com.linka.meuapp` |

Consumidores que já derivam automaticamente: os links do `ShareDrawer`, o rodapé desenhado nos cards de imagem (`client/lib/canvas-card.ts`), a allowlist de CORS da API (`server/index.ts`), a URL da App Store no `App.tsx` e a landing page (`api/share.ts`).

---

## Saída — gerar o link

| Componente | Arquivo | Onde é usado |
|---|---|---|
| `ShareDrawer` | `client/components/shared/share-drawer.tsx` | Feed (`Index.tsx`), `PostDetail.tsx`, `Profile.tsx` |
| `SendToFriendDrawer` | `client/components/shared/send-to-friend-drawer.tsx` | Envio interno por DM — não usa link, não depende de nada aqui |

URLs geradas:

| Conteúdo | URL |
|---|---|
| Post | `https://<domínio>/post/<uuid>` |
| Perfil | `https://<domínio>/usuario/<user_id>` |

> Shots e Flows **não têm** compartilhamento externo hoje: só envio interno por DM. Não existe rota individual (`/shots/:id`) para eles.

---

## Entrada — o link abrindo o app

### Universal Link (caminho principal)

Requer as três pontas alinhadas:

1. **Entitlement** — `com.apple.developer.associated-domains` = `applinks:<domínio>` em `App.entitlements`
2. **AASA hospedado** — `https://<domínio>/.well-known/apple-app-site-association`, servido por HTTPS, **sem redirect**, com `Content-Type: application/json` e sem extensão `.json`
3. **`continueUserActivity`** — já implementado em `AppDelegate.swift`, repassa para o `ApplicationDelegateProxy` do Capacitor

Caminhos declarados no AASA: `/post/*`, `/usuario/*`, `/comunidade`.

> A Apple busca o AASA pela CDN dela **no momento da instalação** do app. Mudanças no arquivo podem levar até 24 h para valer em aparelhos já instalados. Para testar sem esperar, use `applinks:<domínio>?mode=developer` no entitlement e ligue *Ajustes → Desenvolvedor → Associated Domains Development*.

### Custom scheme (plano B)

`com.linka.meuapp://post/<id>` — declarado em `Info.plist` (`CFBundleURLSchemes`).

Existe porque navegadores embutidos (o do WhatsApp, o do Instagram) frequentemente não disparam Universal Links. É o que o botão "Abrir no LinKa" da landing page aciona.

**Atenção ao formato:** no custom scheme o primeiro segmento do caminho vira o **host** da URL, não o pathname:

| URL | `host` | `pathname` |
|---|---|---|
| `https://linkafit.com.br/post/123` | `linkafit.com.br` | `/post/123` |
| `com.linka.meuapp://post/123` | `post` | `/123` |

`parseDeepLinkUrl` reconcatena o host ao caminho nesse caso. Ler `pathname` direto navegava para `/123` e caía no NotFound.

### `DeepLinkHandler` (`client/App.tsx`)

Escuta `appUrlOpen` e resolve o destino:

| Situação | Comportamento |
|---|---|
| Hash contém `type=recovery` | Navega para `/login` → `onAuthStateChange` dispara `PASSWORD_RECOVERY` |
| Caminho contém `login-callback` | Ignora — tratado na tela de Login |
| Host http(s) fora do nosso domínio | Ignora — evita redirect controlado por terceiro dentro do app |
| Usuário logado | Navega para a rota, preservando query string e fragmento |
| Usuário deslogado | Grava em `sessionStorage.deeplink_redirect` e vai para `/login` (consumido em `Login.tsx`) |

**Cold start:** o plugin emite `appUrlOpen` com `retainUntilConsumed: true`, ou seja, o evento é entregue no instante em que o listener monta — quando a sessão do Supabase ainda está sendo restaurada e `user` ainda é `null`. Por isso o destino fica num estado pendente e só é resolvido depois que `loading` vira `false`; decidir antes mandava um usuário **logado** para a tela de login.

---

## Prévia do link (Open Graph) — `api/share.ts`

O app é uma SPA: o HTML servido é uma casca vazia e o conteúdo só existe depois do JavaScript. Os crawlers de pré-visualização (WhatsApp, iMessage, Telegram, Facebook, Slack, Discord) **não executam JavaScript** — sem esta função, todo link compartilhado apareceria como URL crua, sem imagem e sem título.

A função roda no **runtime Edge da Vercel**, sem dependências, e responde no lugar da SPA nas rotas de compartilhamento (reescrita configurada em `vercel.json`).

| Rota pública | Reescrita para |
|---|---|
| `/post/:id` | `/api/share?type=post&id=:id` |
| `/usuario/:id` | `/api/share?type=profile&id=:id` |
| resto | SPA (inclui `/reset-password`, que chega por e-mail) |

**O que a página entrega:**

- `og:title`, `og:description`, `og:image`, `og:url`, `og:type`, `twitter:card` preenchidos com o conteúdo real
- `apple-itunes-app` (Smart App Banner) — no Safari abre o app direto se estiver instalado
- Prévia visual do conteúdo + botão "Abrir no LinKa" (custom scheme, só no iOS) + botão da App Store
- PT ou EN conforme o header `Accept-Language`

**Sem redirecionamento automático, de propósito.** Disparar o custom scheme sozinho mostra um alerta de erro do iOS para quem **não** tem o app — que é a maioria enquanto a base de instalação é pequena. O Universal Link já cobre o caminho automático de quem tem o app instalado.

### Privacidade

A função usa a **chave anônima** do Supabase. A RLS é aplicada exatamente como para um visitante deslogado: um post de perfil com `hide_posts_from_non_followers` simplesmente não é retornado e a página cai na prévia genérica. Conteúdo privado nunca vaza para a pré-visualização num grupo de WhatsApp.

> **Nunca** usar a service role key nesta função.

Qualquer falha (env ausente, banco lento, id inexistente) devolve **200 com a prévia genérica** em vez de erro — um link quebrado no WhatsApp é pior que uma prévia sem detalhe, e o crawler cacheia o resultado da primeira visita.

### Variáveis de ambiente na Vercel

| Variável | Valor |
|---|---|
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_ANON_KEY` | chave `anon` (pública) |

Os nomes com prefixo `VITE_` também são aceitos como fallback.

> A `api/delete-auth-user.ts` exige uma variável a mais — ver a seção de exclusão de conta abaixo.

---

## Exclusão de conta — `api/delete-auth-user.ts`

Não é compartilhamento, mas vive no mesmo servidor e depende do mesmo domínio, então está documentado aqui.

Apagar um usuário do Supabase Auth exige a **service role key**, que nunca pode viajar para o app — por isso a última etapa de "Excluir minha conta" passa por uma função no servidor. O cliente (`deleteAllUserDataDb`, em `ritmofit-db.ts`) apaga todas as linhas do usuário nas tabelas e então chama `POST https://<domínio>/api/delete-auth-user`.

**Autorização** — a chave é irrestrita, então são três checagens encadeadas:

1. header `Authorization: Bearer <access_token>` presente
2. o Supabase confirma a identidade do portador do token
3. o `userId` do corpo é **exatamente** o dono do token

Sem a checagem 3, qualquer usuário autenticado apagaria a conta de outro.

**CORS** — a chamada sai do WebView com origem `capacitor://localhost` e é cross-origin de verdade. A função responde ao preflight `OPTIONS` e ecoa a origem quando ela está na allowlist (origens do domínio + `capacitor://localhost` + `ionic://localhost` + localhost em dev).

### A URL precisa ser absoluta

Dentro do WebView do Capacitor a base é `capacitor://localhost`, então **um caminho relativo nunca sai do aparelho**. Ele é resolvido pelo `CapacitorRouter`, que para qualquer caminho **sem extensão de arquivo** devolve o `index.html` — com HTTP **200**.

Foi exatamente esse o bug da versão anterior, que chamava `/.netlify/functions/delete-auth-user`: o `response.ok` dava `true`, nenhum erro era lançado, e a conta em `auth.users` sobrevivia em silêncio mesmo com todos os dados do usuário já apagados. Toda chamada a API própria a partir do app **tem que usar `SHARE_BASE_URL`**.

### Variável de ambiente adicional

| Variável | Onde |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel — **somente** nesta função; nunca em código de client |

> A função Netlify equivalente (`netlify/functions/delete-auth-user.ts`) ficou órfã depois desta migração — nada mais a chama. Pode ser removida junto com o `netlify.toml` quando o DNS estiver 100% na Vercel.

---

## Checklist de publicação do domínio

- [ ] Domínio registrado e apontado para a Vercel
- [ ] `SHARE_DOMAIN` atualizado em `shared/share-config.ts`
- [ ] `applinks:` (apex + www) atualizado em `App.entitlements`
- [ ] `appIDs` do AASA com o **Team ID real** da conta Apple Developer
- [ ] `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` configuradas na Vercel
- [ ] `https://<domínio>/.well-known/apple-app-site-association` responde **200, sem redirect**, com `Content-Type: application/json`
- [ ] Prévia validada no [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) e enviando o link para si mesmo no WhatsApp
- [ ] `pnpm build` → `npx cap sync ios` → build no Appflow → testar em device via TestFlight
- [ ] App instalado: tocar num link em Safari e em Notas abre o app na tela certa
- [ ] App desinstalado: o mesmo link mostra a landing com a prévia e o botão da App Store
- [ ] **Excluir conta testado de ponta a ponta** com uma conta descartável: os dados somem **e** o e-mail volta a estar livre para um novo cadastro (é o que prova que `auth.users` foi apagado)

> O `APP_STORE_URL` só resolve depois do app aprovado e publicado. Antes disso, o botão leva a uma página de erro da App Store — é esperado.
