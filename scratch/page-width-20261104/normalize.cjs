const fs = require('node:fs');
const path = require('node:path');
const ts = require('../../node_modules/typescript');
const files = JSON.parse(fs.readFileSync(path.join(__dirname, 'changed-files.json'), 'utf8'));
for (const extra of ['src/components/MapPreviewField.tsx', 'src/components/ErrandTrackCard.tsx', 'src/components/OfflineGate.tsx']) if (!files.includes(extra)) files.push(extra);
for (const file of files) {
  let source = fs.readFileSync(file, 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits = [];
  function visit(node) {
    if (ts.isJsxAttribute(node) && node.initializer && ts.isJsxExpression(node.initializer)) {
      const expr = node.initializer.expression;
      if (expr && ts.isArrayLiteralExpression(expr) && expr.elements.length > 1 && ts.isArrayLiteralExpression(expr.elements[0]) && expr.elements.slice(1).every(e => e.getText(ast).startsWith('pageLayout.'))) {
        const inner = expr.elements[0].getText(ast).slice(1, -1).trimEnd().replace(/,$/, '');
        edits.push({ start: expr.getStart(ast), end: expr.end, text: `[${inner}, ${expr.elements.slice(1).map(e => e.getText(ast)).join(', ')}]` });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  for (const edit of edits.sort((a, b) => b.start - a.start)) source = source.slice(0, edit.start) + edit.text + source.slice(edit.end);
  fs.writeFileSync(file, source);
}
fs.writeFileSync(path.join(__dirname, 'changed-files.json'), JSON.stringify(files, null, 2));
console.log(`Normalized style arrays in ${files.length} files.`);
