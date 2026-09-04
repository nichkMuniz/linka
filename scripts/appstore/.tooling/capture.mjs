// Captura as screenshots da App Store dirigindo o APP DE VERDADE num Chromium
// headless. Não é mockup: é a árvore de componentes real, com o CSS real.
//
//   1) npx vite --port 8080
//   2) node scripts/appstore/.tooling/capture.mjs
//
// Como funciona sem login: uma sessão falsa vai para o localStorage e TODA
// chamada ao domínio do Supabase é interceptada e respondida por
// `fixtures.mjs`. Nenhum byte sai da máquina e a base real nunca é tocada.

import { chromium } from "playwright";
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { REF, SESSION, TABLES } from "./fixtures.mjs";

const BASE = "http://localhost:8080";
const OUT = "../../../docs/appstore";

/**
 * Tamanhos exatos que a App Store exige. `viewport × deviceScaleFactor` dá o
 * pixel final — sem redimensionar depois, então não há perda.
 */
const DEVICES = [
  // iPhone 6.9" = 1320x2868 (16/17 Pro Max), que é 440x956 @3x.
  // É o slot PRINCIPAL de iPhone na App Store Connect hoje; o de 6.5" é
  // aceito só como alternativa quando este não existe.
  { id: "iphone-6.9", w: 440, h: 956, dsf: 3, out: [1320, 2868] },
  // iPhone 6.5" = 1242x2688 (11 Pro Max / XS Max), que é 414x896 @3x.
  { id: "iphone-6.5", w: 414, h: 896, dsf: 3, out: [1242, 2688] },
  { id: "ipad-13", w: 1032, h: 1376, dsf: 2, out: [2064, 2752] },
];

/**
 * `acoes` são cliques executados depois de a tela carregar. É como chegamos em
 * telas que só existem atrás de uma interação — a sessão de treino, que é o
 * coração do app, não tem rota própria.
 */
const SCREENS = [
  { id: "1-metas", path: "/metas" },
  {
    id: "2-treino",
    path: "/metas",
    acoes: ["Iniciar treino"],
    espera: 3500,
    series: [[60, 12], [70, 10], [80, 8]],
  },
  { id: "3-feed", path: "/", wait: "Seguindo" },
  { id: "4-perfil", path: "/perfil" },
  { id: "5-comunidade", path: "/comunidade" },
];

const FONTE = "Segoe UI, Arial, sans-serif";
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;");

/**
 * Avatar com as INICIAIS sobre uma cor sólida — nunca foto de pessoa real.
 * O app pede isto como se fosse a foto de perfil (ver `av()` em fixtures).
 */
