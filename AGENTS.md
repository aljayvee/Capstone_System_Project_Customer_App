# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# 🌐 Dual-Agent Handshake & Collaboration Invariant (Claude App ◄► Antigravity 2.0)
> **ALWAYS ACTIVE IN ALL SESSIONS**: Both Claude App and Antigravity 2.0 operate as a unified engineering team.
1. **Boot-Time Handshake Check (Step 0)**: In every single session, ALWAYS inspect `AGENT_HANDSHAKE.md` in this directory before modifying mobile code.
2. **Locked Contract Invariant**: NEVER rename, refactor, or delete functions, types, or components marked `[LOCKED]` in `AGENT_HANDSHAKE.md`.
3. **Surgical Delta Edits**: Apply changes strictly as minimal deltas using surgical replace tools.
4. **Session Handoff Logging**: After completing any modification, update `AGENT_HANDSHAKE.md` with modified file paths, compiler verification (`npx tsc --noEmit`), and directives for the next session.
5. **Gemini Non-Autonomous Execution & Claude Cognitive Alignment**: Gemini models (Gemini 3.x Pro, Gemini 3.8 Flash High) MUST NOT act autonomously or execute sweeping unilateral changes. Gemini must strictly adopt the 6-stage Claude Cognitive Thinking Process (Context Grounding -> Hypothesis & Trade-offs -> User Consultation Gate -> Surgical Delta -> Defensive Rigor -> Empirical Verification).

# Expo & Android Build Rules

## Package Installation
- Always use `npx expo install <package-name>` instead of `npm install` when adding Expo packages to ensure compatibility with the project's Expo SDK version.

## Android Gradle Build Environment
- When running `.\gradlew` commands on Windows:
  - Set JAVA_HOME to Android Studio JBR: `$env:JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"`
  - Set ANDROID_HOME: `$env:ANDROID_HOME="C:\Users\Capstone\AppData\Local\Android\Sdk"`
  - Ensure `android/local.properties` exists with: `sdk.dir=C\:\\Users\\Capstone\\AppData\\Local\\Android\\Sdk`

## Secret Management & Environment Variables
- Never hardcode sensitive API keys (e.g., Google Maps API key, Firebase secrets) inside tracked configuration files like `app.json` or native `AndroidManifest.xml`.
- Use dynamic Expo configuration (`app.config.js` or `app.config.ts`) to read API keys and configuration values from environment variables (`process.env.EXPO_PUBLIC_*`).
- Store local environment variables in `.env` (which must be kept in `.gitignore`), and provide `.env.example` as a template for developers.

## React Native Maps Layout Rules
- NEVER embed `MapView` from `react-native-maps` directly inside a `ScrollView`, `FlatList`, or any scroll container — this causes an immediate native crash on Android.
- **Correct pattern**: Use a static placeholder (coordinates text + icon) inside the ScrollView. Open the full interactive `MapView` inside a full-screen `Modal` only.
- `MapView` may only render directly in a `View` with a fixed pixel `height` at the root render level, completely outside any scroll container.
- Applies to all `MapView` usage in `CustomerApp` and `RiderMobileApp`.

## React Import Preservation Rule
- When performing any large block replacement on a `.tsx` file, ALWAYS confirm the replacement includes `import React, { useState, useEffect } from 'react'` at the top.
- After any import section edit, immediately run `npx tsc --noEmit` to catch `Cannot find name 'useState'` / `Cannot find name 'useEffect'` errors before continuing.

