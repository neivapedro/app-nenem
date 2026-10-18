// Gera os PNGs do ícone a partir de scripts/icone.svg (precisa do Playwright):
//   node scripts/gerar-icones.mjs scripts/icone.svg public
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const svg = readFileSync(process.argv[2], 'utf8');
const out = process.argv[3];
const b = await chromium.launch();
const p = await b.newPage();
for (const [nome, tam, escala] of [['icone-512.png',512,1],['icone-192.png',192,1],['apple-touch-icon.png',180,1],['icone-maskable-512.png',512,0.8]]) {
  await p.setViewportSize({ width: tam, height: tam });
  // maskable: o desenho encolhe para a área segura, o fundo continua inteiro
  const conteudo = escala === 1 ? svg : svg.replace('<circle cx="256" cy="282"', `<g transform="translate(256 256) scale(${escala}) translate(-256 -256)"><circle cx="256" cy="282"`).replace('</svg>', '</g></svg>');
  await p.setContent(`<html><body style="margin:0">${conteudo.replace('<svg ', `<svg width="${tam}" height="${tam}" `)}</body></html>`);
  await p.screenshot({ path: `${out}/${nome}`, clip: { x: 0, y: 0, width: tam, height: tam } });
}
await b.close();
