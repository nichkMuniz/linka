/**
 * Página de compartilhamento — Open Graph por conteúdo + landing de instalação.
 *
 * PARA QUE SERVE
 * O app é uma SPA: o HTML servido é uma casca vazia e o conteúdo só aparece
 * depois do JavaScript rodar. Os crawlers que geram a pré-visualização de link
 * (WhatsApp, iMessage, Telegram, Facebook, Slack, Discord) NÃO executam
 * JavaScript — então um link compartilhado apareceria como URL crua, sem
 * imagem, sem título. Esta função responde no lugar da SPA em `/post/:id` e
 * `/usuario/:id` devolvendo HTML já com as meta tags preenchidas.
 *
 * E TAMBÉM é a página que o usuário SEM o app instalado vê ao tocar no link:
 * mostra a prévia do conteúdo e os botões de abrir/baixar.
 *
 * COMO O LINK CHEGA AQUI (e por que existe o botão "Abrir no app")
 *   • Safari, iMessage, Notas → o iOS resolve o Universal Link e abre o app
 *     direto; esta página nem chega a ser exibida.
 *   • WhatsApp, Instagram → abrem o link no navegador EMBUTIDO deles, onde o
 *     Universal Link frequentemente não dispara. Aí esta página aparece, e o
 *     botão "Abrir no LinKa" usa o custom scheme (`com.linka.meuapp://`), que
 *     funciona de dentro desses navegadores.
 *   • Sem o app instalado → botão da App Store.
 *
 * Não há redirecionamento automático de propósito: disparar o custom scheme
 * sozinho mostra um alerta de erro do iOS para quem NÃO tem o app — que é a
 * maioria enquanto a base de instalação é pequena. O Universal Link já cobre
 * o caminho automático de quem tem o app.
 *
 * SEGURANÇA / PRIVACIDADE
 * Usa a chave ANÔNIMA do Supabase de propósito: a RLS é aplicada como para
 * qualquer visitante deslogado. Post de perfil privado
 * (`hide_posts_from_non_followers`) simplesmente não é retornado e a página cai
 * na prévia genérica — conteúdo privado nunca vaza para a pré-visualização de
 * um grupo de WhatsApp. Nunca usar a service role key aqui.
 *
 * Runtime Edge: sem dependências, só `fetch` e as APIs Web padrão.
 */

import {
  APP_STORE_ID,
  APP_STORE_URL,
  APP_URL_SCHEME,
  SHARE_BASE_URL,
} from "../shared/share-config";

export const config = { runtime: "edge" };

const SITE_NAME = "LinKa";

/** Imagem usada quando o conteúdo não tem foto (ou não pôde ser lido). */
const DEFAULT_OG_IMAGE = "/AppIcon-opaque-1024.png";

/** Prévia fica em cache na CDN: o crawler do WhatsApp bate várias vezes. */
const CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=86400";

type Lang = "pt" | "en";

const COPY = {
  pt: {
    genericTitle: `${SITE_NAME} — rede social fitness`,
    genericDescription:
      "Acompanhe seus treinos, metas e a evolução de quem treina com você.",
    postFallbackTitle: "Publicação no LinKa",
    profileFallbackTitle: "Perfil no LinKa",
    postBy: (name: string) => `${name} publicou no LinKa`,
    profileOf: (name: string) => `${name} no LinKa`,
    openInApp: "Abrir no LinKa",
    getApp: "Baixar na App Store",
    tagline: "Treine com quem te motiva.",
    notInstalled: "Ainda não tem o app? Baixe grátis na App Store.",
  },
  en: {
    genericTitle: `${SITE_NAME} — the fitness social network`,
    genericDescription:
      "Track your workouts, goals and the progress of everyone training with you.",
    postFallbackTitle: "A post on LinKa",
    profileFallbackTitle: "A profile on LinKa",
    postBy: (name: string) => `${name} posted on LinKa`,
    profileOf: (name: string) => `${name} on LinKa`,
    openInApp: "Open in LinKa",
    getApp: "Download on the App Store",
    tagline: "Train with the people who push you.",
    notInstalled: "Don't have the app yet? Download it free on the App Store.",
  },
} as const;

