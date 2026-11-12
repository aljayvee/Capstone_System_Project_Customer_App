// Surgical JSX attribute edits: leave all component internals and static styles intact.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('../../node_modules/typescript');
const specs = {
  'screens/LoginScreen': { gutter: 'sheet', frame: 'sheet', inset: 'hero' },
  'screens/RegisterScreen': { gutter: 'sheet', frame: 'sheet', inset: 'hero', content: 'stepContent' },
  'screens/ForgotPasswordScreen': { gutter: 'sheet', frame: 'sheet', inset: 'hero' },
  'screens/MfaChallengeScreen': { gutter: 'sheet', frame: 'sheet', inset: 'hero' },
  'screens/GooglePhoneSetupScreen': { gutter: 'topBar scrollContent', frame: 'root' },
  'screens/VerifyEmailScreen': { gutter: 'container', frame: 'container' },
  'screens/onboarding/OnboardingLocationScreen': { gutter: 'container', frame: 'container' },
  'screens/onboarding/OnboardingAuthChoiceScreen': { gutter: 'container', frame: 'container', bleed: 'walkLane' },
  'screens/CustomerPortalScreen': { inset: 'animatedHeaderRow' },
  'screens/portal/HomeTab': { gutter: 'contentContainerWrapper', frame: 'contentContainerWrapper', inset: 'floatingSearchSlot', content: 'storeSearchBar' },
  'screens/portal/ChatTab': { gutter: 'fixedTopSection scrollContent', frame: 'container', tablet: 24 },
  'screens/portal/ErrandsTab': { gutter: 'fixedTopSection listContent', frame: 'root', tablet: 24 },
  'screens/portal/TrackTab': { gutter: 'panelScrollContent switcherScroll', frame: 'panelScrollContent' },
  'screens/ActiveChatsScreen': { gutter: 'navHeaderRow content', frame: 'responsiveWrapper', safe: true },
  'screens/ActiveErrandsScreen': { gutter: 'navHeaderRow scrollContent', fill: 'container', safe: true },
  'screens/CustomerChatScreen': { gutter: 'navHeaderRow orderRibbon bentoCapsuleBar bentoDrawer collapsedHalfStrip messagesList inputContainer', fill: 'container', safe: true },
  'screens/ErrandDetailsScreen': { gutter: 'navHeaderRow scrollContent bottomActionDock', frame: 'scrollContent', safe: true, tablet: 18 },
  'screens/StoreSearchScreen': { gutter: 'navHeaderRow scrollContent', fill: 'container', safe: true },
  'screens/errand/MerchantCategoryStoresScreen': { gutter: 'navHeaderRow scrollContent horizontalRow', fill: 'container', bleed: 'bleed', safe: true },
  'screens/ErrandFormScreen': { gutter: 'navHeaderRow scrollContent', fill: 'container', safe: true },
  'screens/pabili/PabiliHubScreen': { gutter: 'navRow scroll bottomBar', fill: 'container', safe: true },
  'screens/pabili/PabiliStoreEditorScreen': { gutter: 'navRow scroll composeBar', fill: 'container', safe: true },
  'screens/pabili/PabiliReviewScreen': { gutter: 'navRow scroll bottomBar', fill: 'container', safe: true },
  'components/stores/StorePickScreen': { gutter: 'navHeaderRow scrollContent limitErrorText', fill: 'container', safe: true, name: 'StorePickScreen' },
  'components/stores/ProceedDock': { gutter: 'dock', safe: true, name: 'ProceedDock' },
  'components/stores/StoreCardRow': { gutter: 'row', bleed: 'bleed', name: 'StoreCardRow' },
  'screens/AccountScreen': { gutter: 'navHeaderRow scrollContent', frame: 'scrollContent', safe: true, tablet: 24 },
  'screens/EditAccountScreen': { gutter: 'navHeaderRow scrollContent stickyBottomDock', frame: 'scrollContent', safe: true, tablet: 24 },
  'screens/SettingsScreen': { gutter: 'navHeaderRow scrollContent', frame: 'scrollContent', safe: true, tablet: 24 },
  'screens/Notification': { gutter: 'root', frame: 'root', tablet: 18 },
  'screens/FeedbackScreen': { gutter: 'header scrollContent', frame: 'root', tablet: 18 },
  'screens/LegalDocumentScreen': { gutter: 'navHeaderRow scrollContent errorWrap', frame: 'scrollContent errorWrap', content: 'inner', tablet: 18 },
  'screens/WaitingForDispatcherScreen': { gutter: 'scrollContent', frame: 'scrollContent', safe: true, tablet: 24 },
  'screens/ErrandConfirmationScreen': { gutter: 'navHeaderRow scrollContent', frame: 'scrollContent', safe: true, tablet: 18 },
  'screens/ServiceListScreen': { gutter: 'container', safe: true, tablet: 18 },
  'screens/CustomerLocationScreen': { gutter: 'navHeaderRow', frame: 'responsiveWrapper', safe: true },
  'screens/location/LocationList': { gutter: 'content', safe: true, name: 'LocationList', tablet: 18 },
  'screens/location/LocationWizard': { gutter: 'header', safe: true, name: 'LocationWizard' },
  'screens/location/WizardStepDetails': { gutter: 'scrollContent footer', safe: true, name: 'WizardStepDetails', tablet: 18 },
  'screens/location/WizardStepPin': { gutter: 'scrollContent footer', safe: true, name: 'WizardStepPin', tablet: 18 },
  'components/ChatSkeleton': { gutter: 'messagesSkeletonContainer', safe: true, name: 'ChatMessagesSkeleton', tablet: 18 },
};
const styleNames = { gutter: 'gutterStyle', frame: 'frameStyle', inset: 'insetStyle', bleed: 'bleedStyle', fill: 'safeAreaFrameStyle', content: 'contentStyle' };
const changed = [];
for (const [rel, spec] of Object.entries(specs)) {
  const file = `src/${rel}.tsx`;
  let source = fs.readFileSync(file, 'utf8');
  if (source.includes("import { usePageLayout }")) { changed.push(file); continue; }
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const component = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.body && (
    spec.name ? n.name?.text === spec.name : n.modifiers?.some(m => m.kind === ts.SyntaxKind.DefaultKeyword)
  ));
  if (!component) throw new Error(`Missing component ${file} ${spec.name ?? ''}`);
  const edits = [];
  const hits = {};
  function visit(node) {
    if (ts.isJsxAttribute(node) && /^(style|contentContainerStyle|containerStyle)$/.test(node.name.getText(ast)) && node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression) {
      const expression = node.initializer.expression;
      const refs = new Set();
      function collect(child) {
        if (ts.isPropertyAccessExpression(child) && child.expression.getText(ast) === 'styles') refs.add(child.name.text);
        ts.forEachChild(child, collect);
      }
      collect(expression);
      const additions = [];
      for (const [key, style] of Object.entries(styleNames)) {
        for (const name of (spec[key] ?? '').split(' ').filter(Boolean)) {
          if (refs.has(name)) {
            if (!additions.includes(`page.${style}`)) additions.push(`page.${style}`);
            hits[`${key}:${name}`] = true;
          }
        }
      }
      if (additions.length) edits.push({ start: expression.getStart(ast), end: expression.end, text: `[${expression.getText(ast)}, ${additions.join(', ')}]` });
    }
    ts.forEachChild(node, visit);
  }
  visit(component.body);
  for (const key of Object.keys(styleNames)) for (const name of (spec[key] ?? '').split(' ').filter(Boolean)) {
    if (!hits[`${key}:${name}`]) console.log(`Review unused/outside component: ${file} ${key}:${name}`);
  }
  const nl = source.includes('\r\n') ? '\r\n' : '\n';
  const opts = [];
  if (spec.safe) opts.push('horizontalSafeAreaApplied: true');
  if (spec.tablet) opts.push(`tabletGutter: ${spec.tablet}`);
  edits.push({ start: component.body.getStart(ast) + 1, end: component.body.getStart(ast) + 1, text: `${nl}  const page = usePageLayout(${opts.length ? `{ ${opts.join(', ')} }` : ''});` });
  const hookPath = path.relative(path.dirname(file), 'src/hooks/usePageLayout').replaceAll('\\', '/');
  edits.push({ start: 0, end: 0, text: `import { usePageLayout } from '${hookPath.startsWith('.') ? hookPath : './' + hookPath}';${nl}` });
  for (const edit of edits.sort((a, b) => b.start - a.start)) source = source.slice(0, edit.start) + edit.text + source.slice(edit.end);
  fs.writeFileSync(file, source);
  changed.push(file);
}
fs.writeFileSync(path.join(__dirname, 'changed-files.json'), JSON.stringify(changed, null, 2));
console.log(`Applied page styles to ${changed.length} components.`);