async function avatarIniciais(iniciais, cor) {
  const S = 240;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">
    <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#${cor}"/>
      <stop offset="100%" stop-color="#${cor}" stop-opacity="0.72"/>
    </linearGradient></defs>
    <rect width="${S}" height="${S}" fill="url(#g)"/>
    <text x="${S / 2}" y="${S / 2 + 34}" font-family="${FONTE}" font-size="96"
          font-weight="700" fill="#ffffff" text-anchor="middle">${esc(iniciais)}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/**
 * Card de resumo de treino — a imagem que o app gera e publica junto do post.
 * Reproduz o layout do card real: marca no topo, rótulo em destaque, o número
 * grande, o subtítulo e a fileira de três chips (duração, séries, volume).
 *
 * É CONTEÚDO dentro de um screenshot real, como seria a foto de um usuário.
 * A interface ao redor é o app de verdade.
 */
const CARDS = {
  "camila-pernas": { acento: "#fbbf24", rotulo: "SEU TREINO EM NÚMEROS", numero: "143 kg", sub: "Cadeira extensora", chips: ["1h 6m", "21 séries", "24,4 t"], de: "#3a2418", para: "#140f0c" },
  "rafael-costas": { acento: "#38bdf8", rotulo: "SEU TREINO EM NÚMEROS", numero: "1h 07m", sub: "Costas e bíceps", chips: ["18 séries", "19,8 t", "70 kg"], de: "#16303f", para: "#0b1620" },
  "marina-ombros": { acento: "#e0457b", rotulo: "SEU TREINO EM NÚMEROS", numero: "12,6 t", sub: "Ombros e core", chips: ["52m", "15 séries", "22 kg"], de: "#3a1626", para: "#1a0c12" },
  "diego-peito": { acento: "#2dd4bf", rotulo: "SEU TREINO EM NÚMEROS", numero: "15,2 t", sub: "Peito e tríceps", chips: ["55m", "16 séries", "85 kg"], de: "#13322c", para: "#0a1a17" },
  "flow-1": { acento: "#a855f7", rotulo: "TREINO DE HOJE", numero: "Pernas", sub: "Camila", chips: [], de: "#2b1740", para: "#140b1e" },
  "flow-2": { acento: "#3b82f6", rotulo: "TREINO DE HOJE", numero: "Costas", sub: "Rafael", chips: [], de: "#152a45", para: "#0a1420" },
  "flow-3": { acento: "#10b981", rotulo: "TREINO DE HOJE", numero: "Peito", sub: "Diego", chips: [], de: "#123028", para: "#091814" },
  "flow-4": { acento: "#f97316", rotulo: "TREINO DE HOJE", numero: "Ombros", sub: "Larissa", chips: [], de: "#3a2312", para: "#1a1009" },
};

async function cardTreino(slug) {
  const c = CARDS[slug] ?? CARDS["camila-pernas"];
  const W = 1080, H = 1080;
  const chips = c.chips
    .map((txt, i) => {
      const cw = 250, gap = 22;
      const total = c.chips.length * cw + (c.chips.length - 1) * gap;
      const x = (W - total) / 2 + i * (cw + gap);
      return `<rect x="${x}" y="${H / 2 + 118}" width="${cw}" height="82" rx="41"
                fill="rgba(255,255,255,.09)" stroke="rgba(255,255,255,.14)"/>
              <text x="${x + cw / 2}" y="${H / 2 + 170}" font-family="${FONTE}" font-size="34"
                font-weight="600" fill="#ffffff" text-anchor="middle">${esc(txt)}</text>`;
    })
    .join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs><linearGradient id="bg" x1="20%" y1="0%" x2="80%" y2="100%">
      <stop offset="0%" stop-color="${c.de}"/><stop offset="100%" stop-color="${c.para}"/>
    </linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    <text x="${W / 2}" y="150" font-family="${FONTE}" font-size="42" font-weight="700"
          fill="rgba(255,255,255,.55)" text-anchor="middle" letter-spacing="2">LinKa</text>
    <text x="${W / 2}" y="${H / 2 - 92}" font-family="${FONTE}" font-size="34" font-weight="700"
          fill="${c.acento}" text-anchor="middle" letter-spacing="6">${esc(c.rotulo)}</text>
    <text x="${W / 2}" y="${H / 2 + 22}" font-family="${FONTE}" font-size="130" font-weight="700"
          fill="#ffffff" text-anchor="middle">${esc(c.numero)}</text>
    <text x="${W / 2}" y="${H / 2 + 82}" font-family="${FONTE}" font-size="40"
          fill="rgba(255,255,255,.6)" text-anchor="middle">${esc(c.sub)}</text>
    ${chips}
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/** Nome da tabela a partir da URL do PostgREST. */
function tabela(pathname) {
  return pathname.replace("/rest/v1/", "").split("?")[0];
}

/**
 * Um PostgREST mínimo, o bastante para o app não perceber a diferença.
 *
 * Sem isto o mock devolvia a tabela inteira para toda consulta, e qualquer
 * `.single()` — o perfil, por exemplo — recebia um array e quebrava com
 * "Perfil não encontrado".
 */
const PARAMS_RESERVADOS = new Set(["select", "order", "limit", "offset", "on_conflict"]);

function aplicaFiltros(linhas, url) {
  let out = [...linhas];

  for (const [coluna, bruto] of url.searchParams.entries()) {
    if (PARAMS_RESERVADOS.has(coluna)) continue;
    // `or=(a.eq.1,b.eq.2)` é complexo demais para valer a pena: deixamos passar.
    if (coluna === "or") continue;

    const i = bruto.indexOf(".");
    const op = i === -1 ? "eq" : bruto.slice(0, i);
    const valor = i === -1 ? bruto : bruto.slice(i + 1);
    const igual = (a, b) => String(a) === String(b);

    if (op === "eq") out = out.filter((r) => igual(r[coluna], valor));
    else if (op === "neq") out = out.filter((r) => !igual(r[coluna], valor));
    else if (op === "in") {
      const lista = valor.replace(/^\(|\)$/g, "").split(",").map((v) => v.replace(/^"|"$/g, ""));
      out = out.filter((r) => lista.some((v) => igual(r[coluna], v)));
    } else if (op === "is") {
      out = valor === "null" ? out.filter((r) => r[coluna] == null) : out.filter((r) => r[coluna] != null);
    } else if (op === "gte") out = out.filter((r) => r[coluna] >= valor);
    else if (op === "lte") out = out.filter((r) => r[coluna] <= valor);
    else if (op === "gt") out = out.filter((r) => r[coluna] > valor);
    else if (op === "lt") out = out.filter((r) => r[coluna] < valor);
  }

  const order = url.searchParams.get("order");
  if (order) {
    const [col, dir] = order.split(".");
    const desc = dir === "desc";
    out.sort((a, b) => {
      const x = a[col], y = b[col];
      if (x === y) return 0;
      return (x > y ? 1 : -1) * (desc ? -1 : 1);
    });
  }

  const limit = Number(url.searchParams.get("limit"));
  if (Number.isFinite(limit) && limit > 0) out = out.slice(0, limit);

  return out;
}

async function main() {
  const browser = await chromium.launch();
  const cacheImg = new Map();

  for (const dev of DEVICES) {
    mkdirSync(`${OUT}/${dev.id}`, { recursive: true });

    const ctx = await browser.newContext({
      viewport: { width: dev.w, height: dev.h },
      deviceScaleFactor: dev.dsf,
      locale: "pt-BR",
      colorScheme: "dark",
      isMobile: dev.id.startsWith("iphone"),
      hasTouch: true,
    });

    // ── Banco falso ──
    await ctx.route(`https://${REF}.supabase.co/**`, async (route) => {
      const url = new URL(route.request().url());
      const json = (body, status = 200, headers = {}) =>
        route.fulfill({
          status,
          contentType: "application/json",
          headers: { "content-type": "application/json", ...headers },
          body: JSON.stringify(body),
        });

      if (url.pathname.startsWith("/auth/v1/user")) return json(SESSION.user);
      if (url.pathname.startsWith("/auth/v1/token")) return json(SESSION);
      if (url.pathname.startsWith("/rest/v1/rpc/")) {
        const fn = url.pathname.split("/rpc/")[1] ?? "";
        // Os contadores do perfil NÃO saem de um count em posts/followers: vêm
        // desta RPC (SECURITY DEFINER), porque a RLS de privacidade zeraria uma
        // contagem direta. Sem tratá-la, o perfil mostrava 0 / 0 / 0.
        if (fn.startsWith("get_profile_counts")) {
          let alvo = null;
          try {
            alvo = JSON.parse(route.request().postData() || "{}").target ?? null;
          } catch { /* GET sem corpo */ }
          const conta = (t, campo, val) => (TABLES[t] ?? []).filter((r) => r[campo] === val).length;
          return json({
            posts_count: conta("posts", "user_id", alvo),
            followers_count: conta("followers", "user_id", alvo),
            following_count: conta("following", "user_id", alvo),
          });
        }
        // `is_current_user_banned` e afins: falso serve para todas.
        return json(false);
      }
      const t = tabela(url.pathname);
      const linhas = aplicaFiltros(TABLES[t] ?? [], url);

      // `.single()` / `.maybeSingle()` pedem UM objeto, não um array — é o
      // header que diz isso. Devolver array aqui quebrava o perfil.
      const accept = route.request().headers()["accept"] || "";
      if (accept.includes("vnd.pgrst.object")) {
        if (linhas.length === 0) {
          return json({ code: "PGRST116", message: "no rows" }, 406);
        }
        return json(linhas[0]);
      }
      // Contagens (`count: "exact"`) NÃO vêm no corpo: o PostgREST as manda no
      // header `Content-Range`. Sem isto o perfil mostrava 0 posts, 0
      // seguidores e 0 seguindo mesmo com as linhas existindo.
      const total = linhas.length;
      const range = total === 0 ? `*/0` : `0-${total - 1}/${total}`;
      const prefer = route.request().headers()["prefer"] || "";
      if (prefer.includes("count=") || url.searchParams.get("select") === "*") {
        return json(linhas, 200, { "content-range": range });
      }
      return json(linhas, 200, { "content-range": range });
    });

    // ── Imagens: avatar com iniciais e card de treino, gerados na hora ──
    await ctx.route("https://cdn.exemplo/**", async (route) => {
      const { pathname } = new URL(route.request().url());
      if (!cacheImg.has(pathname)) {
        const partes = pathname.split("/").filter(Boolean);
        let buf;
        if (partes[0] === "avatar") {
          buf = await avatarIniciais(partes[1] ?? "??", (partes[2] ?? "555.png").replace(".png", ""));
        } else {
          buf = await cardTreino((partes[1] ?? "").replace(".png", ""));
        }
        cacheImg.set(pathname, buf);
      }
      return route.fulfill({ status: 200, contentType: "image/png", body: cacheImg.get(pathname) });
    });

    await ctx.addInitScript(
      ([ref, sess]) => {
        localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(sess));
        // O app localiza pelo idioma do aparelho; fixamos para as duas telas
        // saírem no mesmo idioma.
        localStorage.setItem("lk:lang", "pt");
        // Sessão de treino minimizada é persistida em `linka_active_workout`
        // (ver client/lib/workout-context.tsx). Sem limpar, o FAB "Treino em
        // andamento" reaparece flutuando sobre TODA tela seguinte.
        localStorage.removeItem("linka_active_workout");
        localStorage.removeItem("rest_timer_end_at");
      },
      [REF, SESSION],
    );

    for (const s of SCREENS) {
      // Página NOVA a cada tela. Sem isto, iniciar o treino na tela 2 deixava
      // o FAB "Treino em andamento" flutuando sobre o feed e o perfil — estado
      // de uma captura contaminando a seguinte.
      const page = await ctx.newPage();
      await page.goto(BASE + s.path, { waitUntil: "domcontentloaded", timeout: 60000 });
      // Espera o app hidratar, resolver as leituras e assentar as animações.
      await page.waitForTimeout(5000);
      if (s.wait) await page.getByText(s.wait, { exact: false }).first().waitFor({ timeout: 8000 }).catch(() => {});

      for (const alvo of s.acoes ?? []) {
        const el = page.getByText(alvo, { exact: false }).first();
        await el.waitFor({ timeout: 10000 });
        await el.click();
        await page.waitForTimeout(s.espera ?? 2000);
      }

      // Preenche algumas séries para a sessão não sair zerada. Só o set ATIVO
      // tem campos na tela; ao concluir um, o próximo aparece — por isso o
      // laço refaz os locators a cada volta.
      for (const [kg, reps] of s.series ?? []) {
        const campos = page.locator('input[inputmode="decimal"], input[inputmode="numeric"]');
        if ((await campos.count()) < 2) break;
        await campos.nth(0).fill(String(kg));
        await campos.nth(1).fill(String(reps));
        // Os campos guardam o texto CRU enquanto focados (decimal no iOS, ver
        // decimal-number-inputs-ios): sem tirar o foco, o valor não é
        // commitado e a série não fecha.
        await campos.nth(1).blur().catch(() => {});
        await page.waitForTimeout(250);
        // O botão tem aria-label próprio — bem mais estável que caminhar a
        // árvore por xpath, que resolvia para um elemento em animação e nunca
        // ficava "stable".
        const concluir = page.getByLabel("Marcar série como concluída").first();
        await concluir.scrollIntoViewIfNeeded().catch(() => {});
        await concluir.click({ force: true, timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(1000);
      }

      await page.waitForTimeout(1200);

      const file = `${OUT}/${dev.id}/${s.id}.png`;
      const buf = await page.screenshot({ type: "png" });
      // `flatten` obrigatório: a App Store rejeita PNG com canal alfa.
      await sharp(buf).flatten({ background: "#0a0b12" }).png({ compressionLevel: 9 }).toFile(file);
      console.log(`  ${dev.id}/${s.id}.png  ${dev.out[0]}×${dev.out[1]}`);
      await page.close();
    }

    await ctx.close();
  }

  await browser.close();
  console.log("\nCapturado do app real, sem legenda e sem tocar na base.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
