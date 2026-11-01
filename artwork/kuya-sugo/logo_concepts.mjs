/** Flat app-logo concepts for the 2026-11-01 redesign. White marks on #F62459 only, same 512 grid as
 * export_flat_logo.mjs, so the chosen mark drops into its `rider` slot. Cut-outs are real holes (masks use the
 * `white`/`black` keywords, which the pink-on-white inverse's replaceAll('#FFFFFF') leaves alone), so the
 * notification icon and Android's monochrome icon keep them. Writes logo-concepts/ and a comparison sheet. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire('C:/Users/Capstone/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const sharp = require('sharp');
const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, 'logo-concepts');
await fs.mkdir(out, { recursive: true });
const pink = '#F62459', W = '#FFFFFF';

export const concepts = {
  // Kuya Sugo's capped head: the mascot from the splash, reduced to two shapes and a face.
  'cap-head': {
    label: 'Kuya Sugo head',
    art: `<mask id="m"><rect width="512" height="512" fill="white"/>
  <path d="M0 0H512V272H0Z" fill="black"/>
  <ellipse cx="212" cy="324" rx="14" ry="21" fill="black"/><ellipse cx="292" cy="324" rx="14" ry="21" fill="black"/>
  <path d="M204 366Q252 398 300 366" fill="none" stroke="black" stroke-width="15" stroke-linecap="round"/></mask>
<circle cx="252" cy="284" r="132" fill="${W}" mask="url(#m)"/>
<path d="M120 254V240A132 114 0 0 1 384 240V254Z" fill="${W}"/>
<rect x="296" y="224" width="146" height="30" rx="15" fill="${W}"/>`,
  },
  // An S drawn as a delivery route: starts at a dot, ends at a pin.
  's-route': {
    label: 'S route',
    art: `<mask id="m"><rect width="512" height="512" fill="white"/><circle cx="362" cy="130" r="15" fill="black"/></mask>
<g transform="translate(-6 32)"><path d="M300 150H214A53 53 0 0 0 214 256H298A53 53 0 0 1 298 362H214" fill="none" stroke="${W}" stroke-width="50" stroke-linecap="round"/>
<circle cx="146" cy="362" r="26" fill="${W}"/></g>
<path d="M362 214C340 190 322 164 322 136A40 40 0 0 1 402 136C402 164 384 190 362 214Z" fill="${W}" mask="url(#m)"/>`,
  },
  // Scooter courier with a top box, the way errands actually move in Tacurong.
  'moto-box': {
    label: 'Scooter courier',
    art: `<g fill="none" stroke="${W}" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="148" cy="360" r="46" stroke-width="26"/><circle cx="372" cy="360" r="46" stroke-width="26"/>
  <path d="M258 168 236 252" stroke-width="46"/><path d="M262 184 324 204" stroke-width="22"/>
  <path d="M236 256H282L292 306" stroke-width="30"/><path d="M332 190 384 180" stroke-width="22"/></g>
<path d="M120 304C120 282 136 270 156 270H222L246 318H312L338 194H366L352 300C348 320 334 334 312 334H170C142 334 120 324 120 304Z" fill="${W}"/>
<circle cx="266" cy="122" r="28" fill="${W}"/>
<rect x="100" y="172" width="100" height="84" rx="14" fill="${W}"/>`,
  },
  // A parcel with speed lines and a tape strip.
  'parcel-speed': {
    label: 'Parcel on the move',
    art: `<mask id="m"><rect width="512" height="512" fill="white"/><path d="M302 150V370M342 150V370" stroke="black" stroke-width="12"/></mask>
<rect x="212" y="156" width="210" height="200" rx="22" fill="${W}" mask="url(#m)"/>
<g stroke="${W}" stroke-width="26" stroke-linecap="round"><path d="M108 210H166M76 256H166M124 302H166"/></g>`,
  },
  // The Sugo Tacurong scooter (the user's line-art logo, 2026-11-01) redrawn as a filled mark: rider leaning forward,
  // top box with a bag, speed lines. Drawn in that logo's 4x crop coordinates, then fitted to the 512 grid.
  'sugo-scooter': {
    label: 'Sugo Tacurong scooter',
    art: `<g transform="translate(256 256) scale(.41) translate(-642 -523)">
  <mask id="ms" maskUnits="userSpaceOnUse" x="0" y="0" width="1372" height="900"><rect width="1372" height="900" fill="white"/>
    <path d="M290 760H1000" stroke="black" stroke-width="26"/>
    <path d="M398 324H600" stroke="black" stroke-width="24"/>
    <circle cx="462" cy="800" r="42" fill="black"/><circle cx="1055" cy="780" r="44" fill="black"/></mask>
  <g mask="url(#ms)" fill="${W}">
    <circle cx="462" cy="800" r="96"/><circle cx="1055" cy="780" r="102"/>
    <path d="M296 752C296 640 380 560 470 548H760C700 600 690 690 730 716H900L960 620 930 404 1010 392 1018 600C1080 590 1160 610 1186 692H1030C990 700 960 730 940 752Z"/>
    <rect x="384" y="324" width="214" height="152" rx="16"/>
    <path d="M410 326 426 214H514L530 326Z"/>
    <path d="M440 548 462 476H520L506 548Z"/>
    <circle cx="985" cy="222" r="70"/><path d="M1000 200 1066 236 1040 252Z"/>
    <path d="M925 252C820 218 690 262 632 396C622 440 650 470 700 478L860 506C904 512 916 466 884 450L812 420 940 334Z"/>
  </g>
  <g fill="none" stroke="${W}" stroke-linecap="round" stroke-linejoin="round">
    <path d="M446 214A30 30 0 0 1 494 214" stroke-width="22"/>
    <path d="M870 316 990 362" stroke-width="58"/>
    <path d="M884 486 812 676H850" stroke-width="56"/>
    <path d="M216 448H312M98 520H330M150 596H250" stroke-width="56"/>
  </g>
</g>`,
  },
};

const doc = (content, size = 1024) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">${content}</svg>`;
const icon = (art, size) => doc(`<path fill="${pink}" d="M0 0h512v512H0z"/>${art}`, size);
const markOnly = (art, size) => doc(art, size);
// Android 13 themed / notification: white silhouette only, read on a dark tray.
const png = (svg) => sharp(Buffer.from(svg)).png().toBuffer();

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // Optional names on the command line limit the sheet to those concepts (plus the current logo).
  const names = process.argv.length > 2 ? process.argv.slice(2) : Object.keys(concepts);
  const cell = 300, row = 360, padX = 40, top = 90;
  const width = padX * 2 + cell * 5 + 40 * 4, height = top + row * (names.length + 1) + 20;
  const layers = [];
  const texts = [];
  const cols = ['App icon', 'iPhone home', 'Android circle', '48 px', 'Notification 24 px'];
  cols.forEach((c, i) => texts.push(`<text x="${padX + i * (cell + 40) + cell / 2}" y="60" text-anchor="middle" font-family="Inter, Segoe UI, sans-serif" font-size="22" fill="#475569">${c}</text>`));
  const all = [['current', { label: 'Current (bicycle)', art: (await fs.readFile(path.join(here, '../../assets/mascot/sugo-mark-white.svg'), 'utf8')).replace(/^.*?<title>.*?<\/title>/s, '').replace(/<\/svg>\s*$/, '') }], ...names.map((n) => [n, concepts[n]])];
  for (const [r, [name, c]] of all.entries()) {
    const y = top + r * row;
    texts.push(`<text x="${padX}" y="${y + 24}" font-family="Inter, Segoe UI, sans-serif" font-size="26" font-weight="600" fill="#0B132B">${r === 0 ? '' : r + '. '}${c.label}</text>`);
    const iy = y + 44;
    if (name !== 'current') {
      await fs.writeFile(path.join(out, `${name}.svg`), icon(c.art) + '\n');
      await sharp(Buffer.from(icon(c.art))).png().toFile(path.join(out, `${name}.png`));
    }
    const big = await png(icon(c.art, cell));
    const ios = await sharp(big).composite([{ input: Buffer.from(`<svg width="${cell}" height="${cell}"><rect width="${cell}" height="${cell}" rx="${cell * .225}"/></svg>`), blend: 'dest-in' }]).png().toBuffer();
    // Android adaptive: the mark shrunk into the 66% safe zone, shown through a circle mask.
    const adaptive = doc(`<path fill="${pink}" d="M0 0h512v512H0z"/><g transform="translate(256 256) scale(.72) translate(-256 -256)">${c.art}</g>`, cell);
    const circ = await sharp(await png(adaptive)).composite([{ input: Buffer.from(`<svg width="${cell}" height="${cell}"><circle cx="${cell / 2}" cy="${cell / 2}" r="${cell / 2}"/></svg>`), blend: 'dest-in' }]).png().toBuffer();
    const small = await sharp(await png(icon(c.art, 48))).composite([{ input: Buffer.from(`<svg width="48" height="48"><rect width="48" height="48" rx="11"/></svg>`), blend: 'dest-in' }]).png().toBuffer();
    const small4 = await sharp(small).resize(192, 192, { kernel: 'nearest' }).png().toBuffer();
    const notif = await sharp(await png(markOnly(c.art, 24))).flatten({ background: '#1E293B' }).resize(192, 192, { kernel: 'nearest' }).png().toBuffer();
    const x = (i) => padX + i * (cell + 40);
    layers.push({ input: big, left: x(0), top: iy }, { input: ios, left: x(1), top: iy }, { input: circ, left: x(2), top: iy },
      { input: small4, left: x(3) + 54, top: iy + 54 }, { input: notif, left: x(4) + 54, top: iy + 54 });
  }
  const bg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#F8FAFC"/>${texts.join('')}</svg>`);
  await sharp(bg).composite(layers).png().toFile(path.join(out, process.argv.length > 2 ? 'logo-shortlist-sheet.png' : 'logo-concepts-sheet.png'));
  console.log("Wrote", names.length, "concepts and", process.argv.length > 2 ? "logo-shortlist-sheet.png" : "logo-concepts-sheet.png");
}
