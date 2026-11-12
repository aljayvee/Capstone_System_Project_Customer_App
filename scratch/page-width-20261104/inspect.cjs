const fs = require('node:fs');
const path = require('node:path');
const ts = require('../../node_modules/typescript');
const root = process.cwd();
const before = path.join(__dirname, 'before');
if (!fs.existsSync(before)) {
  fs.mkdirSync(before, { recursive: true });
  fs.cpSync('src', path.join(before, 'src'), { recursive: true });
  fs.copyFileSync('AGENT_HANDSHAKE.md', path.join(before, 'AGENT_HANDSHAKE.md'));
}
const files = process.argv.slice(2);
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const rows = [];
  function visit(node) {
    if (ts.isPropertyAssignment(node) && ts.isObjectLiteralExpression(node.initializer)) {
      const props = node.initializer.properties.filter(p => ts.isPropertyAssignment(p) && /^(paddingHorizontal|padding|marginHorizontal|maxWidth|width)$/.test(p.name.getText(ast)));
      if (props.length) rows.push(`${node.name.getText(ast)} { ${props.map(p => p.getText(ast)).join(', ')} }`);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  console.log('\n' + file + '\n' + rows.join('\n'));
}