## Human-First Consumer Mobile UI/UX & Multi-Errand Invariants
- **No Developer DB Jargon**: NEVER display raw database enums (`PENDING`, `ASSIGNED`, `IN_TRANSIT`) directly in consumer-facing mobile views. Always map them through humanized status dictionaries (`Finding a Rider...`, `Rider Heading to Store`, `Out for Delivery`, `Delivered ✅`, `Cancelled ❌`).
- **Store & Item Lead**: Card headers must lead with the human-recognizable Store Name (e.g. *Jollibee Tacurong*) or Item Category, relegating hex order IDs (`#SGO-8C84F2`) to secondary receipt subtext.
- **Screen Identity**: Maintain welcoming screen titles with functional subtext so first-time users instantly understand the purpose of the screen (e.g. *"My Orders • Track ongoing deliveries or view past receipts"*).
- **Single-Map Multi-Errand Architecture**: Render a single continuous `MapView` at the root view level (strictly outside any `ScrollView`). When multiple active orders exist, display a horizontal floating tab pill overlay over the map to allow 1-tap switching of camera focus, 2-leg GIS polylines, and the bottom mission control panel.
- **Active Order Hero Card**: Active orders must feature an elevated Hero Card with a live pulsing beacon (`● DELIVERY IN PROGRESS`), bold price hierarchy (`₱89.65`), connected route storytelling (`🏪 PICKUP FROM: Store ➔ 📍 DELIVER TO: Address`), and a direct 1-tap `[ 🗺️ View Live Rider GPS Map ➔ ]` CTA.
- **Strict Active State Filtering & Whitelist**: `ACTIVE_STATUSES` MUST strictly include `['AVAILABLE', 'PENDING', 'ASSIGNED', 'IN_TRANSIT']`. NEVER set `activeErrand` to `errands[0]` without verifying its status matches this active whitelist. The Home screen Active Errand card must be hidden if all orders are `DELIVERED`, `COMPLETED`, or `CANCELLED`.
- **Unfulfilled Fare & Payment Realization Invariant**: For unfulfilled requests (`AVAILABLE`, `PENDING`), the base delivery fare MUST NOT be displayed as a finalized or collected charge (e.g. `₱70.00`). The UI MUST display `"Fare: Pending Completion"` (with footnote *"Applied upon rider delivery"*), `"Payment: Pending"`, and `"Deliver to {address}"`. Cancelled errands MUST display `~~₱{fee}~~ Voided (₱0.00)` and `"Order was cancelled • No items delivered"`.
- **Standard Navigation Sub-Screen Header**: Follow the two-tier structure: `navHeaderRow` (circle back button `( < )`, centered bold title, and right action link) + `headerSection` (Large bold Title `FontSizes.xxl` and subtitle description).
- **Multi-Scale Date Filtering**: Use date filter tokens (`ALL`, `DAY`, `WEEK`, `MONTH`, `YEAR`) with live count badges and context-specific empty states.
- **Dynamic Backend Store Categories & Owner Deactivation Invariant**:
  - **Fixed Boundary Anchors**: The first button (`[ Pabili ]`) is fixed to launch the multi-category Pabili Errand flow (`ErrandFormScreen`). The last button (`[ See More ]`) is fixed to open the full collection modal (`MerchantCategoriesModal`).
  - **Dynamic Backend Sourcing**: All intermediate merchant category buttons (e.g. `Malls`, `Pharmacy`, `Bakery`, `Restaurant`, `Retail`) MUST be fetched dynamically from the Express backend (`GET /merchant-categories`) instead of being hardcoded.
  - **Automatic Deactivation Hiding**: When an owner deactivates a merchant category in the backend/database (`status = 'Inactive'`), the backend API filters it out, and the customer app MUST automatically hide that category button from the Home grid and modal.
  - **Direct 1-Tap Category Navigation**: Tapping any individual category button directly navigates to `ErrandItemsScreen` with `selectedCats: [cat.name]`.
