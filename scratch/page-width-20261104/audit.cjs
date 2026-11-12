const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const ts = require('../../node_modules/typescript');
const root = process.cwd();
const out = __dirname;
const files = JSON.parse(fs.readFileSync(path.join(out, 'changed-files.json'), 'utf8'));
for (const file of ['src/utils/responsive.ts', 'src/hooks/usePageLayout.ts', 'src/__tests__/pageLayout.test.ts', 'src/__tests__/usePageLayout.test.tsx', 'src/__tests__/MerchantCategoryStoresScreen.test.tsx', 'src/__tests__/CustomerChatScreen.test.tsx']) if (!files.includes(file)) files.push(file);
const untouched = ['src/config/theme.ts','src/config/portalTypography.ts','src/config/authTypography.ts','src/components/BottomNav.tsx','src/components/KuyaSugoMascot.tsx','src/screens/portal/AccountTab.tsx','src/screens/ErrandItemsScreen.tsx'];
for (const file of untouched) {
  if (fs.readFileSync(file,'utf8') !== fs.readFileSync(path.join(out,'before',file+'.txt'),'utf8')) throw new Error('Unexpected change: '+file);
}
function styles(source,file) {
  const ast = ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const values=[];
  function visit(n) {
    if(ts.isCallExpression(n)&&n.expression.getText(ast)==='StyleSheet.create') values.push(n.getText(ast).replace(/\r\n/g,'\n'));
    ts.forEachChild(n,visit);
  }
  visit(ast);return values;
}
for(const file of files.filter(f=>f.endsWith('.tsx')&&!f.includes('__tests__'))){
  const before=path.join(out,'before',file+'.txt');
  if(fs.existsSync(before)&&JSON.stringify(styles(fs.readFileSync(before,'utf8'),file))!==JSON.stringify(styles(fs.readFileSync(file,'utf8'),file))) throw new Error('Static component geometry changed: '+file);
}
const source=fs.readFileSync('src/navigation/AppNavigator.tsx','utf8');
const ast=ts.createSourceFile('AppNavigator.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const imports=new Map();
for(const statement of ast.statements)if(ts.isImportDeclaration(statement)&&statement.importClause?.name)imports.set(statement.importClause.name.text,statement.moduleSpecifier.text);
const routes=new Map();
function visit(n){
  if((ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n))&&n.tagName.getText(ast)==='Stack.Screen'){
    const attrs=new Map(n.attributes.properties.filter(ts.isJsxAttribute).map(a=>[a.name.getText(ast),a.initializer]));
    const name=attrs.get('name');const component=attrs.get('component');
    if(name&&ts.isStringLiteral(name)&&component&&ts.isJsxExpression(component)&&component.expression){
      const nameOfComponent=component.expression.getText(ast);const imported=imports.get(nameOfComponent);
      if(imported)routes.set(name.text,path.posix.normalize('src/navigation/'+imported)+'.tsx');
    }
  }
  ts.forEachChild(n,visit);
}
visit(ast);
let report='# Customer App page-width implementation review\n\n';
report+='Target supplied by user: Samsung Galaxy A04, Sugo Express 1.4.0. No ADB device was connected; installed build/update ID, native display/font settings, and physical before/after captures could not be inspected. Browser captures below render saved original/current source with inert native-service adapters, not the installed app.\n\n';
report+='## Screen inventory\n\nEvery registered route below received a source layout review. Native visual acceptance remains pending for all routes. “Changed” denotes page-width integration, not a screen redesign.\n\n| Route | Implementation | Source review |\n|---|---|---|\n';
for(const [route,file] of routes){
  if(!fs.existsSync(file))throw new Error('Missing registered screen '+file);
  let status=files.includes(file)?'Changed: shared phone page rule':'Reviewed: delegates shared StorePickScreen';
  if(!files.includes(file)&&!['PopularStores','NearbyStores'].includes(route))throw new Error('Unreviewed route '+route+' '+file);
  report+=`| ${route} | \`${file}\` | ${status} |\n`;
}
report+='\nHome, Messages, Errands, and Tracking tab content were also changed. Find Stores shares StoreSearchView between tab/route entry points. Location wizard steps, store carousels/docks, chat loading skeletons, full-screen map modal controls, and the offline gate/snapshot were reviewed and updated.\n\n';
report+='## Preserved geometry and behavior\n\nStatic StyleSheet definitions are byte-equivalent apart from line endings in all changed existing UI files. Changes are applied as phone-only page styles at render time. Theme spacing, typography ramps, floating bottom navigation, mascot, unused AccountTab, and unused legacy ErrandItemsScreen are unchanged relative to the captured working tree. Home store-card sizing remains 160 dp, its photo ratio remains 4:3, and category-image height remains moderateScale(132, 0.25).\n\n';
report+='## Verification\n\n- First group: 7 suites, 91 tests passed.\n- Broader group: 17/19 suites initially passed; both failing suites passed after targeted test repairs (pre-existing stale store-image assertions; await chat modal press).\n- Targeted rerun: 3 suites, 24 tests passed, including 3 new hook tests.\n- Offline gate: 6 tests passed.\n- Combined unique affected coverage: 28 suites, 319 tests passed across these runs.\n- Baseline source transform confirmed the store-image expectation failure existed before this work. Its saved log/results are included.\n- Pure width tests cover 320, 360, 392, 428, 599, 600, 800 dp, asymmetric safe areas, and exhausted width. Hook tests cover safe-area ownership and removing phone overrides at the tablet breakpoint.\n- Native keyboard behavior, real map rendering, and all-screen native light/dark review remain pending.\n\n';
const metrics=path.join(out,'browser-width-checks.json');
if(fs.existsSync(metrics)){
  report+='## Rendered Login comparison (React Native Web)\n\n| Viewport | Original field width | New field width | New side margin | Input height | Font size |\n|---|---|---|---|---|---|\n';
  const checks=JSON.parse(fs.readFileSync(metrics,'utf8'));
  for(const width of [320,360,392,428,800]){
    const before=checks.find(x=>x.width===width&&x.variant==='before');
    const after=checks.find(x=>x.width===width&&x.variant==='after');
    if(!before||!after)throw new Error('Missing preview '+width);
    const b=before.fields[0],a=after.fields[0];
    if(a.width!==(width<600?width-24:b.width)||a.height!==b.height||a.fontSize!==b.fontSize||after.pageScrollWidth!==width)throw new Error('Preview regression '+width);
    report+=`| ${width} | ${b.width} | ${a.width} | ${a.x} | ${a.height} | ${a.fontSize} |\n`;
  }
  report+='\nThe 800 dp tablet fields retain their original 532 dp width. Captures: [original Login](login-before-360-light.png), [wider Login](login-after-360-light.png), [onboarding source preview](onboarding-after-360-light.png). These are supplemental browser previews, not Galaxy A04 captures.\n\n';
}
report+='## Delivery\n\nNo APK build, OTA publication, version bump, backend API, navigation contract, or persistent data change. Physical Galaxy A04 acceptance is still required before release.\n';
fs.writeFileSync(path.join(out,'review.md'),report);
fs.writeFileSync(path.join(out,'changed-files.json'),JSON.stringify(files,null,2));
let patch='';
for(const file of files){
  const saved=path.join(out,'before',file+'.txt');
  const result=cp.spawnSync('git',['-c','core.autocrlf=false','diff','--no-index','--',fs.existsSync(saved)?saved:'NUL',file],{encoding:'utf8',maxBuffer:4e6});
  if(result.status>1)throw new Error(result.stderr);
  patch+=result.stdout;
}
fs.writeFileSync(path.join(out,'implementation.diff'),patch);
console.log(`Reviewed ${routes.size} registered routes; ${files.length} implementation/test files. Static geometry and unchanged files verified.`);
