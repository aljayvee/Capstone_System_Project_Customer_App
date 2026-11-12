const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const options = require('jest-expo/jest-preset').transform['\\.[jt]sx?$'][1];
const delegate = require('babel-jest').createTransformer(options);
function original(code, file) {
  const relative = path.relative(root, file);
  const snapshot = path.join(__dirname, 'before', relative + '.txt');
  return relative.startsWith('src' + path.sep) && fs.existsSync(snapshot) ? fs.readFileSync(snapshot, 'utf8') : code;
}
module.exports = {
  ...delegate,
  process(code, file, ...args) { return delegate.process(original(code, file), file, ...args); },
  getCacheKey(code, file, ...args) { return delegate.getCacheKey(original(code, file), file, ...args); },
};