- **Zero-Aura Bottom Navigation & Dark Mode Noise-Free Surfaces**:
  - **Bottom Navigation Dome Button**: Center elevated action buttons (e.g. Pabili dome) must NOT feature colored translucent halo rings (`rgba` aura) or colored drop shadows. Must use crisp, subtle neutral drop shadows (`#000000`, elevation `5-6`) and balanced geometry (`42x42px` button, `16px` dome curve height).
  - **Dark Mode Surface Purity**: In dark mode, category badge buttons and cards must NOT use tinted translucent backgrounds (`rgba(246, 36, 89, 0.1)`) that introduce background noise. Use clean neutral dark surfaces (`rgba(255, 255, 255, 0.05)`) with subtle hairline borders (`rgba(255, 255, 255, 0.08)`).
- **Defensive String Normalization & Storage Object Coercion**:
  - **Safe String Manipulation**: Always defensively coerce strings (`String(catName || '').trim().toLowerCase()`) before calling string operations (`.toLowerCase()`, `.includes()`, `.slice()`) to prevent `TypeError: Cannot read property 'toLowerCase' of undefined`.
  - **Storage & API Normalizer**: Category and entity parsers (`normalizeCategoryItem`) must gracefully handle both legacy string arrays `['Food & Restaurant']` and modern object payloads `{ id, name, description, status }`.
- **Pinned-Header List Scrolling Architecture (Zero Off-Screen Controls)**:
  - In collection, search, and communication screens (`ChatTab`, `ErrandsTab`, `ActiveChatsScreen`), the **Screen Title Header, Search Bar, and Status Filter Capsules MUST remain mounted inside a static, non-scrolling top container (`fixedTopSection`)**.
  - **Only the itemized card list (`ScrollView` or `FlatList` with `flex: 1` and `paddingBottom: 110`) MUST scroll**. This prevents search inputs and filter capsules from scrolling off the viewport when browsing orders.
- **Clean Typography-First Screen Headers & Neutral Action Icons**:
  - Portal and tab headers MUST feature clean, typography-first bold titles without decorative leading icons next to the title text.
  - Header action buttons (e.g. `(?)` `HelpCircle`, notification `Bell`) and modal icons MUST use neutral, noise-free circular grey backgrounds (`colors.bgGray` or `rgba(255,255,255,0.06)` in dark mode) with grey icon strokes (`colors.textGray`), avoiding colored translucent tinted halos.
- **Accurate Dispatcher-Rider Errand Workflow Communication**:
  - Customer help modals and FAQs (`CustomerHelpModal`) MUST accurately communicate the 3-step fulfillment model: (1) Customer lists items; (2) Dispatcher confirms order via in-app chat and assigns a verified rider; (3) Rider purchases and delivers with COD payment on arrival.
  - Order assistance prompts must guide customers to communicate directly with their assigned dispatcher via the Messages tab.
- **Zero-Hardcoded Location & Strict Nullable Address State Invariant**:
  - **No Mock Address Fallbacks**: NEVER hardcode default mock or municipal address strings (e.g., `'Poblacion, Tacurong City...'`) as initial state or fallback values for customer delivery locations.
  - **Strict Null Initialization**: Location state variables (`defaultAddressText`, `defaultLocationLabel`, `defaultLocation`) MUST initialize to `null` and explicitly reset to `null` if the backend returns zero saved locations (`res.data.length === 0`).
  - **Actionable Empty-State Prompt**: When `defaultAddressText` is `null`, consumer UI cards (e.g., Home "DELIVERING TO" card, Account "Default Delivery Pin") MUST render explicit actionable setup prompts (`+ Tap to set your delivery address`, `No default pinpoint — tap to set on map`) in neutral text colors rather than displaying phantom addresses.
