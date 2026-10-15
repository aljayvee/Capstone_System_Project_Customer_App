# 🌐 DUAL-MODEL COLLABORATION TUNNEL (CLAUDE ◄► GEMINI) - CUSTOMER APP

> **ALWAYS ACTIVE IN ALL SESSIONS**: This file is the shared living memory between Claude App (Anthropic) and Antigravity 2.0 (Google AI / Gemini) for the Expo React Native Customer App.

---

## 📡 Tunnel State
* **Active Mission**: Pabili Review & Track Screen Visual Streamlining (Removed "What happens next", Updated Delivery Fee Label, Removed Compass Icon & Shortened Track Subtitle)
* **Current Driver**: Antigravity 2.0 (Gemini 3.8 Flash)
* **Target Workspace**: `CustomerApp` (Expo SDK React Native)
* **Last Updated**: 2026-10-14

---

## 2026-10-14 - Pabili Review & Track Screen Visual Streamlining (`PabiliReviewScreen.tsx`, `TrackTab.tsx`) (Antigravity 2.0, Gemini 3.8 Flash)
* **Status**: [Executed & Deeply Verified by Antigravity 2.0 - `npx tsc --noEmit` passed with 0 errors, Jest test suites passed 100% (25/25 in `PabiliScreens.test.tsx`)].
* **Feature & Interaction Specification**:
  - **Pabili Step "Review" (`PabiliReviewScreen.tsx`)**:
    - Removed `<WhatHappensNextCard />` component and its import, reducing visual clutter above the persistent checkout bottom dock.
    - Updated quote fee label from `"Delivery from ${formatPeso(quote.fees.subtotal)}"` to `"Starting Delivery ${formatPeso(quote.fees.subtotal)}"`.
  - **Track Screen Empty State (`TrackTab.tsx`)**:
    - Removed the decorative `Compass` vector icon and its circular wrapper (`emptyIconWrapper`), creating a clean, minimal typography-focused empty view.
    - Cleaned up unused `Compass` import from `lucide-react-native` and removed unused `emptyIconWrapper` StyleSheet definition.
    - Replaced the extended explanation copy with concise notification text: `"You have no active errands in progress."`.
* **Files Modified**:
  - `src/screens/pabili/PabiliReviewScreen.tsx`
  - `src/screens/portal/TrackTab.tsx`
* **Verification Ledger**:
  - `npx tsc --noEmit`: 0 TypeScript compiler errors.
  - `npm test -- PabiliScreens.test.tsx --watchAll=false`: 25/25 tests passed (100%).

---

## 2026-10-13 - Removed "When were you born?" Step from Registration Wizard (`RegisterScreen.tsx`) (Antigravity 2.0, Gemini 3.8 Flash)
* **Status**: [Executed & Deeply Verified by Antigravity 2.0 - `npx tsc --noEmit` passed with 0 errors, Jest test suites passed 100% (7/7 in `RegisterScreen.test.tsx`, 22/22 across `AccountReminder.test.tsx` and `EditAccountScreen.test.tsx`)].
* **Feature & Interaction Specification**:
  - **Removed "When were you born?" Step**:
    - Reduced `TOTAL_STEPS` from 5 to 4:
      - Step 1: Legal Name (`What's your name?`) -> `handleStep1Next` transitions directly to Step 2.
      - Step 2: Contact & Verification Choice (`Account Verification`) -> sends OTP or launches Firebase phone verification.
      - Step 3: 6-Digit OTP Verification (`Enter 6-Digit Code`) -> verifies code with backend.
      - Step 4: Account Credentials (`Create Credentials`) -> submits account creation without `birthdate`.
    - Removed `CalendarPickerModal` import, `showCalendarModal` state, and `birthdate` state from `RegisterScreen.tsx`.
    - Removed unused styles (`dateSelectText`, `infoCard`, `infoCardText`).
    - Backend schema (`customerRegisterSchema`) defines `birthdate: z.string().trim().optional()`, ensuring registration succeeds cleanly without client birthdate payload.
  - **Updated Test Suite (`RegisterScreen.test.tsx`)**:
    - Updated wizard step assertions from `STEP 1 OF 5` to `STEP 1 OF 4`.
    - Removed mock of `CalendarPickerModal` and removed intermediate date selection click step in `advanceToOtpStep`.
* **Files Modified**:
  - `src/screens/RegisterScreen.tsx`
  - `src/__tests__/RegisterScreen.test.tsx`
* **Verification Ledger**:
  - `npx tsc --noEmit`: 0 TypeScript compiler errors.
  - `npm test -- RegisterScreen.test.tsx --watchAll=false`: 7/7 tests passed (100%).
  - `npm test -- AccountReminder.test.tsx EditAccountScreen.test.tsx --watchAll=false`: 22/22 tests passed (100%).

---

## 2026-10-12 - Merchant Category Hierarchy Prioritization & Adaptive Badging (`HomeTab.tsx`, `merchantCategories.ts`) (Antigravity 2.0, Gemini 3.8 Flash)
* **Status**: [Executed & Deeply Verified - CustomerApp `npx tsc --noEmit` clean with 0 errors, Jest test suites passed 100% (56/56 in `HomeTab.test.tsx` and `merchantCategories.test.ts`, 13/13 in `NearbyStoresRow.test.tsx`), Live VPS Deployed & Reloaded (109.123.239.182)].
* **Feature & Interaction Specification**:
  - **Dynamic Hierarchy Prioritization**:
    - For new accounts (cold-start): The server ranks categories by base utility weight (Fast Food: 100, Pharmacy: 95, Supermarket: 90, Bakery: 85) + platform order volume + verified places. The top 4 categories are automatically stamped with `isRecommended: true`.
    - For returning customers: Personal past orders heavily boost frequented categories (+500 pts per completed order), vaulting categories the user ordered from directly to the top with `orderedBefore: true` and `isRecommended: true` (if among the top 4).
    - Local Search & Interaction Affinity: Client tracks category searches, keyword matches (e.g. "medicine" -> Pharmacy, "burger" -> Fast Food), and store picks via `recordCategorySearchAffinity()`, dynamically promoting frequently queried categories into the top 4.
  - **Restrained Surface Badging**:
    - `MerchantCategoryRow` renders understated badge pills inside `categoryImageContainer`:
      - `[RECOMMENDED]`: Solid red pill (`#DC2626`) with Lucide vector `Sparkles` icon for the first 4 slots.
      - `[ORDERED BEFORE]`: Solid emerald pill (`#059669`) with Lucide vector `Clock` icon for categories the customer has ordered from previously.
    - Strictly compliant with Anti-AI-Slop invariants: restrained 4px border radius, no halos, monochromatic Lucide SVG icons, zero emojis.
* **Files Modified**:
  - `src/services/merchantCategories.ts`
  - `src/screens/portal/HomeTab.tsx`
  - `src/screens/errand/MerchantCategoryStoresScreen.tsx`
  - `src/screens/StoreSearchScreen.tsx`
  - `src/components/pabili/EstablishmentPicker.tsx`
  - `src/__tests__/merchantCategories.test.ts`
  - `src/__tests__/HomeTab.test.tsx`
* **Verification Ledger**:
  - `npx tsc --noEmit`: 0 TypeScript compiler errors.
  - `npm test -- HomeTab.test.tsx merchantCategories.test.ts`: 56/56 passed (100%).
  - `npm test -- NearbyStoresRow.test.tsx`: 13/13 passed (100%).

---

## 2026-10-12 - Google Places Storefront Photo Fallback Restoration (Antigravity 2.0, Gemini 3.8 Flash)
* **Status**: [Verified Live - Backend VPS Deployed & Online (109.123.239.182), CustomerApp `npx tsc --noEmit` clean with 0 errors, Jest test suites passed 100% (13/13 in `NearbyStoresRow.test.tsx`)].
* **Specification & Operational Notes**:
  - The missing store photos reported by customers were caused by an overly strict landscape storefront photo filter on the server backend (`googlePlacesClient.ts`) that dropped portrait and square Google Maps photos without fallback.
  - With the server fallback restored, all stores with Google Maps photos (portrait, square, landscape) now stream valid image URLs (`photoUrl`) to the mobile app.
  - Verified on live production backend: *Coffee Bear Cafe*, *Decent Cup Coffee Shop*, *Fur in Stitches*, *Jollibee Tacurong*, and *Savemore Primark* all successfully return valid photo URLs to the Customer App.

---

## 2026-10-12 - Bottom Navigation Upward Scroll Stabilization & PanResponder Conflict Elimination (`BottomNav.tsx`, `CustomerPortalScreen.tsx`) (Antigravity 2.0, Gemini 3.8 Flash)
* **Status**: [Executed & Deeply Verified by Antigravity 2.0 - `npx tsc --noEmit` passed with 0 errors, Jest test suites passed 100% (43/43 tests across `CustomerPortalScrollGestures.test.tsx`, `BottomNav.test.tsx`, `CustomerPortalOnboardingTransition.test.tsx`, `HomeTab.test.tsx`, `DarkModeSubstrates.test.tsx`, and `LightModeSubstrates.test.tsx`)].
* **Feature & Interaction Specification**:
  - **Eliminated PanResponder Gesture Hijacking from `BottomNav.tsx`**:
    - Removed `panResponder` from `src/components/BottomNav.tsx` and unhooked `{...panResponder.panHandlers}` from `<Animated.View testID="bottom-nav-capsule">`.
    - Previously, `PanResponder` intercepted touches on the capsule and fired `handleToggleVisible(false)` whenever `gestureState.dy > 10` (swiping downward). When a user swiped down across the lower screen area to scroll toward the top of the feed, touching the capsule triggered `handleToggleVisible(false)` while the `ScrollView` simultaneously triggered `showNavOnly()`, creating an erratic slide-down/slide-up oscillation loop.
    - Navigation bar visibility is now exclusively coordinated by the page scroll state in `CustomerPortalScreen.tsx`.
  - **Directional Scroll Tracking & Drag End Stabilization (`CustomerPortalScreen.tsx`)**:
    - Added `dragInitialY` and `scrollDirection` (`'up' | 'down' | null`) refs to track the true overall gesture stroke instead of resetting delta anchors mid-drag.
    - In `handleScrollEndDrag`: If the user was scrolling toward the top (`totalDelta < -20 || velocityY < -0.2`), the navigation bar is strictly preserved in its visible state (`showNavOnly()`), preventing Android finger-release velocity bounce from triggering `hideBars()`.
    - In `handleTabScroll`: Momentum scrolling upward maintains `scrollDirection.current = 'up'` and keeps the bottom navigation capsule stably visible without bounce-settling flicker.
* **Files Modified**:
  - `src/components/BottomNav.tsx`
  - `src/screens/CustomerPortalScreen.tsx`
  - `src/__tests__/CustomerPortalScrollGestures.test.tsx`
* **Verification Ledger**:
  - `npx tsc --noEmit`: 0 TypeScript compiler errors.
  - `npm test -- CustomerPortalScrollGestures.test.tsx BottomNav.test.tsx`: 15/15 passed.
  - `npm test -- CustomerPortalScrollGestures.test.tsx BottomNav.test.tsx CustomerPortalOnboardingTransition.test.tsx HomeTab.test.tsx DarkModeSubstrates.test.tsx LightModeSubstrates.test.tsx`: 43/43 passed across 6 test suites.

---

## 2026-10-12 - Precision Store Location Filtering (Option 1) & Verified Catalogue Badging (Option 3) (`establishments.ts`, `StoreCard.tsx`) (Antigravity 2.0, Gemini 3.8 Flash)
* **Status**: [Executed & Deeply Verified by Antigravity 2.0 - `npx tsc --noEmit` passed with 0 errors, Jest test suites passed 100% (`NearbyStoresRow.test.tsx`)].
* **Feature & Interaction Specification**:
  - **Option 1: Street-Only Road Pin Filtering (`isStreetOnlyName`)**:
    - Added `isStreetOnlyName(name: string)` in `src/services/establishments.ts` to reject places whose name is solely a road/highway identifier (e.g. `"Lesdema street tacurong city"`, `"Ledesma street"`, `"National Highway"`).
    - Added `KNOWN_BUSINESS_TOKENS` with major national/local brands to ensure authentic shops (`Mercury Drug`, `Jollibee`, etc.) are never misclassified as roads.
    - Wired `isStreetOnlyName()` into `isPabiliEstablishment()`.
  - **Option 3: Verified Catalogue Badging (`isVerified?: boolean`)**:
    - Added `isVerified?: boolean` to `Establishment` type.
    - Updated `StoreCard.tsx` to render a clean, understated `[VERIFIED]` badge pill with Lucide vector `Check` icon beside the store name for verified catalogue stores.
    - Styled with subtle emerald tinting (`#059669` / `#34D399`) and restrained 4px border radius, strictly conforming to Anti-AI-Slop surface purity invariants.
* **Files Modified**:
  - `src/services/establishments.ts`
  - `src/components/stores/StoreCard.tsx`
* **Verification Ledger**:
  - `npx tsc --noEmit`: 0 errors.
  - `npm test -- NearbyStoresRow.test.tsx`: 13/13 passed.

---

## 2026-10-12 - Search Dock Lock & Slow Top Restoration (Zero Mid-Scroll Sensitivity Shake) (`CustomerPortalScreen.tsx`, `HomeTab.tsx`) (Antigravity 2.0, Gemini 3.8 Flash)
* **Status**: [Executed & Deeply Verified by Antigravity 2.0 - `npx tsc --noEmit` passed with 0 errors, Jest test suites passed 100% (42/42 tests across `CustomerPortalScrollGestures.test.tsx`, `CustomerPortalOnboardingTransition.test.tsx`, `HomeTab.test.tsx`, `BottomNav.test.tsx`, `DarkModeSubstrates.test.tsx`, and `LightModeSubstrates.test.tsx`)].
* **Feature & Interaction Specification**:
  - **Mid-Feed Search Position Lock**:
    - When swiping up, the search button docks into the top header and the bottom navigation bar hides.
    - When the user scrolls or swipes down anywhere mid-feed (`currentY > 20`), the search button position **does NOT move back**. It stays firmly locked in the top header dock.
    - Decisive swipe down gestures show the bottom navigation capsule (`showNavOnly()`), which floats absolutely without altering the ScrollView height or triggering layout resize loops.
  - **Slow & Smooth Top-Only Restoration**:
    - The search button ONLY backs down into its starting content position when the user scrolls all the way back to the top of the page (`currentY <= 20`).
    - The top bar expansion animation timing was smoothed and slowed to `duration: 380ms` (opacity `340ms`) with gentle cubic easing (`Easing.bezier(0.25, 0.1, 0.25, 1)`), eliminating any abrupt snap or sensitivity shaking.
* **Files Modified**:
  - `src/screens/CustomerPortalScreen.tsx` (lines 135–285)
  - `src/__tests__/CustomerPortalScrollGestures.test.tsx` (added mid-feed swipe down assertion)
* **Verification Ledger**:
  - `npx tsc --noEmit`: 0 errors.
  - `npm test`: 42/42 tests passed across 6 test suites.

---

## 2026-10-12 - Strict Non-Pabili Search Query & Establishment Filtering + Closed Store User-Friendly Notice (`"Opens at [12h]"` / `"Temporarily Unavailable"`) & Tacurong Service Area Safeguard (Antigravity 2.0, Gemini 3.8 Flash)
* **Status**: [Executed & Deeply Verified by Antigravity 2.0 - `npx tsc --noEmit` passed with 0 errors, Jest test suites passed 100% (`NearbyStoresRow.test.tsx`)].
* **Feature & Interaction Specification**:
  - **Strict Non-Pabili Search Query & Establishment Filtering (`establishments.ts`, `merchantCategories.ts`)**:
    - Added `isPabiliSearchQuery(query)` and expanded `NON_PABILI_STORE_PHRASES` / `NON_PABILI_STORE_TOKENS` in `src/services/establishments.ts` and `src/services/merchantCategories.ts` to block:
      1. **Police Outposts / Stations** (`police`, `outpost`, `precinct`, `pnp`, `station`/`stations` except Water Refilling Stations)
      2. **Government Offices** (`government`, `govt`, `office`/`offices`, `city hall`, `municipal hall`, `barangay hall`, `capitol`, `lgu`, `bir`, `lto`, `sss`, `philhealth`, `pagibig`, `dswd`, `comelec`, `dti`, `dole`, `dpwh`, `denr`, `nbi`, `psa`, etc.)
      3. **Network / Telecom / ISP** (`network`, `networks`, `networking`, `telecom`, `telecommunications`, `isp`, `pldt`, `converge`, `skycable`, `broadband`, `cable network`, `radio network`, `tv network`)
      4. **Internet Cafe / Computer Shops** (`internet`, `internet cafe`, `cyber cafe`, `computer shop`, `net cafe`, `piso net`, `pisonet`, `icafe`, `gaming cafe`, `esports`)
      5. **Nightclubs / Bars / KTV** (`nightclub`, `night club`, `disco`, `discotheque`, `ktv`, `beerhouse`, `restobar`, `pub`, `videoke`, `karaoke`, `comedy club`, `casino`)
      6. **Logistics & Courier** (`logistics`, `logistic`, `logicstics`, `courier`, `cargo`, `freight`, `shipping`, `forwarder`, `trucking`, `hauling`, `lbc`, `jrs`, `ninjavan`, `spx`, `dhl`, `fedex`, `entrego`, `2go`)
      7. **Express Outlets** (`express`, `xpress`, `j t express`, `lbc express`, `jrs express`, `flash express`, `2go express`, `spx express`, `dhl express`, `palawan express`)
    - Wired `if (params.q && !isPabiliSearchQuery(params.q))` into `searchEstablishments()` in `src/services/establishments.ts` so non-Pabili search queries short-circuit to `{ items: [], google: 'ok', hasMore: false }` before making network requests.
  - **Closed Store Grey Overlay with User-Friendly Notice & Non-Clickable/Non-Selectable Guard (`StoreCard.tsx`, `useStorePicks.ts`, `establishments.ts`)**:
    - Added `isOpen?: boolean` and `closedReason?: string | null` to `Establishment`.
    - In `StoreCard.tsx`, when `store.isOpen === false` (`isClosed`):
      - Resolves `closedNotice = store.closedReason?.trim() || 'Temporarily Unavailable'`.
      - Renders a translucent slate-grey overlay (`testID="${testIDPrefix}-closed-overlay-${store.key}"`) with a user-friendly notice pill badge (`testID="${testIDPrefix}-closed-badge-${store.key}"`, e.g., `"Opens at 8:00 AM"`, `"Opens at 5:30 AM"`, or `"Temporarily Unavailable"`) over the store thumbnail instead of a blunt `"Closed"` label.
      - Sets `disabled={isClosed || undefined}` and blocks `onPress` so closed stores cannot be tapped or opened.
      - Hides the selection circle on multi-store pick screens and mutes the store title and distance text.
    - In `useStorePicks.ts`, added an early return `if (store.isOpen === false) return;` inside `toggle(store)` as a defensive guard so closed stores can never be added to a customer's errand.
  - **Out-of-Service-Area Customer Location Safeguard (`outsideServiceArea`)**:
    - Added `OUTSIDE_SERVICE_AREA_MESSAGE = "Sugo Express isn't in your area yet."` and client-side `isWithinTacurongServiceArea(point)` in `src/services/establishments.ts`.
    - Updated `searchEstablishments()` and `fetchPopularEstablishments()` to short-circuit with `{ items: [], googleAvailable: false, hasMore: false, outsideServiceArea: true }` when `near` is outside the Tacurong City service area (or when the backend returns `outsideServiceArea: true`).
* **Files Modified**:
  - `src/services/establishments.ts`
  - `src/services/merchantCategories.ts`
  - `src/hooks/useEstablishmentSearch.ts`
  - `src/hooks/usePopularStores.ts`
  - `src/hooks/usePagedStores.ts`
  - `src/hooks/useNearbyStoresPages.ts`
  - `src/hooks/useStorePicks.ts`
  - `src/components/stores/StoreCard.tsx`
  - `src/components/PopularStoresRow.tsx`
  - `src/components/NearbyStoresRow.tsx`
  - `src/components/stores/StorePickScreen.tsx`
  - `src/screens/errand/MerchantCategoryStoresScreen.tsx`
  - `src/components/pabili/EstablishmentPicker.tsx`
  - `src/__tests__/NearbyStoresRow.test.tsx`
* **Verification Ledger**:
  - `npx tsc --noEmit`: 0 TypeScript compiler errors.
  - `npx jest src/__tests__/NearbyStoresRow.test.tsx --runInBand`: 13/13 tests passed (100%).

---

## 2026-10-12 - Eliminate Repeated Category Cover Photo Fallback on Store Cards (`StoreCard.tsx`) (Antigravity 2.0, Gemini 3.8 Flash)
* **Status**: [Executed & Deeply Verified by Antigravity 2.0 - `npx tsc --noEmit` passed with 0 errors, Jest test suites passed 100% (54/54 tests across `NearbyStoresRow.test.tsx`, `PopularStores.test.tsx`, `NearbyStoresScreen.test.tsx`, `StoreSearchScreen.test.tsx`, and `MerchantCategoryStoresScreen.test.tsx`)].
* **Feature & Interaction Specification**:
  - **Direct Category Icon Fallback on `StoreCard` (`src/components/stores/StoreCard.tsx`)**:
    - Removed the intermediate `categoryUri` (`categoryImages[resolvedCategoryId]`) fallback inside `StorePhoto` so individual stores without a Google storefront photo (or when a photo URL fails to load) step directly to their clean category vector icon (`getCategoryIcon`) instead of repeating the Merchant Category cover image across multiple store cards.
    - Kept `categoryImages` strictly on the Home tab's Merchant Categories Bento Grid (`DraggableBentoMosaic.tsx`) while preserving optional `categoryImages` prop compatibility on `StoreCardProps`.
* **Files Modified**:
  - `src/components/stores/StoreCard.tsx` (lines 150–215)
  - `src/__tests__/NearbyStoresRow.test.tsx` (lines 176–200)
* **Verification Ledger**:
  - `npx tsc --noEmit`: 0 TypeScript compiler errors.
  - `npx jest src/__tests__/NearbyStoresRow.test.tsx src/__tests__/PopularStores.test.tsx src/__tests__/NearbyStoresScreen.test.tsx src/__tests__/StoreSearchScreen.test.tsx src/__tests__/MerchantCategoryStoresScreen.test.tsx --runInBand`: 54/54 tests passed (100%).

---

## 2026-10-12 - Fix Home Screen Scroll Oscillation & Jitter Loop Near Recent Activity (Antigravity 2.0, Gemini 3.8 Flash High)
* **Status**: [Executed & Deeply Verified by Antigravity 2.0 - npx tsc --noEmit passed 0 errors, Jest test suites passed 100% (36/36 tests across CustomerPortalOnboardingTransition.test.tsx, LightModeSubstrates.test.tsx, HomeTab.test.tsx, DarkModeSubstrates.test.tsx, and BottomNav.test.tsx)].
* **Feature & Interaction Specification**:
  - **Eliminated Scroll Feedback & Jitter Oscillation (`CustomerPortalScreen.tsx`)**:
    - **Root Cause**: Near the bottom of `HomeTab`'s ScrollView (at the last merchants before Recent Activity), native overscroll bouncing coupled with toggling `headerRowHeight` (56dp to 0dp) was altering the ScrollView's viewport bounds ($H_{\text{viewport}}$), which caused the native scroll engine to clamp `contentOffset.y`, firing alternating $\Delta y > 10$ and $\Delta y < -10$ on consecutive frames in an infinite positive feedback loop.
    - **Bottom Overscroll Lock**: Added a defensive guard in `handleTabScroll`: when `contentHeight > 0 && viewportHeight > 0 && currentY + viewportHeight >= contentHeight - 70`, visibility toggling is strictly locked. Overscroll bounce settling at the bottom of the list can never trigger reverse visibility flips.
    - **Jitter & Micro-Tremor Filtering**: Added an absolute displacement threshold (`Math.abs(dy) < 16` returns early) and increased directional thresholds (`dy > 16 && currentY > 50` to hide, `dy < -16` to show).
    - **State Deduplication**: Added `headerVisibleRef` tracking so `setState` is strictly dispatched once per true visibility transition rather than spamming state updates and re-triggering Reanimated timing on every scroll tick.
    - **Clean Box-Model Collapse**: Moved `paddingBottom: Spacing.sm + 2` inside the inner `topBarRow`, allowing `animatedHeaderRow` to collapse cleanly to $0\text{dp}$ with `overflow: 'hidden'` and eliminating residual padding that caused box squishing.
* **Files Modified**:
  - `src/screens/CustomerPortalScreen.tsx`
* **Verification Ledger**:
  - `npx tsc --noEmit`: 0 TypeScript compiler errors.
  - `npx jest src/__tests__/CustomerPortalOnboardingTransition.test.tsx src/__tests__/HomeTab.test.tsx src/__tests__/BottomNav.test.tsx src/__tests__/DarkModeSubstrates.test.tsx src/__tests__/LightModeSubstrates.test.tsx --runInBand`: 36/36 tests passed (100%).

---

