const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const assert = require('node:assert/strict');

const source = readFileSync(resolve(__dirname, '../src/config/palette.ts'), 'utf8');
const light = JSON.parse(source.match(/export const MobileLight = (\{[\s\S]*?\}) as const;/)[1]);
const dark = JSON.parse(source.match(/export const MobileDark[^=]*= (\{[\s\S]*?\});/)[1]);
assert.deepEqual(Object.keys(light).sort(), Object.keys(dark).sort());
assert.equal(light.primary, '#F62459');
assert.equal(light.primaryDark, '#C41B47');
assert.equal(light.primaryLight, '#FFEEF3');
assert.equal(dark.primary, '#FF4D79');
assert.equal(dark.primaryDark, '#F62459');
assert.equal(dark.primaryLight, '#3D1420');
const config = JSON.parse(readFileSync(resolve(__dirname, '../app.json'), 'utf8')).expo;
assert.equal(config.primaryColor, light.primary);
assert.equal(config.android.adaptiveIcon.backgroundColor, light.primary);
assert.equal(config.plugins.find(plugin => Array.isArray(plugin) && plugin[0] === 'expo-notifications')[1].color, light.primary);
const native = readFileSync(resolve(__dirname, '../android/app/src/main/res/values/colors.xml'), 'utf8');
for (const role of ['colorPrimary', 'iconBackground', 'notification_icon_color']) {
  assert.ok(native.includes(`<color name="${role}">${light.primary}</color>`), `${role} must use Customer pink`);
}
process.stdout.write('Customer pink palette and native accents verified.\n');