- **Mobile Auth Screen Adaptive Animation, 120 FPS Performance & Zero Bottom-Shade Invariant**:
  - **Non-Scrolling Adaptive Viewport**: Mobile authentication and landing screens MUST NOT use scroll containers (`ScrollView` or `KeyboardAwareScrollView`) when a single-viewport experience is intended. Wrap the layout in a fixed `<View style={styles.root}>` with `<TouchableWithoutFeedback onPress={Keyboard.dismiss}>` so tapping outside inputs seamlessly dismisses the keyboard and triggers collapsing motion.
  - **Original UI Geometry Preservation**: NEVER downscale typography, shrink button heights, or compress field paddings to fit above the keyboard. Retain the full designed UI hierarchy (`minHeight: 54` inputs, `minHeight: 56` primary CTA, full font scale) and translate the entire card upward via native transforms.
  - **60 / 90 / 120 FPS Framerate Engine & Hardware Textures**:
    - All expanding/collapsing motions MUST execute with 100% `useNativeDriver: true` using pure `transform: [{ translateY }]` and `opacity`, running directly on the native `RenderThread`/`Choreographer` (Android) and `CADisplayLink` (iOS).
    - Moving containers MUST include `renderToHardwareTextureAndroid={true}` and `needsOffscreenAlphaCompositing={Platform.OS === 'android'}` to promote views to dedicated GPU layers (`LAYER_TYPE_HARDWARE`), eliminating CPU redraw frame-drops on 90Hz and 120Hz panels.
    - Motion timing MUST use balanced curves: Material 3 Decelerate `Easing.bezier(0.2, 0.0, 0.0, 1.0)` (~280ms) for opening/expanding and Standard Motion `Easing.bezier(0.4, 0.0, 0.2, 1.0)` (~240ms) for closing/collapsing.
  - **Perimeter Elevation Shadow Removal & Full-Bleed Background**:
    - NEVER attach Android elevation shadows (`elevation > 0` or `Shadows.liftedUp`) directly to a sheet container translated upward with `translateY`. Android applies elevation along all 4 perimeter borders, rendering a dark horizontal shade line across the screen when shifted up.
    - The animated sheet MUST specify `minHeight: screenHeight + shiftDistance + 300` and match `backgroundColor: colors.card` across root, container, and sheet, ensuring a continuous, full-bleed solid background behind and below the keyboard with zero bottom gaps or shade artifacts.
- **Designer-Grade Mathematical Responsive Scaling & Samsung A04 Baseline Invariant**:
  - **Samsung Galaxy A04 Reference Baseline**: All base token coordinates and font scales are calibrated against the Samsung Galaxy A04 baseline ($W = 360\text{dp}, H = 800\text{dp}$ at 2.0x xhdpi density for $720\times 1600\text{ px}$).
  - **Refined Typography Scale**: Base font tokens are calibrated down globally by $-4\text{sp}$ to $-5\text{sp}$ (`huge: 26`, `xxl: 21`, `xl: 17.5`, `lg: 15.5`, `md: 14`, `base: 12.5`, `sm: 11.5`, `xs: 10`) to eliminate bulky or oversized text.
  - **Strict Anti-Overflow Typography Clamping**: Font sizing MUST use $\text{factor} = 0.20$ and clamp strictly within $[0.85 \times \text{size}, 1.06 \times \text{size}]$ via `scaledFontSize(size, 0.20)`. Fonts on FHD+ ($1080\times 2408\text{ px}$) screens MUST NOT expand by more than $6\%$ above baseline.
  - **Accessibility Safety**: Critical UI components (tabs, button titles, status pills, table headers) MUST declare `maxFontSizeMultiplier={1.15}` to `{1.25}` to prevent OS-level accessibility extra-large fonts from breaking structured cards.
  - **Airy Whitespace & Anti-Cramping Layout**: Spacings use expanded breathable tokens (`Spacing.md = 14dp`, `Spacing.lg = 18dp`, `Spacing.xl = 24dp`, `Spacing.xxl = 30dp`). Card inner paddings MUST be $\ge 14\text{dp}$ and section gaps $\ge 18-24\text{dp}$ to prevent visual cramping.
  - **5-Tier Device Form Factor Classification**: Responsive hooks (`useResponsive()`) MUST classify viewports into 5 explicit tiers:
    1. `Compact` ($W < 350\text{dp}$): Compact paddings, condensed button heights ($48–50\text{dp}$).
    2. `Standard` ($350\text{dp} \le W < 414\text{dp}$): Standard $18\text{dp}$ margins, $48–50\text{dp}$ CTAs.
    3. `Phablet` ($414\text{dp} \le W < 600\text{dp}$): Balanced typography, expanded padding ($20–24\text{dp}$).
    4. `Tall Aspect Ratio` (aspect ratio $\ge 2.05$, e.g. Samsung Galaxy Z-Flip $22:9$): Expanded bottom map/mission control clearance ($420\text{dp}$).
    5. `Tablet / Unfolded Foldable` ($W \ge 600\text{dp}$): Container constrained to `maxWidth: MAX_CONTENT_WIDTH` ($580\text{dp}$) with `alignSelf: 'center'` to eliminate edge-to-edge stretching.
  - **Fluid Grid Sizing**: Multi-column grids (e.g. Bento grid slots) MUST dynamically calculate slot widths from live `contentWidth` ($\text{slotWidth} = \frac{\text{contentWidth} - \text{gap}}{\text{columns}}$) instead of fixed hardcoded pixels.
