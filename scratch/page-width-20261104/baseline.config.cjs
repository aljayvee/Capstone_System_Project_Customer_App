const path = require('node:path');
const root = path.resolve(__dirname, '../..');
module.exports = {
  ...require(path.join(root, 'jest.config.js')),
  rootDir: root,
  transform: {
    ...require('jest-expo/jest-preset').transform,
    '\\.[jt]sx?$': path.join(__dirname, 'baseline-transform.cjs'),
  },
};
