# 16 — Segurança

Resultado da auditoria de **2026-07-13** e o que precisa ser feito no painel (o que não dá para corrigir só com código).

---

## 1. Chaves vazadas no histórico do Git — AÇÃO MANUAL OBRIGATÓRIA

O `.env` está no `.gitignore` hoje, mas foi commitado no passado e **continua recuperável no histórico** do repositório `nichkMuniz/ritmofit`:

| Commit | Segredo exposto |
|---|---|
| `d8a397e` | `SUPABASE_SERVICE_ROLE_KEY` |
| `33c0228` | `VITE_SPOTIFY_CLIENT_SECRET` |

O commit `331952f` ("Remove arquivos sensíveis") apagou o arquivo, mas `git show d8a397e:.env` ainda devolve a chave. A **service role key ignora toda a RLS** — com ela, lê-se e altera-se o banco inteiro (DMs, dados de saúde, tudo).

### Passos, nesta ordem

1. **Rotacionar a service role key** — Supabase → Settings → API → *Reset service_role key*.
   Depois atualizar onde ela é usada: `.env` local, env vars do Netlify, secrets das Edge Functions.
2. **Revogar o client secret do Spotify** — Spotify Developer Dashboard → *Reset client secret* (a integração nem existe mais no código).
3. **Só então limpar o histórico:**
   ```sh
   pip install git-filter-repo
   git filter-repo --path .env --invert-paths
   git push --force --all
   ```
   Limpar o histórico **sem rotacionar não resolve** — as chaves já podem ter sido copiadas.
4. Se o repositório for/tiver sido **público**, considere as chaves como comprometidas de fato (bots varrem o GitHub em minutos).

---

## 2. Correções aplicadas no código

| # | Problema | Correção |
|---|---|---|
| 1 | Policy de `profiles` com `FOR UPDATE USING (true)` → qualquer autenticado editava o perfil de qualquer outro | `profiles_update_own` + trigger `freeze_is_verified` |
| 2 | `hide_posts_from_non_followers` / `hide_follow_lists` só no cliente → bypass trivial pela API | Viraram RLS em `posts`, `following`, `followers`; contadores via `get_profile_counts()` |
| 3 | `messages` / `notifications` sem policy versionada | RLS explícita (só participantes / só destinatário) |
| 4 | Mídia de DM no bucket **público** `posts`, URL permanente e caminho previsível | Bucket **privado** `chat-media` + signed URL de 1 h |
| 5 | Edge function `proxy-exercise-image`: SSRF (fetch de qualquer URL) + path traversal no `wgerId`, gravando com service role | **Função removida** (era código morto — nenhum caller) |
| 6 | `send-push-notification` aceitava POST anônimo → push forjado para qualquer usuário | Exige header `x-webhook-secret` (`PUSH_WEBHOOK_SECRET`) |
| 7 | `reengagement-push` com segredo opcional | Segredo obrigatório |
| 8 | `/api/link-preview`: SSRF parcial (não bloqueava `169.254.169.254`, `172.16/12`, IPv6, `file:`, redirects internos) | Guard completo + redirects seguidos manualmente e revalidados |
| 9 | `Browser.open` / `<a href>` com URL crua do usuário (`business_website`, `external_link`, `link_url`) → `javascript:` e phishing | `client/lib/safe-url.ts`: só http(s), validado na exibição **e** ao salvar |
| 10 | Express com `cors()` aberto | Allowlist de origens |
| 11 | Migrações fora do Git (`*.sql` no `.gitignore`) | Versionadas — são a fonte de verdade da RLS |

---

## 3. Checklist de deploy (fazer junto com o próximo release)

- [ ] Rodar `docs/migrations/20260713-security-hardening.sql` no SQL Editor do Supabase
- [ ] Conferir que o bucket `chat-media` aparece como **privado** em Storage
- [ ] Criar o secret `PUSH_WEBHOOK_SECRET` (Edge Functions → Secrets) com um valor aleatório
- [ ] Editar o Database Webhook de `notifications` → adicionar o header `x-webhook-secret: <valor>`
- [ ] Criar/conferir o secret `REENGAGEMENT_CRON_SECRET` e o header `x-cron-secret` no job do pg_cron
- [ ] Redeploy das funções `send-push-notification` e `reengagement-push`
- [ ] **Deletar** a função `proxy-exercise-image` no painel (foi removida do repo, mas a versão deployada continua no ar e ainda é explorável)
- [ ] Conferir que toda tabela tem RLS ligada:
      `select tablename, rowsecurity from pg_tables where schemaname = 'public' and rowsecurity = false;`

---

## 4. Regras permanentes

- **Nunca** prefixar segredo com `VITE_` — tudo que tem esse prefixo entra no bundle e é legível no binário do iOS. A anon key é pública por design; quem protege os dados é a RLS.
- **Toda tabela nova nasce com RLS ligada** e com a policy no arquivo de migração (versionado).
- Toda URL vinda de outro usuário passa por `safeExternalUrl()` antes de virar `href` ou `Browser.open`.
- Toda Edge Function com `verify_jwt` desligado precisa de um segredo compartilhado no header.
- Mídia privada (DM) nunca vai para bucket público.