- **Bottom Mission Control Scroll Clearance & Tab Bar Underflow Prevention Invariant**:
  - **Sheet Elevation**: Floating bottom panels overlaying map views MUST declare calibrated heights ($\ge 365\text{dp}$ standard, $\ge 420\text{dp}$ tall aspect ratio).
  - **Scroll Bottom Clearance**: Scrollable panel content containers MUST declare `paddingBottom: 110dp` to ensure footers, pricing totals, and action buttons scroll completely clear of the bottom tab bar and center action dome.
- **Horizontal Stepper Fit & Header Pill Anti-Collision Invariant**:
  - **Concise Step Labels**: Multi-step progress tracks MUST use concise humanized labels (`['Received', 'To Store', 'Buying', 'In Route', 'Delivered']`) with `adjustsFontSizeToFit={true}`, `minimumFontScale={0.85}`, and flexible node limits (`minWidth: 44`, `maxWidth: 58`, `flex: 1`) to eliminate text clipping.
  - **Category Pill Collision Protection**: Header category pills placed alongside status badges MUST enforce `flexShrink: 1`, `maxWidth: '65%'`, `numberOfLines={1}`, and `ellipsizeMode="tail"` inside `flexWrap: 'nowrap'` rows.
  - **Humanized Status Badges**: All status badges MUST map raw database enums (`IN_TRANSIT`, `ASSIGNED`, `PENDING`) to humanized title case (`"In Transit"`, `"Assigned"`, `"Pending"`) with `flexShrink: 0` and `numberOfLines={1}`.
- **Multi-Stop Route Visibility**: Store stops in multi-stop errand cards MUST specify `numberOfLines={2}` with responsive font scaling so complete route chains display clearly without abrupt truncation.
- **Zero Hardcoded Urgency & Live Telemetry Verification Invariant**:
  - **No Mock/Simulated Urgency Banners**: NEVER insert hardcoded or simulated scarcity/urgency banners (e.g. `"High Demand: Only 2 Riders nearby in this area."`, `"Only 1 slot left!"`) into customer or rider screens.
  - **Strict Real-Time Data Gating**: Operational status banners or high-demand alerts MUST only render when backed by verified live backend data (e.g., real-time fleet telemetry, active rider counts from Firebase RTDB / API). If live data is unavailable or uncalculated, the UI MUST omit the banner entirely to maintain clean, noise-free, and trustworthy customer surfaces.