/** PT quando o Accept-Language pedir português; EN em qualquer outro caso. */
function pickLang(request: Request): Lang {
  const header = request.headers.get("accept-language") ?? "";
  return /(^|,|\s)pt\b/i.test(header) ? "pt" : "en";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function truncate(value: string, max: number): string {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`;
}

/** Só http(s) — impede `javascript:` vindo de uma coluna do banco. */
function safeImageUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? value : null;
  } catch {
    return null;
  }
}

function supabaseEnv(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
  return url && key ? { url: url.replace(/\/+$/, ""), key } : null;
}

/**
 * Consulta a REST do Supabase com a anon key. Devolve `[]` em qualquer falha —
 * a página SEMPRE responde 200 com a prévia genérica em vez de quebrar o link.
 */
async function query<T>(table: string, params: string): Promise<T[]> {
  const env = supabaseEnv();
  if (!env) return [];

  try {
    const response = await fetch(`${env.url}/rest/v1/${table}?${params}`, {
      headers: {
        apikey: env.key,
        Authorization: `Bearer ${env.key}`,
        Accept: "application/json",
      },
      // Não deixa uma lentidão do banco segurar o crawler: preview vazia é
      // melhor que timeout, porque o WhatsApp cacheia o resultado da 1ª visita.
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? (data as T[]) : [];
  } catch {
    return [];
  }
}

type ProfileRow = {
  user_id: string;
  nickname: string | null;
  handle: string | null;
  photo: string | null;
  bio: string | null;
};

type PostRow = {
  id: string;
  user_id: string;
  description: string | null;
  photo: string | null;
  photos: unknown;
};

function displayName(profile: ProfileRow | null, lang: Lang): string {
  if (!profile) return SITE_NAME;
  const handle = profile.handle ? `@${profile.handle}` : null;
  return profile.nickname?.trim() || handle || COPY[lang].genericTitle;
}

/** Metadados da prévia. */
type Preview = {
  title: string;
  description: string;
  image: string | null;
  ogType: "article" | "profile" | "website";
};

async function buildPostPreview(id: string, lang: Lang): Promise<Preview> {
  const copy = COPY[lang];
  const [post] = await query<PostRow>(
    "posts",
    `id=eq.${encodeURIComponent(id)}&select=id,user_id,description,photo,photos&limit=1`,
  );

  if (!post) {
    return {
      title: copy.postFallbackTitle,
      description: copy.genericDescription,
      image: null,
      ogType: "article",
    };
  }

  const [author] = await query<ProfileRow>(
    "profiles",
    `user_id=eq.${encodeURIComponent(post.user_id)}&select=user_id,nickname,handle,photo,bio&limit=1`,
  );

  // `photos` é um array jsonb; `photo` é a foto principal dos posts antigos.
  const firstOfArray = Array.isArray(post.photos) ? post.photos[0] : null;
  const image = safeImageUrl(post.photo) ?? safeImageUrl(firstOfArray);

  return {
    title: copy.postBy(displayName(author ?? null, lang)),
    description: post.description?.trim()
      ? truncate(post.description, 200)
      : copy.genericDescription,
    image,
    ogType: "article",
  };
}

async function buildProfilePreview(id: string, lang: Lang): Promise<Preview> {
  const copy = COPY[lang];
  const [profile] = await query<ProfileRow>(
    "profiles",
    `user_id=eq.${encodeURIComponent(id)}&select=user_id,nickname,handle,photo,bio&limit=1`,
  );

  if (!profile) {
    return {
      title: copy.profileFallbackTitle,
      description: copy.genericDescription,
      image: null,
      ogType: "profile",
    };
  }

  return {
    title: copy.profileOf(displayName(profile, lang)),
    description: profile.bio?.trim()
      ? truncate(profile.bio, 200)
      : copy.genericDescription,
    image: safeImageUrl(profile.photo),
    ogType: "profile",
  };
}

function renderPage(opts: {
  lang: Lang;
  preview: Preview;
  canonicalUrl: string;
  appSchemeUrl: string;
  imageUrl: string;
}): string {
  const { lang, preview, canonicalUrl, appSchemeUrl, imageUrl } = opts;
  const copy = COPY[lang];

  const title = escapeHtml(preview.title);
  const description = escapeHtml(preview.description);
  const image = escapeHtml(imageUrl);
  const canonical = escapeHtml(canonicalUrl);

  return `<!doctype html>
<html lang="${lang === "pt" ? "pt-BR" : "en"}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title}</title>
<meta name="description" content="${description}">
<link rel="canonical" href="${canonical}">

<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:type" content="${preview.ogType}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:image" content="${image}">
<meta property="og:url" content="${canonical}">
<meta property="og:locale" content="${lang === "pt" ? "pt_BR" : "en_US"}">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
<meta name="twitter:image" content="${image}">

<!-- Smart App Banner: no Safari, abre o app direto se estiver instalado. -->
<meta name="apple-itunes-app" content="app-id=${APP_STORE_ID}, app-argument=${canonical}">

<meta name="theme-color" content="#0e0d14">
<link rel="icon" href="/logo.png" type="image/png">
<style>
  *{box-sizing:border-box}
  body{margin:0;min-height:100dvh;display:flex;align-items:center;justify-content:center;
       padding:max(1.5rem,env(safe-area-inset-top)) max(1.25rem,env(safe-area-inset-right))
               max(1.5rem,env(safe-area-inset-bottom)) max(1.25rem,env(safe-area-inset-left));
       background:radial-gradient(120% 80% at 50% 0%,#1e1c28 0%,#0e0d14 60%);
       color:#fff;font-family:-apple-system,BlinkMacSystemFont,"Inter","Segoe UI",system-ui,sans-serif;
       -webkit-font-smoothing:antialiased}
  .card{width:100%;max-width:26rem;text-align:center}
  .logo{height:2.25rem;margin:0 auto 1.75rem;display:block}
  .cover{width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:1.5rem;
         border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05);margin-bottom:1.5rem}
  h1{font-size:1.25rem;line-height:1.35;margin:0 0 .5rem;font-weight:650}
  p.desc{font-size:.9375rem;line-height:1.5;color:rgba(255,255,255,.62);margin:0 0 2rem}
  a.btn{display:block;padding:.9375rem 1.25rem;border-radius:1rem;font-size:1rem;font-weight:600;
        text-decoration:none;margin-bottom:.75rem;transition:opacity .15s}
  a.btn:active{opacity:.75}
  a.primary{background:linear-gradient(135deg,#5b8cff,#9d6bff);color:#fff;
            box-shadow:0 8px 24px -8px rgba(91,140,255,.6)}
  a.secondary{background:rgba(255,255,255,.08);color:#fff;border:1px solid rgba(255,255,255,.14)}
  p.hint{font-size:.8125rem;color:rgba(255,255,255,.4);margin:1.25rem 0 0}
  #open-app{display:none}
</style>
</head>
<body>
  <main class="card">
    <img class="logo" src="/logo-branco.png" alt="${SITE_NAME}">
    <img class="cover" src="${image}" alt="" onerror="this.style.display='none'">
    <h1>${title}</h1>
    <p class="desc">${description}</p>

    <a class="btn primary" id="open-app" href="${escapeHtml(appSchemeUrl)}">${copy.openInApp}</a>
    <a class="btn secondary" href="${APP_STORE_URL}">${copy.getApp}</a>

    <p class="hint">${copy.notInstalled}</p>
  </main>
  <script>
    // "Abrir no app" só faz sentido no iOS — em qualquer outro lugar o botão
    // levaria a um erro de "endereço inválido". Fora do iOS resta a App Store.
    if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
      document.getElementById('open-app').style.display = 'block';
    }
  </script>
</body>
</html>`;
}

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const lang = pickLang(request);

  // O `vercel.json` reescreve /post/:id e /usuario/:id para cá passando type+id.
  // O fallback lê do próprio caminho para a função continuar testável direto.
  const type = url.searchParams.get("type");
  const id = url.searchParams.get("id");

  let preview: Preview;
  let canonicalPath: string;

  if (type === "post" && id) {
    preview = await buildPostPreview(id, lang);
    canonicalPath = `/post/${encodeURIComponent(id)}`;
  } else if (type === "profile" && id) {
    preview = await buildProfilePreview(id, lang);
    canonicalPath = `/usuario/${encodeURIComponent(id)}`;
  } else {
    preview = {
      title: COPY[lang].genericTitle,
      description: COPY[lang].genericDescription,
      image: null,
      ogType: "website",
    };
    canonicalPath = "/";
  }

  const canonicalUrl = `${SHARE_BASE_URL}${canonicalPath}`;

  return new Response(
    renderPage({
      lang,
      preview,
      canonicalUrl,
      // O custom scheme espelha o caminho: com.linka.meuapp://post/123
      appSchemeUrl: `${APP_URL_SCHEME}:/${canonicalPath}`,
      // OG image precisa ser absoluta — crawler não resolve caminho relativo.
      imageUrl: preview.image ?? `${SHARE_BASE_URL}${DEFAULT_OG_IMAGE}`,
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": CACHE_CONTROL,
      },
    },
  );
}
