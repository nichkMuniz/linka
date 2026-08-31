import sharp from "sharp";
const set = process.argv[2] || "iphone-6.5";
const w = Number(process.argv[3] || 430);
for (const f of ["1-metas","2-treino","3-feed","4-perfil","5-comunidade"]) {
  await sharp(`docs/appstore/${set}/${f}.png`).resize(w).toFile(`scripts/appstore/preview-out/${set}-${f}.png`);
}
console.log("ok");