- **Single-Tier Compact Navigation Header Invariant (Zero Duplicate Hero Headers)**:
  - **Single Source of Screen Title**: In stack and modal sub-screens with a top navigation bar (`navHeaderRow` containing `<` Back button and centered title), NEVER render a second duplicate body hero header with a large bold title and explanatory subtext.
  - **Immediate Content & Control Surfacing**: Search bars, filter capsules, and item lists MUST mount directly beneath the top navigation bar to maximize visible card space and reduce vertical scrolling friction.
  - **Compact Badge Integration**: Status counts or unread badges (e.g. unread notification count) MUST be integrated compactly alongside the navigation bar title or header action link rather than inside a large banner.
- **Component-Level Modular Skeleton & Smooth Wave Shimmer Invariant**:
  - **Component-Level Isolation (No Monolithic Full-Page Skeletons)**: Skeletons MUST NEVER replace the entire screen tree with a monolithic placeholder. Every distinct screen component/section (e.g., Delivery Location Card, Active Orders Hero, Categories Bento Grid, Recent Activity History) MUST have its own dedicated, independently exportable skeleton component (`LocationCardSkeleton`, `ActiveErrandSkeleton`, `CategoriesBentoSkeleton`, `RecentActivitySkeleton`).
  - **Independent Staggered Gating**: When an individual data source is in-flight (e.g. merchant categories reloading over socket or HTTP), ONLY that specific component renders its skeleton placeholder. All other loaded sections MUST remain mounted, visible, and interactive.
  - **60 / 90 / 120 FPS Native Wave Shimmer Engine**: Skeletons MUST utilize a smooth linear gradient wave (`expo-linear-gradient` with `useNativeDriver: true` and `translateX` transform interpolation) executing on native `RenderThread` / `CADisplayLink`, avoiding CPU redraw frame drops or simple opacity pulsing.
  - **Theme-Adaptive Surface Purity**: Shimmer highlights must maintain clean, noise-free contrast for both Light (`rgba(255, 255, 255, 0.65)`) and Dark (`rgba(255, 255, 255, 0.10)`) modes with subtle base backgrounds (`rgba(255, 255, 255, 0.06)`).
- **Zero-Duplicate Help Banner & Immediate Control Surfacing Invariant**:
  - **No Redundant In-Body Guide Banners**: When a screen header already provides a dedicated action button (e.g. `(?)` `HelpCircle` icon button opening `CustomerHelpModal`), NEVER insert an in-body guide banner, promo strip, or reminder card repeating the same help prompt (e.g. `"Live Dispatcher Support & Guide — View Guide"`).
  - **Immediate Surfacing of Functional Controls**: Search bars, category chips, and status filter capsules MUST mount directly beneath the concise header section to maximize visible card rows and minimize vertical scrolling friction.
  - **Chat & Messaging Skeleton Wave Shimmer**: Chat channels and message bubble loading states MUST utilize `ShimmerWave` linear gradient sweeps (`ChannelListSkeleton`, `ChatMessagesSkeleton`) running on the native `RenderThread` rather than static or opacity-pulsing placeholders.
