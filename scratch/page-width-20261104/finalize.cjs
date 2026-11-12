const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const out = __dirname;
const audit = cp.spawnSync(process.execPath,[path.join(out,'audit.cjs')],{encoding:'utf8'});
if(audit.status!==0)throw new Error(audit.stderr||audit.stdout);
console.log(audit.stdout.trim());
const files=JSON.parse(fs.readFileSync(path.join(out,'changed-files.json'),'utf8'));
for(const file of files){
  const saved=path.join(out,'before',file+'.txt');
  const result=cp.spawnSync('git',['-c','core.autocrlf=false','-c','core.whitespace=blank-at-eol,blank-at-eof,space-before-tab,cr-at-eol','diff','--no-index','--check','--',fs.existsSync(saved)?saved:'NUL',file],{encoding:'utf8'});
  if(result.status>1||result.stdout.trim())throw new Error('Whitespace check: '+file+' '+result.stdout+result.stderr);
}
const additional=JSON.parse(fs.readFileSync(path.join(out,'final-layout-results.json'),'utf8'));
const rerun=JSON.parse(fs.readFileSync(path.join(out,'recheck-results.json'),'utf8'));
if(additional.numFailedTests||rerun.numFailedTests)throw new Error('Verification failures remain');
if(fs.readFileSync(path.join(out,'typescript.log'),'utf8').trim())throw new Error('TypeScript diagnostics remain');
let report=fs.readFileSync(path.join(out,'review.md'),'utf8');
report=report.replace('Combined unique affected coverage: 28 suites, 319 tests passed across these runs.','Combined unique affected coverage: 30 suites, 355 tests passed across these runs, including 36 additional legal/map-mode tests.');
report=report.replace('## Delivery','## Final checks\n\n- `node node_modules/typescript/bin/tsc --noEmit`: exit 0.\n- Task-only whitespace checks against the saved working tree: passed for every implementation/test file.\n- Login rendered in light and dark modes at 360 dp with 336 dp-wide fields; the 320 dp dark-mode required-field state retained 296 dp-wide fields and no horizontal page overflow.\n- [Dark-mode Login capture](login-after-360-dark.png), [320 dp validation capture](login-after-320-dark-validation.png).\n\n## Delivery');
fs.writeFileSync(path.join(out,'review.md'),report);
fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({
  typescriptExitCode:0,taskWhitespaceCheck:'passed',registeredRoutesReviewed:31,
  uniqueAffectedSuitesPassed:30,uniqueAffectedTestsPassed:355,
  physicalDeviceConnected:false,nativeVisualAcceptance:'pending',apkBuilt:false,otaPublished:false,
},null,2));
const handoff='AGENT_HANDSHAKE.md';
const old=fs.readFileSync(handoff,'utf8');
const title='## 2026-11-04 - Shared 12 dp phone page margins (Codex)';
if(old.includes(title))throw new Error('Handoff already written');
const nl=old.includes('\r\n')?'\r\n':'\n';
const entry=[title,
'* **Request**: Implement the approved plan to widen content throughout Sugo Express, targeting Samsung Galaxy A04 / version 1.4.0, with 12 dp page margins and existing type/control/image sizes.',
'* **Modified paths**: '+files.map(f=>'`'+f+'`').join(', ')+', and this handoff.',
'* **Implementation**: Added pure `getPageLayout` and `usePageLayout`, separate from global spacing/type scaling. Phone-only page styles cover all 31 registered routes (including shared delegated store screens), four main tabs, location steps, carousels/docks, skeletons, full-screen map controls, and offline snapshots. Horizontal SafeAreaView roots keep their full outer width; nested content consumes insets once. Tablets retain existing style overrides/caps. Preserve the approved 160 dp Home store cards, 4:3 photos, category height, floating navigation, typography ramps, mascot, and unused legacy AccountTab/ErrandItemsScreen. Historical wider page-gutter guidance is superseded by this user-approved 12 dp phone rule; inner component padding is retained.',
'* **Verification**: TypeScript `node node_modules/typescript/bin/tsc --noEmit` exit 0. Combined affected checks: 355 unique tests across 30 suites passed after targeted reruns. Pre-change source confirmed stale category-store photo expectations (200/150 instead of approved 160/120); repaired those assertions and awaited chat modal dispatch in its existing test. Pure layout tests cover 320/360/392/428/599/600/800 dp and asymmetric safe areas; hook tests cover ownership and tablet transitions. Task-specific whitespace checks and static-geometry preservation audit passed.',
'* **Rendered checks**: Local React Native Web Login before/after at 320/360/392/428/800 dp; fields gain 24 dp on phones, retain 54 dp height / same font size, and retain tablet width. Light/dark and narrow-phone validation captures saved. These are source previews with inert native-service adapters, not physical-device captures.',
'* **Artifacts**: `scratch/page-width-20261104/review.md` (31-route inventory, verification, pending native acceptance), `implementation.diff` (task-only delta from the saved working tree), `changed-files.json`, `verification.json`, and browser comparison PNGs/metrics.',
'* **Native acceptance / next session**: No ADB device was connected, so installed A04 build/update ID, display/font settings, physical captures, native keyboard behavior and real-map visual review remain pending. No APK build, version bump, OTA publication, backend/API contract or persistent-data change. Do not describe this as native visual approval or a deployed change.',
'',
].join(nl);
const first=old.indexOf('\n')+1;
fs.writeFileSync(handoff,old.slice(0,first)+nl+entry+nl+old.slice(first));
console.log('Saved review, verification metadata, task diff, and handoff.');
