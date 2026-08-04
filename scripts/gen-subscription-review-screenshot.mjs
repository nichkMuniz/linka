// Gera a screenshot de review da assinatura (App Store Connect) em 640x920,
// que é a dimensão mínima documentada pela Apple para IAP no iOS.
// Reproduz o layout do PaywallDrawer para o revisor reconhecer a tela.
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const W = 640;
const H = 920;

const FONT = "DejaVu Sans, Helvetica, Arial, sans-serif";

const benefits = [
  ["Gráficos de progressão de carga e peso", "Veja sua evolução, exercício por exercício"],
  ["Rotinas ativas ilimitadas", "Treino, dieta e hábitos ao mesmo tempo"],
  ["Macros e metas de nutrição completas", "Proteína, carboidrato e gordura no diário"],
  ["Insígnias exclusivas e duelos ilimitados", "Destaque-se no feed e crie quantos quiser"],
];

const plans = [
  { name: "Anual", price: "R$ 149,90", period: "/ano", selected: true },
  { name: "Mensal", price: "R$ 19,90", period: "/mês", selected: false },
];

const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

let y = 0;
const parts = [];

// ── Fundo ────────────────────────────────────────────────────────────────────
parts.push(`
<defs>
  <radialGradient id="bg" cx="50%" cy="0%" r="110%">
    <stop offset="0%" stop-color="#221f2e"/>
    <stop offset="60%" stop-color="#0e0d14"/>
  </radialGradient>
  <linearGradient id="cta" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" stop-color="#5b8cff"/>
    <stop offset="100%" stop-color="#9d6bff"/>
  </linearGradient>
  <linearGradient id="crownbg" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" stop-color="#3a4470"/>
    <stop offset="100%" stop-color="#4b3a72"/>
  </linearGradient>
</defs>
<rect width="${W}" height="${H}" fill="url(#bg)"/>`);

// ── Cabeçalho ────────────────────────────────────────────────────────────────
parts.push(`
<circle cx="320" cy="76" r="34" fill="url(#crownbg)" stroke="rgba(255,255,255,.18)" stroke-width="1"/>
<path d="M303 86 L300 66 L310 74 L320 62 L330 74 L340 66 L337 86 Z"
      fill="#fbbf24"/>
<text x="320" y="146" text-anchor="middle" font-family="${FONT}" font-size="27"
      font-weight="bold" fill="#ffffff">LinKa Premium</text>
<text x="320" y="174" text-anchor="middle" font-family="${FONT}" font-size="14"
      fill="rgba(255,255,255,.5)">Desbloqueie todo o potencial do seu treino</text>`);

// ── Benefícios ───────────────────────────────────────────────────────────────
y = 206;
for (const [title, desc] of benefits) {
  parts.push(`
<rect x="32" y="${y}" width="576" height="72" rx="18"
      fill="rgba(255,255,255,.06)" stroke="rgba(255,255,255,.10)" stroke-width="1"/>
<rect x="50" y="${y + 16}" width="40" height="40" rx="12" fill="rgba(255,255,255,.08)"/>
<circle cx="70" cy="${y + 36}" r="8" fill="none" stroke="#9d6bff" stroke-width="2.5"/>
<text x="106" y="${y + 32}" font-family="${FONT}" font-size="14.5" font-weight="bold"
      fill="#ffffff">${esc(title)}</text>
<text x="106" y="${y + 52}" font-family="${FONT}" font-size="12"
      fill="rgba(255,255,255,.5)">${esc(desc)}</text>`);
  y += 82;
}

// ── Planos ───────────────────────────────────────────────────────────────────
y += 8;
for (const p of plans) {
  parts.push(`
<rect x="32" y="${y}" width="576" height="62" rx="18"
      fill="rgba(255,255,255,.06)"
      stroke="${p.selected ? "#9d6bff" : "rgba(255,255,255,.10)"}"
      stroke-width="${p.selected ? 2 : 1}"/>
<circle cx="66" cy="${y + 31}" r="10"
        fill="${p.selected ? "#9d6bff" : "none"}"
        stroke="${p.selected ? "none" : "rgba(255,255,255,.3)"}" stroke-width="1.5"/>
${p.selected ? `<path d="M61 ${y + 31} l4 4 l7 -8" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` : ""}
<text x="92" y="${y + 37}" font-family="${FONT}" font-size="15" font-weight="bold"
      fill="#ffffff">${esc(p.name)}</text>
<text x="586" y="${y + 37}" text-anchor="end" font-family="${FONT}" font-size="15"
      font-weight="bold" fill="#ffffff">${esc(p.price)}<tspan font-size="12"
      font-weight="normal" fill="rgba(255,255,255,.5)">${esc(p.period)}</tspan></text>`);
  y += 72;
}

// ── CTA + rodapé legal ───────────────────────────────────────────────────────
y += 10;
parts.push(`
<rect x="32" y="${y}" width="576" height="52" rx="26" fill="url(#cta)"/>
<text x="320" y="${y + 33}" text-anchor="middle" font-family="${FONT}" font-size="16"
      font-weight="bold" fill="#ffffff">Assinar</text>

<text x="320" y="${y + 82}" text-anchor="middle" font-family="${FONT}" font-size="13"
      fill="rgba(255,255,255,.7)">Restaurar compras</text>

<text x="320" y="${y + 116}" text-anchor="middle" font-family="${FONT}" font-size="10.5"
      fill="rgba(255,255,255,.42)">A assinatura renova automaticamente até ser cancelada.</text>
<text x="320" y="${y + 132}" text-anchor="middle" font-family="${FONT}" font-size="10.5"
      fill="rgba(255,255,255,.42)">Cancele quando quiser nos Ajustes do seu Apple ID.</text>

<text x="248" y="${y + 158}" text-anchor="middle" font-family="${FONT}" font-size="11.5"
      fill="rgba(255,255,255,.6)" text-decoration="underline">Termos de Uso</text>
<text x="320" y="${y + 158}" text-anchor="middle" font-family="${FONT}" font-size="11.5"
      fill="rgba(255,255,255,.25)">·</text>
<text x="400" y="${y + 158}" text-anchor="middle" font-family="${FONT}" font-size="11.5"
      fill="rgba(255,255,255,.6)" text-decoration="underline">Política de Privacidade</text>`);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join("")}</svg>`;

const out = process.argv[2];
mkdirSync(dirname(out), { recursive: true });

await sharp(Buffer.from(svg))
  // flatten remove o canal alfa — PNG com transparência é uma das causas mais
  // comuns de "dimensions are wrong" no App Store Connect.
  .flatten({ background: "#0e0d14" })
  .png({ compressionLevel: 9 })
  .toFile(out);

const meta = await sharp(out).metadata();
console.log(`OK  ${out}`);
console.log(`    ${meta.width}x${meta.height}  ${meta.channels} canais  alpha=${meta.hasAlpha}`);