- **Errand & Pabili Item Ordering Invariants (15 Rules & 3 Conversion Mechanisms)**:
  - **The 15 Errand Surface Invariants**:
    1. **Merchant Banner Icon Contrast**: Action/navigation icons (`<` Back, Search, Share, Favorites) overlaying store cover photos or merchant headers MUST have frosted background containers (`bg-slate-900/60 backdrop-blur-md border border-white/10` or `colors.card`) with thin outlines so they remain 100% legible over bright, white, or busy store photos.
    2. **Consistent Catalog Imagery**: Store cards and item thumbnails in pabili catalog grids MUST use uniform aspect ratios ($1:1$ or $4:3$) and neutral card backings to preserve visual rhythm across diverse merchant listings.
    3. **Strict Grid Alignment**: All elements across store listings and item sheets MUST snap to a unified layout grid (standard 18–24px horizontal gutters) to maintain visual order and trust.
    4. **Supportive Palette (No Accent Shouting)**: Store category tags, merchant pills, and item cards MUST use calm, neutral tones. Saturated brand red (`#E53935` / `#F62459`) is strictly reserved for primary progression and errand dispatch CTAs.
    5. **Single-Family Typography Hierarchy**: Constrain typography to 1 clean font family. Express hierarchy exclusively through size, weight, contrast, and line-height.
    6. **Concise Non-Redundant Badges**: Merchant badges MUST use concise, high-signal copy (`VERIFIED`, `FAST QUEUE`, `AIR-CON`). Never combine redundant words (`VERIFIED MERCHANT PARTNER`) or decorative clutter in compact tags. Small uppercase tags must feature subtle letter-spacing (`0.5px`).
    7. **Balanced Item Titles**: Item and store titles must be prominent and scannable without aggressive shouting. Use balanced semi-bold/bold weights (`600–700`), not ultra-black.
    8. **Readable Paragraph Line-Height**: Item notes and store delivery instructions MUST specify line-height $\ge 1.4\text{–}1.6$ with softened contrast (`text-slate-400` / `colors.textMuted`). Headlines attract attention; paragraphs support understanding.
    9. **Merchant Rating & Trust Proximity**: Store ratings (`★ 4.9 (120+)`) and verified status MUST be anchored directly adjacent to the store/item title in the hero area, answering *"What store is it and can I trust it?"* at first glance.
    10. **Monochromatic Benefit Icons**: Errand feature chips (e.g., `Official Receipt`, `Fragile Handling`, `Cold Storage`) MUST share unified visual logic: monochromatic stroke weights, shared container geometry, and balanced spacing.
    11. **Soft Hairline Dividers (Zero "Divider Hell")**: Replace harsh dark lines with ultra-subtle hairline borders (`rgba(255,255,255,0.06)` or `colors.border`) and macro-whitespace.
    12. **Gestalt Spacing Balance**: Related item data (Item Name + Estimated Price + Quantity) must use tight micro-spacing ($4\text{–}8\text{px}$); distinct conceptual sections (Store Info vs. Item List) must use macro-spacing ($18\text{–}24\text{px}$).
    13. **Zero Redundant "Price:" / "Qty:" Labels**: NEVER prefix currency figures with the literal word `Price:` (e.g. `Price: ₱85.00`). Display `₱85.00` directly with bold numerical hierarchy. Let currency symbols and typography speak for themselves.
    14. **Pure Item Titles & Early Price Visibility**: Strip weight and package sizes from titles (e.g., `"Fresh Mangoes"`, not `"Fresh Mangoes 1kg"`). Place estimated pricing prominently in the upper hero area alongside the title and merchant name.
    15. **Ergonomic Item Stepper & Dynamic Total in CTA**: Place the quantity selector directly adjacent to the Add to Errand button, display the unit (`kg`, `pcs`, `packs`) inside the stepper, and embed the dynamic total price inside the button (`[ Add to Errand • ₱179.00 ]`).
  - **The 3 Advanced Errand Conversion Mechanisms**:
    1. **Scrollable Card Sheet with Sticky Store Header Transition**: The store info, search bar, and item catalog live inside a soft card sheet that slides over the cover image; as the cover scrolls away, the store title and rating smoothly condense into the sticky top navigation header so the customer never loses store context.
    2. **Persistent Sticky Bottom Errand Action Dock (Thumb Zone)**: In item selection and errand building screens, the quantity stepper, running item count, and primary conversion CTA remain persistently pinned in the bottom thumb reach zone (`bottom: 0`, `paddingBottom: safeAreaInsets.bottom`).
    3. **Predefined 1-Tap Quantity Presets**: Above or beside the custom stepper, provide quick-select pill chips (`[ 1x ]`, `[ 2x ]`, `[ 3x ]`, `[ 5x ]` or common weights `[ 500g ]`, `[ 1kg ]`, `[ 2kg ]`) to eliminate repetitive `+` clicking while retaining the custom stepper for exact numbers.


# Impeccable UI/UX Design Standards & Strict Anti-AI-Slop Invariants