## 2026-10-12 - Strict Merchant Category Store Filtering on `MerchantCategoryStoresScreen` (Antigravity 2.0, Gemini 3.8 Flash High)
* **Status**: [Executed & Deeply Verified by Antigravity 2.0 - npx tsc --noEmit passed 0 errors, Jest test suites passed 100% (54/54 tests across MerchantCategoryStoresScreen.test.tsx, StoreSearchScreen.test.tsx, PopularStores.test.tsx, NearbyStoresRow.test.tsx, and NearbyStoresScreen.test.tsx)].
* **Feature & Interaction Specification**:
  - **Preserved Existing Visual Design**: Kept the exact visual layout, typography, spacing, and unboxed `StoreCard` design of `HomeTab.tsx`, `MerchantCategoryStoresScreen.tsx`, and `StoreCard.tsx`.
  - **Strict Client-Side Category Matching (`src/services/establishments.ts`)**:
    - Added `doesEstablishmentMatchCategory(store, categoryId, categoryName)` with singularized word normalization (`singularCategoryWord`) and compound segment splitting (`splitCategorySegments`) so plural/singular category names (`"Restaurants & Cafes"` vs `"Restaurant"` / `"Cafe"`, `"Supermarkets & Groceries"` vs `"Supermarket & Grocery"`) match accurately, while conflicting `categoryName`s on colliding `categoryId`s are rejected.
    - Applied `doesEstablishmentMatchCategory` inside both `searchEstablishments()` and `fetchPopularEstablishments()`.
  - **Category-Scoped Hooks & Screen Filtering (`usePopularStores.ts`, `useEstablishmentSearch.ts`, `EstablishmentPicker.tsx`, `MerchantCategoryStoresScreen.tsx`)**:
    - Updated `usePopularStores` (supporting both 4-arg and 5-arg invocation signatures), `usePopularStoresPages`, `useEstablishmentSearch`, and `EstablishmentPicker` to accept and forward `categoryName`.
    - Updated `MerchantCategoryStoresScreen.tsx` to strictly filter `categoryStores`, `nearbyStores`, and `popularStores` via `doesEstablishmentMatchCategory(store, category.id, category.name)`, waiting for `popular` to settle before falling back to rated stores from `categoryStores`, and passed `cataloguePool = [...categoryStores, ...popularStores]` to `useStorePicks`.
* **Files Modified**:
  - `src/services/establishments.ts`
  - `src/hooks/usePopularStores.ts`
  - `src/hooks/useEstablishmentSearch.ts`
  - `src/components/pabili/EstablishmentPicker.tsx`
  - `src/screens/errand/MerchantCategoryStoresScreen.tsx`
  - `src/__tests__/MerchantCategoryStoresScreen.test.tsx`
* **Verification Ledger**:
  - `npx tsc --noEmit`: 0 TypeScript compiler errors.
  - `npx jest src/__tests__/MerchantCategoryStoresScreen.test.tsx src/__tests__/StoreSearchScreen.test.tsx src/__tests__/PopularStores.test.tsx src/__tests__/NearbyStoresRow.test.tsx src/__tests__/NearbyStoresScreen.test.tsx --runInBand`: 54/54 tests passed (100%).

---

## 2026-10-12 - Home Screen Collapsible Header Replaced by Sticky Search Button on Scroll (Antigravity 2.0, Gemini 3.8 Flash High)
* **Status**: [Executed & Deeply Verified by Antigravity 2.0 - npx tsc --noEmit passed 0 errors, Jest test suites passed 100% (36/36 tests across CustomerPortalOnboardingTransition.test.tsx, BottomNav.test.tsx, LightModeSubstrates.test.tsx, HomeTab.test.tsx, and DarkModeSubstrates.test.tsx)].
* **Feature & Interaction Specification**:
  - **Collapsible Top Header with Search Button Docking (`CustomerPortalScreen.tsx`)**:
    - Added `headerVisible` state coupled with React Native Reanimated shared values (`headerRowHeight = 56`, `headerTranslateY = 0`, `headerOpacity = 1`).
    - Wrapped the top header row (Customer Profile Avatar, Display Name, Delivery Location Pin Button, and Notification Bell) in an `<Animated.View style={[styles.animatedHeaderRow, animatedHeaderStyle]} pointerEvents={headerVisible ? 'auto' : 'none'} testID="home-collapsible-header">`.
    - Moved `paddingBottom: Spacing.sm + 2` inside the collapsing container with `overflow: 'hidden'`, preserving clean `paddingTop: insets.top + Spacing.xs` on `styles.topBar`.
    - **Swipe Up to Scroll Down (`dy > 10 && currentY > 30`)**:
      - `setHeaderVisible(false)` smoothly animates the top header row upwards (`translateY: -56dp`), fading opacity to 0 and collapsing height to 0 with `Easing.bezier(0.25, 0.1, 0.25, 1)` over 260ms.
      - As the header row collapses, `mainContent` and `HomeTab` smoothly rise up by $56\text{dp}$.
      - The liquid glass search bar (`home-sticky-search`, docked at `top: 0` inside `HomeTab`) smoothly moves directly into the vacated header slot directly below the device status bar (`insets.top + Spacing.xs`).
      - The header is thus seamlessly hidden and replaced by the search button/bar at the top of the Home Screen!
    - **Swipe Down to Scroll Up / Reaching Top (`dy < -10` or `currentY <= 15`)**:
      - `setHeaderVisible(true)` smoothly expands the top header row back to $56\text{dp}$ and restores opacity to 1.
      - The search button/bar smoothly returns to its resting position below the header.
    - **Tab Switching Guard (`handleTabChange`)**:
      - Resets `setHeaderVisible(true)` when switching tabs or focusing on new views, ensuring the header is always available when navigating.
* **Files Modified**:
  - `src/screens/CustomerPortalScreen.tsx`
* **Verification Ledger**:
  - `npx tsc --noEmit`: 0 TypeScript compiler errors.
  - `npx jest src/__tests__/CustomerPortalOnboardingTransition.test.tsx src/__tests__/HomeTab.test.tsx src/__tests__/BottomNav.test.tsx src/__tests__/DarkModeSubstrates.test.tsx src/__tests__/LightModeSubstrates.test.tsx --runInBand`: 36/36 tests passed (100%).

---

## 2026-10-12 - Bottom Navigation Bar Smooth Animated Hide on Scroll Down & Show on Scroll Up (Antigravity 2.0, Gemini 3.8 Flash High)
* **Status**: [Executed & Deeply Verified by Antigravity 2.0 - npx tsc --noEmit passed 0 errors, Jest test suites passed 100% (32/32 tests across BottomNav.test.tsx, DarkModeSubstrates.test.tsx, LightModeSubstrates.test.tsx, and HomeTab.test.tsx)].
* **Feature & Interaction Specification**:
  - **Animated Downward Hiding & Restoration (`BottomNav.tsx`)**:
    - Added `visible?: boolean;` and `onVisibilityChange?: (visible: boolean) => void;` props to `BottomNavProps`.
    - Integrated React Native Reanimated `useSharedValue(isNavVisible ? 0 : 140)` with `withTiming(..., { duration: 280, easing: Easing.bezier(0.25, 0.1, 0.25, 1) })`.
    - Wrapped the floating liquid glass capsule in `<Animated.View style={[styles.floatingCapsule, animatedCapsuleStyle, ...]}>`.
    - Added dynamic `pointerEvents={isNavVisible ? 'auto' : 'none'}` on the animated capsule so when translated off-screen, touches pass cleanly through to underlying scroll lists or buttons.
    - Updated the capsule `panResponder` to trigger `handleToggleVisible(false)` on swipe down and `handleToggleVisible(true)` on swipe up.
  - **Scroll Detection & Viewport Reset (`CustomerPortalScreen.tsx`)**:
    - Added `navVisible` state in `CustomerPortalScreen.tsx`.
    - Enhanced `handleTabScroll`:
      - When scrolling down (user swiping up to read further down: `dy > 10 && currentY > 30`), triggers `setNavVisible(false)`.
      - When scrolling up (user swiping down: `dy < -10`), triggers `setNavVisible(true)`.
      - When reaching near top (`currentY <= 15`) or on bounce reset, forces `setNavVisible(true)`.
    - In `handleTabChange`: resets `setNavVisible(true)` and `lastScrollY.current = 0` whenever switching tabs, guaranteeing the navigation bar is immediately visible on newly selected screens.
    - Wired `visible={navVisible}` and `onVisibilityChange={setNavVisible}` to `<BottomNav />`.
  - **Unit Test Coverage (`BottomNav.test.tsx`)**:
    - Added tests for `visible={true}` (checking `pointerEvents="auto"`) and `visible={false}` (checking `pointerEvents="none"`).
* **Files Modified**:
  - `src/components/BottomNav.tsx`
  - `src/screens/CustomerPortalScreen.tsx`
  - `src/__tests__/BottomNav.test.tsx`
* **Verification Ledger**:
  - `npx tsc --noEmit`: 0 TypeScript compiler errors.
  - `npx jest src/__tests__/BottomNav.test.tsx src/__tests__/DarkModeSubstrates.test.tsx src/__tests__/LightModeSubstrates.test.tsx src/__tests__/HomeTab.test.tsx --runInBand`: 32/32 tests passed (100%).

---

