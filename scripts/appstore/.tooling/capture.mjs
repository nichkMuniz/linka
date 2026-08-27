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
  { id: "iphone-6.9", w: 440, h: 956, dsf: 3, out: [1320, 2868] },
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

/** Imagem de conteúdo: gradiente gerado, nunca foto de pessoa real. */
async function placeholder(w, h, seed) {
  const paletas = [
    ["#3a2b52", "#1a1626"],
    ["#243a52", "#141c26"],
    ["#4a2b3a", "#26161c"],
  ];
  const [a, b] = paletas[seed % paletas.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${a}"/><stop offset="100%" stop-color="${b}"/>
    </linearGradient></defs>
    <rect width="${w}" height="${h}" fill="url(#g)"/></svg>`;
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
  const fotos = [await placeholder(900, 900, 0), await placeholder(900, 900, 1), await placeholder(900, 900, 2)];
  const avatares = [await placeholder(200, 200, 1), await placeholder(200, 200, 2), await placeholder(200, 200, 0)];

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
        // `is_current_user_banned` e afins: falso/zero serve para todas.
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

    // ── Imagens ──
    await ctx.route("https://cdn.exemplo/**", async (route) => {
      const u = route.request().url();
      const buf = u.includes("/av") ? avatares[(u.charCodeAt(u.length - 5) || 0) % 3] : fotos[(u.charCodeAt(u.length - 5) || 0) % 3];
      return route.fulfill({ status: 200, contentType: "image/png", body: buf });
    });

    const page = await ctx.newPage();
    await page.addInitScript(
      ([ref, sess]) => {
        localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(sess));
        // O app localiza pelo idioma do aparelho; fixamos para as duas telas
        // saírem no mesmo idioma.
        localStorage.setItem("lk:lang", "pt");
      },
      [REF, SESSION],
    );

    for (const s of SCREENS) {
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
