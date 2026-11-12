const fs = require('node:fs');
const path = require('node:path');
const base = path.resolve(__dirname, 'before');
function protectSnapshots(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.resolve(dir, ent.name);
    if (!file.startsWith(base + path.sep)) throw new Error('Snapshot path escaped');
    if (ent.isDirectory()) protectSnapshots(file);
    else if (/\.tsx?$/.test(file)) fs.renameSync(file, file + '.txt');
  }
}
protectSnapshots(base);
const files = JSON.parse(fs.readFileSync(path.join(__dirname, 'changed-files.json'), 'utf8'));
for (const file of files) {
  let s = fs.readFileSync(file, 'utf8');
  s = s.replace(/const page = usePageLayout/g, 'const pageLayout = usePageLayout').replace(/\bpage\.(?=isPhone|gutter\b|contentWidth|frameStyle|gutterStyle|insetStyle|bleedStyle|safeAreaFrameStyle|contentStyle)/g, 'pageLayout.');
  fs.writeFileSync(file, s);
}
console.log('Named layout variables independently of pagination; excluded snapshots from TS/Jest discovery.');
