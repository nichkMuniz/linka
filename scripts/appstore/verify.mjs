import sharp from "sharp";
import { readdirSync } from "node:fs";
const spec = { "iphone-6.5": [1242, 2688], "ipad-13": [2064, 2752] };
let bad = 0;
for (const [dir, [W, H]] of Object.entries(spec)) {
  for (const f of readdirSync(`docs/appstore/${dir}`)) {
    if (!f.endsWith(".png")) continue;
    const m = await sharp(`docs/appstore/${dir}/${f}`).metadata();
    const okSize = m.width === W && m.height === H;
    const okAlpha = !m.hasAlpha;
    if (!okSize || !okAlpha) bad++;
    console.log(
      `${okSize && okAlpha ? "OK  " : "FALHA"} ${dir}/${f}  ${m.width}x${m.height}  alfa=${m.hasAlpha}  ${m.channels}ch`,
    );
  }
}
console.log(bad === 0 ? "\nTodos conformes." : `\n${bad} arquivo(s) fora do padrão.`);
