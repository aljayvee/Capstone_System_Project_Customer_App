# Customer App page-width implementation review

Target supplied by user: Samsung Galaxy A04, Sugo Express 1.4.0. No ADB device was connected; installed build/update ID, native display/font settings, and physical before/after captures could not be inspected. Browser captures below render saved original/current source with inert native-service adapters, not the installed app.

## Screen inventory

Every registered route below received a source layout review. Native visual acceptance remains pending for all routes. “Changed” denotes page-width integration, not a screen redesign.

| Route | Implementation | Source review |
|---|---|---|
| Login | `src/screens/LoginScreen.tsx` | Changed: shared phone page rule |
| Register | `src/screens/RegisterScreen.tsx` | Changed: shared phone page rule |
| ForgotPassword | `src/screens/ForgotPasswordScreen.tsx` | Changed: shared phone page rule |
| MfaChallenge | `src/screens/MfaChallengeScreen.tsx` | Changed: shared phone page rule |
| GooglePhoneSetup | `src/screens/GooglePhoneSetupScreen.tsx` | Changed: shared phone page rule |
| VerifyEmail | `src/screens/VerifyEmailScreen.tsx` | Changed: shared phone page rule |
| OnboardingLocation | `src/screens/onboarding/OnboardingLocationScreen.tsx` | Changed: shared phone page rule |
| OnboardingAuthChoice | `src/screens/onboarding/OnboardingAuthChoiceScreen.tsx` | Changed: shared phone page rule |
| CustomerPortal | `src/screens/CustomerPortalScreen.tsx` | Changed: shared phone page rule |
| ServiceList | `src/screens/ServiceListScreen.tsx` | Changed: shared phone page rule |
| ErrandForm | `src/screens/ErrandFormScreen.tsx` | Changed: shared phone page rule |
| PopularStores | `src/screens/PopularStoresScreen.tsx` | Reviewed: delegates shared StorePickScreen |
| StoreSearch | `src/screens/StoreSearchScreen.tsx` | Changed: shared phone page rule |
| ActiveErrands | `src/screens/ActiveErrandsScreen.tsx` | Changed: shared phone page rule |
| NearbyStores | `src/screens/NearbyStoresScreen.tsx` | Reviewed: delegates shared StorePickScreen |
| MerchantCategoryStores | `src/screens/errand/MerchantCategoryStoresScreen.tsx` | Changed: shared phone page rule |
| ErrandItems | `src/screens/pabili/PabiliHubScreen.tsx` | Changed: shared phone page rule |
| PabiliStoreEditor | `src/screens/pabili/PabiliStoreEditorScreen.tsx` | Changed: shared phone page rule |
| PabiliReview | `src/screens/pabili/PabiliReviewScreen.tsx` | Changed: shared phone page rule |
| ErrandConfirmation | `src/screens/ErrandConfirmationScreen.tsx` | Changed: shared phone page rule |
| WaitingForDispatcher | `src/screens/WaitingForDispatcherScreen.tsx` | Changed: shared phone page rule |
| CustomerChat | `src/screens/CustomerChatScreen.tsx` | Changed: shared phone page rule |
| ActiveChats | `src/screens/ActiveChatsScreen.tsx` | Changed: shared phone page rule |
| CustomerLocation | `src/screens/CustomerLocationScreen.tsx` | Changed: shared phone page rule |
| EditAccount | `src/screens/EditAccountScreen.tsx` | Changed: shared phone page rule |
| Account | `src/screens/AccountScreen.tsx` | Changed: shared phone page rule |
| Settings | `src/screens/SettingsScreen.tsx` | Changed: shared phone page rule |
| Notification | `src/screens/Notification.tsx` | Changed: shared phone page rule |
| ErrandDetails | `src/screens/ErrandDetailsScreen.tsx` | Changed: shared phone page rule |
| Feedback | `src/screens/FeedbackScreen.tsx` | Changed: shared phone page rule |
| LegalDocument | `src/screens/LegalDocumentScreen.tsx` | Changed: shared phone page rule |

Home, Messages, Errands, and Tracking tab content were also changed. Find Stores shares StoreSearchView between tab/route entry points. Location wizard steps, store carousels/docks, chat loading skeletons, full-screen map modal controls, and the offline gate/snapshot were reviewed and updated.

## Preserved geometry and behavior

Static StyleSheet definitions are byte-equivalent apart from line endings in all changed existing UI files. Changes are applied as phone-only page styles at render time. Theme spacing, typography ramps, floating bottom navigation, mascot, unused AccountTab, and unused legacy ErrandItemsScreen are unchanged relative to the captured working tree. Home store-card sizing remains 160 dp, its photo ratio remains 4:3, and category-image height remains moderateScale(132, 0.25).

## Verification

- First group: 7 suites, 91 tests passed.
- Broader group: 17/19 suites initially passed; both failing suites passed after targeted test repairs (pre-existing stale store-image assertions; await chat modal press).
- Targeted rerun: 3 suites, 24 tests passed, including 3 new hook tests.
- Offline gate: 6 tests passed.
- Combined unique affected coverage: 30 suites, 355 tests passed across these runs, including 36 additional legal/map-mode tests.
- Baseline source transform confirmed the store-image expectation failure existed before this work. Its saved log/results are included.
- Pure width tests cover 320, 360, 392, 428, 599, 600, 800 dp, asymmetric safe areas, and exhausted width. Hook tests cover safe-area ownership and removing phone overrides at the tablet breakpoint.
- Native keyboard behavior, real map rendering, and all-screen native light/dark review remain pending.

## Rendered Login comparison (React Native Web)

| Viewport | Original field width | New field width | New side margin | Input height | Font size |
|---|---|---|---|---|---|
| 320 | 272 | 296 | 12 | 54 | 15px |
| 360 | 312 | 336 | 12 | 54 | 15px |
| 392 | 344 | 368 | 12 | 54 | 15px |
| 428 | 380 | 404 | 12 | 54 | 15px |
| 800 | 532 | 532 | 134 | 54 | 15px |

The 800 dp tablet fields retain their original 532 dp width. Captures: [original Login](login-before-360-light.png), [wider Login](login-after-360-light.png), [onboarding source preview](onboarding-after-360-light.png). These are supplemental browser previews, not Galaxy A04 captures.

## Final checks

- `node node_modules/typescript/bin/tsc --noEmit`: exit 0.
- Task-only whitespace checks against the saved working tree: passed for every implementation/test file.
- Login rendered in light and dark modes at 360 dp with 336 dp-wide fields; the 320 dp dark-mode required-field state retained 296 dp-wide fields and no horizontal page overflow.
- [Dark-mode Login capture](login-after-360-dark.png), [320 dp validation capture](login-after-320-dark-validation.png).

## Delivery

No APK build, OTA publication, version bump, backend API, navigation contract, or persistent data change. Physical Galaxy A04 acceptance is still required before release.
