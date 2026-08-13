/**
 * Asset final do papel de parede da mensageria.
 * Fonte: public/background-mensagem.png (arte enviada pelo usuario).
 *
 * - recorta 1300x685 do canto superior esquerdo: tira as bordas e o glifo de
 *   estrela que existia em ~(1325,707) na arte original;
 * - espelha em 2x2. A arte crua NAO e um ladrilho continuo (as figuras estao
 *   cortadas nas bordas), entao repetir ela direto criaria linha de emenda;
 *   ladrilho espelhado casa perfeitamente nas quatro bordas;
 * - exporta em WebP (alvo iOS 15+, suporte total) — 1.2 MB de PNG viram ~120 KB.
 *
 * Uso: node scripts/build-chat-wallpaper.cjs (a partir da raiz do projeto)
 */
const path = require('path');
const sharp = require('sharp');
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'public/background-mensagem.png');
const DEST = path.join(ROOT, 'public/chat-wallpaper.webp');
const CW = 1300, CH = 685;

(async () => {
  const base = await sharp(SRC).extract({ left: 0, top: 0, width: CW, height: CH }).png().toBuffer();
  const flop = await sharp(base).flop().png().toBuffer();
  const flip = await sharp(base).flip().png().toBuffer();
  const both = await sharp(base).flip().flop().png().toBuffer();

  await sharp({ create: { width: CW * 2, height: CH * 2, channels: 4, background: '#000' } })
    .composite([
      { input: base, left: 0, top: 0 },
      { input: flop, left: CW, top: 0 },
      { input: flip, left: 0, top: CH },
      { input: both, left: CW, top: CH },
    ])
    .webp({ quality: 90, effort: 6 })
    .toFile(DEST);

  const fs = require('fs');
  const m = await sharp(DEST).metadata();
  console.log(`${DEST} -> ${m.width}x${m.height}, ${(fs.statSync(DEST).size / 1024).toFixed(0)} KB`);
})();
