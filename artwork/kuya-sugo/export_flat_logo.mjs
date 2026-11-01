/** Brand mark is always flat vector artwork. Never derive it from a 3D render. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { concepts } from './logo_concepts.mjs';
const require = createRequire('C:/Users/Capstone/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const sharp = require('sharp');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const assets = path.join(root,'assets/mascot');
await fs.mkdir(assets,{recursive:true});
const pink = '#F62459';
// The Sugo Tacurong scooter (chosen 2026-11-01), redrawn as a filled mark in logo_concepts.mjs. It replaced the white
// cyclist, which is kept in scratch/kuya-sugo-blender/backups/logo-bicycle-2026-11-01/.
const rider = concepts['sugo-scooter'].art;
const document = (content) => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 512 512"><title>Sugo Express</title>${content}</svg>`;
const mark = document(rider);
const icon = document(`<path fill="${pink}" d="M0 0h512v512H0z"/>${rider}`);
// Android foreground fits wholly inside the central 66% safe area.
const adaptive = document(`<g transform="translate(256 256) scale(.72) translate(-256 -256)">${rider}</g>`);
for (const [name,svg] of Object.entries({'sugo-app-logo.svg':icon,'sugo-mark-white.svg':mark,'sugo-adaptive-mark.svg':adaptive})) await fs.writeFile(path.join(assets,name),svg+'\n');
await sharp(Buffer.from(icon)).flatten({background:pink}).removeAlpha().png().toFile(path.join(assets,'app-icon.png'));
for(const name of ['android-icon-foreground.png','android-icon-monochrome.png']) await sharp(Buffer.from(adaptive)).png().toFile(path.join(assets,name));
// Resampling leaves 254-grey on the edges; Android tints the alpha only, so rebuild it as pure white plus that alpha.
// sharp runs extend after resize within one pipeline, so trim and pad first, then resize separately.
const notificationPadded = await sharp(Buffer.from(mark)).trim().extend({top:12,bottom:12,left:12,right:12,background:'#FFFFFF00'}).png().toBuffer();
const notificationAlpha = await sharp(notificationPadded).resize(96,96,{fit:'contain',background:'#FFFFFF00'}).extractChannel('alpha').png().toBuffer();
await sharp({create:{width:96,height:96,channels:3,background:'#FFFFFF'}}).joinChannel(notificationAlpha).png().toFile(path.join(assets,'notification-icon.png'));
await sharp(Buffer.from(icon)).resize(64,64).png().toFile(path.join(assets,'favicon.png'));
const inverse = document(`<path fill="#FFFFFF" d="M0 0h512v512H0z"/>${rider.replaceAll('#FFFFFF',pink)}`);
await fs.writeFile(path.join(assets,'sugo-logo-pink-on-white.svg'),inverse+'\n');
await sharp(Buffer.from(inverse)).png().toFile(path.join(assets,'sugo-logo-pink-on-white.png'));
// EAS builds the checked-out android/ folder as-is (no prebuild), so its launcher mipmaps must be written here too.
const res = path.join(root,'android/app/src/main/res');
const round = document(`<circle cx="256" cy="256" r="256" fill="${pink}"/><g transform="translate(256 256) scale(.72) translate(-256 -256)">${rider}</g>`);
if (await fs.stat(res).then(()=>true,()=>false)) {
  for (const [density,scale] of Object.entries({mdpi:1,hdpi:1.5,xhdpi:2,xxhdpi:3,xxxhdpi:4})) {
    const dir = path.join(res,`mipmap-${density}`), legacy = 48*scale, layer = 108*scale;
    await sharp(Buffer.from(icon)).resize(legacy,legacy).flatten({background:pink}).removeAlpha().webp({lossless:true}).toFile(path.join(dir,'ic_launcher.webp'));
    await sharp(Buffer.from(round)).resize(legacy,legacy).webp({lossless:true}).toFile(path.join(dir,'ic_launcher_round.webp'));
    for (const name of ['ic_launcher_foreground.webp','ic_launcher_monochrome.webp']) await sharp(Buffer.from(adaptive)).resize(layer,layer).webp({lossless:true}).toFile(path.join(dir,name));
  }
}
console.log('Flat Sugo logos exported: SVG masters and 1024px launcher assets. White and #F62459 only.');
