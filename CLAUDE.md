# CustomerApp Mobile Rules (Claude Protocol)

This file contains the mobile rules and instructions for Claude App / Claude Desktop.

---

## 🌐 Dual-Agent Tunnel Invariant (Always Active in All Sessions)
1. **Boot-Time Handshake Check (Step 0)**: In every session, ALWAYS inspect `AGENT_HANDSHAKE.md` in this directory before designing or modifying mobile components.
2. **Locked Contract Invariant**: NEVER alter map hierarchies or auth persistence marked `[LOCKED]` in `AGENT_HANDSHAKE.md`.
3. **Surgical Diffs**: Always generate precise, minimal edits.

---

## Core Mobile & UI Invariants

### 1. React Native Maps Layout Rule
- **NEVER embed `MapView` inside `ScrollView` or `FlatList`** (causes native crash on Android).
- Place `MapView` at root level in a fixed pixel `height` View, or inside a full-screen `Modal`.

### 2. Designer-Grade Mathematical Responsive Scaling (Samsung A04 Baseline)
- Calibrated against Samsung Galaxy A04 baseline ($W=360\text{dp}, H=800\text{dp}$).
- Typography: `scaledFontSize(size, 0.20)` clamped strictly within $[0.85\times, 1.06\times]$.
- Accessibility safety: `maxFontSizeMultiplier={1.15}` to `{1.25}` on critical badges and pills.

### 3. Humanized UI & Errand Surface Rules
- Map database enums to conversational text (`PENDING` ➔ `Finding a Rider...`, `ASSIGNED` ➔ `Rider Heading to Store`, `IN_TRANSIT` ➔ `Out for Delivery`).
- Zero-aura bottom navigation (no colored translucent halo rings or colored glow shadows).
- Zero mock urgency banners (must be backed by live backend telemetry).