> **ENFORCEMENT LEVEL: ABSOLUTE & UNIVERSAL**
> Applies whenever designing, creating, editing, refactoring, or suggesting UI/UX layouts.
> Generic "AI Slop" visual design patterns are STRICTLY BANNED in production engineering.

## 1. The Anti-AI-Slop Bans (The 15 Absolute Refusals)
1. **NO Identical Card Grid Scaffolds**: NEVER structure screens out of repetitive, same-size card boxes containing `[Icon + Heading + Paragraph]`. Replace boxes with generous whitespace, typographic rhythm, and clear sectional flow. Nested cards are strictly banned.
2. **NO Hero-Metric Templates**: Refuse repetitive dashboard clichés (giant number, tiny label, supporting percentage badge, colored accent bar). Structure metrics according to real domain utility.
3. **NO Decorative Kickers or Eyebrows (Absolute Ban)**: NEVER place tiny uppercase kickers or category tags above headings as visual crutches. A heading carries its own weight.
4. **NO Generic Purple / Indigo Gradients**: Stick strictly to authentic brand colors: Deep Navy (`#0F2035`, `#0B132B`), bone (`#F2EEE4`), SUGO Red (`#DC2626`, `#F62459`), and tinted neutrals.
5. **NO Pill-Shaped Action Buttons**: Standard action buttons, CTAs, and inputs must use restrained ergonomic radii (8 to 12px). Full pills are strictly reserved for compact status indicator chips and action domes.
6. **NO Glowing Colored Halo Shadows**: Zero-offset colored drop shadows or glowing halo rings are banned. Shadows must carry intentional vertical offset and soft blur.
7. **NO Unicode Glyphs or Emojis as Structural UI Icons**: NEVER use emojis (🚀, ✨, 🔥, 🛵, 📦) in headers, buttons, status pills, or navigation bars. Use clean drawn vector SVGs (Lucide) in consistent stroke and weight.
8. **NO Fake Reviews, Fake Counters, or Fabricated Urgency**: Never render simulated stats, animated count-ups, fake testimonials, or fabricated scarcity countdowns.
9. **NO Gradient Text**: Emphasis comes from weight, size, and contrast, never rainbow/gradient text fills.
10. **NO Glassmorphism or Blur as Lazy Decoration**: Use crisp, solid flat surfaces with intentional contrast.
11. **NO Colored Border-Left / Border-Right Callouts**: Avoid 3px or 4px colored side borders on cards or alerts.
12. **NO Monospace as Costume**: Monospace is for code, data, money, timers, and measurements only.
13. **NO Low-Contrast Microcopy (WCAG 2.2 AA Violation)**: Body and placeholder text must clear >= 4.5:1, large text >= 3:1.
14. **NO Em Dashes in UI Copy**: Use standard hyphens, colons, commas, or concise sentence breaks instead.
15. **NO Vague Marketing Filler**: Write clear, concrete, human domain copy.

## 2. Impeccable Mobile Craft Floor
- **Platform Ergonomics**: MD3 / HIG compliant, touch bounding areas >= 48x48 dp, safe area clearance, hardware-accelerated transforms (`useNativeDriver: true`).
- **Thumb Reach Zone**: Primary progression and checkout CTAs persistently placed in bottom third reach zone.
- **Asymmetric Vertical Rhythm**: Headings must always have significantly more spacing above them than below them (margin-top >= 1.5-2.5x margin-bottom).
- **Tinted Neutrals (Zero Dead Gray)**: Never use dead black (`#000000`) or dead gray (`#808080`). Tint dark surfaces and text with ambient brand hue.
- **Primary Action Law**: Red has exactly ONE legal meaning: **you must act**. Exactly one primary CTA per viewport.
- **Preserve User Drafts**: Never allow back-button presses, network drops, or validation errors to wipe out unsubmitted user inputs.