## 2026-10-12 - Unified Unboxed Store Template Across Home, Popular, Nearby & Merchant Category Screens + Small Merchant Descriptions (Antigravity 2.0, Gemini 3.8 Flash High)
* **Status**: [Executed & Deeply Verified by Antigravity 2.0 - npx tsc --noEmit passed 0 errors, Jest test suites passed 100% (67/67 tests across MerchantCategoryStoresScreen.test.tsx, HomeTab.test.tsx, PopularStores.test.tsx, NearbyStoresScreen.test.tsx, NearbyStoresRow.test.tsx, StoreSearchScreen.test.tsx, and ErrandFormScreen.test.tsx)].
* **Feature & Interaction Specification**:
  - **Small Merchant Category Descriptions (`HomeTab.tsx`, `MerchantCategoryStoresScreen.tsx` & `ErrandFormScreen.tsx`)**:
    - Reduced `categorySubtitle` in `HomeTab.tsx` (`MerchantCategoryRow`), `categoryDescription` in `MerchantCategoryStoresScreen.tsx`, and `categoryCardDesc` in `ErrandFormScreen.tsx` to `scaledPortalFontSize(PortalFontSizes.micro)` (12sp) with `maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}` so merchant descriptions are clearly smaller than the merchant category name (`PortalFontSizes.subheading`, 16sp).
  - **Eliminated Card Boxes on Home, Popular Stores, Stores Near You & Store Search (`StoreCard.tsx`, `StoreCardRow.tsx`, `StorePickScreen.tsx`, `EstablishmentPicker.tsx`)**:
    - Redesigned `StoreCard.tsx` to be strictly unboxed (eliminated outer `borderWidth`, `borderColor`, `backgroundColor: colors.card`, and `Shadows.soft`; applied `borderRadius: BorderRadius.lg` and `overflow: 'hidden'` directly to `StorePhoto` and aligned `styles.body` flush below the photo).
    - Removed outer card borders and background fills from `shimmerCard` and `seeAllCard` in `StoreCardRow.tsx` (Home Screen's Popular Stores and Stores Near You rows), `StorePickScreen.tsx` (`PopularStoresScreen` and `NearbyStoresScreen`), and `EstablishmentPicker.tsx`.
    - Updated `StorePickScreen.tsx` to pass `pages.items` as `cataloguePool` to `useStorePicks(initialPicks ?? [], pages.items)` and `selected={isPicked(item)}` (full `Establishment` object) so `PopularStoresScreen` and `NearbyStoresScreen` deduplicate across Google and catalogue keys while preserving verified `placeId`.
  - **Unified Layout Template, Green Distance Highlight & Ratings on `MerchantCategoryStoresScreen.tsx`**:
    - Replaced `UnboxedStoreItem` in `MerchantCategoryStoresScreen.tsx` with the shared `<StoreCard />` component (`showRating`, `selectable`, `fallbackCategoryId`, `fallbackCategoryName`).
    - All stores on `MerchantCategoryStoresScreen` now share the exact same layout template as `PopularStoresScreen` and `NearbyStoresScreen`: rounded photo with star rating pill (`RatingChip`, e.g. `4.5 (51)`) when rated and `OrderedBeforeChip`, bold store name, `{category} · {distance}` with bold green (`colors.success`) distance highlight (`1.3 km`), address line, and right-aligned `+`/`Check` pick indicator.
    - Aligned horizontal `ScrollView` edge-to-edge bleed (`marginHorizontal: -Spacing.md`), `shimmerBody`, inline state panels, and navigation header geometry (`PortalTouchTargets.compact`, `17sp` header title) with `StoreCardRow.tsx` and `StorePickScreen.tsx`.
* **Files Modified**:
  - `src/screens/portal/HomeTab.tsx`
  - `src/screens/ErrandFormScreen.tsx`
  - `src/components/stores/StoreCard.tsx`
  - `src/components/stores/StoreCardRow.tsx`
  - `src/components/stores/StorePickScreen.tsx`
  - `src/components/pabili/EstablishmentPicker.tsx`
  - `src/screens/errand/MerchantCategoryStoresScreen.tsx`
  - `src/__tests__/HomeTab.test.tsx`
  - `src/__tests__/PopularStores.test.tsx`
  - `src/__tests__/MerchantCategoryStoresScreen.test.tsx`
* **Verification Ledger**:
  - `npx tsc --noEmit`: 0 TypeScript compiler errors.
  - `npx jest src/__tests__/MerchantCategoryStoresScreen.test.tsx src/__tests__/HomeTab.test.tsx src/__tests__/PopularStores.test.tsx src/__tests__/NearbyStoresScreen.test.tsx src/__tests__/NearbyStoresRow.test.tsx src/__tests__/StoreSearchScreen.test.tsx src/__tests__/ErrandFormScreen.test.tsx --runInBand`: 67/67 tests passed (100%).

---

## 2026-10-11 - Delivery Pin Map Modal Read-Only Invariant (Antigravity 2.0, Gemini 3.8 Flash High)
* **Status**: [Executed & Deeply Verified by Antigravity 2.0 - npx tsc --noEmit passed 0 errors, Jest test suites passed 100% (8/8 tests in MapPreviewField.test.tsx and AccountScreen.test.tsx)].
* **Feature & Interaction Specification**:
  - **Read-Only Map Modal Presentation**:
    - `src/components/MapPreviewField.tsx`:
      - Primary delivery pin rendering decoupled from `editable`: updated to render whenever `props.center` is valid with `draggable={Boolean(props.editable)}`, ensuring current delivery pin is clearly visible at its saved coordinates while remaining non-draggable when `editable={false}`.
      - Map tap interaction disabled: `onPress` on `MapView` evaluates to `undefined` when `!props.editable`, rejecting any tap-to-pin mutations.
      - Modal subtitle updated: displays `"Read-only location view"` when `!props.editable` (versus `"Tap map or drag pin to update location"` when editable).
      - Footer actions: when `props.editable` is false, replaced the `[Cancel]` + `[Save Pinpoint Location]` button pair with a single full-width `[Close]` button (`styles.closeFooterBtn`), completely eliminating the save action and preventing any accidental pinpoint mutations.
  - **Account Views Integration**:
    - `src/screens/portal/AccountTab.tsx` & `src/screens/AccountScreen.tsx`:
      - Set `editable={false}` on `MapPreviewField`.
      - Removed `onConfirm` and `confirmLabel` callbacks, ensuring no pinpoint mutations are dispatched.
      - Updated labels and buttons from "Update Pin" to "View Pin" / "View Delivery Pin on Map".
  - **Unit Tests**:
    - Added comprehensive unit tests in `src/__tests__/MapPreviewField.test.tsx` verifying read-only mode suppresses "Save Pinpoint Location", renders "Close", and closes without invoking `onConfirm`.
* **Files Modified**:
  - `src/components/MapPreviewField.tsx`
  - `src/screens/portal/AccountTab.tsx`
  - `src/screens/AccountScreen.tsx`
  - `src/__tests__/MapPreviewField.test.tsx`
* **Verification Ledger**:
  - `npx tsc --noEmit`: 0 TypeScript compiler errors.
  - `npm test -- src/__tests__/MapPreviewField.test.tsx src/__tests__/AccountScreen.test.tsx --watchAll=false --runInBand`: 8/8 tests passed (100%).

---

## 2026-10-11 - Messages & Support Top Controls & Spacing Calibration (Antigravity 2.0, Gemini 3.8 Flash High)
* **Status**: [Executed & Deeply Verified by Antigravity 2.0 - npx tsc --noEmit passed 0 errors, Jest test suites passed 100% (5/5 tests in ChatTab.test.tsx, 15/15 tests in Substrates.test.tsx)].
* **Feature & Interaction Specification**:
  - **Position & Spacing Parity with My Errands Screen (`ErrandsTab.tsx`)**:
    - Calibrated `ChatTab.tsx` header title row to `minHeight: PortalTouchTargets.compact` (44dp), ensuring the "Messages & Support" header row shares the exact vertical footprint and baseline alignment of "My Errands" (which features the 44dp date filter action button).
    - Preserved Apple liquid glass Search bar geometry (`height: 48`, `borderRadius: 24`, `borderWidth: 1.2`, `borderTopWidth: 1.5`, elevation/shadow) with `marginBottom: Spacing.sm` (8dp).
    - Calibrated Dynamic Status Filter Capsules (`All`, `Pending`, `Assigned`, `In Transit`) to `minHeight: 36`, `paddingVertical: moderateScale(8, 0.2)`, `borderRadius: BorderRadius.full` with `marginBottom: Spacing.md` (14dp), identical to `ErrandsTab.tsx`.
    - Calibrated empty state container in `ErrandChannelList.tsx` (`styles.emptyCard`) with `marginTop: Spacing.md` (14dp) and `paddingVertical: Spacing.xxl + 8`, eliminating compressed top-cramming and mirroring `ErrandsTab.tsx`'s `emptyContainer`.
* **Files Modified**:
  - `src/screens/portal/ChatTab.tsx`
  - `src/components/ErrandChannelList.tsx`
* **Verification Ledger**:
  - `npx tsc --noEmit`: 0 TypeScript compiler errors.
  - `npm test -- ChatTab.test.tsx`: 5/5 tests passed (100%).
  - `npm test -- DarkModeSubstrates.test.tsx LightModeSubstrates.test.tsx`: 15/15 tests passed (100%).

---

## 🔒 LOCKED CONTRACT REGISTRY (ZERO-REGRESSION POLICY)
* `[LOCKED]` `React Native Maps Layout Rule` (NEVER embed `MapView` inside `ScrollView` or `FlatList` - causes native crash on Android)
* `[LOCKED]` `Samsung Galaxy A04 Typography Baseline` (`scaledFontSize` factor 0.20, clamped [0.85x, 1.06x], `maxFontSizeMultiplier={1.15-1.25}`)
* `[LOCKED]` `Session Persistence & Auth Navigation Isolation` (`@react-native-async-storage/async-storage` in `AuthContext`, split `!user ? AuthStack : AppStack`)
* `[LOCKED]` `Zero-Hardcoded Address & Nullable State Invariant` (No mock strings; initialize to `null` with actionable setup prompts)
* `[LOCKED]` `Zero-Aura Bottom Navigation & Dark Mode Noise-Free Surfaces` (Crisp neutral drop shadows, no colored halos)
* `[LOCKED]` `Credential Endpoint Refresh Exclusion` (A 401 from any URL matching `CREDENTIAL_ENDPOINTS` in `apiClient.ts` MUST NOT enter the silent-refresh branch, MUST NOT clear tokens, MUST NOT fire `onSessionExpired`. Every CustomerApp auth call lives under `/customers/`, NOT `/auth/` - never narrow this matcher back to a `'/auth/'` substring test)
* `[LOCKED]` `Zero Raw Server Text In UI` (NEVER render `error.message`, `err.response.data.error`, or `err.response.data.message` in a user-facing surface. All failures route through `toUserMessage(err, context)` in `services/errorMessages.ts`. The app targets a deployed backend whose wording - and any CDN/WAF in front of it - is not ours to display)
* `[LOCKED]` `Offline Gate Blocking Invariant` (`OfflineGate` MUST stay a native `<Modal>` and the last child of the root `View` in `AppNavigator`. A plain absolutely-positioned `View` renders BELOW any open RN Modal sheet, leaving the app usable through the hole. `onRequestClose` stays a no-op so Android back cannot dismiss it)
* `[LOCKED]` `Unified Single Splash Screen Invariant` (Android 12+ forces a system splash screen at boot. The OS splash is configured with `splash-blank.png` matching the background color, while `SplashScreen.preventAutoHideAsync()` holds it until `AnimatedSplashScreen` renders its first frame via `onFirstFrame`. This ensures customers see only the animated branded splash screen with zero double-logo or white flash).

## 2026-10-11 - Pabili Store Filter Expansion: Logistics, Salons, Carwash (Antigravity 2.0, Gemini 3.8 Flash High)
* **Status**: [Executed & Verified by Antigravity 2.0 - npx tsc --noEmit passed 0 errors, Jest test suites passed 100% (41/41 tests in merchantCategories.test.ts)].
* **Feature & Interaction Specification**:
  - Expanded non-Pabili denylist in `src/services/merchantCategories.ts`:
    - Added tokens: `logistics`, `logistic`, `logicstics`, `courier`, `cargo`, `freight`, `shipping`, `salon`, `salons`, `barbershop`, `barber`, `spa`, `carwash`.
    - Added phrases: `logistics service`, `courier service`, `express courier`, `cargo forwarder`, `freight forwarder`, `cargo service`, `freight service`, `shipping service`, `beauty salon`, `hair salon`, `nail salon`, `barber shop`, `hair and beauty`, `car wash`, `auto wash`, `car detailing`, `auto detailing`.
  - Expanded store pruning in `src/services/establishments.ts`:
    - Added non-Pabili phrases and tokens for Logistics, Salons, and Carwash to `NON_PABILI_STORE_PHRASES` and `NON_PABILI_STORE_TOKENS`.
  - Unit Tests:
    - Added test suite to `src/__tests__/merchantCategories.test.ts` verifying rejection of Logistics, Logicstics, Salons, Carwash, etc., and acceptance of valid Pabili categories. (41/41 tests passed).
* **Files Modified**:
  - `src/services/merchantCategories.ts`
  - `src/services/establishments.ts`
  - `src/__tests__/merchantCategories.test.ts`
* **Verification Ledger**:
  - `npx tsc --noEmit`: 0 TypeScript compiler errors.
  - `npm test src/__tests__/merchantCategories.test.ts -- --watchAll=false`: 41/41 tests passed (100%).

---

## 2026-10-11 - Find Stores & Establishments Pabili-Only Category Filtering (Antigravity 2.0, Gemini 3.8 Flash High)
* **Status**: [Executed & Deeply Verified by Antigravity 2.0 - npx tsc --noEmit passed with 0 errors, Jest test suites passed 100% (37/37 tests in StoreSearchScreen.test.tsx, NearbyStoresScreen.test.tsx, PopularStores.test.tsx, and 24/24 tests in PabiliScreens.test.tsx)].
* **Feature & Interaction Specification**:
  - **Client-Side Category & Store Filtering**:
    - `src/services/merchantCategories.ts`: Added `isPabiliCategory(name: string): boolean` denylist guard for Schools, Banks, Padala Outlets, and Motor Trades / parts. Filtered both live-fetch and cache-fallback paths in `fetchBackendMerchantCategories()`.
    - `src/services/establishments.ts`: Added `isPabiliEstablishment(store: Establishment): boolean` checking category name, non-Pabili phrases, and non-Pabili whole-word tokens. Filtered responses in `searchEstablishments()`, `fetchPopularEstablishments()`, and `establishmentsFromStops()`.
    - `src/components/pabili/EstablishmentPicker.tsx`: Filtered `results` through `isPabiliEstablishment` so non-Pabili establishments never render in the Find Stores list.
    - `src/screens/StoreSearchScreen.tsx`: Sanitized incoming `category` route parameter with `isPabiliCategory`.
* **Files Modified**:
  - `src/services/merchantCategories.ts`
  - `src/services/establishments.ts`
  - `src/components/pabili/EstablishmentPicker.tsx`
  - `src/screens/StoreSearchScreen.tsx`
* **Verification Ledger**:
  - `npx tsc --noEmit`: 0 TypeScript compiler errors.
  - `npm test -- src/__tests__/StoreSearchScreen.test.tsx src/__tests__/NearbyStoresScreen.test.tsx src/__tests__/PopularStores.test.tsx`: 37/37 tests passed (100%).
  - `npm test -- src/__tests__/PabiliScreens.test.tsx`: 24/24 tests passed (100%).

## 2026-10-11 - Shopping List (List Items) UX Redesign & Compose Ergonomics (Antigravity 2.0, Gemini 3.8 Flash High)
* **Status**: [Executed & Deeply Verified by Antigravity 2.0 - npx tsc --noEmit passed with 0 errors, Jest test suites passed 100% (24/24 tests in PabiliScreens.test.tsx, 15/15 tests in Substrates.test.tsx)].
* **Feature & Interaction Specification**:
  - **PabiliHubScreen (Shopping List / Step 2)**:
    - Removed redundant header title `"What should we buy?"` and subtitle `"Open a store to add its items. Your list is saved as you go."`.
    - Removed heavy card boxes (`styles.storeCard`), outer borders, and grey shadows (`Shadows.soft`) from selected stores.
    - Replaced with clean unboxed list rows (`styles.storeRow`) with transparent background, generous vertical padding, and 1px bottom hairline divider (`isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9'`), preserving store icon, name, store type, item count, and `testID="store-card-${cat}"`.
  - **PabiliStoreEditorScreen (List Items Editor)**:
    - Removed `"Popular here. Tap to add."` section and all horizontal suggestion chips (`chipsBlock`).
    - Removed explanatory caption in the empty state (`"Type an item below, like '5 kilo chicken x2'. You can paste a whole list, one item per line."`), keeping clean `"Nothing from {category} yet"`.
    - Updated item input placeholder from `"e.g. Coke 1.5L"` to `"5 kilo chicken x2"`.
    - Added **Quantity** stepper directly on the right side of `"What to buy"` input field (`styles.composeQtyField`, `styles.stepper` height 48 to match input), with label `"Quantity"`.
    - Transferred the `+` Add button to the bottom position, completely replacing the redundant `"Back to my stores"` button with primary `[ + Add ]` button (`testID="compose-add"`, calling `commit()`).
    - Added clean `"Done"` button in top right navigation header (`testID="editor-done"`), with top left `<` back button preserved.
  - **Synchronized ErrandItemsScreen**:
    - Synchronized `placeholder="5 kilo chicken x2"` in `ErrandItemsScreen.tsx` for complete project-wide consistency.
* **Files Modified**:
  - `src/screens/pabili/PabiliHubScreen.tsx`
  - `src/screens/pabili/PabiliStoreEditorScreen.tsx`
  - `src/screens/ErrandItemsScreen.tsx`
  - `src/__tests__/PabiliScreens.test.tsx`
  - `AGENT_HANDSHAKE.md`
* **Verification Ledger**:
  - `npx tsc --noEmit`: 0 TypeScript compiler errors.
  - `npm test -- src/__tests__/PabiliScreens.test.tsx`: 24/24 tests passed (100%).
  - `npm test -- src/__tests__/DarkModeSubstrates.test.tsx src/__tests__/LightModeSubstrates.test.tsx`: 15/15 tests passed (100%).

## 2026-10-11 - Account & Profile Screen Breathable UI/UX Redesign & Clutter Removal (Antigravity 2.0, Gemini 3.8 Flash High)
* **Status**: [Executed & Deeply Verified by Antigravity 2.0 - npx tsc --noEmit passed with 0 errors, Jest test suites passed 100% (5/5 tests in AccountScreen.test.tsx)].
* **Feature & Interaction Specification**:
  - **Clean & Breathable Layout (Zero Box Scaffold)**:
    - Removed heavy card boxes (`bentoCard`) and transitioned identity hero to unboxed, airy layout (`heroSection: { paddingVertical: Spacing.xs, marginBottom: Spacing.md }`).
    - Removed outer grey drop shadows (`Shadows.soft`, `elevation`, `shadowColor`) from all card surfaces, stat tiles, and list containers.
    - Preserved all customer data, names, phone numbers, handle, and labels.
  - **Inline Pencil "Edit Profile" Button**:
    - Replaced the full-width `"Edit Profile Details"` card button with an inline pencil icon (`Pencil` 12px) + `"Edit Profile"` label placed directly adjacent to the customer's last name (`inlineEditBtn`, `testID="edit-profile-button"`).
  - **Clutter Elimination & Defensive Surface Purity**:
    - Removed `"Active, Protected"` stat card from `statsBentoRow`, leaving 2 clean, shadow-free quick stat tiles (Completed Orders & Tacurong Delivery Pin).
    - Removed `"Security & Authentication"` card/menu item.
    - Removed `"Customer Guide & FAQs"` card/menu item.
    - Consolidated `"App Feedback & Reviews"` cleanly into the single preferences list with `borderBottomWidth: 0`.
    - Removed the light-red background fill (`#FEF2F2`) of `"Sign Out of Account"`, setting it to clean transparent (`backgroundColor: 'transparent'`) with subtle red border.
    - Removed version footnote text (`"SUGO Logistics · Tacurong City · Version 1.0.0"`).
    - Removed subtitle `"Riders will deliver to this exact pinpoint in Tacurong by default."` under Default Delivery Pin.
  - **Synchronized Across Both Screens**:
    - Implemented and verified identically across both `src/screens/AccountScreen.tsx` and `src/screens/portal/AccountTab.tsx` to prevent portal drift.
* **Files Modified**:
  - `src/screens/AccountScreen.tsx`
  - `src/screens/portal/AccountTab.tsx`
  - `AGENT_HANDSHAKE.md`
* **Verification Ledger**:
  - `npx tsc --noEmit`: 0 TypeScript compiler errors.
  - `npm test -- src/__tests__/AccountScreen.test.tsx`: 5/5 tests passed (100%).
* **Status**: [Executed & Deeply Verified by Antigravity 2.0 - npx tsc --noEmit passed with 0 errors, Jest test suites passed 100%].
* **Feature & Interaction Specification**:
  - **Sort Errands Modal Dialog Layout Redesign**:
    - `modalCard`: Redesigned as a fully enclosed, 4-corner rounded dialog card (`borderRadius: BorderRadius.xl`, `borderWidth: 1.2`, `borderTopWidth: 1.5`, `borderBottomWidth: 1.2`) constrained to `maxWidth: 380` with centered alignment, eliminating cut-off bottom corners and missing bottom borders.
    - Added Apple Liquid Glass border tones (`isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0'`, `borderTopColor: isDark ? 'rgba(255, 255, 255, 0.22)' : '#FFFFFF'`) and neutral ambient depth shadow (`shadowColor: '#000000'`, `elevation: 8`, `shadowRadius: 18`, `shadowOpacity: 0.14`).
    - `modalHeader`: Structured header with dedicated icon badge (`modalIconBadge`), bold title, and circular neutral close button (`modalCloseBtn`).
    - `modalOptionItem`: 12px rounded cards with inset icon boxes (`optionIconBox`), bold title, secondary descriptive helper text (`modalOptionDesc`: e.g. *"Most recent errands first"*, *"Highest total amount first"*), and clean neutral selection highlights (`#F8FAFC` with `#CBD5E1` border in Light Mode, `rgba(255, 255, 255, 0.08)` in Dark Mode), eliminating hot-pink selection backgrounds.
  - **"Highest Price First" Section Header & Downward Arrow Margins**:
    - **Balanced Vertical Rhythm**: Standardized `sectionHeaderRow` vertical margins (`marginTop: Spacing.lg` [20px], `marginBottom: Spacing.sm + 2` [10px], and `marginTop: Spacing.md` [16px] for first section).
    - **Symmetrical Rule Line Margins**: Applied `marginHorizontal: Spacing.sm + 2` (10px) directly to `sectionHeaderRule`, eliminating the asymmetrical 22px lopsided gap caused by old `minWidth: 44` button sizing.
    - **Interactive Sort Label**: Made the sort label (`sectionSortLabelBtn`) directly tap-responsive so customers can tap either the text or the downward arrow to trigger sorting.
    - **Downward Arrow Button (`sectionSortBtn`)**: Transformed into a clean 28×28 circular interactive button (`width: 28, height: 28, borderRadius: 14`, subtle `#F1F5F9` / `rgba(255, 255, 255, 0.08)` fill, 1px border) with `hitSlop={PortalTouchTargets.compactHitSlop}` for full 44×44 touch accessibility.
    - **Accurate Control Scoping**: Ensured the sort trigger appears accurately on `section-sorted` and history headers instead of improperly mounting on the non-sortable `"Happening now"` live header.
* **Files Modified**:
  - `src/screens/portal/ErrandsTab.tsx`
  - `AGENT_HANDSHAKE.md`
* **Verification Ledger**:
  - `npx tsc --noEmit`: 0 TypeScript compiler errors.


## 2026-10-11 - Sign Out Navigation Isolation to LoginScreen, Clean Location Typography, and Welcome Sugo Express UI Polish (Antigravity 2.0, Gemini 3.8 Flash High)
* **Status**: [Executed & Deeply Verified by Antigravity 2.0 - npx tsc --noEmit passed with 0 errors, Jest test suites passed 100% (31/31 tests)].
* **Feature & Interaction Specification**:
  - **Sign Out Onboarding Exclusion & Login Screen Navigation**:
    - In `AuthContext.tsx`: Persisted `@sugo_customer_onboarding_completed: 'true'` across `logout()`, `login()`, `restoreSession()`, and `setOnSessionExpired()`. Ensured `logout()` never removes the onboarding completion flag.
    - In `AppNavigator.tsx`: Re-checked and tracked `user` transitions. Persisted `@sugo_customer_onboarding_completed: 'true'` when `user` is active. Enforced the invariant that once `hasCompletedOnboarding` is true (or user authenticated), it NEVER flips back to `false` during sign-out (`setHasCompletedOnboarding((prev) => (prev === true ? true : completed))`).
    - Added resilient sign-out reset to Login with `navigationRef.reset({ index: 0, routes: [{ name: 'Login' }] })` and fallback timer.
    - Conditionally partitioned unauthenticated stack (`!user`): when `hasCompletedOnboarding === true`, the stack mounts `Login` as the root screen and completely omits `OnboardingLocation` and `OnboardingAuthChoice`, guaranteeing onboarding never appears again after signing out.
  - **Set Your Location Screen Clean Typography**:
    - In `OnboardingLocationScreen.tsx`: Removed the repetitive card containers, shadows, borders, and `Store` / `Clock` icons. Replaced with a clean, high-contrast typographic list with subtle bullet dots (`alignItems: 'flex-start'`, `marginTop: 8`) and generous whitespace conforming to Anti-AI-Slop standards. Cleaned up unused imports.
  - **Welcome to Sugo Express & Back Button Removal**:
    - In `OnboardingAuthChoiceScreen.tsx`: Updated headline from *"Welcome to Sugo!"* to *"Welcome to Sugo Express"*, matching the official brand copy. Removed the top back arrow button and header wrapper to keep the screen focused and clean. Cleaned up unused imports.
* **Files Modified**:
  - `src/context/AuthContext.tsx`
  - `src/navigation/AppNavigator.tsx`
  - `src/screens/onboarding/OnboardingLocationScreen.tsx`
  - `src/screens/onboarding/OnboardingAuthChoiceScreen.tsx`
  - `src/__tests__/OnboardingAuthChoiceScreen.test.tsx`
  - `src/__tests__/Navigation.test.tsx`
  - `src/__tests__/SignOutOnboardingIsolation.test.tsx` [NEW]
  - `AGENT_HANDSHAKE.md`
* **Verification Ledger**:
  - `npx tsc --noEmit`: 0 TypeScript compiler errors.
  - `npx jest`: All 31 tests in `Navigation.test.tsx`, `OnboardingLocationScreen.test.tsx`, `OnboardingAuthChoiceScreen.test.tsx`, `LoginScreen.test.tsx`, and `SignOutOnboardingIsolation.test.tsx` passed.

## 2026-10-11 - Customer App Onboarding Liquid Glass Button Redesign & Casual English Copy (Antigravity 2.0, Gemini 3.8 Flash High)
* **Status**: [Executed & Deeply Verified by Antigravity 2.0 - npx tsc --noEmit passed with 0 errors, Jest test suites passed 100%].
* **Feature & Interaction Specification**:
  - **Apple Liquid Glass Button Redesign**:
    - **Specular Highlight Glint & Chiseled Borders**: Applied top-edge specular glint (`borderTopWidth: 1.5`, `borderTopColor: 'rgba(255, 255, 255, 0.40)'`), chiseled perimeter (`borderWidth: 1.2`, `borderColor: 'rgba(255, 255, 255, 0.22)'`), and multi-layer depth shadow tokens (`shadowColor: '#000000'`, `shadowOffset: { width: 0, height: 4 }`, `shadowOpacity: 0.18`, `shadowRadius: 10`, `elevation: 4`) to primary CTAs (`continueButton`, `createAccountBtn`).
    - **Secondary & Tertiary Liquid Glass Surfaces**: Upgraded `GoogleSignInButton`, `loginLinkBtn`, and header `backButton` with frosted liquid glass substrate (`backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#FFFFFF'`, `borderColor: isDark ? 'rgba(255, 255, 255, 0.10)' : '#E2E8F0'`, `borderTopColor: isDark ? 'rgba(255, 255, 255, 0.22)' : '#FFFFFF'`, depth shadow `elevation: 2`).
  - **Casual, Human-Readable English Copy**:
    - `OnboardingLocationScreen`:
      - Subhead: Replaced robotic *"Allow location access for:"* with casual *"Turn on your location so we can:"*.
      - Bullet 1: Replaced *"Searching the best shops near you."* with friendly *"Find the best stores and restaurants near you"*.
      - Bullet 2: Replaced *"Receiving more accurate and faster delivery."* with clear *"Get your orders delivered faster and right to your door"*.
      - Button state: Replaced *"Detecting Location..."* with *"Finding your location..."*.
    - `OnboardingAuthChoiceScreen`:
      - Hero title: Replaced formal *"Sign up or Log in"* with warm *"Welcome to Sugo!"*.
      - Hero subtitle: Replaced *"Create an account or sign in to start placing delivery errands."* with conversational *"Create an account or sign in to start ordering errands."*.
      - Divider: Lowercase casual *"or"* instead of uppercase *"OR"*.
      - Secondary button: Replaced awkward *"Email or Username (if you already have an account)"* with natural *"Already have an account?"* + *"Log in with your email or username"*.
* **Files Modified**:
  - `src/screens/onboarding/OnboardingLocationScreen.tsx`
  - `src/screens/onboarding/OnboardingAuthChoiceScreen.tsx`
  - `src/components/GoogleSignInButton.tsx`
  - `src/__tests__/OnboardingLocationScreen.test.tsx`
  - `src/__tests__/OnboardingAuthChoiceScreen.test.tsx`
  - `AGENT_HANDSHAKE.md`
* **Verification Ledger**:
  - `npx tsc --noEmit` -> 0 errors.
  - `npm test -- src/__tests__/GoogleSignInButton.test.tsx src/__tests__/OnboardingLocationScreen.test.tsx src/__tests__/OnboardingAuthChoiceScreen.test.tsx src/__tests__/LoginScreen.test.tsx` -> 4/4 test suites passed, 28/28 tests passed (100%).

## 2026-10-11 - Customer App Fresh-Install Onboarding Flow & Location Auto-Setup (Antigravity 2.0, Gemini 3.8 Flash High)
* **Status**: [Executed, Fixed & Deeply Verified by Antigravity 2.0 - npx tsc --noEmit passed with 0 errors, Jest 68/68 test suites passed: 702/702 tests passed (100%)].
* **Feature & Interaction Specification**:
  - **Fresh-Install Splash Suppression**:
    - Gated `AnimatedSplashScreen` strictly to `hasCompletedOnboarding === true && (!isSplashComplete || isLoading)`. Fresh installs hold the native OS splash blank canvas until `OnboardingLocationScreen` renders and explicitly calls `SplashScreen.hideAsync()`, completely preventing the splash flash bug.
    - Returning users (`@sugo_customer_onboarding_completed === 'true'`) continue to see the full branded animated splash screen as required by the locked contract.
  - **Delivery Location Onboarding (`OnboardingLocationScreen`)**:
    - Explains location access clearly: "Allow location access for: Searching the best shops near you. Receiving more accurate and faster delivery."
    - Primary CTA "Continue" requests foreground location permission via `Location.requestForegroundPermissionsAsync()`.
    - Implemented a 6-second timeout race on `Location.getCurrentPositionAsync` with fallback to `Location.getLastKnownPositionAsync()` to protect against hardware GPS delays.
    - On grant: Balances GPS fix and reverse-geocodes using `resolveCoordinateToAddress`, caching draft to `@sugo_onboarding_location_draft` and routing to `OnboardingAuthChoice` with `detectedLocation`.
    - On denial: Cleans up `@sugo_onboarding_location_draft` and gracefully routes to `OnboardingAuthChoice` with `detectedLocation: undefined` without blocking user.
  - **Auth Gateway (`OnboardingAuthChoiceScreen`)**:
    - 1-tap "Sign Up with Google" via native Google Sign-In button; routes to `GooglePhoneSetup` (with `detectedLocation`) or logs in directly with `@sugo_pending_onboarding_location_setup = 'true'` persistence.
    - Primary solid CTA "Create an Account" routing to `RegisterScreen` with `{ detectedLocation }`. Removed Google button from `RegisterScreen` Step 1 to keep flow clean.
    - Tertiary link "Email or Username (if you already have an account)" routing directly to `LoginScreen`.
    - `LoginScreen` sets `@sugo_customer_onboarding_completed = 'true'` on login success for both username/password and Google login.
  - **Post-Registration Automatic Navigation & 2-Second Delay**:
    - Calling `login()` in `AuthContext` swaps navigation stacks from Auth to App stack. Persisted `@sugo_pending_onboarding_location_setup = 'true'` in `AsyncStorage` before `login()` so the trigger survives the stack swap.
    - `CustomerPortalScreen` supports dual-source triggering (reading `route.params?.triggerOnboardingLocationSetup` and `@sugo_pending_onboarding_location_setup`), delays 2000ms, and shields `HeaderLocationButton` (`!isWaitingOnboardingLocation`) to eliminate modal collision with `LocationRequiredSpotlight`.
    - Fixed infinite re-render loop on `setCurrentUser` via shallow user equality guard.
    - Fixed Reanimated `FadeIn.duration(160).easing` syntax error.
    - Automatically routes to `CustomerLocation` in wizard mode with `initialStep={2}` (or fallback to Step 1 interactive map pin picker if GPS denied), pre-filling address, label ('Home'), and presenting fields for Street Name, Landmark, and Notes for the Rider.
    - Cleans up `@sugo_onboarding_location_draft` and `@sugo_pending_onboarding_location_setup` upon successful location save in `CustomerLocationScreen`.
* **Files Modified & Created**:
  - `src/navigation/types.ts`
  - `src/navigation/AppNavigator.tsx`
  - `src/hooks/useReverseGeocodedAddress.ts`
  - `src/screens/onboarding/OnboardingLocationScreen.tsx` [NEW]
  - `src/screens/onboarding/OnboardingAuthChoiceScreen.tsx` [NEW]
  - `src/screens/RegisterScreen.tsx`
  - `src/screens/GooglePhoneSetupScreen.tsx`
  - `src/screens/LoginScreen.tsx`
  - `src/screens/CustomerPortalScreen.tsx`
  - `src/screens/CustomerLocationScreen.tsx`
  - `src/screens/location/LocationWizard.tsx`
  - `src/__tests__/Navigation.test.tsx`
  - `src/__tests__/OnboardingLocationScreen.test.tsx` [NEW]
  - `src/__tests__/OnboardingAuthChoiceScreen.test.tsx` [NEW]
  - `src/__tests__/LocationWizardOnboarding.test.tsx` [NEW]
  - `src/__tests__/CustomerPortalOnboardingTransition.test.tsx` [NEW]
  - `src/__tests__/LoginScreen.test.tsx`
  - `AGENT_HANDSHAKE.md`
* **Verification Ledger**:
  - `npx tsc --noEmit` -> 0 errors.
  - `npm test -- --watchAll=false` -> 68 test suites passed, 702/702 tests passed (100%).

## 2026-10-10 - Light Mode Crisp White Substrates & Neutral Slate Borders Across Inputs & Sticky Containers (Antigravity 2.0, Gemini 3.8 Flash High)
* **Status**: [Executed & Verified by Antigravity 2.0 - npx tsc --noEmit passed with 0 errors, Jest 62/62 test suites passed: 676/676 tests passed (100%)].
* **Feature & Interaction Specification**:
  - **Crisp Neutral White Substrates & Clean Border Neutralization**:
    - Eliminated the Light Mode "brown-white" background defect on input fields, buttons, and sticky wrappers across the Customer App.
    - Purged all `#FAF9F6` / `rgba(250, 249, 246)` warm bone tints, muddy `rgba(15, 23, 42, 0.06)` button fills, and 12% translucent slate bleed (`rgba(255, 255, 255, 0.88)` + `rgba(15, 23, 42, 0.12)`) in Light Mode.
    - Replaced them with crisp neutral white (`#FFFFFF` / `rgba(255, 255, 255, 0.95)`) substrates, clean neutral slate borders (`#E2E8F0`), and crisp slate button backgrounds (`#F1F5F9`).
  - **Component Modifications**:
    1. **Home Tab Sticky Search** (`src/screens/portal/HomeTab.tsx`):
       - `stickySearchWrapper`: Light Mode background changed from `rgba(250, 249, 246, 0.95)` to `rgba(255, 255, 255, 0.95)`.
       - `liquidGlassSearchBar`: Light Mode `backgroundColor` changed to `'#FFFFFF'`, `borderColor` to `'#E2E8F0'`, and `borderTopColor` to `'#FFFFFF'`.
       - `liquidGlassSearchAction`: Light Mode `backgroundColor` changed from `rgba(15, 23, 42, 0.06)` to `'#F1F5F9'` and `borderColor` from `rgba(15, 23, 42, 0.08)` to `'#E2E8F0'`. Added `testID="home-store-search-action"`.
    2. **Find Stores Search** (`src/components/pabili/EstablishmentPicker.tsx`):
       - `styles.searchBar`: Light Mode `backgroundColor` changed to `'#FFFFFF'`, `borderColor` to `'#E2E8F0'`, `borderTopColor` to `'#FFFFFF'`.
    3. **Messages Search** (`src/screens/portal/ChatTab.tsx`):
       - `styles.searchBar`: Light Mode `backgroundColor` changed to `'#FFFFFF'`, `borderColor` to `'#E2E8F0'`, `borderTopColor` to `'#FFFFFF'`.
    4. **My Errands Search** (`src/screens/portal/ErrandsTab.tsx`):
       - `styles.searchBar`: Light Mode `backgroundColor` changed to `'#FFFFFF'`, `borderColor` to `'#E2E8F0'`, `borderTopColor` to `'#FFFFFF'`.
    5. **Message Input Composer** (`src/screens/CustomerChatScreen.tsx`):
       - `inputWrapperPill`: Light Mode `backgroundColor` changed to `'#FFFFFF'`, `borderColor` to `'#E2E8F0'`, `borderTopColor` to `'#FFFFFF'`.
    6. **Item Compose Input & Stepper** (`src/screens/ErrandItemsScreen.tsx`):
       - `composeInput` and `composeStepper`: Light Mode `backgroundColor` changed to `'#FFFFFF'`, `borderColor` to `'#E2E8F0'`, `borderTopColor` to `'#FFFFFF'`.
    7. **Edit Account Inputs & Phone Containers** (`src/screens/EditAccountScreen.tsx`):
       - `inputWrapper` (First, Middle, Last, Birthdate, Email), `phonePrefixBox`, and `phoneFieldWrapper`: Light Mode `backgroundColor` changed to `'#FFFFFF'`, `borderColor` to `'#E2E8F0'`, `borderTopColor` to `'#FFFFFF'`. Added `testID="edit-first-name-wrapper"` and `testID="phone-field-wrapper"`.
    8. **Active Errands Action Button** (`src/screens/ActiveErrandsScreen.tsx`):
       - `openBtn`: Light Mode `backgroundColor` changed from `rgba(15, 23, 42, 0.06)` to `'#F1F5F9'` and `borderColor` from `rgba(15, 23, 42, 0.10)` to `'#E2E8F0'`.
    9. **System Nav Bar Blur Dock** (`src/navigation/AppNavigator.tsx`):
       - `systemNavBarBlurDock`: Light Mode background changed from `rgba(250, 249, 246, 0.25)` to `rgba(255, 255, 255, 0.25)`, Dark Mode background changed from `rgba(1, 0, 19, 0.35)` to `rgba(0, 0, 0, 0.35)`. Added `testID="system-nav-blur-dock-overlay"`.
    10. **Bottom Navigation Constant Cleanup** (`src/components/BottomNav.tsx`):
       - Removed dead code constant `const COLOR_WHITE = '#FAF9F6';`.
  - **Empirical Test Suite**:
    - `src/__tests__/LightModeSubstrates.test.tsx`: 8-test deep verification suite covering HomeTab (search + action), EstablishmentPicker, ChatTab, ErrandsTab, ErrandItems (input + stepper), EditAccount (first name, prefix, phone field), ActiveErrands openBtn, and CustomerChat input pill.
    - `src/__tests__/DarkModeSubstrates.test.tsx`: Added `home-store-search-action` assertion.
    - `src/__tests__/Navigation.test.tsx`: Added assertions for `system-nav-blur-dock-overlay` in both Light Mode (`rgba(255, 255, 255, 0.25)`) and Dark Mode (`rgba(0, 0, 0, 0.35)`).
* **Files Modified**:
  - `src/screens/portal/HomeTab.tsx`
  - `src/components/pabili/EstablishmentPicker.tsx`
  - `src/screens/portal/ChatTab.tsx`
  - `src/screens/portal/ErrandsTab.tsx`
  - `src/screens/CustomerChatScreen.tsx`
  - `src/screens/ErrandItemsScreen.tsx`
  - `src/screens/EditAccountScreen.tsx`
  - `src/screens/ActiveErrandsScreen.tsx`
  - `src/navigation/AppNavigator.tsx`
  - `src/components/BottomNav.tsx`
  - `src/__tests__/LightModeSubstrates.test.tsx`
  - `src/__tests__/DarkModeSubstrates.test.tsx`
  - `src/__tests__/Navigation.test.tsx`
  - `AGENT_HANDSHAKE.md`
* **Verification Ledger**:
  - `npx tsc --noEmit` -> 0 errors.
  - `npm test -- --watchAll=false` -> 62 test suites passed, 676/676 tests passed (100%).

## 2026-10-10 - Dark Mode OLED Neutralization: Pure Black Backdrop & Neutral Dark Frosted Glass Across Inputs & Navigation (Antigravity 2.0, Gemini 3.8 Flash High)
* **Status**: [Executed & Verified by Antigravity 2.0 - npx tsc --noEmit passed with 0 errors, Jest 61/61 test suites passed: 664/664 tests passed (100%)].
* **Feature & Interaction Specification**:
  - **Neutral Pure Black Backdrop & OLED Frosted Substrates**:
    - Fixed the Dark Mode dark blue background bug on the Home Tab sticky search bar and neutralized blue tones across all search bars, input fields, and floating navigation capsules in CustomerApp.
    - Replaced saturated dark slate/navy tints (`rgba(11, 19, 43, 0.95)`, `rgba(15, 23, 42, 0.78)`, `rgba(15, 20, 32, 0.88)`) with true neutral frosted glass substrates over OLED pure black (`#000000`).
  - **Component Modifications**:
    1. **Home Tab Sticky Search** (`src/screens/portal/HomeTab.tsx`):
       - `stickySearchWrapper`: Dark Mode background set to `rgba(0, 0, 0, 0.95)`, `testID="home-sticky-search"`.
       - `liquidGlassSearchBar`: Dark Mode background set to `rgba(255, 255, 255, 0.08)`, `shadowColor: '#000000'`.
    2. **Find Stores Search** (`src/components/pabili/EstablishmentPicker.tsx`):
       - `styles.searchBar`: Dark Mode background set to `rgba(255, 255, 255, 0.08)`, `shadowColor: '#000000'`, `testID="establishment-search-bar"`.
    3. **Messages Search** (`src/screens/portal/ChatTab.tsx`):
       - `styles.searchBar`: Dark Mode background set to `rgba(255, 255, 255, 0.08)`, `shadowColor: '#000000'`, `testID="chat-search-bar"`.
    4. **My Errands Search** (`src/screens/portal/ErrandsTab.tsx`):
       - `styles.searchBar`: Dark Mode background set to `rgba(255, 255, 255, 0.08)`, `shadowColor: '#000000'`, `testID="errands-search-bar"`.
    5. **Message Input Composer** (`src/screens/CustomerChatScreen.tsx`):
       - `inputWrapperPill`: Dark Mode background set to `rgba(255, 255, 255, 0.08)`, `shadowColor: '#000000'`, `testID="chat-input-wrapper-pill"`.
    6. **Item Compose Input & Stepper** (`src/screens/ErrandItemsScreen.tsx`):
       - `composeInput` and `composeStepper`: Dark Mode background set to `rgba(255, 255, 255, 0.08)`, `shadowColor: '#000000'`, stepper `testID="draft-stepper-${cat}"`.
    7. **Edit Account Inputs & Phone Containers** (`src/screens/EditAccountScreen.tsx`):
       - `inputWrapper` (First, Middle, Last, Birthdate, Email), `phonePrefixBox`, `phoneFieldWrapper`: Dark Mode background set to `rgba(255, 255, 255, 0.08)`, `shadowColor: '#000000'`, prefix box `testID="phone-prefix-box"`.
    8. **Floating Bottom Navigation Capsule** (`src/components/BottomNav.tsx`):
       - `capsuleBackground`: Dark Mode background set to neutral dark charcoal `rgba(20, 20, 22, 0.90)`, `shadowColor: '#000000'`, `testID="bottom-nav-capsule"`.
    9. **LiquidGlass Base Component** (`src/components/glass/LiquidGlass.tsx`):
       - `backgroundColor`: Dark Mode background set to `rgba(20, 20, 22, 0.55)` (blurs) / `rgba(20, 20, 22, 0.90)` (fallback), `shadowColor: '#000000'`.
* **Files Modified**:
  - `src/screens/portal/HomeTab.tsx`
  - `src/components/pabili/EstablishmentPicker.tsx`
  - `src/screens/portal/ChatTab.tsx`
  - `src/screens/portal/ErrandsTab.tsx`
  - `src/screens/CustomerChatScreen.tsx`
  - `src/screens/ErrandItemsScreen.tsx`
  - `src/screens/EditAccountScreen.tsx`
  - `src/components/BottomNav.tsx`
  - `src/components/glass/LiquidGlass.tsx`
  - `src/__tests__/DarkModeSubstrates.test.tsx`
  - `src/__tests__/EditAccountScreen.test.tsx`
  - `AGENT_HANDSHAKE.md`
* **Verification Ledger**:
  - `npx tsc --noEmit` -> 0 errors.
  - `npm test -- --watchAll=false` -> 61 test suites passed, 664/664 tests passed (100%).
  - Added empirical dark-mode unit test suite `DarkModeSubstrates.test.tsx` asserting background RGBA values and shadow colors across `HomeTab`, `EstablishmentPicker`, `ChatTab`, `ErrandsTab`, `BottomNav`, `LiquidGlass`, and `ErrandItemsScreen`.

## 2026-10-10 - Apple Liquid Glass Redesign Across All 6 Input Fields (Antigravity 2.0, Gemini 3.8 Flash High)
* **Status**: [Executed by Antigravity 2.0 - npx tsc --noEmit passed with 0 errors, Jest 59/59 test suites passed: 646/646 tests passed (100%)].
* **Feature & Interaction Specification**:
  - **Applied Apple Liquid Glass Tokens Across 6 Input Components**:
    1. **Find Stores Search** (`src/components/pabili/EstablishmentPicker.tsx`): 24px Pill Liquid Glass, 48px height, 1.5px specular top edge highlight, and ambient depth shadow.
    2. **What to buy Item Compose Input & Stepper** (`src/screens/ErrandItemsScreen.tsx`): 14px Ergonomic Liquid Glass container, inline quantity controls, matching Add button with optical clarity.
    3. **Messages & Support Search** (`src/screens/portal/ChatTab.tsx`): 24px Full-width Liquid Glass pill search bar with clean X clear button and slate search icon.
    4. **My Errands Search Stores** (`src/screens/portal/ErrandsTab.tsx`): 24px Full-width Liquid Glass pill search bar matching ChatTab for global consistency.
    5. **Message Input Composer** (`src/screens/CustomerChatScreen.tsx`): 22px Ergonomic Liquid Glass message pill resting above the chat dock.
    6. **Edit Account Information Fields** (`src/screens/EditAccountScreen.tsx`): 14px Liquid Glass input containers for First Name, Middle Name, Last Name, Birthdate Card, Email, and Phone (+63 prefix + 10-digit number) with dynamic validation focus/error states.
  - **Design System Tokens Applied**:
    - **Substrates**: `rgba(255, 255, 255, 0.88)` (Light Mode) / `rgba(15, 23, 42, 0.78)` (Dark Mode).
    - **Specular Top Edge**: `borderTopColor: rgba(255, 255, 255, 0.95)` (Light) / `0.28` (Dark).
    - **Chiseled Perimeter**: `borderColor: rgba(15, 23, 42, 0.12)` (Light) / `rgba(255, 255, 255, 0.12)` (Dark), `borderWidth: 1.2`, `borderTopWidth: 1.5`.
    - **Ambient Soft Shadow**: `#0F172A`, offset `{0, 2-3}`, radius `8-10`, elevation `2-3`.
* **Files Modified**:
  - `src/components/pabili/EstablishmentPicker.tsx`
  - `src/screens/ErrandItemsScreen.tsx`
  - `src/screens/portal/ChatTab.tsx`
  - `src/screens/portal/ErrandsTab.tsx`
  - `src/screens/CustomerChatScreen.tsx`
  - `src/screens/EditAccountScreen.tsx`
* **Verification Ledger**:
  - `npx tsc --noEmit` -> 0 errors.
  - `npm test -- --watchAll=false` -> 59 test suites passed, 646/646 tests passed (100%).

## 2026-10-10 - Bottom Nav Refinement, Phone Blur Dock & Sticky Liquid Glass Search (Antigravity 2.0, Gemini 3.8 Flash High)
* **Status**: [Executed by Antigravity 2.0 - npx tsc --noEmit passed with 0 errors, Jest 3/3 test suites passed: 18/18 tests passed (100%)].
* **Feature & Interaction Specification**:
  - **Removed Square/Box Background on Tab Click (`BottomNav.tsx`)**:
    - Removed `activeBackplateLight` and `activeBackplateDark` styling. Tab icons no longer render a rectangular or square background on selection. Active state indicated cleanly via filled gray icon, bold typography, and micro-dot.
  - **Lowered Tab Vertical Alignment (`BottomNav.tsx`)**:
    - Tuned `styles.tabContent` with `paddingTop: 6, paddingBottom: 2` inside the 68dp floating capsule, ensuring Home, Errands, Search, Track, and Chat sit in a comfortable lower position for thumb reach.
  - **Flattened Center (+) Button to Standard Search Tab (`BottomNav.tsx`)**:
    - Replaced elevated circular jewel dome with a standard, non-elevated `Search` tab item (`Search` vector icon, `"Search"` label). All 5 tabs share equal `flex: 1` width and identical geometry.
  - **Android 3-Button Navigation Bar Liquid Glass Blur Dock (`AppNavigator.tsx`)**:
    - Removed the heavy 72%/78% solid container background in `systemNavBarBlurDock`. Elevated `BlurView` intensity to 45 with a subtle 25-35% liquid glass tint overlay, delivering true optical blur over content scrolling beneath the 3 buttons.
  - **Apple Liquid Glass Store Search Bar (`HomeTab.tsx`)**:
    - Redesigned search bar with high optical clarity substrate (`rgba(255, 255, 255, 0.88)` light / `rgba(15, 23, 42, 0.78)` dark), specular reflection glint (`borderTopColor: rgba(255, 255, 255, 0.95)` light), 1.2px chiseled perimeter, and subtle frosted search action tag.
  - **Sticky Search Bar on Scroll (`HomeTab.tsx`)**:
    - Configured `ScrollView` with `stickyHeaderIndices={[1]}`. When swiping/scrolling up, the search bar docks at the top with a liquid glass backdrop, remaining persistently viewable while cards glide underneath.
* **Files Modified**:
  - `src/components/BottomNav.tsx`
  - `src/navigation/AppNavigator.tsx`
  - `src/screens/portal/HomeTab.tsx`
  - `src/__tests__/BottomNav.test.tsx`
  - `jest.setup.js`
* **Verification Ledger**:
  - `npx tsc --noEmit` -> 0 errors.
  - `npm test -- src/__tests__/BottomNav.test.tsx src/__tests__/Navigation.test.tsx src/__tests__/HomeTab.test.tsx` -> 3 suites passed, 18/18 tests passed (100%).

## 2026-10-10 - Default Gray Palette, Click Animation Removal & System Nav Bar Separating Line Elimination (Antigravity 2.0, Gemini 3.8 Flash High)
* **Status**: [Executed by Antigravity 2.0 - npx tsc --noEmit passed with 0 errors, Jest 2/2 test suites passed: 9/9 tests passed (100%)].
* **Feature & Interaction Specification**:
  - **Click/Press Animation Elimination**:
    - Removed icon button click animations (`pressScale`, `bloomScale`, `useEffect` bounce sequence, and `withSequence` spring loops) from `StandardTabItem`.
    - Removed rotation (`iconRotate`) and tap scale feedback from the center Pabili dome (`CenterPabiliTabItem`).
    - Tab switching is now instantaneous with zero jitter, while preserving fluid scroll-driven label hide/show animations on vertical swipe.
  - **Default Slate Gray Accent Theme**:
    - Replaced the pink accent color (`#F62459`) with the default slate gray palette:
      - Active Color: `#1E293B` in Light Mode, `#F1F5F9` in Dark Mode.
      - Inactive Color: `#64748B` in Light Mode, `#94A3B8` in Dark Mode.
    - Active icon path fill, active bold text, active micro indicator dot, and active backplate now use the default gray theme.
    - Center Pabili jewel dome styled in deep slate (`#1E293B` light / `#334155` dark) with specular top glass highlights.
  - **Separating Line Removal (`systemNavBarBlurDock`)**:
    - Removed the top grey hairline (`borderTopWidth: 0.8` and `borderTopColor`) separating the app screen from the phone's 3-button navigation bar in `AppNavigator.tsx`.
    - Content flows smoothly and seamlessly under the liquid glass blur dock with zero dividing line.
* **Files Modified**:
  - `src/components/BottomNav.tsx`
  - `src/navigation/AppNavigator.tsx`
* **Verification Ledger**:
  - `npx tsc --noEmit` -> 0 errors.
  - `npm test -- src/__tests__/BottomNav.test.tsx src/__tests__/Navigation.test.tsx` -> 2 suites passed, 9/9 tests passed (100%).

## 2026-10-10 - Customer App Direct APK Download, Version Validation & Post-Update Dialog (Antigravity 2.0, Gemini 3.8 Flash High)
* **Status**: [Executed by Antigravity 2.0 - npx tsc --noEmit passed with 0 errors, Jest 12/12 tests passed on appUpdateService.test.ts (100%)].
* **Feature & Interaction Specification**:
  - **Direct System Download Trigger**:
    - When clicking the update button in `AppUpdatesModal.tsx`, the app resolves `/api/app-releases/download/customer` with `API_BASE_URL` to trigger the Android native Download Manager directly via `Linking.openURL`, downloading the APK in the background without directing users to a browser.
  - **Renamed Button & Mirror Link Clean Up**:
    - Renamed primary CTA to `"Update New Version"`.
    - Removed the redundant `"sugoonthego.online Mirror"` button from `AppUpdatesModal.tsx`.
  - **Hero Card Version Comparison Validation Bug Fix**:
    - Fixed redundant `v1.1.2 ➔ v1.1.2` comparison when installed version equals latest version (`isSameVersion = installedVersion === latestVersion || !isUpdateAvailable`).
    - When up to date: Renders `"You are on the latest version"` headline, an `"Up to Date"` status pill with green checkmark, and a single version display `v{installedVersion}`. The footer displays a confirmation card (`"You are on the latest version"` with `CheckCircle2`) with no unnecessary download prompt.
    - When an update is needed: Renders `"App needs an update"` headline, an `"Update Ready"` status pill, and `v{installedVersion} ➔ v{latestVersion}` progression indicator, with the `"Update New Version"` primary CTA.
  - **Post-Update Announcement Dialog (`HomeTab.tsx`)**:
    - Added `checkNewlyUpdatedApp()` to compare runtime version against `@sugo_customer_last_run_version` in `AsyncStorage`.
    - First boot sets baseline without false prompts; when the app is newly opened after an upgrade from an older version, a graceful `ConfirmModal` appears on the Home screen:
      - Title: *"Update Installed"*
      - Message: *"Sugo Express has been updated to v{version}. Enjoy the latest features and improvements!"*
      - Single CTA: *[ Got it ]*
* **Files Modified**:
  - `src/services/appUpdateService.ts`
  - `src/components/AppUpdatesModal.tsx`
  - `src/screens/portal/HomeTab.tsx`
  - `src/__tests__/appUpdateService.test.ts`
* **Verification Ledger**:
  - `npx tsc --noEmit` -> 0 errors.
  - `npx jest src/__tests__/appUpdateService.test.ts` -> 12/12 tests passed (100%).

## 2026-10-10 - Android 3-Button System Navigation Bar Theme Adaptation & Liquid Glass Blur Dock (Antigravity 2.0, Gemini 3.8 Flash High)
* **Status**: [Executed by Antigravity 2.0 - npx tsc --noEmit passed with 0 errors, Jest 3/3 tests passed on Navigation.test.tsx, 6/6 tests passed on BottomNav.test.tsx (100%)].
* **Feature & Interaction Specification**:
  - **Android Dark Gray Scrim Overlay Removal**:
    - Identified that Android 10+ (API 29+) enforces `isNavigationBarContrastEnforced = true` by default, which causes Android's OS WindowManager to draw an artificial opaque/dark-gray scrim over 3-button navigation bars ("recent, home, back").
    - Disabled contrast enforcement in native `android/app/src/main/res/values/styles.xml` (`<item name="android:enforceNavigationBarContrast" tools:targetApi="29">false</item>` and `<item name="expoEnforceNavigationBarContrast">false</item>`).
    - Explicitly set `window.isNavigationBarContrastEnforced = false` in `MainActivity.kt` (`onCreate`).
    - Configured `expo-navigation-bar` config plugin in `app.config.js` with `{ "enforceContrast": false }`.
  - **Button Color Adaptation (Recent, Home, Back)**:
    - Fixed inverted `NavigationBar style` in `BottomNav.tsx` (`<NavigationBar style={isLight ? 'dark' : 'light'} />`).
    - In Light Mode (`#FAF9F6`), system navigation buttons render in crisp dark slate (`style="dark"`).
    - In Dark Mode (`#010013`), system navigation buttons render in crisp white (`style="light"`).
  - **Liquid Glass Blur Shelf (`systemNavBarBlurDock`)**:
    - When 3-button navigation is active (`Platform.OS === 'android' && insets.bottom >= 24`): Renders a dedicated liquid glass blur dock spanning `bottom: 0, height: insets.bottom` at root level (`AppNavigator.tsx`).
    - Employs `BlurView` (`intensity: 35`, `experimentalBlurMethod: 'dimezisBlurViewSdk31Plus'`) with liquid glass background fills adopting the app color (`rgba(250, 249, 246, 0.72)` in Light Mode, `rgba(1, 0, 19, 0.78)` in Dark Mode) and a 0.8px hairline top border.
    - Uses `pointerEvents="none"`, allowing native touch inputs on "recent, home, back" or underlying controls to pass through effortlessly.
    - App content (cards, list items) smoothly scrolls behind the 3 buttons with optical blur.
  - **Edge-to-Edge Swipe Gesture Preservation ("All Screen")**:
    - When swipe gesture navigation is used (`insets.bottom < 24`), the blur dock is not rendered, preserving pure edge-to-edge "all screen" presentation as requested.
* **Files Modified**:
  - `src/navigation/AppNavigator.tsx`
  - `src/components/BottomNav.tsx`
  - `app.config.js`
  - `android/app/src/main/res/values/styles.xml`
  - `android/app/src/main/java/com/astrowarden/CustomerApp/MainActivity.kt`
  - `jest.setup.js`
  - `src/__tests__/Navigation.test.tsx`
* **Verification Ledger**:
  - `npx tsc --noEmit` -> 0 errors.
  - `npm test -- src/__tests__/Navigation.test.tsx` -> 3/3 tests passed (100%).
  - `npm test -- src/__tests__/BottomNav.test.tsx` -> 6/6 tests passed (100%).

## 2026-10-10 - Floating Apple Liquid Glass Bottom Navigation with Sugo Pink Icon Fill (Antigravity 2.0, Gemini 3.8 Flash High)
* **Status**: [Executed by Antigravity 2.0 - npx tsc --noEmit passed with 0 errors, Jest 6/6 tests passed on BottomNav.test.tsx (100%), regression tests green].
* **Feature & Interaction Specification**:
  - **Apple Liquid Glass Material Architecture (Replacing Cloudy Frosted Glass)**:
    - **High Optical Clarity on Pure White**: Replaced cloudy/milky opaque white wash with crystal-clear optical glass substrate (`rgba(255, 255, 255, 0.86)` in Light Mode, `rgba(15, 20, 32, 0.88)` in Dark Mode).
    - **Chiseled Slate Boundary & Specular Highlight**: Directional 1.2px chiseled slate refraction perimeter (`rgba(15, 23, 42, 0.16)`) combined with a razor-sharp specular top reflection rim (`rgba(255, 255, 255, 0.95)`), establishing instant edge contrast and visibility against pure white backgrounds (`#FFFFFF`).
    - **Multi-Tier Elevation Shadow**: Grounded with a deep directional elevation shadow (`shadowColor: '#0F172A'`, offset `{0, 10}`, opacity 0.16, radius 22, elevation 12), ensuring the capsule never washes out on light screens.
  - **Sugo Pink Icon Fill on Click (`#F62459`)**:
    - When tapped/selected, the active tab icon fills its interior path with Sugo Pink (`fill="#F62459"` and `color="#F62459"`), paired with a spring scale bloom (`1.12x` overshoot on tap, settling at `1.0x`).
    - Active label switches to `#F62459` in bold typography.
    - Framed by a subtle Apple fluid pill backplate (`rgba(246, 36, 89, 0.08)`, border `rgba(246, 36, 89, 0.18)`, radius 18).
    - Inactive items rendered in clean slate neutral (`#64748B` light / `#94A3B8` dark) with `fill="none"` and `FontFamily.medium`.
  - **Elevated Liquid Glass Jewel Dome (Pabili CTA)**:
    - Elevated 48dp circular jewel dome anchored in vibrant Sugo Pink (`#F62459`), accented by dual specular rims (`borderTopColor: 'rgba(255, 255, 255, 0.75)'`, `borderColor: 'rgba(255, 255, 255, 0.40)'`), crisp white `Plus` icon (`strokeWidth: 2.8`), and pink depth shadow (elevation 10).
  - **Balanced Icon & Typography Rhythm**:
    - Capsule height: 68dp, radius 34.
    - 21dp icon + strict 3dp spacing cadence + 10.5dp micro-type label (`letterSpacing: 0.2`, `lineHeight: 12.5`), perfectly centered.
    - Preserves animated label hide/show on swipe and scroll.
* **Files Modified**:
  - `src/components/BottomNav.tsx`
  - `src/__tests__/BottomNav.test.tsx`
* **Verification Ledger**:
  - `npx tsc --noEmit` -> 0 errors.
  - `npm test -- src/__tests__/BottomNav.test.tsx` -> 6/6 tests passed (100%).
* **Verification Ledger**:
  - `npx tsc --noEmit` -> 0 errors.
  - `npm test -- src/__tests__/BottomNav.test.tsx` -> 6/6 tests passed (100%).
  - `npm test -- src/__tests__/HomeTab.test.tsx src/__tests__/ChatTab.test.tsx src/__tests__/appUpdateService.test.ts` -> 23/23 tests passed (100%).


## 2026-10-10 - Header Back Button Unification & Grey Background Removal (Antigravity 2.0, Gemini 3.8 Flash High)
* **Status**: [Executed by Antigravity 2.0 - npx tsc --noEmit passed with 0 errors, Jest 53/53 tests passed across 8 test suites (100%)].
* **Feature & Interaction Specification**:
  - **Standardized Navigation Back Button**: Replaced non-standard `ArrowLeft` icon (size 20) with standard `ChevronLeft` (size 22, `colors.textDark`) in `FeedbackScreen.tsx` (lines 16 & 175) and `GooglePhoneSetupScreen.tsx` (lines 15 & 134), achieving 100% visual and geometric consistency across all screens in CustomerApp.
  - **Universal Grey Background Removal from Headers**: Removed the circular grey background fill (`colors.bgGray`, `#F1F5F9`, `rgba(255,255,255,0.06)`) from navigation back buttons and header action buttons across ALL screens. Header buttons now feature clean, flat transparent surfaces matching modern mobile guidelines:
    - `FeedbackScreen.tsx`: line 171 (`backButton`)
    - `GooglePhoneSetupScreen.tsx`: line 130 (`backButton`)
    - `CustomerChatScreen.tsx`: line 976 (`backBtn`), lines 1047 & 1061 (`actionIconBtn` for MapPin and Errand Info)
    - `AccountScreen.tsx`: line 330 (`backBtn`), line 349 (`settingsBtn`)
    - `EditAccountScreen.tsx`: line 453 (`backBtn`)
    - `SettingsScreen.tsx`: line 308 (`backBtn`)
    - `ErrandDetailsScreen.tsx`: line 149 (`backBtn`)
    - `ErrandConfirmationScreen.tsx`: line 104 (`backBtn`)
    - `ErrandFormScreen.tsx`: line 195 (`backBtn`)
    - `ErrandItemsScreen.tsx`: line 505 (`backBtn`)
    - `Notification.tsx`: line 265 (`backBtn`)
    - `PopularStoresScreen.tsx`: line 85 (`backBtn`)
    - `ServiceListScreen.tsx`: line 42 (`backBtn`)
    - `ActiveChatsScreen.tsx`: line 57 (`backBtn`)
    - `pabili/PabiliHubScreen.tsx`: line 193 (`backBtn`)
    - `pabili/PabiliReviewScreen.tsx`: line 184 (`backBtn`)
    - `pabili/PabiliStoreEditorScreen.tsx`: line 171 (`backBtn`)
    - `portal/AccountTab.tsx`: line 265 (`settingsBtn`)
    - `portal/ChatTab.tsx`: line 100 (`headerHelpBtn`)
    - `portal/ErrandsTab.tsx`: line 533 (`headerActionBtn`)
  - **Ergonomics & Accessibility Invariants Preserved**:
    - Retained all 40/38dp touch target boundaries and compact hit slop margins (`PortalTouchTargets.compactHitSlop` / `hitSlop={8}`) ensuring zero degradation of accessibility or tap responsiveness.
    - Preserved all `testID`s (`back-button`, `feedback-back-button`, `review-back`, `editor-back`, `account-settings-gear-button`, etc.).
* **Files Modified**:
  - `src/screens/FeedbackScreen.tsx`
  - `src/screens/GooglePhoneSetupScreen.tsx`
  - `src/screens/CustomerChatScreen.tsx`
  - `src/screens/AccountScreen.tsx`
  - `src/screens/EditAccountScreen.tsx`
  - `src/screens/SettingsScreen.tsx`
  - `src/screens/ErrandDetailsScreen.tsx`
  - `src/screens/ErrandConfirmationScreen.tsx`
  - `src/screens/ErrandFormScreen.tsx`
  - `src/screens/ErrandItemsScreen.tsx`
  - `src/screens/Notification.tsx`
  - `src/screens/PopularStoresScreen.tsx`
  - `src/screens/ServiceListScreen.tsx`
  - `src/screens/ActiveChatsScreen.tsx`
  - `src/screens/pabili/PabiliHubScreen.tsx`
  - `src/screens/pabili/PabiliReviewScreen.tsx`
  - `src/screens/pabili/PabiliStoreEditorScreen.tsx`
  - `src/screens/portal/AccountTab.tsx`
  - `src/screens/portal/ChatTab.tsx`
  - `src/screens/portal/ErrandsTab.tsx`
  - `src/__tests__/SettingsScreen.test.tsx`
* **Verification Ledger**:
  - `npx tsc --noEmit` -> 0 errors.
  - `npm test -- src/__tests__/FeedbackScreen.test.tsx src/__tests__/CustomerChatScreen.test.tsx` -> 17/17 tests passed (100%).
  - `npm test -- src/__tests__/AccountScreen.test.tsx src/__tests__/EditAccountScreen.test.tsx src/__tests__/ErrandConfirmationScreen.test.tsx src/__tests__/ErrandFormScreen.test.tsx src/__tests__/ChatTab.test.tsx` -> 29/29 tests passed (100%).
  - `npm test -- src/__tests__/SettingsScreen.test.tsx` -> 7/7 tests passed (100%).

## 2026-10-10 - Customer Chat Screen Bento Capsule & Anti-AI-Slop Redesign (Antigravity 2.0, Gemini 3.8 Flash High)
* **Status**: [Executed by Antigravity 2.0 - npx tsc --noEmit passed with 0 errors, Jest 11/11 tests passed on CustomerChatScreen.test.tsx, 13/13 on ChatTab & Availability suites].
* **Feature & Interaction Specification**:
  - **46px Collapsible Bento Order Capsule (`bentoCapsuleBar`)**: Replaced the legacy stacked vertical ribbons (95px+ screen height consumption) with a single interactive Bento Capsule bar. Displays the mono order reference (`#SGO-XXXXXX`), store categories summary, live `StatusBadge`, and interactive expand/collapse toggle (`ChevronDown` / `ChevronUp`).
  - **Expandable Itinerary & Quick Actions Drawer (`bentoDrawer`)**: Tapping the capsule smoothly reveals active route stops/itinerary chips, quick route map launcher (`View Route Map`), and errand details inspector (`Full Errand Info`).
  - **Zero-Regression Half-Payment Banner Survival**: Preserved `testID="half-payment-banner"` and `testID="half-payment-banner-action"` in both collapsed reminder strip (`collapsedHalfStrip`) and expanded drawer states with exact verification copy (`Half-payment needed: ₱...`).
  - **Digital Receipt Slip In-Thread Breakdown (`isOrderConfirmation`)**: Redesigned the bulky 800px card into a clean digital receipt slip featuring a Deep Navy header (`#0B132B`), tabular 2-column alignment (item name left, quantity badge right e.g. `10×`), and monochromatic vector icons (`FolderOpen`, `Store`, `ReceiptText`) replacing emoji markers (`📁`, `✓`).
  - **Absolute Anti-AI-Slop Copy Cleanse**:
    - Purged repetitive fine print (`'Actual store receipt upon purchase'`) from `parseOrderConfirmationTree` and item rows.
    - Removed redundant AI-slop kicker (`'Grouped by store with upfront fee'`).
    - Replaced 15-word explanatory paragraph with a concise 1-line footnote: `"Purchased items verified by physical merchant receipts upon delivery (COD)"`.
    - Modernized CTA buttons: `"Approve Order (₱${deliveryFee})"` without decorative checkmark glyphs.
    - Action-oriented decline modal subtitle: `"Specify brand, quantity, or replacement preference."`.
    - Shortened overflow text: Replaced bulky sentence `"Adjustment Requested — Awaiting Dispatcher Revision"` with concise, single-line `"Adjustment Requested"` pill (`minHeight: 38`, `paddingHorizontal: 12`).
    - Contact Email Privacy in Feedback: Initialized `contactEmail` state to empty string `''` in `FeedbackScreen.tsx` so user's email is not prefilled in the optional contact field.
  - **Surface Elevation & Zero Blur Flat Design**: Pure solid surfaces (`#0B132B` Deep Navy, `#F8FAFC` Slate light), 1px hairline borders, and zero blurry ambient halo drop shadows.
* **Files Modified**:
  - `src/screens/CustomerChatScreen.tsx`
  - `src/screens/FeedbackScreen.tsx`
  - `src/__tests__/FeedbackScreen.test.tsx`
* **Verification Ledger**:
  - `npx tsc --noEmit` -> 0 errors.
  - `npm test -- src/__tests__/CustomerChatScreen.test.tsx` -> 11/11 tests passed (100%).
  - `npm test -- src/__tests__/FeedbackScreen.test.tsx` -> 6/6 tests passed (100%).
  - `npm test -- src/__tests__/ChatTab.test.tsx src/__tests__/CustomerChatAvailability.test.tsx` -> 13/13 tests passed (100%).

## 2026-10-09 - Customer App Feedback & Review System (Antigravity 2.0, Gemini 3.8 Flash High)
* **Status**: [Executed by Antigravity 2.0 - npx tsc --noEmit passed with 0 errors, Jest 6/6 tests passed on FeedbackScreen.test.tsx, 30/30 passed across regression suite].
* **Feature & Interaction Specification**:
  - **Human Feedback & Review Form (`FeedbackScreen.tsx`)**: Built a complete, anti-AI-slop customer feedback console featuring 5 category chips (`BUG_REPORT`, `FEATURE_REQUEST`, `DELIVERY_EXPERIENCE`, `APP_USABILITY`, `OTHER`), subject and description inputs with live character counters, optional follow-up contact info, and an opt-in technical diagnostics toggle.
  - **Zero-Star Initial Reset & Validation Gate**: Overall experience rating initializes to 0 unselected stars with helper prompt (`"Tap a star to rate your experience"`). Attempting to submit without selecting a rating triggers an actionable notification (`"Please select a star rating for your experience."`) before validating subject/description.
  - **Developer Email Privacy Protection**: Removed developer personal email address from the customer-facing mobile UI. The success screen displays `"Your review has been directly dispatched to our engineering team."` while the backend safely routes alerts to `aljayveeversola@gmail.com` without exposing private developer contact details to app users.
  - **Human-Friendly Diagnostics Copy**: Replaced technical telemetry strings (e.g., `Attaches devices model (SM-A045F) and OS (android 34)...`) with clean, human-friendly wording (`"Include technical diagnostics"` / `"Helps our engineering team identify and solve app issues faster."`).
  - **Zero Data Loss & Direct Developer Alert**: Reviews are persisted in MariaDB first via `/api/feedback`, generate a unique reference ticket (`FB-YYMMDD-XXXX`), and dispatch an immediate HTML alert to the developer inbox (`aljayveeversola@gmail.com`).
  - **Navigation Integration**: Registered `Feedback` route in `AppNavigator.tsx` and wired intuitive entry points in `AccountScreen.tsx` (Row 6 under Security & Support), `AccountTab.tsx`, and `SettingsScreen.tsx` (under About & Operations).
  - **Ergonomics & Surface Hygiene**: 12dp restrained radii, Lucide vector icons (`MessageSquare`, `Bug`, `Lightbulb`, `Truck`, `Smartphone`, `Star`), zero blurry colored halos, WCAG 2.2 AA contrast, and `KeyboardAwareScrollView` for keyboard-safe input.
* **Files Modified**:
  - `src/navigation/types.ts`
  - `src/navigation/AppNavigator.tsx`
  - `src/screens/FeedbackScreen.tsx`
  - `src/screens/AccountScreen.tsx`
  - `src/screens/portal/AccountTab.tsx`
  - `src/screens/SettingsScreen.tsx`
  - `src/__tests__/FeedbackScreen.test.tsx` (6 unit tests)
  - `src/__tests__/AccountReminder.test.tsx` (type fix)
* **Verification Ledger**:
  - `npx tsc --noEmit` -> 0 errors.
  - `npm test -- src/__tests__/FeedbackScreen.test.tsx` -> 6/6 tests passed (100%).
  - `npm test -- src/__tests__/AccountScreen.test.tsx src/__tests__/LoginScreen.test.tsx src/__tests__/AccountReminder.test.tsx` -> 30/30 tests passed (100%).

## 2026-10-08 - Google Sign-In "Signing In..." Spinner State Hardening (Antigravity 2.0, Gemini 3.8 Flash High)
* **Status**: [Executed by Antigravity 2.0 - npx tsc --noEmit passed with 0 errors, Jest 6/6 tests passed on GoogleSignInButton.test.tsx, 12/12 on LoginScreen.test.tsx, 7/7 on RegisterScreen.test.tsx].
* **Feature & Interaction Specification**:
  - **Selected Google Account Feedback**: In `GoogleSignInButton.tsx`, added `loadingText?: string | null` prop. When `loading` is true and `loadingText` is provided, renders the `ActivityIndicator` alongside high-contrast `Text` (`"Signing In..."`) in `contentRow` instead of an ambiguous lone spinner.
  - **Dynamic State Progression**: In `LoginScreen.tsx` and `RegisterScreen.tsx`, `googleLoadingText` is initialized to `null` while launching the native Google account picker. Once `signInWithGoogleNative()` resolves with the selected Google account, `setGoogleLoadingText('Signing In...')` is immediately dispatched before triggering backend token exchange (`apiClient.post('/customers/google-login')`), ensuring reassuring real-time status feedback.
  - **Accessibility Role & Label**: `accessibilityLabel` dynamically reflects `loading && loadingText ? loadingText : text`.
* **Files Modified**:
  - `src/components/GoogleSignInButton.tsx`
  - `src/screens/LoginScreen.tsx`
  - `src/screens/RegisterScreen.tsx`
  - `src/__tests__/GoogleSignInButton.test.tsx` (new unit test suite)
* **Verification Ledger**:
  - `npx tsc --noEmit` -> 0 errors.
  - `npm test -- src/__tests__/GoogleSignInButton.test.tsx` -> 6/6 tests passed (100%).
  - `npm test -- src/__tests__/LoginScreen.test.tsx` -> 12/12 tests passed (100%).
  - `npm test -- src/__tests__/RegisterScreen.test.tsx` -> 7/7 tests passed (100%).

## 2026-10-08 - Customer App Login Screen Optimization (Antigravity 2.0, Gemini 3.8 Flash High)
* **Status**: [Executed by Antigravity 2.0 - npx tsc --noEmit passed with 0 errors, Jest 12/12 tests passed on LoginScreen.test.tsx, 10/10 passed on regression suite].
* **Design Pattern & Architecture (Dribbble-Inspired Anchor Hero + Ascending Sheet Archetype)**:
  - **Anchor Hero & Brand Canvas**: Top 30% viewport atmospheric brand anchor with authentic Sugo Crimson (`#F62459` light / `#8E1739` dark) and Deep Navy stops, SVG speed-line pattern, and Lucide `Bike` brand insignia.
  - **Ascending Form Sheet (`styles.sheet`)**: 28px top-radius sheet overlapping hero by 34px (`marginTop: -34`) with dynamic status bar content inversion (`sheetUnderStatusBar`).
  - **Persistent Uppercase Micro-Labels (`styles.inputLabel`)**: Set to 11.5sp with `letterSpacing: 0.5`, flush with input borders to eliminate floating label jitter.
  - **Input Geometry & Focus States**: Standardized to 52dp height with ergonomic 12dp border radius (`BorderRadius.lg`). Clean 1.5px border transitions on focus/error (`idFocused`, `passFocused`) without blurry neon halos.
  - **Primary Log In CTA (`styles.button`)**: Restrained 12dp border radius (eliminating `BorderRadius.full` pill violation), 54dp minHeight, white bold text, and Lucide `ArrowRight` icon.
  - **Keyboard-Safe Clearance**: `KeyboardAwareScrollView` tuned with `bottomOffset={Spacing.xxl + 16}` (46dp) and `keyboardShouldPersistTaps="handled"`.
  - **Jest Native Mock**: Added `@react-native-google-signin/google-signin` native TurboModule mock in `jest.setup.js`.
* **Files Modified**:
  - `src/screens/LoginScreen.tsx`
  - `jest.setup.js`
* **Verification Ledger**:
  - `npx tsc --noEmit` -> 0 errors.
  - `npm test -- src/__tests__/LoginScreen.test.tsx` -> 12/12 tests passed (100%).
  - `npm test -- src/__tests__/EditAccountScreen.test.tsx src/__tests__/AccountScreen.test.tsx` -> 10/10 tests passed (100%).

## 2026-10-08 - Customer App Account & Edit Information Optimization (Antigravity 2.0, Gemini 3.8 Flash High)
* **Status**: [Executed by Antigravity 2.0 - npx tsc --noEmit passed with 0 errors, Jest 10/10 tests passed across AccountScreen.test.tsx and EditAccountScreen.test.tsx, 24/24 passed across regression suite].
* **Design Pattern & Architecture (Dribbble-Inspired Anchor-Bento-List & Focus-Aware Form)**:
  - **Hero Identity Card (`heroCard`)**: Upgraded to 72px avatar geometry (`avatarBadge`, `avatarImage` 72x72dp, radius 36) in `EditAccountScreen.tsx` and 68px in `AccountTab.tsx`/`AccountScreen.tsx`. Added a 2.5px solid isolation border (`borderColor: isDark ? colors.card : '#FFFFFF'`) on `cameraBadge` preventing visual bleed against any underlying avatar colors.
  - **Focus-Aware Inputs (`focusedField` state)**: Implemented crisp border transitions on focus (`borderColor: focusedField === 'fieldName' ? colors.primary : colors.border`, `borderWidth: 1.5`) across First Name, Middle Name, Last Name, Email, and Phone fields without blurred drop shadows or glowing halos.
  - **Positive Micro-Validation**: Trailing green micro-checkmarks (`Check size={14} color="#10B981"`) appear seamlessly on valid fields.
  - **Segmented Phone Input**: Unified container pairing the `+63` prefix box (52dp height, 12dp radius) with the 10-digit number field, inline verification status badge (`VERIFIED` / `UNVERIFIED`), and SMS OTP verification modal trigger.
  - **3-Column Metrics Bento Row (`statsBentoRow`)**: Implemented compact 3-column operational stats strip (`[ 📦 Completed ] [ 📍 Tacurong Pin ] [ 🛡️ Active ]`) with 34x34dp icon badges, bold numbers, and micro labels calibrated for Samsung Galaxy A04 baselines.
  - **Apple/Uber Grouped Inset Sections (`groupSection`, `groupedCard`)**: Structured into `ACTIVITY & PREFERENCES` and `SECURITY & SUPPORT` with 10dp rounded icon badges and indented hairline dividers.
  - **Sticky Bottom Thumb-Zone Dock (`stickyBottomDock`)**: 52dp height CTA, 12dp border radius, with dynamic dirty-state label (`Save ${modifiedCount} Changes` / `Save Profile Changes`) and loss-aversion back navigation guard (`ConfirmModal`).
* **Files Modified**:
  - `src/screens/portal/AccountTab.tsx`
  - `src/screens/AccountScreen.tsx`
  - `src/screens/EditAccountScreen.tsx`
* **Verification Ledger**:
  - `npx tsc --noEmit` -> 0 errors.
  - `npm test -- src/__tests__/AccountScreen.test.tsx src/__tests__/EditAccountScreen.test.tsx` -> 2 suites passed, 10/10 tests passed.
  - `npm test -- src/__tests__/CustomerPortalScreen.test.tsx src/__tests__/PabiliScreens.test.tsx` -> 24/24 tests passed.

## 2026-10-06 - Android Three-Key Navigation Safety & Hardware Back Interception (Antigravity 2.0, Gemini 3.8 Flash High)
* **Status**: [Executed by Antigravity 2.0 - npx tsc --noEmit passed with 0 errors, Jest 24/24 tests passed across PabiliScreens.test.tsx and SavedLocationCard.test.tsx].
* **Android 3-Button System Navigation Bar Clearance**:
  - `PabiliStoreEditorScreen.tsx`: Dynamic `paddingBottom: Math.max(insets.bottom, Spacing.md)` on `composeBar` prevents the sticky "Done with store" button and item input from resting behind the Android 3-button navigation bar.
  - `PabiliReviewScreen.tsx`: Dynamic `paddingBottom: Math.max(insets.bottom, Spacing.md)` on `bottomBar` protects the primary "Submit Errand" CTA.
  - `PabiliHubScreen.tsx`: Dynamic `paddingBottom: Math.max(insets.bottom, Spacing.md)` on `bottomBar` ensures the "Review All Stores & Items" CTA is 100% visible and reachable.
  - `CustomerPortalScreen.tsx`: Tab screens (`HomeTab`, `ErrandsTab`, `ChatTab`, `TrackTab`, `AccountTab`) updated from hardcoded padding to responsive `paddingBottom: 80 + Math.max(insets.bottom, 16) + Spacing.md` (~144dp on 3-button devices) so list cards never hide behind `BottomNav`.
  - `AppNavigator.tsx`: Synchronized `NavigationBar.setStyle(isDark ? 'light' : 'dark')` matching active color scheme for crisp physical key contrast.
* **Hardware Back Interception & Form Draft Preservation**:
  - `useAndroidBackHandler.ts` [NEW]: Reusable `useDoubleTapBackToExit` and `useHardwareBackAction` hooks.
  - `CustomerPortalScreen.tsx`: Hardware back button dismisses active accepted errand dialog / help modal; if on a secondary tab, switches to Home tab; if on Home tab, triggers native double-tap-to-exit toast.
  - `PabiliStoreEditorScreen.tsx`: Physical Back button dismisses the item edit modal if open before popping screen.
  - `PabiliReviewScreen.tsx`: Physical Back button safely returns to Pabili store hub with all form drafts preserved.
  - `PabiliHubScreen.tsx`: Physical Back button dismisses open confirmation modals before leaving.
  - `ErrandConfirmationScreen.tsx`: Physical Back button safely resets navigation back to CustomerPortal.

## 2026-10-06 - Pabili Item Entry Layout Calibration: Wider Input & Transferred Stepper (Antigravity 2.0, Gemini 3.8 Flash High)
* **Status**: [Executed by Antigravity 2.0 - tsc green (0 errors), jest tests 17/17 passing on PabiliScreens.test.tsx, 18/18 passing on regression suite].
* **Core Interaction & Ergonomic Deltas**:
  - **Expanded Item Input Field (`composeRow`)**: Transferred the "+ / -" stepper out of the top composer row. The "What to buy" input field now occupies `flex: 1` alongside the `Add` (+) button, expanding from ~185dp to over 287dp+ (~60% wider). Long item titles and quantities fit comfortably without horizontal truncation.
  - **Transferred Stepper to Dedicated "How many" Row (`qtySection` + `qtyRow`)**: Created a dedicated quantity row directly beneath the text input. Quick preset pills (`1×, 2×, 3×, 5×`) sit on the left, and the transferred stepper (`-`, number, `+`) sits on the right.
  - **Dynamic Custom Quantity Indicator**: When the user adjusts to a non-preset quantity (e.g. 4, 6, 7), the stepper dynamically illuminates with `borderColor: colors.primary` and colored text to clearly indicate an active custom selection.
  - **Budget Viewport Calibration**: Harmonized `qtyPill` and `stepper` heights to 38dp with `BorderRadius.md`. The entire quantity section fits easily within 280dp, leaving generous clearance on 360dp baselines (Samsung Galaxy A04).
  - **Automated Test Contracts Maintained**: Preserved all testIDs (`compose-input`, `compose-add`, `compose-minus`, `compose-plus`, `quick-qty-${n}`) and accessibility labels.
* **Verification**:
  - `npx tsc --noEmit` -> 0 errors.
  - `npx jest src/__tests__/PabiliScreens.test.tsx` -> 17/17 tests passed.
  - Regression suite (`SavedLocationCard`, `LocationWizard`, `ConfirmModal`, `ChatTab`) -> 18/18 tests passed.

---

## 2026-10-06 - Saved Locations Card-Tap Default Selection Calibration (Antigravity 2.0, Gemini 3.8 Flash High)
* **Status**: [Executed by Antigravity 2.0 - tsc green (0 errors), jest tests 4/4 passing on SavedLocationCard.test.tsx].
* **Core Interaction Deltas**:
  - **Natural Card-Tap Selection**: Made the entire main body of `SavedLocationCard.tsx` an interactive `TouchableOpacity` (`testID="saved-location-select-${id}"`). Tapping any non-default address immediately sets it as default (`onSetDefault(location)`).
  - **Elimination of Star Button Clutter**: Removed the redundant Star icon button from the right action stack. The action column now cleanly houses only `Pencil` (Edit) and `Trash2` (Delete), reducing height and visual noise.
  - **Active State Border Accent**: Added active brand primary border (`borderColor: colors.primary`, `borderWidth: 1.5`) and preserved the `[ Default ]` badge for the active delivery location.
  - **Protected Action Touch Targets**: Isolated `Pencil` and `Trash2` as sibling touch targets to ensure edit and delete actions never accidentally trigger default location changes.
  - **Firebase Realtime DB Sync**: Added `saveCustomerLocation` call in `handleSetDefault` in `CustomerLocationScreen.tsx` to keep active dispatch coordinates in sync.
* **Verification**:
  - `npx tsc --noEmit` -> 0 errors.
  - `npx jest src/__tests__/SavedLocationCard.test.tsx` -> 4/4 tests passed.

---

## 2026-10-06 - ErrandsTab and ChatTab Layout Alignment & Balance Calibration (Antigravity 2.0, Gemini 3.8 Flash High)
* **Status**: [Executed by Antigravity 2.0 - tsc green (0 errors), jest tests 13/13 passing, pixel-perfect alignment achieved].
* **Core Alignment Deltas**:
  - **Unified `fixedTopSection` Structure**: Wrapped top header, search, and filter capsules into `<View style={styles.fixedTopSection}>` with `paddingHorizontal: Spacing.md` and calibrated `paddingTop` (`insets.top + Spacing.xs`), eliminating previous vertical drift and outer margin asymmetry.
  - **Full-Width Minimalist Search Bar**: Removed side-squeezed date button from search row; search input now occupies 100% width with primary Search icon, clean placeholder, and clear button, identical to `ChatTab.tsx`.
  - **Header Date Filter Action Button**: Relocated calendar date picker trigger into a clean 44x44dp circular button (`headerActionBtn`) on the header right, directly matching `ChatTab.tsx`'s `headerHelpBtn` touch target and styling, equipped with an active indicator dot.
  - **4-Tab Symmetric Flex Filter Capsules**: Replaced horizontal `ScrollView` with a responsive 4-item flex row (`[ Active | All | Delivered | Cancelled ]`), assigning `flex: 1` and 36dp height with `BorderRadius.full` to eliminate scrolling jitter and align seamlessly with the search bar above.
  - **List Surface Purity & Dividers**: Aligned card bottom border colors to subtle hairline dividers (`isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9'`) across both `heroCard` and `standardCard`, matching `ErrandChannelRow`.
* **Verification**:
  - `npx tsc --noEmit` -> 0 errors.
  - `npm test` -> 13/13 tests passed across suites (`ChatTab`, `AnimatedSplashScreen`, `ConfirmModal`).

---

## 2026-10-05 - Unified Single Splash Screen Invariant (Antigravity 2.0, Gemini 3.8 Flash High)
* **Status**: [Executed by Antigravity 2.0 - tsc green (0 errors), jest tests 4/4 passing, single splash active].
* **Core Architecture**:
  - Replaced static 1st splash screen by configuring `expo-splash-screen` in `app.json` to use a transparent blank asset (`./assets/splash-blank.png`) matching the app theme background (`#ffffff` light, `#0F2035` dark).
  - Maintained `SplashScreen.preventAutoHideAsync()` on boot in `App.tsx` so the blank system canvas holds cleanly while fonts load.
  - Removed early `SplashScreen.hideAsync()` on `onLayoutRootView` in `App.tsx` to eliminate premature system splash release.
  - Added `onFirstFrame` lifecycle hook to `src/components/AnimatedSplashScreen.tsx` that triggers `SplashScreen.hideAsync()` the exact millisecond the animated splash paints its first frame on screen.
  - Cleanly unmounts `AnimatedSplashScreen` once animation sequence finishes and app prerequisites (`!isLoading`) are ready.
* **Verification**:
  - `npx tsc --noEmit` -> 0 errors.
  - `npx jest src/__tests__/AnimatedSplashScreen.test.tsx` -> 4/4 tests passed.

---

## 2026-10-05 - Universal Custom Alert & Modal System Migration (Antigravity 2.0, Gemini 3.8 Flash High)
* **Status**: [Executed by Antigravity 2.0 - tsc green (0 errors), jest tests 4/4 passing, 0 Alert.alert instances remaining].
* **Core Architecture**:
  - Upgraded `src/components/ConfirmModal.tsx` to support single-button alert mode (`singleButton?: boolean`), custom status accents (`variant: 'confirm' | 'info' | 'error' | 'warning' | 'success'`), and vector status icons (`icon: 'info' | 'error' | 'warning' | 'success' | 'trash' | 'lock'`).
  - Created lightweight event bus singleton in `src/services/alertModal.ts` exposing `showAppAlert()` and `showAppConfirm()` for both declarative and imperative triggers.
  - Mounted `<GlobalAlertModal />` in `src/components/GlobalAlertModal.tsx` and registered at the root of `src/navigation/AppNavigator.tsx` inside `NavigationContent`.
* **Zero OS Popups Invariant Achieved**:
  - Migrated all 43 instances of native `Alert.alert` across 10 screens and utilities:
    1. `src/screens/CustomerLocationScreen.tsx`: Delete location confirmation (`showAppConfirm`) and 8 error/feedback alerts.
    2. `src/screens/location/LocationWizard.tsx`: Missing label/address/pin validation alerts.
    3. `src/utils/safeImagePicker.ts`: Camera/photo library permissions and photo access errors.
    4. `src/screens/EditAccountScreen.tsx`: Avatar format, size (>5MB), and removal alerts.
    5. `src/screens/AccountScreen.tsx`: Avatar format, size (>5MB), and removal alerts.
    6. `src/screens/portal/AccountTab.tsx`: Avatar format, size (>5MB), and removal alerts.
    7. `src/screens/ErrandFormScreen.tsx`: Maximum 3 store category cap alert.
    8. `src/screens/ErrandItemsScreen.tsx`: Errand checkout submission error alert.
    9. `src/screens/SettingsScreen.tsx`: Cache clean and cache cleared feedback alerts.
    10. `src/screens/CustomerChatScreen.tsx`: Order confirmation, read-only chat, and payment closed alerts.
* **Verification**:
  - `Get-ChildItem ... | Select-String -Pattern "Alert\.alert\("` -> 0 occurrences.
  - `npx tsc --noEmit` -> 0 errors.
  - `npx jest src/__tests__/ConfirmModal.test.tsx` -> 4/4 tests passed.

---

## 2026-10-05 - Account Edit Contact Details & App Settings Multi-Channel Password Reset (Antigravity 2.0, Gemini 3.8 Flash High)
* **Status**: [Executed by Antigravity 2.0 - tsc green (0 errors), backend deployed & verified live on VPS].
* **Contact Details Mobile Phone Input (`EditAccountScreen.tsx`)**:
  - Implemented `normalizeTo10Digits()` to extract clean 10-digit number (`9XXXXXXXXX`) on screen mount.
  - Replaced unrestricted text input with dedicated split prefix container: non-editable `+63` prefix box + 10-digit clamped input (`maxLength={10}`, `keyboardType="phone-pad"`).
  - Cleaned `handlePhoneChange()` to reject leading country prefixes and non-numeric characters, enforcing exactly 10 digits starting with `9`.
  - Upgraded verification detection: unverified state displays an in-context `[ Verify Mobile Number ]` (or `[ Verify New Mobile Number ]`) button whenever a complete 10-digit number starting with `9` is typed.
  - Tapping opens `WebBrowser.openAuthSessionAsync` via `https://portal.sugo-express.org/verify-phone`. Upon completion, immediately calls `POST /api/customers/verify-phone-firebase` and activates the green `VERIFIED` chip.
  - Guarded `handleSave` to block saving unverified phone numbers.
* **App Settings Multi-Channel Password Reset (`SettingsScreen.tsx`)**:
  - Replaced inert mock dialog with a 4-step modal state machine (`CHOOSE_CHANNEL` -> `EMAIL_OTP` | `SMS OTP` -> `SET_PASSWORD` -> `SUCCESS`).
  - **Email Channel**: Calls `POST /api/customers/forgot-password`, transitions to `EMAIL_OTP` for entering the 6-digit code with resend countdown timer, and calls `POST /api/customers/verify-reset-code` to obtain the cryptographic `resetToken`.
  - **SMS Channel**: Opens `WebBrowser.openAuthSessionAsync` targeting `https://portal.sugo-express.org/verify-phone`, receives `firebaseIdToken`, and exchanges it via newly mounted `POST /api/customers/verify-reset-phone` to obtain the `resetToken`.
  - **Password Setting**: Validates minimum 6 characters and matching passwords with toggleable eye visibility, submitting `POST /api/customers/reset-password` and presenting confirmation upon completion.
* **Verification**: `npx tsc --noEmit` compiles cleanly with 0 errors across CustomerApp.

---

## 2026-10-05 - Native Google Sign-In & Phone Onboarding Flow (Antigravity 2.0, Gemini 3.8 Flash High)
* **Status**: [Executed by Antigravity 2.0 - tsc green (0 errors), backend deployed & verified live].
* **Native Google Sign-In Architecture (Path B)**:
  - Installed `@react-native-google-signin/google-signin` and configured plugin in `app.config.js`.
  - Configured Web Client ID (`39494270128-6cp0uhbuj4oqvqhgcjtoaut40htat9fo.apps.googleusercontent.com`) via `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` in `.env` and `.env.example`.
  - Synced `google-services.json` with Firebase OAuth client configuration (`client_type 1` hash `3c3f85a0fbae49fb2c0796dee67d32684ecabf7b` and `client_type 3` Web Client ID).
  - Synchronized `CustomerApp/android/app/debug.keystore` with developer machine `~/.android/debug.keystore` matching the SHA-1 registered in Firebase (`3C:3F:85:A0:FB:AE:49:FB:2C:07:96:DE:E6:7D:32:68:4E:CA:BF:7B`).
  - Created `src/services/googleAuth.ts`: wraps Google Sign-In Play Services picker, exchanges Google `idToken` with Firebase Auth (`signInWithCredential`), yielding an authenticated Firebase session and Firebase ID token. Handles `response.type === 'cancelled'` gracefully.
  - Created `src/components/GoogleSignInButton.tsx`: Anti-AI-slop design adhering to Google Brand Guidelines with 4-color "G" mark, restrained 10px radius, zero glowing halo shadows, and accessible touch target.
  - Integrated `GoogleSignInButton` and clean `OR` dividers into `LoginScreen.tsx` and `RegisterScreen.tsx` (Step 1).
* **New User Phone Onboarding Gate (`GooglePhoneSetupScreen.tsx`)**:
  - When a customer logs in with Google for the first time or lacks a phone number, the backend responds with `{ status: "PHONE_SETUP_REQUIRED", email, firstName, lastName, avatar }`.
  - The app navigates to `GooglePhoneSetupScreen.tsx`.
  - The user provides their 10-digit Philippine phone number (`09...`) and undergoes mandatory SMS OTP verification via `WebBrowser.openAuthSessionAsync` (`https://portal.sugo-express.org/verify-phone`).
  - Upon receiving the verified phone token, `POST /api/customers/google-register` completes registration with unique username generation, verified phone number, and returns active JWT/refresh session tokens.
* **Verification**: `npx tsc --noEmit` compiles cleanly with 0 errors across CustomerApp.

---

## 2026-10-05 - Firebase Phone Authentication & Dual-Channel Registration (Antigravity 2.0, Gemini 3.8 Flash High)
* **Status**: [Executed by Antigravity 2.0 - tsc green (0 errors), backend deployed & live on VPS].
* **Dual Channel Verification**: Step 3 of `RegisterScreen.tsx` adds a clean channel switcher (`[ Email OTP | SMS (Phone) ]`).
  - **Email Channel**: Existing 6-digit email OTP flow preserved with full backward compatibility.
  - **SMS (Phone) Channel**: Powered by Firebase Phone Auth via web-based authentication session (`expo-web-browser` / `expo-linking`).
* **Deep-Link Authentication Architecture**:
  - `CustomerApp` invokes `WebBrowser.openAuthSessionAsync` targeting `https://portal.sugo-express.org/verify-phone?phone=...&redirect=customerapp://phone-verified`.
  - The Web Portal executes invisible reCAPTCHA on the authorized domain (`portal.sugo-express.org`), sends SMS via Google CloudOTP, verifies the 6-digit code, and deep-links back to the app with the cryptographically signed Firebase ID token.
  - The app captures the token, sets `phoneVerified: true`, advances to Step 5, and submits the token with the registration payload.
  - The Express backend (`POST /api/customers/register`) cryptographically validates the token via Firebase Admin SDK before writing `phoneVerified: true` and `phoneVerifiedAt` to MariaDB.
* **Option 4 - Account Edit Phone Verification (`EditAccountScreen.tsx`)**:
  - Added SMS verification gate when a customer updates their phone number in `EditAccountScreen.tsx`.
  - If the user edits their phone digits, `isPhoneChanged` activates, and an ergonomic `[ Verify New Mobile Number ]` button appears.
  - Tapping opens `openAuthSessionAsync` to `https://portal.sugo-express.org/verify-phone?phone=...&redirect=customerapp://phone-verified`.
  - Once verified, the received `firebaseIdToken` is stored in state, showing a green `VERIFIED` chip.
  - Submitting `handleSave` passes `firebaseIdToken` to `PUT /api/customers/:id`.
  - The server verifies the token against the new phone number before updating the database.
  - Added `phoneVerified` and `phoneVerifiedAt` fields to `UserData` (`navigation/types.ts`) and `User` (`AuthContext.tsx`).
* **Verification**: `npx tsc --noEmit` compiles cleanly with 0 errors across CustomerApp.

---

## 2026-10-03 - Saved-location door details, stale Home location, keyboard safety (Claude, Opus 5.5)
* **Status**: [Executed by Claude - tsc green, jest 43/43 suites, 324/324 tests. Backend half deployed to production 2026-10-03. NOT yet in a shipped APK. NOT device-verified: no emulator on this machine.]
* **Stale Home location.** `CustomerPortalScreen` and `AccountScreen` loaded the default location on mount only. Saved Locations is pushed on top of both, so coming back is a focus, not a mount, and the header kept the old default until a restart. Both now also refetch on `navigation.addListener('focus')`.
* **Door details.** Step 2 of the location wizard adds Street Name, Landmark and Notes for the Rider, all optional. Stored in `saved_delivery_locations.streetName / landmark / notes`. `ErrandItemsScreen` copies them into `POST /errands` as `deliveryStreetName / deliveryLandmark / deliveryNotes`: a snapshot, so editing a saved place never rewrites an errand already out. A blank field is sent as `null` (clears it); the one-tap "Set as default" omits them, and the server keeps what is stored.
* **Keyboard safety.** All of it goes through `react-native-keyboard-controller`; React Native's own `KeyboardAvoidingView` is inert under edge-to-edge.
  - `TrueBottomSheet`: its full-screen root is now a KAV with `padding`, so every sheet rides up on the keyboard (Rating comment, Merchant category search). The sheet got `flexShrink: 1` and the root `paddingTop: insets.top`, so a tall sheet shrinks instead of pushing its header off the top.
  - `LoginScreen`, `RegisterScreen`: now `KeyboardAwareScrollView`, the same as `ForgotPasswordScreen`. The `expandProgress` slide-the-sheet-up animation is gone: it sat in a View that could not scroll, so with an error banner, or on the longer Register steps, the lower fields and the button were unreachable. Login's status bar now switches on scroll position instead of on the keyboard.
  - `WizardStepDetails`: `KeyboardAwareScrollView` plus a `KeyboardStickyView` Save bar, with `bottomOffset` set to the bar's measured height.
  - `VerifyEmailScreen`, `SessionExpiredSheet`: KAV `padding` re-centres the card above the keyboard.
  - Search lists (Notifications, Chat tab, Errands tab, Active Chats): `keyboardShouldPersistTaps="handled"` and `keyboardDismissMode="on-drag"`.
* **Check on a device**, A04 first: Login with an error banner showing, Register step 3, location Step 2 with Notes focused, the Rating sheet's comment box.

---

## 2026-09-23 - Chat "We lost the connection to this chat" (Claude, Opus 5.5)
* **Status**: [Executed by Claude - typecheck green, suite 257/258 (the 1 failure is the pre-existing `AnimatedSplashScreen` circuit-breaker timer test, which imports nothing touched here). NOT yet in a shipped APK.]
* **Root cause.** `/auth/firebase-token` spends an access token, but its URL matches the `auth/` arm of `CREDENTIAL_ENDPOINTS`, so the interceptor never refreshed its 401. On any cold start more than 15 minutes after the last refresh, launch fired it with an expired token alongside other calls: the others refreshed and retried, this one failed silently, and the app ran with no Firebase session. Every RTDB read was then refused, which the chat shows as "lost the connection". Seen in production nginx logs 2026-09-23 06:05:32 (customer 1).
* **Second bug.** "Try again" did a one-off read on the same refused session and never cleared `connectionError`, so it could not recover even when the read worked.
* **Delivered** (the locked matcher was NOT touched):
  - `src/firebase/realtimeSession.ts` - `requestFirebaseToken()` refreshes once through `refreshCustomerSession()` on a 401 and retries.
  - `src/screens/CustomerChatScreen.tsx` - listeners open only after `ensureRealtimeSession()` settles; "Try again" bumps `subscriptionAttempt`, which re-mints the session and reopens the listeners.
  - Tests: new `src/__tests__/realtimeSession.test.ts` (4); `CustomerChatScreen.test.tsx` +2. All fail against the old code (checked by mutation).
* **Decision needed (locked contract).** `Credential Endpoint Refresh Exclusion` defines credential endpoints as calls that present credentials rather than spend an access token, and `/auth/firebase-token` is not one. Narrowing `auth/` to `auth/(refresh|logout)` would make the workaround above unnecessary. Amend the lock explicitly if you want that; do not do it silently.
* **Still open.** `useRiderLiveLocation`, `useChatPresence` and `ErrandChannelRow` also subscribe without waiting for the session. With the root cause fixed they can only lose the race while a mint is still in flight, but they have no retry.

---

## 🧠 Model A (Claude) Blueprint & Directives
* **Status**: [Executed by Claude - Typecheck & Suite Green, Device Run OUTSTANDING]

### Root Cause Fixed (read this before touching `apiClient.ts`)
The reported symptom was "the login screen shows a security message instead of Wrong password". It was not a copy problem. Two defects stacked:
1. `apiClient.ts` gated the silent-refresh branch on `original.url.includes('/auth/')`. **No CustomerApp auth endpoint is under `/auth/`** - login, register, OTP, forgot/reset password and verify-email all live under `/customers/`. So a wrong password (HTTP 401) entered the refresh branch, `performRefresh()` threw `NO_REFRESH_TOKEN`, the catch wiped both tokens, fired `onSessionExpired()`, and rejected with *"Your session has expired. Please sign in again."*
2. `LoginScreen.tsx` then rendered `error.message` verbatim. Since `.env` points at the deployed `https://api.sugoonthego.online` (NOT `C:\Capstone_Server\server`), any string that backend or a CDN in front of it emits landed in the red banner. The phrase "secure cookies" exists nowhere in `src/`, `node_modules`, or any git branch - it arrives over the wire.

### Delivered
* **New** `src/services/ApiError.ts` - typed error carrying `status`, `code`, `isOffline`, `isTimeout`, `retryAfterSeconds`, `serverMessage`. The response interceptor used to flatten everything to `new Error(message)`, erasing `err.code`/`err.response`.
* **New** `src/services/errorMessages.ts` - `toUserMessage(err, context)`, `RETRY_LABEL`, `retryAfterSeconds()`, `isSessionEnded()`. Single sanitization boundary; replaced ~28 hand-rolled raw chains.
* **New** `src/services/lastActiveErrand.ts` - AsyncStorage snapshot of the last active errand, written by `useActiveErrands` while the network still works. Feeds the offline read-only escape.
* **New** `src/context/NetworkContext.tsx` - `NetworkProvider` / `useNetworkStatus()` returning `{ isConnected, isSlow, justReconnected, retry, reconnectCount }`. Connected predicate copied verbatim from `RiderMobileApp/src/hooks/useConnectivity.ts`.
* **New** `src/components/OfflineGate.tsx` - full-screen block with a read-only, staleness-stamped errand escape.
* **Dependency** `@react-native-community/netinfo` pinned at `12.0.1` (same pin as RiderMobileApp). Native module: **requires a rebuild, not a Metro reload**. No manifest edit needed - the library declares `ACCESS_NETWORK_STATE`/`ACCESS_WIFI_STATE` in its own manifest and Gradle merges them.
* **Slow detection** - `apiClient` times its own in-flight requests; `SLOW_REQUEST_MS = 3000`, matching the threshold `ErrandChannelList` already used. Deliberately NOT a NetInfo radio reading (full-bars Wi-Fi with a dead uplink reads as healthy).
* **Polling gated on connectivity** with refetch on the reconnect edge: `NotificationBell` (25s), `useLiveRoute` (30s). `useRiderLiveLocation`'s 5s tick was left alone - it is local freshness re-evaluation, not a network poll.
* **Wired up five previously orphaned components**: `MobileErrorBoundary` (now mounted, and split so it reads theme tokens), `RateLimitCountdown` (now fires on a login 429), `InlineFieldError`, `NetworkStatusPill` (re-copied, tokenized, third "slow" variant), plus copy fixes to `AccessRestrictedModal` / `ErrandStateConflictModal` / `MaintenanceScreen`.

### Incidental Bugs Found & Fixed
* `useActiveErrands.ts` tested `err.code === 'ERR_NETWORK' || !err.response` and so reported **every** failure - including a clean 404 or 500 - as a network failure, because the old interceptor had already destroyed both fields.
* `SessionExpiredSheet.tsx` posted `{ identifier, password }` where the API expects `username`, and read `res.data.customer` where `respondWithAuth` returns `user`. It threw *"Authentication response invalid."* even on a correct password. Never caught because nothing mounts it.
* `NetworkStatusPill` shipped a `"Working Offline (N queued)"` variant. Nothing in CustomerApp queues anything, so it promised the customer their tap had been saved when it had not - the mock telemetry `AGENTS.md` forbids. Removed.

### Copy Contract (do not drift from this)
* One retry word everywhere: **`Try again`**, imported as `RETRY_LABEL`. Four labels used to ship (`Try Again`, `Tap to Refresh`, `Check Status Now`, `Reload from Server`).
* Field-level chips render inside a narrow `labelRow` beside the field name, so the vocabulary is short **by layout necessity** and is identical on Login / Register / ForgotPassword / EditAccount / VerifyEmail: `Required`, `Check this address`, `Enter all 6 digits`, `Use 6+ characters`, `Passwords must match`. No exclamation marks.
* Banner and alert text comes from `toUserMessage()` only. System nouns are gone: `Runtime Protection`, `Incident Ref`, `HTTP 503`, `Cooldown Active`, `Connection to Server Dropped`, `Network request failed`.

* **Directives for Gemini**:
  - Maintain all 15 Errand Surface Invariants and 5 mandatory UI states (Ideal, Empty, Loading Shimmer, Error, Overflow).
  - **Run the device pass.** No AVD is configured and `adb devices` is empty on this machine, so `npx expo run:android` never ran. NetInfo is a native module - until that build happens, offline/slow behaviour is unproven on hardware. Manual passes still outstanding: wrong password, login 429 countdown, airplane-mode block + auto-dismiss, offline-with-active-errand escape, EDGE throttling for the amber strip, and all of it repeated in dark mode.
  - **Decision needed on `SessionExpiredSheet`.** Both its bugs are fixed but it is still not mounted. Mounting it means holding `user` non-null through an expiry, which is exactly the `[LOCKED] Session Persistence & Auth Navigation Isolation` split. Claude did not touch a locked contract without a ruling. Either mount it and amend that contract explicitly, or delete the component.
  - **Open copy question.** `Wrong password.` was requested verbatim and is implemented, but the server deliberately returns one 401 for both an unknown username and a bad password (anti-enumeration), so it shows for both. `That username or password doesn't match.` is a one-line swap in the `unauthorizedMessage` switch if the owner prefers accuracy.
  - Do not reintroduce hardcoded hexes in these surfaces. `src/__tests__/palette.test.ts` enforces WCAG AA on token pairs only; a literal hex bypasses the audit entirely.

* **Files Modified (40)**:
  - **New**: `src/services/ApiError.ts`, `src/services/errorMessages.ts`, `src/services/lastActiveErrand.ts`, `src/context/NetworkContext.tsx`, `src/components/OfflineGate.tsx`, `src/__tests__/apiClient.test.ts`, `src/__tests__/errorMessages.test.ts`, `src/__tests__/OfflineGate.test.tsx`
  - **Network core**: `src/services/apiClient.ts` (credential-endpoint matcher, recoverable-session guard, `ApiError` rejection, in-flight latency tracking), `src/navigation/AppNavigator.tsx` (`NetworkProvider` between `ThemeProvider` and `AuthProvider`; `NetworkStatusPill` as a floating absolute overlay; `OfflineGate` and `MobileErrorBoundary` mounted)
  - **Hooks**: `src/hooks/useActiveErrands.ts`, `src/hooks/useLiveRoute.ts`, `src/hooks/useRateConfig.ts`
  - **Components**: `NetworkStatusPill`, `RateLimitCountdown`, `MobileErrorBoundary`, `SessionExpiredSheet`, `AccessRestrictedModal`, `ErrandStateConflictModal`, `ErrandChannelList`, `MerchantCategoriesModal`, `NotificationBell`, `RatingModal`, `PaymentModeSelectionModal`
  - **Screens**: `LoginScreen`, `RegisterScreen`, `ForgotPasswordScreen`, `VerifyEmailScreen`, `AccountScreen`, `EditAccountScreen`, `portal/AccountTab`, `CustomerChatScreen`, `CustomerLocationScreen`, `ErrandItemsScreen`, `MaintenanceScreen`
  - **Utils / config**: `src/utils/safeImagePicker.ts`, `jest.setup.js` (NetInfo mock copied from RiderMobileApp), `package.json`
  - **Existing tests updated**: `LoginScreen.test.tsx` (previously asserted raw server-text passthrough, i.e. it encoded the bug), `RegisterScreen.test.tsx`, `ForgotPasswordScreen.test.tsx`

* **Verification**:
  - `npx tsc --noEmit`: PASS (0 errors)
  - `npm test`: PASS (32/32 suites, 236/236 tests - up from 29/199)
  - `npx expo export --platform android`: PASS (7.1MB Hermes bundle, clean resolution). Run as a substitute for the device pass, since it proves every import including the new native module's JS side resolves.
  - `npx expo run:android`: **NOT RUN** - no AVD configured, `adb devices` empty. See Directives above.

---

### 🛠️ Model B (Gemini / Antigravity) Execution & Verification
* **Active Mission (2026-09-28)**: My Errands Screen Unboxed Surface & Grey Line Layout (Card Removal)
  1. **Delivered Changes**:
     - `src/screens/portal/ErrandsTab.tsx`:
       - **Active Ongoing Errand ("Delivery In Progress" / "Request in Review")**: Removed the enclosed card box (`backgroundColor: colors.card`, `borderRadius`, `borderWidth`, `Shadows.soft`). Replaced with a clean, open, breathable layout bounded at the bottom by a crisp 1px grey divider line (`isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0'`).
       - **Delivered, Cancelled, and Past Errands**: Removed the card box wrapper (`styles.standardCard`: removed `backgroundColor`, `borderRadius`, outer `borderWidth`, and `Shadows.soft`). Replaced with an open row layout separated by a 1px grey divider line. Removed internal card footer dividing rule to prevent "divider hell".
     - `src/components/ErrandsSkeleton.tsx`:
       - Updated `ErrandsCardSkeleton` (`styles.cardSkeleton`) to match the unboxed open row geometry with a 1px bottom border, preventing Cumulative Layout Shift (CLS).
  2. **Verification**:
     - `npx tsc --noEmit` in `CustomerApp`: PASS (0 errors)
     - `npm test` in `CustomerApp`: PASS (42/42 test suites, 318/318 tests passed)

---

* **Prior Mission (2026-09-28)**: Customer App Errand Transaction Payment Pending State & End-to-End Payment Mode Synchronization
  1. **Root Cause Resolved**:
     - At errand creation (`POST /errands`), `input.paymentMethod` is omitted because payment mode is selected later in chat via `PaymentModeSelectionModal`.
     - Server (`errandService.createErrand`) previously defaulted `input.paymentMethod || "COD"`, hardcoding `"COD"` into `customer_transactions.paymentMethod` upon errand submission.
     - When payment mode was confirmed in chat (`POST /errands/:id/payment-selection`), `paymentSelectionService.confirmPaymentSelection` created a `PaymentSelection` record but never updated `customer_transactions.paymentMethod` or `errands.paymentModeId`.
     - `customerService.listTransactions` directly returned `tx.paymentMethod` without reading `paymentSelection` or handling pending states, causing newly created errands to immediately claim "Cash on Delivery" or "Cash".
     - `formatPaymentMethod` defaulted null, undefined, or empty values to `'Cash'` / `'Cash on Delivery'`, and lacked handling for `'PENDING'`.
  2. **Delivered Changes**:
     - `src/utils/format.ts`: Updated `formatPaymentMethod` to return `'Pending Selection'` (`'full'`) and `'Pending'` (`'short'`) for null, undefined, empty, or `'PENDING'` values.
     - `src/__tests__/format.test.ts`: Added unit tests verifying `null`, `undefined`, `''`, `'PENDING'`, and `'UNSET'` return `'Pending Selection'` / `'Pending'`.
     - `src/screens/portal/ErrandsTab.tsx`: Hero active card pill now explicitly checks `isPendingOrAvailable || !item.paymentMethod || item.paymentMethod === 'PENDING'` to display `'Payment: Pending'`. List cards format via `formatPaymentMethod(item.paymentMethod, 'short')` to display `'Pending'`.
     - `src/screens/ErrandDetailsScreen.tsx` & `src/components/ErrandDetailsModal.tsx`: Displays `'Pending Selection'` whenever payment mode is pending/unassigned instead of falsely displaying Cash on Delivery.
  3. **Verification**:
     - `npx tsc --noEmit` in `CustomerApp`: PASS (0 errors)
     - `npm test` in `CustomerApp`: PASS (42/42 test suites, 318/318 tests passed)

---

* **Prior Mission (2026-09-28)**: Customer App 15-Minute Session Resilience & Payment Method Normalization
  1. `src/services/apiClient.ts` (15-Minute Sudden Logout Fix):
     - **In-Flight Sibling Token Reuse**: Added check against `currentToken !== requestToken && !isTokenExpired(currentToken)`. When concurrent polling calls (15s errands, 25s notifications) receive 401s around the 15-minute token expiry, sibling requests now detect if a refresh has already occurred and replay immediately with the new access token. This eliminates rapid-fire cascade rotations that previously exhausted the server's 1-previous-hash history and triggered accidental `REFRESH_TOKEN_REUSE` session revocations.
     - **Resilient Fallback Persistence**: Hardened `setCustomerRefreshToken` to keep `AsyncStorage` fallback updated alongside `SecureStore`, preventing `NO_REFRESH_TOKEN` crashes when Android Keystore transiently returns null upon device wake. Also updated `performRefresh()` to store `newAccessToken` in both `SecureStore` and `AsyncStorage`.
     - **Auth-Only Revocation Gate**: Updated the refresh catch block so `onSessionExpired?.()` and token clearance only fire for explicit auth failures (`401`, `403`, or `NO_REFRESH_TOKEN`). Transient network drops, timeouts, 429 rate limits, and 5xx errors preserve credentials and keep the user logged in.
  2. `src/utils/format.ts` & `src/screens/portal/ErrandsTab.tsx` (Inconsistent Payment Method Fix):
     - Added `formatPaymentMethod` utility supporting `'full'` and `'short'` variants to accurately normalize diverse database values (`GCash / PayMaya`, `GCASH`, `Bank Transfer`, `Card`, `Online`, `COD`, `Cash on Delivery`).
     - Replaced naive `item.paymentMethod === 'ONLINE'` ternaries in `ErrandsTab.tsx` (hero active card and history rows), `ErrandDetailsScreen.tsx`, and `ErrandDetailsModal.tsx`.
  3. Tests & Server Hardening:
     - Added unit test suite `src/__tests__/format.test.ts` (14/14 passed).
     - Added unit tests in `src/__tests__/apiClient.test.ts` verifying refresh fallback persistence and sibling in-flight token reuse (10/10 passed).
     - Hardened server `ServiceError.ts` (`Object.setPrototypeOf`) and `errorHandler.ts` status extraction.
  - **Verification**:
     - `npx tsc --noEmit` in `CustomerApp`: PASS (0 errors)
     - `npx tsc --noEmit` in `server`: PASS (0 errors)
     - `npm test` in `CustomerApp`: PASS (42/42 test suites, 316/316 tests passed)

---

* **Prior Mission (2026-09-28)**: Customer App UI Consistency & Surface Purity
  1. `src/navigation/AppNavigator.tsx`:
     - Completely removed the `NetworkStatusPill` floating banner and its imports per user directive. The screen no longer renders yellow-brown "Slow connection" alerts or top status pill strips.
  2. `src/screens/portal/HomeTab.tsx` & `src/screens/CustomerPortalScreen.tsx`:
     - Removed `RefreshControl` prop completely from HomeTab `<ScrollView>`, eliminating the circular loading spinner entirely on screen load.
     - Skeleton loading (`HomeSkeleton`) renders cleanly on initial load.
     - Added background silent auto-refresh (every 15s when on HomeTab) and tab-switch revalidation in `CustomerPortalScreen.tsx` so the home tab stays up to date automatically without manual pulling.
  3. `src/screens/portal/ErrandsTab.tsx`:
     - Updated the search input to match `ChatTab` (Messages & Support): flat minimalist background (`isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9'`), 0px border, zero drop shadow, identical typography and hit slops.
     - Kept the adjacent Calendar date filter trigger button with matching flat container styling.
     - Removed card box enclosure (`styles.emptyCard` with borders, card background, and drop shadows) from all empty states (`No Active Errands`, `No Matching Errands`, `No Errands Found`). Replaced with open `styles.emptyContainer` featuring generous macro-whitespace, centered halo icon, crisp typography, and action buttons.
  4. `src/screens/portal/ChatTab.tsx` & `src/__tests__/ChatTab.test.tsx`:
     - Removed the subtitle label `"Chat live with dispatchers or tap (?) for customer assistance and FAQs."`.
     - Updated unit tests to assert the removed label is null (`queryByText(...) === null`).
  5. `src/screens/Notification.tsx`:
     - Removed `notificationCard` enclosure (outer border, card background, and drop shadows).
     - Added `ItemSeparatorComponent` rendering a 1px grey divider line (`#E2E8F0` / dark mode `rgba(255,255,255,0.08)`).
     - Unread notifications remain highlighted via bold typography and the red unread indicator dot on a transparent row.
  - **Verification**:
     - `npx tsc --noEmit`: PASS (0 errors)
     - `npm test`: PASS across test suites.

---

* **Prior Mission**: Delivered Errand Rating Modal & Read-Only Chat Enforced
  1. `src/screens/CustomerChatScreen.tsx`:
     - **Reliable Rating Modal Triggering**:
       - Concurrently fetched `/errands/${errandId}/rating` and `/errands/${errandId}` on mount using `Promise.all`.
       - If the errand status is `'DELIVERED'` and unrated, immediately opens `RatingModal` (`setShowRatingModal(true)`) and marks `hasHandledRatingPrompt(true)` so the customer is prompted even when opening an already-delivered errand.
       - Subscribed to the socket errand channel via `subscribeToErrand(errandId)` on mount and `unsubscribeFromErrand(errandId)` on unmount.
       - In `onOrderUpdated`, normalized status (`toUpperCase()`) and flexibly matched errand ID (`formatErrandId(updatedErrand.id) === formatErrandId(errandId)`).
       - Added safety check in `RatingModal.onDone` to ensure `hasHandledRatingPrompt` prevents re-triggering.
     - **Delivered Read-Only View**:
       - Updated `isChatClosed = ['CANCELLED', 'DELIVERED', 'COMPLETED'].includes(errandStatusUpper)`.
       - Added explicit read-only banner copy: `"This errand was delivered. Conversation is archived."`
       - Hid the composer input bar and send button when `isChatClosed` is true.
     - **Button Locking (All Chat Buttons Disabled Except View Map)**:
       - Header MapPin button (`onPress={() => setShowMapModal(true)}`): Kept interactive (`testID="header-view-map-button"`).
       - In-message store pinpoints action (`onPress={() => setShowMapModal(true)}`): Kept interactive (`testID="chat-view-map-button"`).
       - Header Info details button: Disabled when `isChatClosed` (`disabled={isChatClosed}`, `opacity: 0.4`).
       - In-message payment mode button: Disabled when `isChatClosed || isOrderLocked`.
       - In-message item revision action buttons ("Decline / Adjust" and "Proceed with Changes"): Disabled when `isChatClosed || isOrderLocked`.
       - In-message order confirmation buttons ("Modify / Adjust" and "Approve Order & Fees"): Disabled when `isChatClosed || isOrderLocked`.
       - Header back button remains fully active so the user can navigate back to portal tabs.
  2. `src/__tests__/CustomerChatAvailability.test.tsx`:
     - Updated suite to verify that `'ASSIGNED'` and `'IN_TRANSIT'` keep the conversation open, while `'DELIVERED'`, `'COMPLETED'`, and `'CANCELLED'` archive the conversation into read-only mode.
     - Added test verifying `RatingModal` opens when errand is `'DELIVERED'` and unrated.
     - Added test verifying all action buttons are disabled when `'DELIVERED'` while keeping the view map button active.
  3. `src/__tests__/CustomerChatScreen.test.tsx`:
     - Added `subscribeToErrand` and `unsubscribeFromErrand` to the `socketClient` mock to prevent null reference errors.
     - **[NEW - 2026-09-20]** Completed Test 6 (`opens Decline / Adjust modal and submits customer adjustment response`):
       - Added `act` import from `@testing-library/react-native`.
       - Wrapped `Send Response` press in `await act(async () => {...})` to flush the full `handleConfirmDeclineRevision` async chain (including `handleRespondToRevision` → `update` → `push` → `finally { setRespondingRevisionId(null); setIsSubmittingDecline(false); }`).
       - Added `waitFor` assertions for `mockUpdate` (`status: 'rejected'`) and `mockPush` (`role: 'customer'` decline text).
       - Added `waitFor` assertion for modal dismiss (`queryByText('Decline or Request Adjustment') === null`).
       - Removed diagnostic `afterAll` socket-handle logger.
  4. `jest.config.js`:
     - **[NEW - 2026-09-20]** Added `forceExit: true`. Root cause: React 19's `flushPassiveEffects` schedules a microtask via `void getSocket().then(socket => socket.on(...))` that remains in-flight after all tests complete. The `VirtualizedList._updateCellsToRender` `Timeout` and `KeyboardAvoidingView.componentDidMount setState` also fire outside of the test's act() scope. Together these keep Node's event loop alive past Jest's teardown window. `forceExit: true` terminates Jest cleanly once all assertions resolve.
* **Execution Date**: 2026-09-20
* **Status**: [Completed & Verified - 100% Green]
* **Verification**:
  - `npx tsc --noEmit`: PASS (0 errors — no changes to source files)
  - `npx jest CustomerChatScreen.test.tsx --runInBand`: PASS (6/6 tests, exit code 0, ~17s)

---

### Prior Mission Archive: Errand Details Screen & ErrandFormScreen Flat Minimalist UI Overhaul
* **Details**:
  1. `src/screens/ErrandFormScreen.tsx`:
     - Overhauled store category listings from chunky boxed cards with borders (`borderWidth: 1/2`) and drop shadows (`Shadows.soft`) into sleek, flat minimalist list rows with subtle hairline bottom dividers (`borderBottomWidth: 1`, `rgba(255,255,255,0.06)` / `#F1F5F9`).
     - Layout calibrated: Left circular icon (40x40dp), Center column (`categoryCardName` + `categoryCardDesc` with `flex: 1`), and Right circular toggle indicator (28x28dp with `Check` / `Plus`).
     - Selected state: Soft subtle tint (`rgba(246, 36, 89, 0.08)` / `#FFF5F7`) and primary checkmark with zero thick card borders or shadows.
     - Removed the "Dispatchers active in Tacurong" banner card (`styles.fleetBanner`) and unused dot/text styles.
     - Removed the "Transparent Pricing Guarantee" card (`styles.trustCard`) and unused `ShieldCheck` icon.
     - Flattened `styles.submitBtn`: Removed `Shadows.liftedUp` drop shadow for a pure flat solid primary button.
     - Preserved all test IDs (`category-card-${cat.name}`, `submit-errand-form-button`, `pabili-section`, `category-limit-error`).
  2. `src/screens/ErrandDetailsScreen.tsx` [NEW]:
     - Created dedicated screen replacing popup dialog modal with full React Navigation stack integration.
     - Stripped `#` symbol from Errand IDs across the screen (`Errand ${errandId}`, e.g., `Errand SGO-2E2246`).
     - Typeset calibrated with `PortalFontSizes`, `scaledPortalFontSize`, and clean scannable hierarchy.
     - Flat minimalist architecture: Removed all nested boxed cards (`styles.infoBox`, `styles.feeCard`, `styles.statusHero`), outer card borders (`borderWidth: 0`), and drop shadows.
     - Clean hairline dividers (`borderBottomWidth: 1`, `rgba(255,255,255,0.06)` / `#F1F5F9`) separating sections (Status & Date, Items Requested, Delivery Destination, Assigned Personnel, Payment & Fees, and Proof of Delivery).
     - Thumb-Zone pinned bottom action dock: Prominent `[ Open Live Chat ]` ($50\text{dp}$ height, `colors.primary`, white bold text) for active orders, or `[ Back to Errands ]` for completed orders.
  3. `src/navigation/types.ts` & `src/navigation/AppNavigator.tsx`:
     - Added `ErrandDetails: { user: UserData; errand?: any; errandId?: string };` to `RootStackParamList`.
     - Registered `<Stack.Screen name="ErrandDetails" component={ErrandDetailsScreen} options={{ headerShown: false }} />`.
  4. `src/screens/portal/ErrandsTab.tsx`:
     - Active order hero cards and past order cards navigate to `ErrandDetails` on press.
     - Stripped `#` from Errand IDs on both active and past cards.
     - Retired `<ErrandDetailsModal ... />` and `selectedErrand` modal state.
  5. `src/screens/portal/HomeTab.tsx`:
     - Recent Activity rows and active errand "See more..." links navigate to `ErrandDetails` on press.
     - Retired `<ErrandDetailsModal ... />` and `selectedErrand` modal state.
  6. `src/components/ErrandDetailsModal.tsx`:
     - Synchronized modal component to remove `#` and flatten inner card boxes and drop shadows for complete visual consistency across legacy references.
  7. `src/__tests__/ErrandDetailsScreen.test.tsx` [NEW]:
     - Comprehensive unit tests verifying `#` removal, clean typeset, navigation callbacks, and active/completed actions (4/4 tests passing).
* **Execution Date**: 2026-09-17
* **Status**: [Completed & Verified - 100% Green]

---

### Prior Mission Archive: Customer App Comprehensive Sub-Screens Calibration
* **Files Modified & Calibrated**:
  - `src/screens/ErrandFormScreen.tsx` & `src/screens/ErrandConfirmationScreen.tsx`:
    1. Upgraded inputs to 50–52dp minHeight with rectangular curved corners (`BorderRadius.md`).
    2. Scaled typography across form steps: 16sp section headers, 14.5sp body/input text, 13sp labels/hints, 12sp micro-badges.
    3. Applied `PortalTouchTargets.min` / `PortalTouchTargets.compactHitSlop` across all steppers, radio choices, back buttons, and submission CTAs.
  - `src/screens/ErrandItemsScreen.tsx`:
    1. Upgraded item input fields and quantity steppers to ergonomic heights (50dp minHeight, `BorderRadius.md`).
    2. Replaced micro-font sizes with `PortalFontSizes` (14.5sp item names, 13sp notes, 12sp chips and item badges).
    3. Elevated touch targets on item deletion, quantity increment/decrement, and bottom checkout dock.
  - `src/screens/SettingsScreen.tsx`:
    1. Calibrated header with 44x44dp back button with `compactHitSlop` and 16sp title.
    2. Sized settings rows with 52dp minHeight, 16sp row labels, 13sp status/version text, and 48dp toggle touch bounding areas.
  - `src/screens/EditAccountScreen.tsx`:
    1. Overhauled entire form with `BorderRadius.md` (curved rectangle) on all 52dp input fields, removing legacy pill-shaped inputs and decorative leading icons.
    2. Scaled typography to 16sp headings, 14.5sp inputs, 13sp field helper labels, and 16sp submit button text.
    3. Expanded primary save button to 54dp minHeight with WCAG 2.2 AA touch bounding clearance.
  - `src/screens/portal/EditProfileModal.tsx`:
    1. Sized modal header with 44x44dp close trigger and 16sp title.
    2. Sized inputs to 50dp minHeight with `BorderRadius.md` and 14.5sp text.
    3. Standardized Cancel and Save CTAs to 50dp minHeight with 16sp bold typography.
  - Saved Locations Flow:
    1. `src/screens/CustomerLocationScreen.tsx`: 44x44dp header back button with hitSlop and 16sp title.
    2. `src/screens/location/LocationList.tsx`: 20sp title, 13sp subtitle, 50dp "Add New Address" CTA with `BorderRadius.md`.
    3. `src/screens/location/SavedLocationCard.tsx`: 36x36dp action buttons with `compactHitSlop` (>= 48dp touch clearance), 16sp title, 13sp address, 12sp default badge.
    4. `src/screens/location/LocationWizard.tsx`: 44x44dp back button with hitSlop and 13sp step counter.
    5. `src/screens/location/WizardStepPin.tsx`: 50dp GPS recenter button, 50dp Next CTA, 13sp status/hint texts. Kept `MapView` outside scroll containers.
    6. `src/screens/location/WizardStepDetails.tsx`: 52dp input fields with `BorderRadius.md`, 36dp label chips, 50dp Save CTA, and `PortalFontSizes` throughout.
  - `src/screens/Notification.tsx`:
    1. Overhauled search bar: replaced pill with `BorderRadius.md` (curved rectangle), 48dp minHeight, 14.5sp font.
    2. Calibrated 44x44dp back button with hitSlop, 16sp title, 12sp unread pill badge, 36dp date filter tabs (13sp text), 15–16sp card titles, 13sp message body (18 line-height), 12sp timestamps, and 36dp mark-as-read action with hitSlop.
  - `src/screens/CustomerChatScreen.tsx`:
    1. Header: 44x44dp back button with `compactHitSlop`, 38x38dp action icon buttons with hitSlop, 16sp dispatcher name, 12sp online/offline status and order pill.
    2. Composer: replaced legacy pill wrapper with curved rectangle (`BorderRadius.md`), 48dp minHeight, 14.5sp input typography (21 line-height), 48x48dp send button.
    3. Messages & Cards: elevated sub-11sp micro-fonts across order confirmation cards, store groups, category headers, unavailable/dropped items, and system notices to `PortalFontSizes.caption` (13sp) and `PortalFontSizes.micro` (12sp).
    4. Actions & Modals: revision action buttons upgraded to `PortalTouchTargets.buttonHeight` (50dp) with `BorderRadius.md`; decline modal inputs to 80dp minHeight with `BorderRadius.md`; modal cancel/submit CTAs to 50dp minHeight; close trigger with `compactHitSlop`.
* **Verification**:
  - `npx tsc --noEmit`: PASS (0 errors)
  - `npm test -- CustomerChatScreen.test.tsx EditAccountScreen.test.tsx AccountScreen.test.tsx ErrandFormScreen.test.tsx ErrandConfirmationScreen.test.tsx SettingsScreen.test.tsx`: PASS (6/6 suites, 25/25 tests passed)

---

### Prior Mission Archive: Customer Portal Typeset Ramp
* **Files Created & Modified**:
  - `src/config/portalTypography.ts`: [NEW] Specialized portal-domain typography engine providing responsive 4-tier scaling (`scaledPortalFontSize`), dynamic proportional line-height calculation (`getPortalLineHeight` supporting semantic roles and numeric multipliers), WCAG 2.2 AA compliant touch target heights & hit slops (`PortalTouchTargets` - 48dp min touch target, 50dp buttons, 44dp compact, 36dp filter pills), and coordinated accessibility font scaling caps (`PortalFontSizeMultipliers` - 1.15 for pills/captions, 1.20 for titles/buttons/subheadings, 1.25 for body text).
  - `src/config/theme.ts`: Re-exported all `portalTypography` tokens and helpers alongside `authTypography` tokens for centralized developer access.
  - `src/components/BottomNav.tsx`:
    1. Upgraded tab item touch targets to 48x48dp bounding boxes with WCAG 2.2 AA hit slop padding.
    2. Scaled navigation micro-labels to 12sp readable floor (`PortalFontSizes.micro`), protected with `maxFontSizeMultiplier: 1.15`.
    3. Added dynamic proportional line-heights to eliminate text clipping on compact viewports.
  - `src/screens/CustomerPortalScreen.tsx`:
    1. Scaled header customer name to 16sp bold uppercase with proportional line-height.
    2. Enforced 48x48dp touch clearance on header notification bell and customer help action buttons (`PortalTouchTargets.minTouchTarget`).
    3. Scaled accepted errand dialog typography, confirmation buttons, and route badges.
  - `src/screens/portal/HomeTab.tsx`:
    1. Upgraded Delivering To row typography with 12sp uppercase kicker, 14.5sp delivery location, and 44dp touch target on the Change/Set action.
    2. Scaled Active Errand hero cards (both single-card and carousel variants) with 12sp live status pills, 16sp store headings, 17sp bold price hierarchy, and 50dp primary track CTAs.
    3. Calibrated Recent Activity rows with 14.5sp store titles, 13sp date/status chips, and 48dp row tap targets.
  - `src/components/DraggableBentoMosaic.tsx`:
    1. Scaled Bento category slot titles to 13.5sp/16sp with dynamic proportional line-heights.
    2. Raised item count subtext from legacy 8-9sp to 12sp minimum readable floor.
    3. Upgraded the "See More" category button to 50dp minimum container height.
  - `src/screens/portal/TrackTab.tsx`:
    1. Scaled multi-errand switcher tabs to 13.5sp with 44dp container height and compact hit slop.
    2. Sized mission control bottom sheet elements: 16sp title, 14.5sp rider and store identifiers, 12sp ETA and metadata chips, 17sp bold total bill.
    3. Preserved root-level MapView isolation outside of scroll containers adhering to the locked Android layout rule.
  - `src/screens/portal/ErrandsTab.tsx`:
    1. Upgraded pinned search bar to 48dp minHeight with 14.5sp input typography.
    2. Sized calendar date picker trigger to 44x44dp square icon button with compact hit slop.
    3. Scaled status filter capsules to 36dp container height with 13sp typography and hit slops.
    4. Sized hero active card and history cards with 16sp headings, 14.5sp route details, 12sp chips, and 17sp prices.
  - `src/screens/portal/ChatTab.tsx`:
    1. Scaled title to 20sp, subtitle to 13.5sp, search input to 14.5sp (48dp height), and filter capsules to 36dp height.
    2. Added compact hitSlop across help, clear search, and filter buttons.
    3. Scaled empty state and error banners with standardized `toUserMessage` sanitization.
  - `src/components/ErrandChannelRow.tsx`:
    1. Raised channel row container to 64dp minimum height for ergonomic touch scrolling.
    2. Scaled category preview to 14.5sp bold, order hex ID to 12sp mono, and dispatcher badge to 12sp.
    3. Guarded all typography against accessibility overflow via `PortalFontSizeMultipliers`.
  - `src/components/ErrandChannelList.tsx`:
    1. Scaled error and empty state titles to 16sp and descriptive guidance to 13.5sp.
    2. Upgraded empty state mini-flow recap with 12sp step text and 22x22dp number badges.
    3. Upgraded retry button and refresh action to 44dp with hit slop, and Request Errand CTA to 50dp minHeight.
  - `src/screens/portal/AccountTab.tsx`:
    1. Scaled profile identity card: 18sp customer name, 13.5sp phone/handle, 12sp verified badge, 44dp edit CTA.
    2. Scaled default delivery pin card: 16sp title, 13.5sp address, 50dp empty setup CTA.
    3. Scaled settings menu rows: 52dp row height, 38x38dp icon badges, 16sp titles, 13.5sp values/subtitles.
    4. Scaled sign-out action button to 50dp minimum touch height.
  - `src/screens/AccountScreen.tsx`:
    1. Upgraded standalone top navigation bar: 44x44dp back and settings gear buttons with hitSlops, 16sp nav title.
    2. Synchronized profile identity, pin card, settings menu, and sign-out button typography and touch targets with `AccountTab.tsx`.
* **Verification**:
  - `npx tsc --noEmit`: PASS (0 errors)
  - `npm test -- AccountScreen.test.tsx ChatTab.test.tsx DraggableBentoMosaic.test.tsx HomeTab.test.tsx Navigation.test.tsx`: PASS (6/6 suites, 28/28 tests passed)
  - `npm test -- palette.test.ts responsive.test.ts merchantCategories.test.ts`: PASS (3/3 suites, 41/41 tests passed, WCAG AA token contrast verified)
  - Zero regression on existing test IDs, locked contracts, and error message sanitization.

---

### Prior Mission Archive: Customer App Auth Typography Scaling & Corner Radii
* **Execution Date**: 2026-09-16
* **Files Created & Modified**:
  - `src/config/authTypography.ts`: Specialized auth-domain typography ramp.
  - `src/screens/LoginScreen.tsx`: Scaled fonts, 52dp inputs / 54dp CTAs, rectangular rounded corners (`BorderRadius.md` / 10px), removed leading icons.
  - `src/screens/ForgotPasswordScreen.tsx`: Scaled multi-step fonts, rectangular rounded corners (`BorderRadius.md`), removed leading icons.
  - `src/screens/RegisterScreen.tsx`: Scaled 5-step fonts, 52dp inputs / 54dp CTAs, rectangular rounded corners (`BorderRadius.md`), removed leading icons.
* **Verification**:
  - `npx tsc --noEmit`: PASS (0 errors)
  - `npx jest LoginScreen.test.tsx ForgotPasswordScreen.test.tsx RegisterScreen.test.tsx`: PASS (3/3 suites, 34/34 tests passed)

---

### Prior Mission Archive
* **Files Modified**:
  - `src/screens/portal/ErrandsTab.tsx`:
    1. Removed header sub-label (`screenSubtitle`) for a clean typography-first title.
    2. Removed the background on the "Ongoing" pill, rendering an unboxed pulsing live dot and text.
    3. Defaulted status filter to `'ACTIVE'` and positioned `'Active'` first in the tab selector.
    4. Removed the `"Showing [Number] Errands"` counter text.
    5. Moved Date Filtration to the right side of the Search bar as a clean, square icon-only button (`42x42px` with `<Calendar />`), removing text and chevrons.
    6. Integrated the Sort Icon directly into the horizontal line of "Happening Now" on the right-side of the screen (replacing the number count) and removed the redundant utility bar row.
    7. Removed all AI-slop decorative pink dots across the screen (in the header Ongoing indicator, Date filter button, Active filter capsule, Happening Now section line, and Hero card live tag row) for a mature, production-grade clean aesthetic.
    8. Refined the empty state when 0 active orders exist with an actionable `"View All Errands"` fallback.
    9. Removed all AI-slop pill backgrounds across the screen (in header milestone tag, status filter chips, count badges, Hero card status indicator, Hero footer payment/rider metadata, past order status tags, and date modal badges) transitioning to typography-first unboxed layouts and restrained `BorderRadius.lg` radii.
    10. Removed colored border auras (`#FFE4EC` / `rgba(246,36,89,0.35)`), thick 1.5px borders, and exaggerated `Shadows.liftedUp` shadows from active Hero cards, standardizing to 1px neutral hairline borders (`colors.border` / `#EDEFF2`) and `Shadows.soft`. Also neutralized `reorderBtn` and `emptyIconHalo` backgrounds.
    11. Removed the border aura line card, background box, and drop shadow from the Calendar Icon button in the search bar row, making it a completely clean, frameless icon trigger.
    12. Remodeled Date Range and Sort Option modals using `TrueNativeModal` with tactile scale and rise-and-settle elevation physics.
  - `src/components/transitions/TrueNativeModal.tsx`: [NEW] Hardware-accelerated center dialog component replacing stock RN modal fades with physical scale/elevation rise-and-settle (0.94x -> 1.0x, +14dp -> 0dp) and graceful exit easing.
  - `src/components/transitions/TrueBottomSheet.tsx`: [NEW] Gesture-driven bottom sheet component replacing stock RN modal slides with authentic PanResponder thumb drag physics, proportional backdrop dimming, and velocity-aware flick-to-dismiss.
  - `src/components/ConfirmModal.tsx`: Replaced raw `<Modal animationType="fade">` with `<TrueNativeModal>`, eliminating abrupt window popups and giving confirmation dialogs physical presence.
  - `src/components/RatingModal.tsx`: Replaced raw `<Modal animationType="fade">` with `<TrueBottomSheet>`, creating a fluid swipe-to-dismiss feedback sheet.
  - `src/components/CalendarPickerModal.tsx`: Replaced raw `<Modal animationType="fade">` with `<TrueNativeModal>`.
  - `src/components/MerchantCategoriesModal.tsx`: Replaced raw `<Modal animationType="slide">` and fake drag handle with `<TrueBottomSheet>`, enabling interactive thumb drag pull-down dismissal.
  - `src/components/CustomerHelpModal.tsx`: Replaced raw `<Modal animationType="slide">` with `<TrueBottomSheet>`.
  - `src/screens/portal/EditProfileModal.tsx`: Replaced raw `<Modal animationType="slide">` with `<TrueBottomSheet>`.
  - `src/navigation/AppNavigator.tsx`: Calibrated screen navigation hierarchy:
    1. Hierarchical Push: `animation: 'slide_from_right'`, `animationDuration: 280`, `gestureEnabled: true`, `fullScreenGestureEnabled: Platform.OS === 'ios'`.
    2. Modal Task Sub-Screens: `CustomerLocationScreen`, `NotificationScreen`, `ServiceListScreen` configured with `presentation: 'modal'`, `animation: 'slide_from_bottom'`.
    3. Terminal Screen Locks: `ErrandConfirmationScreen` & `WaitingForDispatcherScreen` configured with `gestureEnabled: false`.
    4. Auth Stack: `Login` and `CustomerPortal` cross-fade smoothly with `animation: 'fade'`, `animationDuration: 200`.
  - `src/components/BottomNav.tsx`: Reordered the bottom navigation buttons to: 1. Home, 2. Track, 3. Pabili (Center), 4. Chat, 5. My Errand.
  - `src/screens/CustomerPortalScreen.tsx`: Enlarged profile avatar icon with a big circumference (`44x44`, `borderRadius: 22`), formatted the customer name in all caps (`textTransform: 'uppercase'`) with bold weight (`FontFamily.bold`), removed the underline, and removed the `>` chevron button.
  - `src/screens/portal/HomeTab.tsx`:
    1. Removed redundant "Hi, [Customer Name] 👋" greeting.
    2. Removed the border aura line card, drop shadow (`Shadows.soft`), and card background from the "Delivering To" container, transforming it into an unboxed, clean header row.
    3. Removed the pink background (`#FFF0F5` / `rgba(246, 36, 89, 0.16)`) from the location pin icon, rendering a clean vector icon directly in the flow.
    4. Removed card background, borders, and full pill container from the "Change" / "Set" action button, rendering it as a clean unboxed text button (`colors.primary`).
    5. Removed `colors.primary` border aura, 1.5px border width, and `Shadows.liftedUp` on single and carousel active cards, unifying to 1px neutral hairline borders (`colors.border` / `#EDEFF2`) and `Shadows.soft`.
    6. Eradicated decorative pulse dots (`pulseDot`) from active errand headers (both single card and carousel cards).
    7. Neutralized carousel pagination dots from saturated pink to minimalist neutral dark/slate active indicator.
    8. Standardized `trackBtn` to `BorderRadius.lg` (10px), `featureBadge` to `BorderRadius.sm` (4px), and `recentRowItem` to `BorderRadius.lg` (10px).
  - `src/components/StatusBadge.tsx`: Replaced `BorderRadius.full` with `BorderRadius.sm` (4px), transforming all status tags across Customer Portal into clean, non-pill, square-cornered badges.
  - `src/components/HomeSkeleton.tsx`: Removed pulse dot shimmer (`9x9px`); updated status badge shimmer to `BorderRadius.sm` (4px); updated action button shimmer to `BorderRadius.lg` (10px); updated recent activity badge shimmer to `BorderRadius.sm` (4px).
  - `src/screens/portal/TrackTab.tsx`: Removed multi-errand switcher pink dots (`switcherDot`) and replaced full pill backgrounds with restrained `BorderRadius.lg` (10px) on `switcherTab`.
  - `src/screens/portal/ChatTab.tsx`: Removed pulsating pink dot (`tabDot`) and `isPulsing` flag; replaced full pill backgrounds with `BorderRadius.lg` (10px) on `filterTab` and `BorderRadius.sm` (4px) on `tabBadge`.
  - `src/screens/portal/AccountTab.tsx`: Replaced full pill backgrounds on `verifiedChip`, `mapLocationTag`, and `mapTapChip` with `BorderRadius.sm` (4px); unified unbalanced border radii on `bentoCard` (`14` -> `BorderRadius.lg`), `emptyAddressCTA` (`8` -> `BorderRadius.md`), `logoutBtn` (`10` -> `BorderRadius.lg`), `photoModalCard` (`16` -> `BorderRadius.xl`), and `photoOptionBtn` (`10` -> `BorderRadius.lg`).
  - `src/screens/location/SavedLocationCard.tsx`: Removed primary border aura and 1.5px border width on default location cards, standardizing to 1px neutral `colors.border`.
  - `src/components/CustomerHelpModal.tsx`: Removed pink background and `colors.primary` border aura from assistance section card, standardizing to neutral background and `colors.border`.
  - `src/screens/AccountScreen.tsx` & `src/screens/portal/AccountTab.tsx`:
    1. Unboxed the bottom section of Account & Profile by removing the 4 bento grid cards (`bentoGridRow`, `bentoGridTile`, `bentoTileHeader`, etc.) and the Customer Guide card (`helpBentoCard`).
    2. Converted into an unboxed, unified vertical settings list (`menuSection`, `menuRow`) with clean hairline dividers (`borderBottomWidth: 1`, subtle neutral color), eliminating all card boxes, white card containers, card borders, and floating drop shadows (`Shadows.soft`).
    3. Retained all 5 menu items (Orders Completed, Saved Places, App Theme, Security & Auth, Customer Guide & FAQs) with neutral circular icon badges, clear typography hierarchy, right-aligned values/status badges, and chevrons, maintaining 100% of existing navigation, callbacks, and accessibility functionality.
    4. Removed the red border line (`borderColor`, `borderWidth: 1`) and background from the "Sign Out of Account" button, rendering it as a pure, clean ghost text action button with zero card border artifacts.
* **Verification**:
  - `npx tsc --noEmit`: PASS (0 errors)
  - `npm test src/__tests__/AccountScreen.test.tsx src/__tests__/Navigation.test.tsx`: PASS (2/2 suites, 5/5 tests passed)
  - Full `npm test`: PASS (29/29 suites, 199/199 tests passed)

---

### 🛠️ Model B (Gemini / Antigravity) Execution & Verification - 2026-09-22
* **Active Mission**: Real-Time Notification Bell Sync & Sound/Chime Push Notifications (Dispatcher Chat & Rider 500m Proximity Alert)
* **Status**: [Executed & Verified - All 3 Codebases Compiling Cleanly with 0 Errors, Jest 7/7 Tests Green]

#### Problem Addressed
1. **Notification Bell Sync Bug**: Reading all notifications in `Notification.tsx` updated local screen state, but the notification bell badge on `CustomerPortalScreen` / `HomeTab` did not disappear until navigating to another screen and remounting.
2. **Missing Chimes & Push Notifications**: In-app notifications lacked sound chimes and vibrations.
3. **Dispatcher Chat & Rider Proximity Alerts**: Dispatcher chat messages and rider approaching delivery location (within 500m) lacked automated push, chime, vibration, and deep-link routing.

#### Architectural Deliverables
1. **Single Source of Truth (`NotificationContext.tsx`)**:
   - Centralized `notifications`, `unreadCount`, `loading`, `markAsRead`, `markAllAsRead`, and `refreshNotifications`.
   - `markAllAsRead()`: Immediately zeroes in-memory `unreadCount` to 0 synchronously (instant UI badge removal in `NotificationBell` with 0 lag) and triggers atomic backend `PATCH /api/notifications/read-all`.
   - Listens to real-time socket events `notification:new` and `errand:rider_nearby`.
   - Schedules local notifications with sound (`sound: 'default'`) and vibration channels (`chats`, `delivery-alerts`, `default`) via `Notifications.scheduleNotificationAsync`.
2. **Active Chat Suppression Engine (`activeChatTracker.ts`)**:
   - Singleton tracking current active chat errand ID via `setActiveChatErrandId`.
   - `CustomerChatScreen` registers `setActiveChatErrandId(errandId)` on mount and clears on unmount.
   - Suppresses incoming chat heads-up banners and chime interruptions while the customer is actively chatting in that exact room.
3. **Android Heads-Up & Sound Channels (`useRegisterPushToken.ts`)**:
   - Created Android notification channels:
     - `'chats'`: Importance `HIGH`, vibration `[0, 250, 150, 250]`, sound `'default'`.
     - `'delivery-alerts'`: Importance `HIGH`, vibration `[0, 500, 200, 500]`, sound `'default'`.
     - `'default'`: Importance `HIGH`, vibration `[0, 250, 250, 250]`, sound `'default'`.
   - Updated `Notifications.setNotificationHandler` to respect `@sugo_customer_sounds_enabled` preference and active chat suppression.
   - Added cold-start notification response handler via `Notifications.getLastNotificationResponseAsync()`.
4. **Backend Proximity & Chat Alerts (`Capstone_Server/server`)**:
   - Added `proximityAlertSentAt` to `Errand` in Prisma schema & MariaDB.
   - Added `markProximityAlertSent` atomic update in `errandRepository.ts`.
   - In `trackingService.ts` (`ingestBatch`), checks if rider is $\le 0.5\text{ km}$ from customer during `IN_TRANSIT`. Atomically marks DB, sends Expo Push, and emits `errand:rider_nearby` and `notification:new` socket events.
   - Added `notifyCustomerChatMessage` in `errandService.ts` with 3-second cooldown and 120-character preview truncation, mounted at `POST /api/errands/:id/chat-notify`.
   - Added atomic `markAllReadForCustomer` / `markAllReadForUser` mounted at `PATCH /api/notifications/read-all`.
5. **Dispatcher Web Portal Integration (`Capstone_Project_Web`)**:
   - Connected `useOrderChat.ts` to call `POST /errands/${orderId}/chat-notify` when dispatcher sends messages.
6. **Smart Notification Routing (`Notification.tsx`, `TrackTab.tsx`, `CustomerPortalScreen.tsx`)**:
   - Tapping chat notification routes directly to `CustomerChat` for that errand.
   - Tapping rider proximity alert routes to `CustomerPortal` on `'track'` tab focused on that errand (`focusedErrandId`), centering map and route.

#### Files Modified
- **Customer Mobile App (`CustomerApp`)**:
  - `src/navigation/types.ts`: Added `focusedErrandId?: string` to `CustomerPortal` params.
  - `src/utils/activeChatTracker.ts`: [NEW] Singleton helper for active chat suppression.
  - `src/context/NotificationContext.tsx`: [NEW] Real-time notification provider with optimistic sync & sound scheduling.
  - `src/components/NotificationBell.tsx`: Refactored to consume `useNotifications()`, added `testID="notification-bell-badge"`.
  - `src/screens/Notification.tsx`: Wired `useNotifications()`, added `RIDER_NEARBY` visual, added `handleNotificationPress` deep linking.
  - `src/screens/CustomerChatScreen.tsx`: Added `setActiveChatErrandId` mount/unmount lifecycle.
  - `src/screens/CustomerPortalScreen.tsx`: Added `focusedErrandId` tab switching & `handlePushTapped` routing.
  - `src/screens/portal/TrackTab.tsx`: Added `focusedErrandId` prop and effect for instant camera & tab focus.
  - `src/hooks/useRegisterPushToken.ts`: Android channels, active chat suppression, sound settings check, and cold-start tap listener.
  - `src/navigation/AppNavigator.tsx`: Mounted `<NotificationProvider>`.
  - `jest.setup.js`: Added `expo-notifications` mock.
  - `src/__tests__/NotificationContext.test.tsx`: [NEW] 5 unit tests for context, optimistic sync, socket events.
  - `src/__tests__/NotificationSync.test.tsx`: [NEW] 2 unit tests verifying instant badge disappearance on "Read All".
- **Backend Server (`Capstone_Server/server`)**:
  - `prisma/schema.prisma`: Added `proximityAlertSentAt` to `Errand`.
  - `src/repositories/errandRepository.ts`: Added `markProximityAlertSent`.
  - `src/repositories/notificationRepository.ts`: Added `markAllReadForCustomer` and `markAllReadForUser`.
  - `src/services/notificationService.ts`: Added `markAllAsRead` and `notifyRiderNearby`.
  - `src/controllers/notificationController.ts`: Added `markAllNotificationsRead`.
  - `src/routes/notificationRoutes.ts`: Mounted `PATCH /read-all`.
  - `src/services/errandService.ts`: Added `notifyCustomerChatMessage` with cooldown & truncation.
  - `src/controllers/errandController.ts`: Added `notifyChatMessage`.
  - `src/routes/errandRoutes.ts`: Mounted `POST /:id/chat-notify`.
  - `src/lib/eventPublisher.ts`: Added `emitToCustomer` and `emitToUser`.
  - `src/services/trackingService.ts`: IngestBatch 500m proximity detection with deduplication.
- **Dispatcher Web (`Capstone_Project_Web`)**:
  - `src/portals/dispatcher/components/order-chat/hooks/useOrderChat.ts`: Triggered `POST /errands/${orderId}/chat-notify` on message send.

#### Verification
- `CustomerApp`: `npx tsc --noEmit` -> PASS (0 errors)
- `CustomerApp`: `npm test src/__tests__/NotificationContext.test.tsx src/__tests__/NotificationSync.test.tsx` -> PASS (2/2 suites, 7/7 tests passed)
- `server`: `npx tsc --noEmit` -> PASS (0 errors)
- `Capstone_Project_Web`: `npx tsc --noEmit` -> PASS (0 errors)

---

### Session Log: 2026-09-22 - Branding Modernization to "Sugo Express" & Web Cyclist Icon
* **Driver**: Antigravity 2.0 (Gemini 3.8 Flash High)
* **Status**: Complete & Verified (Zero Regressions)
* **Scope**: Customer App Name & Icon Branding Update
* **Modifications**:
  - `app.json`:
    - Updated `expo.name` to `"Sugo Express"`.
    - Added `ios.infoPlist.CFBundleDisplayName: "Sugo Express"`.
    - Updated `ios.infoPlist.NSLocationWhenInUseUsageDescription` to `"Sugo Express needs your location to auto-fill your delivery address."`.
    - Preserved `package: "com.astrowarden.CustomerApp"` and `bundleIdentifier: "com.astrowarden.CustomerApp"` 100% untouched.
  - `android/app/src/main/res/values/strings.xml`:
    - Updated `<string name="app_name">` from `"CustomerApp"` to `"Sugo Express"`.
  - `assets/images/`:
    - `icon.png`: Replaced with 1024x1024 solid Sugo Pink (`#F62459`) square with white cyclist silhouette.
    - `android-icon-foreground.png`: Replaced with 1024x1024 transparent foreground with white cyclist silhouette in safe zone.
    - `android-icon-monochrome.png`: Replaced with 1024x1024 white cyclist silhouette on transparent background.
    - `android-icon-background.png`: Replaced with 1024x1024 solid `#F62459`.
    - `splash-icon.png`: Replaced with transparent background with Sugo Pink (`#F62459`) cyclist silhouette.
  - `android/app/src/main/res/mipmap-*`:
    - Synchronized all density tiers (`mdpi`, `hdpi`, `xhdpi`, `xxhdpi`, `xxxhdpi`) using `@expo/prebuild-config` native icon pipeline.
* **Verification**:
  - `npx tsc --noEmit`: PASS (0 errors)
  - Full `npm test`: PASS (35/35 suites, 252/252 tests passed)

---

### Session Log: 2026-09-22 - Release Push Notifications, Chat Chime & Vibration, Native Splash Drawables, and Cold-Boot Session Restore Fixes
* **Driver**: Antigravity 2.0 (Gemini 3.8 Flash High)
* **Status**: Complete & Verified (Zero Regressions)
* **Scope**: Customer App Release Push Notifications, Dispatcher Chat Chime/Vibration, Splash Screen Branding, Cold-Boot LoginScreen Flash Elimination, Settings Screen Preferences.
* **Root Causes & Solutions**:
  1. **Native Splash Logo**: Prebuilt native Android directories (`android/app/src/main/res/drawable-*/splashscreen_logo.png`) had stale default Expo blue chevron drawables. Replaced all 5 density tiers (`mdpi`, `hdpi`, `xhdpi`, `xxhdpi`, `xxxhdpi`) with the crisp Sugo Pink (`#F62459`) cyclist logo.
  2. **1.5s Login Screen Flash on Cold Boot**: `restoreSession()` in `AuthContext.tsx` deferred `setUser(parsedUser)` until `await settleRealtimeSession()` (up to 4000ms timeout) and `getCustomerRefreshToken()` completed. Meanwhile, `AnimatedSplashScreen` timed out at 3500ms (`HARD_TIMEOUT_MS`). Because `user` was still `null`, `AppNavigator` displayed `LoginScreen` for ~1.5s before `setUser` finally fired. Fixed by parsing `storedUser` and calling `setUser(parsedUser)` immediately on the first tick from `AsyncStorage`.
  3. **Release APK Push Banners**: Added `POST_NOTIFICATIONS` permission to `AndroidManifest.xml` and `app.json`. Upgraded Android notification channels (`default`, `chats`, `delivery-alerts`) from `HIGH` to `AndroidImportance.MAX` (level 5), strictly required for floating heads-up pop-up banners on Android.
  4. **Dispatcher Chat Chime & Vibration**: In `CustomerChatScreen.tsx`, added double-pulse haptic vibration (`Vibration.vibrate([0, 150, 100, 150])`) and audible local notification chime for incoming messages from dispatcher/rider.
  5. **Settings Toggles Wiring**: Wired `SettingsScreen.tsx` switches (`Live Delivery Updates` -> `@sugo_customer_errand_alerts_enabled`, `Dispatcher & Rider Messages` -> `@sugo_customer_chat_alerts_enabled`, `Audible In-App Chimes` -> `@sugo_customer_sounds_enabled`) to `AsyncStorage`. Updated `useRegisterPushToken.ts` and `NotificationContext.tsx` to honor these toggles.
* **Modifications**:
  - `android/app/src/main/AndroidManifest.xml`: Added `android.permission.POST_NOTIFICATIONS`.
  - `app.json`: Added `POST_NOTIFICATIONS` permission and `expo-notifications` plugin.
  - `android/app/src/main/res/drawable-*/splashscreen_logo.png`: Replaced all 5 density tiers with Sugo Pink cyclist logo.
  - `src/hooks/useRegisterPushToken.ts`: Upgraded channel importance to `AndroidImportance.MAX`; wired `setNotificationHandler` to respect `@sugo_customer_sounds_enabled`, `@sugo_customer_chat_alerts_enabled`, and `@sugo_customer_errand_alerts_enabled`.
  - `src/context/AuthContext.tsx`: Prioritized `storedUser` parse and immediate `setUser(parsedUser)` to eliminate `LoginScreen` flash.
  - `src/screens/SettingsScreen.tsx`: Persisted `errandAlerts` and `chatAlerts` toggles to `AsyncStorage`.
  - `src/context/NotificationContext.tsx`: Gated chat and proximity delivery alerts against user preferences in `AsyncStorage`.
  - `src/screens/CustomerChatScreen.tsx`: Added double-pulse tactile vibration and audio chime when new messages arrive.
* **Verification**:
  - `npx tsc --noEmit`: PASS (0 errors)
  - `npm test`: PASS (35/35 test suites, 252/252 tests passed)

---

### Session Log: 2026-09-23 - Google Maps Active API Key, Customer Data Guarding & Zero Splash-to-Login Flash
### Session Log: 2026-09-23 - Push Notifications & Messenger-Style In-App Banner Notifications
* **Driver**: Antigravity 2.0 (Gemini 3.8 Flash High)
* **Status**: Complete & Verified (Zero Regressions)
* **Scope**: Fix Release APK Remote Push Notifications, Enable In-App Messenger-Style Floating Heads-Up Banners, and Dispatcher Chat Audible Chime.
* **Root Causes & Solutions**:
  1. **Missing Google Services Gradle Plugin**: `android/build.gradle` and `android/app/build.gradle` omitted `classpath 'com.google.gms:google-services:4.4.2'` and `apply plugin: 'com.google.gms.google-services'`. FCM background receivers were never registered into release APKs. Added the Google Services plugin to both build.gradle files.
  2. **Undefined ProjectId in Standalone APKs**: In `useRegisterPushToken.ts`, `Constants.expoConfig?.extra?.eas?.projectId` evaluated to undefined in bare Gradle builds, causing the app to skip notification permission requests and push token registration. Added fallback `projectId = 'b3e551d1-d422-4e09-8f27-d1d76237a1c4'` and requested permissions unconditionally.
  3. **Android Heads-Up Compatibility**: Added `shouldShowAlert: true` alongside `shouldShowBanner: true` in `Notifications.setNotificationHandler` so floating heads-up pop-ups drop down from the top on all Android versions.
  4. **Foreground In-App Messenger Experience**: In `NotificationContext.tsx`, added real-time Firebase RTDB chat listener (`chats/${errandId}/messages`) with `limitToLast(1)` for all active customer errands. When a dispatcher message arrives:
     - If viewing that specific chat screen (`getActiveChatErrandId() === errandId`), the floating banner is suppressed to avoid obstructing the chat, while playing the soft in-chat chime.
     - If browsing anywhere else in the app (Home, Errands, Track, Settings), an immediate heads-up banner drops down with audible chime, vibration, and tap-to-navigate action.
     - Synchronized active errand IDs between `CustomerPortalScreen.tsx` and `NotificationContext.tsx`.
     - Added 3-second deduplication cache between Socket.io and Firebase RTDB events.
  5. **Backend Socket.io Relay**: In `server/src/services/errandService.ts` (`notifyCustomerChatMessage`), added `eventPublisher.emitToCustomer(customer.id, 'notification:new', ...)` so in-app customers receive instant chat notification events even before FCM delivers.
  6. **Dispatcher Web Hook Expansion**: In `useOrderChat.ts`, expanded `/api/errands/:id/chat-notify` triggering to cover all message types (store pinpoints, revisions, payment links, and text).
* **Modifications**:
  - `CustomerApp/android/build.gradle`: Added `classpath 'com.google.gms:google-services:4.4.2'`.
  - `CustomerApp/android/app/build.gradle`: Applied plugin `'com.google.gms.google-services'`.
  - `CustomerApp/src/hooks/useRegisterPushToken.ts`: Fallback `projectId`, `shouldShowAlert: true`, unconditional permission request.
  - `CustomerApp/src/context/NotificationContext.tsx`: Added Firebase RTDB active chat listener, deduplication, and `syncActiveErrands`.
  - `CustomerApp/src/screens/CustomerPortalScreen.tsx`: Wired `syncActiveErrands` to `dbErrands`.
  - `server/src/services/errandService.ts`: Added Socket.io emit to `notifyCustomerChatMessage`.
  - `Capstone_Project_Web/src/.../useOrderChat.ts`: Expanded chat-notify for all message payloads.
* **Verification**:
  - `CustomerApp` `npx tsc --noEmit`: PASS (0 errors)
  - `server` `npx tsc --noEmit`: PASS (0 errors)
  - `Capstone_Project_Web` `npx tsc --noEmit`: PASS (0 errors)
  - `npm test src/__tests__/useRegisterPushToken.test.ts`: PASS (9/9 tests passed)
  - `npm test src/__tests__/MessengerChatNotifications.test.tsx`: PASS (4/4 tests passed)
  - `npm test src/__tests__/NotificationContext.test.tsx`: PASS (5/5 tests passed)
  - `npm test src/__tests__/NotificationSync.test.tsx`: PASS (2/2 tests passed)
  - `npm test src/__tests__/SettingsScreen.test.tsx`: PASS (7/7 tests passed)
  - `npm test src/__tests__/AnimatedSplashScreen.test.tsx`: PASS (3/3 tests passed)
  - Complete CustomerApp suite (`npm test`): **PASS (39/39 suites, 279/279 tests passing - 100% green)**
  - Hermes Android Bundle (`npx expo export --platform android`): PASS (7.2MB HBC bundle, 3573 modules cleanly compiled)
