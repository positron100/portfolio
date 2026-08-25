# Portfolio Project Context

> **Handover written 2026-08-24.** Reflects the repository as it actually
> stands, verified by reading the source, not by recalling conversation.
> Where this document and your memory of an older plan disagree, the source
> wins; where this document and the source disagree, fix this document.

---

## 0. NEXT TASK

**The contact email feature is DONE and verified with a live send. Do not
re-implement it.** An earlier plan listed it as "the next major task"; that
plan is stale.

The mobile performance baseline is **done** (§3A), **P0-2 (the idle floor) is
fixed and verified**, and the **`SectionBigTitle` mount measurement is fixed
and verified** (§3B). The next task is **framer-motion's `useScroll` offset
walk**, then the theme toggle, then the two open content conflicts:

1. **framer-motion `useScroll` - now the largest named forced-reflow
   contributor on a cold load.** **16 instances** initialise in the same
   mount: 7 `SectionBigTitle` + 7 `useConnectedScroll` + Hero +
   `ExperienceTimeline`, each walking `offsetLeft`/`offsetTop` up the
   `offsetParent` chain. Measured **497ms -> 366ms** of forced reflow after
   the `SectionBigTitle` fix, i.e. it inherited attribution rather than
   shrinking. Investigate whether those walks are genuinely needed during the
   critical initial render window, or can be batched/deferred. Isolated
   experiment, fresh cold-load before/after, **two runs per side** (§3A).
2. **Theme toggle `readColors` forced reflow** - confirmed, not yet fixed.
   See §3B.
3. **Deploy to Vercel.** The git repository now exists with an `origin/main`
   remote. The short version of the deploy steps is in §16.
4. **DevTown duration conflict.** `src/data/experience.ts` says
   `period: "3 Months"` and `role: "Software Development Intern"`. Mukul's own
   DevTown certificates (rendered in `public/certificates/`) say **May 2024 to
   Sep 2024**, "5-months internship", **Full Stack Web Developer**. A visitor
   can open the certificate from the Certifications section and see the
   mismatch. This is Mukul's claim to resolve - do not silently rewrite it.
5. **About duplicates Certifications.** `src/sections/About.tsx` still renders
   the old plain-text `certifications` list from `src/data/site.ts`. It now
   duplicates the real Certifications section and includes "Backend Web
   Development Bootcamp - ShapeAI", for which no certificate file exists.
   Offer to trim it.

After those, remaining polish (all currently working, none urgent):
mobile animation profiling on a real device, and a final regression pass.

---

## 1. Project Overview

Personal portfolio for **Mukul Negi**, backend software developer (Java /
Spring Boot, microservices, API integrations, financial systems). Single-page
React app.

Section order in `src/App.tsx`:
`Hero → About → Skills → Experience → Certifications → Projects →
Architecture → Contact`.

**This is not a generic static portfolio.** The project deliberately invests
in premium interactions: fluid animation, magnetic and liquid effects, a 3D
avatar companion, shared-element transitions, and a circular theme reveal.
Preserving that visual language matters more than any individual refactor.

- **Dark theme**: near-black surfaces with a green accent (`--accent:
  #3ecf8e`), terminal-adjacent, technical.
- **Light theme**: indigo primary (`--accent: #4f46e5`) with a violet
  secondary, more colourful but held to the same "accent has one job" rule.
- Full desktop and mobile support. Both themes are first-class everywhere.
- `prefers-reduced-motion` gates every non-essential animation, checked
  per-component via Framer Motion's `useReducedMotion()`.

---

## 2. Tech Stack and Architecture

Verified from `package.json`:

| Concern | Choice |
|---|---|
| Framework | React 19.2 + TypeScript |
| Build | Vite 8 (`npm run dev` / `build` / `preview`) |
| Styling | Tailwind CSS v4, CSS-first `@theme inline` in `src/index.css` |
| Animation | `framer-motion` ^13.1.1 |
| 3D | `three` + `@react-three/fiber` v9 (no drei, deliberately) |
| Lint | `oxlint` |
| Dev-only | `pdfjs-dist` + `@napi-rs/canvas` (certificate previews) |

There is **no router**. Navigation is scroll-driven with `#section` hashes
(`src/utils/scroll.ts`), so no SPA rewrite rule is needed at deploy time.

### Key directories

- `src/sections/` - one file per page section.
- `src/components/` - shared and section-specific components.
- `src/components/architecture/` - the system-map subsystem.
- `src/hooks/` - theme, intro clock, scroll, magnetic, modal behaviour.
- `src/utils/` - motion tokens, geometry, scroll, theme transition.
- `src/data/` - all copy and content. **Content lives here, not in JSX.**
- `api/` - the contact endpoint (server-side only, never bundled).
- `scripts/` - one-off maintenance script for certificate previews.
- `public/certificates/` - web copies of certificates + generated previews.
- `Certificates/` - Mukul's original documents. **Never edit or delete.**

### Central systems worth knowing before touching anything

- **`src/utils/motion.ts`** - the shared motion vocabulary: `duration`,
  `ease`, `spring`, `fadeUp`, `staggerContainer`, `hoverLift`, `scaleTap`,
  `press`, `jiggle`, `cardTilt`, `rowFill`, `wordReveal`. **Reuse these
  rather than inventing per-component spring configs.**
- **`src/hooks/useMagnetic.ts`** - the site's single magnetic implementation.
  `Magnetic.tsx` is a thin wrapper for plain children; use the hook directly
  on elements that are already motion elements.
- **`src/components/LiquidIndicator.tsx`** - one shared active-state marker
  used by the navbar, skill category tabs and project filters. Springs its
  own geometry and derives squash-and-stretch from travel velocity.
- **`src/index.css`** - the only source of colour truth. CSS custom
  properties feed `@theme inline`, which feeds Tailwind utilities. Change
  palette here, never in components.

---

## 3. Installed Skills and Tooling

Available under `~/.claude/skills/`:

| Skill | When it is actually useful here |
|---|---|
| `design-taste-frontend` | Redesigns and new sections. Audit-first, anti-slop rules. Used for the Architecture rebuild. |
| `web-design-guidelines` | Reviewing UI code for a11y/interaction compliance. Caught three real issues in the Architecture section. |
| `taste` | Reverse-engineering another site's design system. Needs a URL. Not applicable so far. |
| `image-to-code` | Image-first design work. Not applicable so far. |
| `design-md` | Brand design-system reference library. Not needed; this site has its own system. |
| `playwright-cli` | Browser automation. |

**Use them when relevant, not reflexively.** For most targeted refinements in
this repo, reading the source and measuring in the browser beats loading a
skill.

**Playwright MCP is configured and is the primary verification tool.** Every
claim in this document about behaviour was measured through it.

**Chrome DevTools MCP is configured and is the primary *performance* tool.**
The two servers are complementary, not alternatives — see §3A.

### Harness caveat that will waste your time if you forget it

In this Playwright-driven Chrome, `requestAnimationFrame` idles at roughly
2 fps unless something actively pumps frames. A tight `page.screenshot()`
loop pumps them. Consequences:

- Timing measured while idle is meaningless.
- Fast animations (the opening sequence's first ~300ms) finish before your
  first screenshot lands. You cannot always capture them; say so rather than
  claiming they were visually verified.
- Playwright's synthetic mouse reports `(pointer: fine)`. To exercise touch
  code paths, override `matchMedia` in an `addInitScript` so
  `(pointer: fine)` returns `false`.

---

## 3A. Browser MCP Servers - Which One, and When

Two browser MCP servers are configured. **They are complementary. Pick by the
question you are asking, and do not run overlapping sessions through both** -
each spawns its own Chrome instance, and two live browsers competing for CPU
makes any measurement taken in either one worthless.

| Server | Use it for |
|---|---|
| **Playwright MCP** | Functional and interaction testing: clicks, touch, drag, swipe, navigation, form flows, regression sweeps, screenshots, console errors, overflow checks. |
| **Chrome DevTools MCP** | Performance only: profiling, animation debugging, long-task analysis, rendering/paint/layout bottlenecks, CPU and network throttling, frame analysis. |

Chrome DevTools MCP is **configured locally and is not part of this git
repository** - a fresh clone will not have it. Configured command:

```
npx -y chrome-devtools-mcp@latest --isolated
```

`--isolated` means each run gets a **fresh browser profile**, so no extension,
cache or previous-session state contaminates a trace.

### The measurement rule that supersedes earlier work in this document

**Do not treat Playwright `requestAnimationFrame` sampling as authoritative
for animation smoothness.** Every rAF/`getComputedStyle` timing figure in this
file was taken under browser automation, where the frame loop is throttled and
backgrounding behaviour distorts it (§3). Those numbers were good enough to
prove *ordering* and *interpolation continuity*, and they are still fine for
that. They are not evidence about frame rate, jank or smoothness - §4's own
note that "frame-level smoothness cannot be measured in this sandbox" was
correct, and Chrome DevTools MCP is the answer to it.

For anything about frames, use `performance_start_trace` /
`performance_stop_trace` and `performance_analyze_insight`, so the conclusion
comes from Chrome's real trace data rather than from sampled style reads.

### Session hygiene - the rule that invalidated a whole round of findings

**A performance baseline must be recorded in a fresh browser session.** This is
not a nicety. An entire set of "severe" findings - avatar follow at 11 long
tasks, menu close at 6, the project card committing 6 frames in 1.5s, a card-
close CLS of 0.26, and a 90%-busy idle - turned out to be **artifacts of one
long-lived renderer** that had already run the intro, a modal cycle and a
synthetic touch-stress loop. Re-measured on the *same unmodified code* in a
fresh session, every one of them was fine.

The tell was unmissable once looked for: the same synthetic touch driver
delivered **40 samples per 3s** in the degraded session and **131** in a fresh
one, on identical code. If an input-driven measurement changes by 3x between
sessions, the session is the variable.

Rules that follow:

- **Establish every baseline from a fresh browser session and a fresh
  document.** `new_page` with an `isolatedContext`, then reload; do not reuse
  the tab that has been driving the last twenty traces.
- **Never treat a stress-tested, long-lived renderer as authoritative.** It
  degrades, and it degrades in exactly the direction that makes code look
  guilty.
- **Reproduce anything surprising in a clean session before changing code.**
  A number that implies a serious bug is a reason to re-measure, not a reason
  to start editing.
- **Synthetic touch sample rates are a property of the session, not the
  device.** They are not comparable to real hardware input rates and must not
  be reported as if they were.
- **Before/after comparisons must both be fresh.** Stash the change, rebuild,
  re-measure the baseline under the same conditions, restore. Comparing a new
  build in a fresh session against an old number from a tired one measures the
  session.
- **Watch the trace window for harness contamination.** Calling
  `evaluate_script` *inside* a running trace installs MCP's
  `waitForStableDom` observer, which showed up as 155 callbacks / 64ms of
  someone else's work. Scroll and set up state *before* starting the trace, or
  pass `waitForStableDom: false`.
- **Short windows lie about anything periodic.** Idle main-thread busy at Hero
  sampled 79% / 69% / 81% across three 3s runs purely because of where the
  window landed in the typewriter's type/hold cycle. Use a 9s window, or
  measure a condition where the periodic work is off.

### Recommended mobile performance workflow

1. `npm run dev`, and confirm which port actually answered (§13.1).
2. Emulate a representative mobile viewport, starting at **390x844**.
3. Apply **CPU throttling** representative of a mid-range Android before
   investigating anything animation-sensitive. An unthrottled desktop hides
   every bottleneck that matters here.
4. **Record a trace while reproducing the real interaction** - not while idle,
   and not around a synthetic approximation of the gesture.
5. Analyse: long tasks, rendering / paint / layout work, animation and
   compositor issues, frame performance.
6. **Change only the specific bottleneck the trace names.** No opportunistic
   refactoring alongside it.
7. Re-run the *same* trace after the fix and compare against the baseline.
8. Verify on a **real mobile device** last. Emulation plus CPU throttling
   cannot reproduce Mukul's actual Oppo device.

---

## 3B. Performance Findings - Verified Status

**Every number here was recorded in a fresh session** (§3A) on a production
build (`vite build --minify false`, served by `vite preview`), at 390x844,
DPR 3, mobile+touch, CPU 4x. Figures are 4x-throttled; that band is the
closest available analogue to a mid-range Android.

### DONE - P0-2, the idle performance floor

Two changes, measured independently.

**P0-2a - `useTypewriterCycle`. A proven improvement; keep it.**
The chain had no terminal state and no visibility gate, so it re-rendered a
React component every 28-55ms for the entire visit, including while the
visitor was reading Architecture or Contact. It is now suspended when the text
is off screen or the tab is hidden, resuming at the exact position it stopped
(the chain carries its position in `step`'s arguments, so pausing is holding
the next thunk instead of scheduling it), and `setDisplay` is guarded with
`prev === next` because the type→hold→delete boundary emitted the same string
twice. Measured, fresh both sides, 3s:

| | Hero visible | Scrolled to Projects |
|---|---|---|
| React renders | 40 → **20** | 34 → **0** |
| React time | 86ms → 35ms | 52ms → **0ms** |
| `Layout` | 122ms → 103ms | 116ms → **73ms** (-37%) |
| Main-thread busy | 79% → 69% | 77% → 67% |

**React work is exactly zero once Hero is off screen.** No timing constant,
word, or markup changed; typing/deleting/cycling verified before measuring.

**P0-2b - `FrameDriver`. A scheduling cleanup, NOT a proven performance win.**
`FrameDriver` re-armed `requestAnimationFrame` unconditionally, so it was a
*second* permanent 60Hz rAF whose only job was to throttle down to
`TOUCH_FPS`: 177 callbacks per 3s producing 89 invalidations. It is a
`setInterval` now, with a `document.hidden` guard replacing what rAF gave for
free. `invalidate()` only marks the canvas dirty - r3f's own rAF still draws
on the next vsync - so rate and vsync alignment are unchanged (verified: r3f
`loop` runs 281x/9s = 31/s, exactly `TOUCH_FPS`, before and after).

Measured over 9s at Hero: **rAF 1877 → 1337 (-29%), main-thread busy 7091ms →
7105ms (unchanged).** The removed callbacks were cheap. **Do not describe this
as a performance improvement.** It removes a genuine duplicate scheduler and
costs nothing visually; that is the whole claim.

**The r3f scene does not sleep while visible, and must not.** `AvatarHead`'s
`useFrame` animates `position.y = sin(clock.elapsedTime * 0.9) * 0.06`
continuously, so there is no "nothing changed" frame. The avatar is
`position: fixed`, 164x164, `opacity: 1`, `visibility: visible` at **every**
scroll offset - verified with `getBoundingClientRect` at Projects. It is a
site-wide visible companion, not an invisible scene burning frames. It sleeps
only behind a modal (`frameloop="never"`) and now in a backgrounded tab.

**HeroBackground's visibility gate already works** - `step` goes from 177
calls to **0** when Hero scrolls off. Nothing to fix there.

### DONE - `SectionBigTitle` mount measurement

**A confirmed contributor-level improvement, with a deliberately bounded
claim about the whole load.**

Seven instances each read `offsetWidth`/`clientWidth` in their own
`useLayoutEffect`. React interleaves DOM mutation with those effects, so every
read landed on a freshly invalidated document and forced its own layout -
seven forced layouts, plus seven independent `document.fonts.ready` handlers
firing a second storm, plus seven `setEntryScale` render passes.

The fix is in `SectionBigTitle.tsx` only:

- **One module-level batched pass.** All instances register; one pass reads
  every geometry value back to back (only the first read pays for a layout)
  and only then writes. One forced layout instead of seven.
- **The pre-paint guarantee is preserved, not traded away.** Still
  `useLayoutEffect`; the batch flushes via `queueMicrotask`, which drains as
  the commit's stack unwinds - after all seven layout effects, **before
  paint**. This is deliberately *not* a move to `useEffect`.
- **`entryScale` is a `MotionValue`, not React state.** Seven render passes
  become zero.
- **One shared `ResizeObserver`** on each heading and container replaces both
  the seven `resize` listeners and the seven `document.fonts.ready` handlers:
  the shrink-wrapped heading's own box is what changes on a font swap *and* on
  a column resize, so one instrument covers both, off the critical path.

Measured, **two cold runs per side, a fresh isolated context each**:

| | Before | After |
|---|---|---|
| `SectionBigTitle measure` forced reflow | **896 / 878ms** | **absent** |
| replacement (`flushMeasurements`) | - | **14.8 / 13.4ms** |
| Total forced reflow | 820 / 806ms | **690 / 701ms** |
| framer `useScroll measure` reflow | 497ms | 366ms |
| Batched passes per cold load | - | 3 (mount, RO delivery, font swap) |

**What this does NOT claim.** Total forced reflow fell only ~16%, not ~890ms:
the work partly *moved*, with framer's `useScroll` and
`useNodeGeometry.measure` absorbing attribution `SectionBigTitle` used to
take. Largest task, long-task count, Layout, Style, Paint, LCP and
commits-under-2s all sit **within run-to-run noise**. **No claim is made that
the intro renders earlier** - first commit moved 440/395ms -> 316/86ms, but
n=2 with an outlier is not evidence.

Verified visually: all seven headings measure exactly the pre-change formula
at 390 *and* 1440 (including the clamped ones - Certifications 1.446,
Architecture 1.691 at 390); all settle to scale 1 / opacity 1; a desktop
resize re-measures all seven through the ResizeObserver; the intro's
dots-to-avatar formation, typed caption, arrow and transition into the site
are unchanged; no horizontal overflow; 0 console errors.

---

### CONFIRMED - still open

**framer-motion `useScroll`: the largest named forced-reflow contributor on a
cold load.** 16 instances initialise in one mount, each walking
`offsetLeft`/`offsetTop` to `offsetParent`. Measured 497ms -> 366ms after the
`SectionBigTitle` fix - it inherited attribution rather than shrinking. See
§0.1. Not yet investigated; next isolated experiment.

**Theme toggle: seven full-document style recalculations, one of them forced.**
Fresh session, 2s window: `UpdateLayoutTree` totals **892ms** across recalcs
of 75 / 107 / **172** / 106 / 101 / 133 / 104ms; 6 long tasks; 88% busy.
`ForcedReflow` names `readColors @ HeroBackground.tsx:34` at **172ms** - its
`MutationObserver` on `data-theme` calls
`getComputedStyle(document.documentElement)` in the microtask right after the
attribute flip, forcing a synchronous recalc on top of the one the browser was
already going to do. `IntroParticles.readColor` has the identical pattern.
(`startThemeReveal`'s 75ms is the knob's `getBoundingClientRect` - small,
legitimate, leave it.)
*Correction:* an earlier note said "three recalcs"; it is seven. Only the
first three were visible at the top level of that trace.
*Assumption, not measured:* fixing `readColors` would recover ~172ms. The
other six are the `data-theme` flip invalidating 855+ var-driven elements and
would remain.

### PARTIALLY CONFIRMED

**Architecture, Kafka focused: real paint cost, no actual jank.**
Worst case reproduces exactly - 15 dash-flow + 30 particles, **49 running
animations**. Paint is genuinely attributable to this section: **293ms across
306 paint events per 3s**, against **0ms / 0 events** when idle away from Hero.
That is the `stroke-dashoffset` cost §9 predicted, and it is real.

But it renders fine: **152 frames in 3s, median 18.0ms, zero long tasks**,
88% busy. **Do not optimise it on this evidence.**
*Correction:* an earlier note claimed Architecture triples per-frame
`Layerize`. It does not - 4.0ms per event here against 3.6ms per event at
scrolled-away idle. Layerize is a page-wide background cost, not this
section's doing.

### DISPROVEN

**Card close CLS 0.26 - does not reproduce.** Zero `LayoutShift` events in a
fresh session; no `CLSCulprits` insight generated at all. The original shift
(score 0.2569) impacted `SECTION#projects` with its rect widening 472 → 488,
i.e. ~13 CSS px - a scrollbar appearing. In a fresh mobile session
`innerWidth === clientWidth === 390` and `body padding-right: 0px` both before
and during the open modal, with `overflow: hidden` and `data-modalOpen` set
correctly: there is no classic scrollbar to compensate for, so nothing shifts.
*Not disproven for desktop* - `useModalBehavior`'s padding compensation simply
was not exercised here, and no desktop trace was taken.

### Session artifacts - NOT optimization targets

The following were reported as severe and are **not code behaviour**. They came
from one long-lived renderer that had already run the intro, a modal cycle and
a synthetic touch-stress loop (§3A). Re-measured on the *same unmodified code*
in a fresh session:

| Interaction | Reported (degraded) | Fresh, same code |
|---|---|---|
| Avatar follow, 3s | 93% busy, 56 frames, med 46.3ms, **11 long tasks** | 84%, **179 frames, med 16.4ms, 0 long** |
| Menu close, 1.5s | 86%, 26 frames, med 39.7ms, **6 long tasks** | 92%, **74 frames, med 17.7ms, 0 long** |
| Card open, 1.5s | 66%, **6 frames**, med 98.8ms, **5 long tasks** | 90%, **64 frames, med 20.6ms, 0 long** |
| Idle at Hero, 3s | 90% busy, 69 frames, med 36.8ms | 79%, 179 frames, med 16.7ms |

**Avatar follow and menu close are smooth and are not bottlenecks.** Card open
was already fine and improved further after P0-2 (busy 90% → 77%, frames
64 → 72, median 20.6 → 17.7ms, Style 284 → 248ms, Layout 78 → 56ms, Paint
46 → 32ms) - it was the interaction most starved by idle work, as predicted.

**The "8892ms initial mount" was also a session artifact.** It was reported as
one `RunTask` of 8892ms containing a single `Layout` of 3384ms with **5 frame
commits in 14 seconds**, and described at the time as a fresh load. It was a
*reload* - the document was new, the **browser was the degraded one**. A
genuine cold load in a fresh isolated context, two runs:

| | Reported | Fresh cold load |
|---|---|---|
| Largest task | 8892ms | **373 / 331ms** |
| Largest single `Layout` | 3384ms | **8 / 13ms** |
| Frame commits in trace | 5 in 14s | **1388 / 1401** |

**There is no monolithic mount task.** What was real is the forced-reflow
attribution, and that is what the `SectionBigTitle` fix above addressed.

A reload is not a cold load, and it is not proof of a fresh browser. To
measure a real first visit: fresh isolated context on `about:blank`, start the
trace, *then* navigate.

Do not reopen any of these on the strength of the old numbers.

---

## 4. Current Features

Everything below is implemented and working unless flagged.

### Opening sequence - stable
`IntroOverlay.tsx`, `IntroParticles.tsx`, `useIntroSequence.ts`,
`introGeometry.ts`, `avatarLayout.ts`.

One continuous `elapsed` motion-value clock (`INTRO_TIMELINE`) drives every
stage, so nothing can drift. Dots are the **real vertices** of the avatar's
icosahedron projected through the avatar's own camera, and the lines are its
real edges - the 3D avatar resolves in on top of its own finished wireframe,
so there is no geometric discontinuity. Flow: dots emerge → converge → edges
draw → avatar solidifies → typewriter caption → arrow button → circular
clip-path reveal into the site → avatar flies to its hero dock.

The arrow button supports both click and drag-to-scrub the reveal.

### Developer avatar - stable
`DeveloperAvatar.tsx` (position/scale/opacity), `DeveloperAvatarScene.tsx`
(the r3f scene), `avatarLayout.ts` (pure layout maths).

Lazy-loaded via `React.lazy`; the three.js chunk (~883 kB / 234 kB gzip)
never enters the main bundle. **Renders on mobile as well as desktop** as of
this session. Purely decorative: `pointer-events: none` on both the wrapper
*and* the r3f `<Canvas>` inline style (r3f forces `auto` on its own wrapper,
which silently beats an inherited `none`).

- **Desktop**: follows the cursor, scaled by how far past Hero you have
  scrolled. Docks beside the hero copy, shrinks to a companion after.
- **Mobile**: follows the finger continuously at `TOUCH_FOLLOW = 0.88` with
  120ms exponential smoothing, so it trails rather than sticks. Nothing
  resets on lift - the samples simply stop arriving and it settles.
- **Smoothing is tuned per input, and the loop is delta-driven.** Touch uses
  `TOUCH_SMOOTHING_TAU_MS = 55`, mouse keeps `SMOOTHING_TAU_MS = 120`. One
  value for both is why touch felt disconnected: a cursor is already where the
  visitor is looking so the avatar may drift lazily behind it, but a finger is
  *on the glass* and the eye tracks it directly, so 120ms (≈63% of the gap
  closed per 120ms) reads as failing to keep up rather than as a trail.
  `TOUCH_FOLLOW` is `0.94`, not `0.88` — the old value left a permanent 12%
  shortfall on top of the smoothing lag.
- **Every delta is clamped** (`MAX_FRAME_MS = 64`, and `MAX_FRAME_SECONDS` for
  the eyes). Unclamped, one long frame — GC, a dropped frame on a mid-range
  Android, a backgrounded tab — drives `alpha` to 1 and the avatar teleports
  onto the finger. That is the "sudden catching up after fast movement": a
  delta problem, not a smoothing one.
- **No layout read is left in the loop.** `window.scrollY` was read every
  frame *after* the previous frame wrote `x`/`y`/`scale`, so each frame forced
  a synchronous style/layout flush across the boundary. It is cached from a
  passive `scroll` listener now. Measured **180 reads per 180 frames → 0**.
  (The older comment in that file about removing the `offsetHeight` reads was
  correct about those and missed this one — check the whole loop, not the part
  a comment claims is clean.)
- **The eyes' lerp is delta-based** (`EYE_TAU_SECONDS`), not a fixed 0.06 per
  frame. A per-frame constant silently couples tracking *speed* to render
  rate, so at the throttled touch rate the eyes closed the gap 32×/s instead
  of 60×/s and tracked at roughly half the body's speed — which is what
  desynchronised them from it.
- `will-change: transform` on the moving layer is deliberate and is the one
  place §11's "don't blindly add it" does not apply: that element's transform
  is rewritten every frame for the whole visit. One element, not a blanket.
- **Two rAF loops, not three, and neither runs behind a modal.** Measured at
  idle: **3 rAF loops per frame** (avatar position loop, r3f's render loop,
  HeroBackground). r3f defaults to `frameloop="always"` — it re-renders the
  WebGL scene every frame for the whole visit whether anything changed or not.
  It is now `frameloop`-switched in `DeveloperAvatarScene`:
  - `never` while a project modal is open,
  - `demand` on a coarse pointer, driven by `FrameDriver` at `TOUCH_FPS = 32`
    (one throttled loop instead of an unbounded one — the scene is a slow idle
    float plus smoothed tracking, nothing in it needs 60fps). **`FrameDriver`
    is a `setInterval`, not a rAF loop, and must stay one** — as a rAF it was
    a second permanent 60Hz loop whose only job was to throttle to 32fps.
    `invalidate()` only marks the canvas dirty; r3f's own rAF still draws on
    the next vsync, so the rate is unchanged. The `document.hidden` guard
    replaces what rAF gave for free. See §3B,
  - `always` on desktop, unchanged.
- **The modal signal.** `useModalBehavior` sets
  `documentElement.dataset.modalOpen`; `observeModalOpen` in `pointerTracking`
  exposes it. The avatar's follow loop is torn down entirely while it is set
  (not checked inside the loop — no rAF, no listeners, no motion-value writes)
  and the canvas stops rendering. The avatar sits at z-40 behind a z-60 modal
  and an opaque scrim, so all of that was invisible work competing for the GPU
  with the card expansion the visitor is actually looking at. **Measured 3 →
  0.5 loops per frame while a modal is open.**
- **`src/utils/pointerTracking.ts` is the only place either loop subscribes
  to the pointer, and it must stay that way.** Listening to `pointermove`
  alone is the bug that made the avatar look like it only reacted to the
  *last* touch: the moment the browser decides a touch is a page scroll it
  claims the gesture, fires `pointercancel`, and stops sending `pointermove`
  for the rest of that touch, so the avatar froze at whatever the finger's
  last pre-scroll position was. `touchmove` has no such rule and keeps
  reporting through the whole gesture, so both are subscribed and whichever
  arrives first wins. **`pointermove`/`pointerdown` are ignored when
  `pointerType === "touch"`**: a touch fires both families for the same finger
  sample, and with two subscribers that was four handler bodies per sample
  (measured 2 invocations per sample per subscriber). Touch keeps the
  `touchmove` path, mouse and pen keep the pointer path, and neither device
  runs the other's work. Verified: after a synthetic `pointercancel` the avatar
  had barely moved (193,593), then tracked to (79,326) on `touchmove` alone.
  Every listener is passive and nothing ever calls `preventDefault` -
  scrolling measured unaffected, `touchmove.defaultPrevented` false, and
  `elementFromPoint` at the avatar's centre returns the page beneath it.
- **Opening screen**: a *separate bounded offset* (`INTRO_LEAN_PX = 46`) on
  an outer wrapper. It has to be separate: the intro clock owns the inner
  `x`/`y` and resumes the moment the arrow is pressed, so a follow loop
  writing the same values would fight the flight to the dock.
- **Eyes**: the whole group rotates toward the pointer, capped
  (`rotation.y = pointer.x * 0.35`, `rotation.x = pointer.y * 0.2`). Vertical
  is **not** inverted - `pointer.y` is screen-space, not NDC, and a previous
  extra negation was the bug. Do not "fix" it again.

### Theme toggle - stable, historically fragile. See §5.

### Navbar - stable
`Navbar.tsx`. Floating pill, `LiquidIndicator` for the active item, magnetic
hover on labels, and **drag-to-navigate**: dragging the indicator activates
sections in real time (not on release), with hysteresis so the bubble never
rests between items.

**Mobile menu.** Opens as one gesture, not a panel that fades in with a list
inside it. The hamburger is three spans that *become* the close mark (outer
two travel to the middle and cross, middle thins from its centre) — transform
and opacity only, no path morphing. The panel unfolds from that button's own
corner (`transformOrigin: top right`) and the items follow on a stagger;
closing runs the stagger backwards (`staggerDirection: -1`) so the items
retreat before the panel folds after them. `menuPanel`/`menuItem` variants.

Nothing animates height or any other layout property. The items' staggered
`y` is safe next to `LiquidIndicator` specifically because that measures
`offsetTop`/`offsetLeft`, which transforms do not affect — switch it to
`getBoundingClientRect` and the indicator will slide around during the open.

Rapid open/close is safe by construction: every bar and item animates
independently to its own resting state, so an interrupted run re-targets from
wherever it is. Verified — six rapid toggles alternate cleanly and settle at
`transform: none` / `opacity: 1`, body overflow restored, at 360/390/430.

The panel is **glass**: `bg-bg/70` with `backdrop-blur-md` on a phone (`xl`
only from `sm:`), plus `backdrop-saturate-150`, which does most of the frosted
work at a fraction of the cost of a larger blur radius.

### Opening and closing are tuned differently on purpose

**Open is an under-damped spring, not keyframes.** The overshoot, the
compression back and the secondary wobble all fall out of the physics, which
is what keeps it from reading as a cartoon bounce. The axes are deliberately
tuned apart — height is the dimension actually growing so it carries the
bounce (`damping 15`), width only breathes (`damping 20`). **That difference
between the axes is the liquid part; a uniform scale just looks springy.**
Opacity is fast (150ms) and separate, so the panel is fully present *through*
the bounce rather than fading in during it. Measured: scaleY
`0.70 → 1.091 → 0.978 → 1.009 → 1.000`, scaleX only `0.90 → 1.017 → 1.000`.

**Close is authored keyframes, and `opacity` is the line that matters.** A
spring has no deterministic end and this one must finish so `AnimatePresence`
can unmount. The old exit ran `opacity 1 → 0` across its whole 220ms while
scale moved only `1 → 0.9`, so the panel had faded out before it visibly did
anything — which is exactly why closing read as the menu *disappearing*
rather than moving. Opacity now holds at 1 through the compress and the
overshoot (`times: [0, 0.62, 1]`) and only drops at the end, so the collapse
is what the eye follows. Measured: scaleY overshoots to `1.040`, then
`0.622 → 0.441 → 0.422`, opacity `1` until 200ms, unmounts at ~280ms —
**6 visible frames instead of a fade.**

Items settle *inside* the container on the way in: their spring is stiffer and
better damped than the panel's, so they come to rest while the panel is still
finding its last few percent. That lag is what makes them read as contents of
a liquid object rather than a second animation running alongside it.

**The close is a spring, and it must stay one. Do not rewrite it as
keyframes.** It was keyframes twice, and the second attempt caused a visible
jump that took two rounds to pin down:

`scaleY: [1, 0.94, 1.04, 0.42]` on `times: [0, 0.22, 0.44, 1]` looks like a
reasonable compress-overshoot-collapse. But **Framer eases each keyframe
segment separately**, so segment two decelerated to a standstill at 1.04 and
segment three — carrying almost all of the travel — restarted under
`ease.standard` (`[0.16, 1, 0.3, 1]`), which launches fast and decelerates.
The panel was momentarily still and then leapt: measured **1.040 → 0.651 in a
single 35ms step**, against 0.04 in the step after. A velocity discontinuity at
a segment boundary, not a dropped frame, and no amount of duration or easing
tuning fixes it while the shape stays segmented.

A spring cannot do that: it integrates from the current value *and* velocity,
so there is no boundary to jump at, the first closing frame continues exactly
from the open state (including mid-open, if closed while still bouncing), and
the mild undershoot past the target is the reverse jiggle falling out of the
physics rather than being drawn by hand.

**Children lead by a beat rather than being fully sequenced.** An earlier fix
used `when: "afterChildren"`, which is right about the competing work — nine
items on a 22ms stagger with a 150ms exit were still animating ~348ms in while
the container collapsed across its whole 360ms, so every collapse frame also
animated nine elements inside a blurred, shadowed, scaling box — but it left
~280ms where nothing moved but item opacity, a dead pause that broke the sense
of one motion. A tight stagger (8ms) plus a 70ms delay on the container keeps
the items clear of the expensive part without the wait.

**`backdrop-filter` is dropped for the collapse phase only.** A static
backdrop-filter still re-samples and re-blurs everything behind it on *every
frame the element transforms* — unlike `box-shadow`, which a promoted layer
rasterises once and then just scales. It was the most expensive paint on the
page running for every frame of the collapse. `when: "afterChildren"` means
the switch lands after the items are already gone, so the boundary is not
visible. Write it as `blur(0px) saturate(1)`, **never `"none"`**: Framer
resolves `"none"` component-wise against the previous value, which turns
`saturate(1.5)` into `saturate(0)` and greyscales the backdrop for the whole
collapse.

The opening is untouched by all of this and must stay that way — re-measured
after the close rework: `0.70 → 1.051 → 0.977 → 1.009 → 1.000`, items visible.

**Measured status: menu close is fine.** A fresh-session trace records 74
frames in 1.5s at a 17.7ms median with **zero long tasks** (§3B). An earlier
profiling pass reported it as the expensive phase with 6 long tasks; that was
a degraded renderer, not this code. Do not rewrite the close for performance.

Harness note, and it matters for anyone trying to verify this: **frame-level
smoothness cannot be measured by sampling `getComputedStyle` in this
sandbox** — use a Chrome DevTools trace (§3A). rAF runs at roughly 14fps
here even with a pump loop, so sampling `getComputedStyle` produces gaps that
look exactly like stutter — a naive read gave a 31x "velocity spike" that was
purely a sampling artifact. Measured overall timing here even reports the
close as *smoother* than the open (median 16.7ms vs 33.3ms frame delta). The
keyframe discontinuity above was identified from the segment structure and the
easing semantics, and confirmed by a step size 5x its neighbours in a run
where the sampling interval was uniform — not from a frame profile.

Nothing here sets `will-change` — Framer applies it only for the duration of
each animation, which is the behaviour §11 wants.

Verified at 390, both themes: 8 rapid toggles alternate cleanly and unmount
with nothing stranded; **re-opening mid-exit recovers to a fully open panel**
(`transform: none`, opacity 1, every item visible) rather than a half state;
drag-then-close navigates and leaves no drag state with body overflow
restored; no horizontal overflow; 0 console errors.

### Mobile drag-to-navigate

The desktop gesture turned on its side, with two differences forced by touch
and one bug worth not repeating.

- The open menu locks `body` to `overflow: hidden`, and a locked body **drops
  `window.scrollTo`** — so real-time scrolling would silently do nothing. The
  lock is released the moment a drag actually starts, not on open, so a
  stationary menu still cannot be scrolled behind.
- The list carries `touch-action: none`, scoped to that element only, so the
  browser never claims the vertical movement as a page scroll mid-drag.
  Nothing else on the page loses native scrolling.

**Crossing detection runs in the pointer handler (`updateMobileTarget`), not
in `getOverride`.** The desktop version resolves its target inside the
indicator's `getOverride`, which is called once per *rendered frame* — so
navigation only happens as often as that element re-renders. On mobile that
was erratic: crossings were missed and the active item lagged a step behind
the finger. Detecting in the pointer handler means a crossing is found on the
event that caused it, at input rate, whatever the renderer is doing.
`activateTarget` still fires only on a real change of item, so it cannot
restart the scroll on every sample, and `scrollToSection` cancels its own
in-flight run — nothing queues.

**`mobileScaleRef` is load-bearing, and its absence caused a genuinely
confusing bug.** Item geometry is cached from `offsetTop`/`offsetHeight` —
layout values, which transforms cannot reach — but the finger touches the
panel *where it is drawn*, and the panel is scaled by its own open spring.
Comparing a visual pointer position against layout centres mis-resolves every
target while the menu is still springing open (measured at `scaleY 0.9`,
putting every centre ~14% out and overshooting by a whole item). Dividing the
pointer's offset by the captured scale converts it into the space the centres
live in. With the panel settled the correction is a no-op — verified, scale
exactly 1 and all eight derived centres matching layout to the pixel.

Verified at 390: dragging Home → About → Skills → Experience → Projects →
Contact activated **every** item in order *during* the gesture with the page
scrolling before release; rapid direction changes (Skills → About → Projects →
Certifications) followed exactly; releasing on a boundary snapped to a real
item; `pointercancel` left no stuck drag state; six rapid toggles then a
normal drag still worked; desktop drag, 8 nav items and hidden hamburger all
unchanged; 0 console errors, no horizontal overflow, body overflow restored.

### Section headings - stable
`SectionBigTitle.tsx`. **Exactly one heading per section.** An oversized
`font-mono` word (the JetBrains Mono stack, matching the Hero's "Hi, I'm
Mukul Negi") scales down as the section scrolls in, then the subtitle and
content stagger in beneath. `inline-block` is load-bearing: as a block-level
`h2` it stretched full width and scaling it overflowed the viewport on
mobile. Headings render in `text-accent`.

A previous "duplicate headings" bug was caused by call sites passing the same
word as both `eyebrow` and `bigWord`. The `eyebrow` prop is gone. Do not
reintroduce a second heading system.

### About / Skills / Experience - stable
`SkillsExplorer.tsx` uses `LiquidIndicator` for categories and a card stack
for descriptions. **Subskills are deliberately plain buttons** - see §7.

`ExperienceTimeline.tsx` renders either thematic `groups` (Fincart) or
`projects` (DevTown) per entry. Order is oldest-first at Mukul's request.

### Certifications - stable
`Certifications.tsx`, `CertificateCard.tsx`, `CertificateLightbox.tsx`,
`src/data/certificates.ts`.

CSS **columns**, not a grid: a grid locks rows to the tallest cell and one
A4-portrait certificate left half a screen of dead space. Each preview keeps
its document's real aspect ratio - nothing is cropped or letterboxed.

The lightbox is a **physical card deck**, not a fade. Direction-aware
(`enter` +240px / `exit` -360px, mirrored), rotation and scale derived from a
single `x` motion value so a dragged card tilts exactly like a released one.
Drag with velocity-aware commit at 110px, spring-back below it, arrow keys,
wrapping at both ends, and `layoutId` only on the certificate the modal was
opened from. **Do not simplify this back to a fade or a plain grid.**

Previews are generated by `scripts/render-certificate-previews.mjs`
(`node scripts/render-certificate-previews.mjs`) because no PDF rasteriser is
installed on this machine. `pdfjs-dist` and `@napi-rs/canvas` are
devDependencies and never ship.

### Projects - stable
`ProjectCard.tsx`, `ProjectDetailsModal.tsx`. Shared-element expansion via
`layoutId`. See §8 for the glitch fixes, which are done.

### Architecture - stable, recently rebuilt. See §9.

### Contact - **complete, including real email sending.** See §10.

---

## 5. Theme Toggle - History and Current State

**A lot of work went into this. Do not casually rewrite it.**

Files: `useTheme.ts` (state + persistence + `data-theme`),
`useThemeToggleController.ts` (click + drag state machine),
`themeTransition.ts` (View Transitions API circular reveal),
`ThemeToggle.tsx` (presentation).

- **Click** either direction runs a full circular reveal originating from the
  toggle's screen position.
- **Drag** scrubs that same reveal live via WAAPI `Animation.currentTime`,
  exponentially smoothed. Release commits past 50% or on flick velocity.

### Reveal origin — the thumb, not the track

`useThemeToggleController` takes an optional `originRef`; `ThemeToggle` passes
the **knob**. The reveal opens from the thing the finger is actually on, and
the thumb sits up to 11px from the track's centre — small on a desktop, but
visibly off-centre on a phone. Measured live at every gesture and never
cached, via `getBoundingClientRect`, which is viewport-relative and therefore
the same space the reveal's `clip-path` circle resolves in: correct at any
scroll offset, with no document/viewport mix to get wrong. It also picks up
the knob's live `x`, so a part-way drag opens from where the thumb really is.

Verified: origin `328.4` against a thumb centre of `328` where the track
centre was `318`; still exact after a 3457px scroll; and correct for drag.

### Two bugs that were hard to find. Do not reintroduce them.

1. **Overlapping transitions.** Every new `startThemeReveal` must cancel the
   in-flight one. Without it, `document.startViewTransition()` calls piled up
   full-page GPU snapshots and the page went black.
2. **Stale cleanup wiping the attribute.** `transition.finished.finally()`
   removed the shared `data-theme-transition` attribute *unconditionally*.
   When a second toggle superseded a running one, the superseded transition's
   `finished` settled **after** the new reveal had set the attribute, and
   deleted it mid-flight - which removed the CSS clip-path and z-index
   ordering, producing "instant flash to dark". The fix is a guard: only the
   currently-active transition may tear the attribute down. Both fixes were
   verified in a real non-hidden Chrome.

### Current appearance (visual only)

**The toggle is plain, and that is the settled state.** A neutral
`bg-bg-subtle` track, a neutral `border-border` border, and an ordinary
`hover:border-border-strong` — the same border-colour hover every other
bordered control on the site uses. Nothing else.

**No glow.** The accent-tinted border and the `box-shadow` ring that deepened
on hover/hold are gone: no `box-shadow`, no filter, no blur, no
pseudo-elements. Verified as computed styles, not by reading the class list.

**No accent fill in the track either.** An accent-coloured track was tried
(a `--toggle-track` token, blue in light / green in dark, with the opaque knob
masking the unexposed part) and then reverted at Mukul's request — he wanted
the original neutral track back. The token was deleted from `index.css` rather
than left dangling; `grep toggle-track src/` returns nothing. **Do not
reintroduce either the glow or a coloured track** unless he asks: both have
now been explicitly rejected.

Size unchanged at 56x32. The knob keeps its own small `shadow-sm` elevation —
that is depth on the thumb, inside the control, not a halo around it, and it
predates all of this. **Click, drag, theme state and circular-transition logic
were never touched through any of it.**

Verified after the revert: light track `rgb(244,244,245)` / border
`rgb(228,228,231)`, dark track `rgb(23,26,24)` / border `rgb(35,39,42)`,
`boxShadow: none` and `filter: none` in both, no pseudo-elements, four clicks
alternate cleanly with `aria-pressed` matching the theme, no overflow,
0 console errors, `tsc` + `oxlint` + `build` clean.

Two harness artifacts seen while testing, **neither caused by this change**
and both explained by the rAF idle in §3: the knob does not visibly step
during a synthetic drag (the scrub loop is rAF-driven), and
`data-theme-transition` lingers on `<html>` after a click until frames are
pumped — it clears the moment a screenshot pumps them.

---

## 6. Opening Animation - Refinement State

The flow in §4 is fully implemented. Two refinements were made this session:

- **Dot emergence.** Dots used to be painted at 30% opacity the instant their
  turn arrived (`0.3 + arrived * 0.6`), so groups appeared at visible strength
  out of nothing. Each dot now fades from zero over its own 300ms window that
  starts **170ms before** it begins travelling (`APPEAR_MS`,
  `APPEAR_LEAD_MS`), with its radius growing in alongside. Appearance and
  convergence are therefore one continuous event with no still moment
  between them.
- **Canvas batching.** Edges and dots were each their own
  `beginPath`/`stroke` pair because each carries a different depth alpha -
  measured at **39.6 draw calls per frame**, peaking at 162. Alphas now round
  into 8 buckets drawn as one path each: **5.5 per frame**, at most 16.
  Positions are written into pre-allocated `Float32Array`s instead of 42
  fresh objects per frame.

**Not visually confirmed:** the first ~300ms of emergence. The harness cannot
capture it (see §3). Verified by construction and by the draw-call
measurement. Worth a look on a real phone.

---

## 7. Liquid / Magnetic System and the Subskill Pitfall

Magnetic pull, liquid indicators and jiggle feedback are used on the navbar,
buttons, tags, skill category tabs, project filters, architecture nodes and
certificate cards. UI should feel tactile, playful and alive.

**Historical pitfall - read before adding animation to a list.** The subskill
section broke three times when the liquid/card-stack interaction was applied
to it: the animation wrappers interfered with the natural flex/grid layout.
After several failed patches, the decision was to **roll back the animation
from the subskill section only**, keeping the card stack and the category
indicator. The subskills are now plain `motion.button`s with a hover lift and
tap scale, and their layout is owned entirely by the grid.

**Do not reintroduce a card-stack or absolutely-positioned animation into the
subskill list.** If a list needs motion, structure first, animation layered
on top, and measure the layout before and after.

---

## 8. Projects - Glitch Fixes (done)

Mobile modal position is final: **centred, 16px each side, 358px wide on a
390px screen, `rounded-3xl`, safe-area insets**. Do not change it.

Two real causes of the opening/closing glitches were found and fixed:

1. **`whileTap` and `whileHover` sat on the same element as `layoutId`.**
   Tapping wrote `scale: 0.98` and hover wrote `y`/`rotate` to the exact
   element whose transform Framer's shared-layout projection was driving -
   two owners, one matrix. The card is now split: an outer element owns the
   layout id and nothing else, an inner one owns lift/tilt/press.
2. **Scroll lock reflowed the page mid-transition.** `overflow: hidden`
   removed the scrollbar, the page shifted by its width, and the card
   measured before that shift was elsewhere after it.
   `useModalBehavior.ts` now compensates with matching `padding-right`.

Also: the backdrop blur is `sm:` only (a full-viewport `backdrop-filter`
recomputing every frame was the biggest mobile cost), and the redundant
`layout` prop was removed from both card and modal.

Verified: normal open/close, open-then-immediate-close, 4x rapid cycles,
different cards in succession - always exactly one dialog, position
preserved, body overflow restored.

---

## 9. Architecture Section

`src/components/architecture/*`, data in `src/data/platformArchitecture.ts`.

Rebuilt from a generic 6-box flowchart into a system map organised around
**communication**, not dependencies.

- **Spine**: Client → API Gateway → Microservices Ecosystem → Kafka bus.
  A Service Registry hangs off the side in a dashed "not a request hop" style.
- **Four clusters**: Core Business, Financial Services, Supporting Services,
  Integration & Processing.
- **Two link languages, distinguishable without the legend:**
  - **Synchronous / REST** - solid line, primary accent, arrowhead, and **two
    chevrons** travelling it half a cycle apart.
  - **Asynchronous / Kafka** - fine dashes that themselves stream toward the
    destination, secondary accent, no arrowhead, plus riding particles.
  - Service discovery gets a third, quiet language: long dashes, no glow, no
    particles.

### How the flow animation works, and why it is direction-correct for free

`buildPath(from, to)` always starts its `M` at the source, so **every path is
drawn in its own direction of travel**. Everything else follows from that and
there is no per-edge direction flag anywhere:

- Particles ride `offset-path` from `offset-distance: 0%` to `100%`, so they
  travel source → destination whatever shape the path is.
- Chevrons use `offset-rotate: auto`, so they turn along the tangent and stay
  pointed correctly around every curve, corner and vertical run.
- The dash flow animates `stroke-dashoffset` `0 → -8`. Negative, because a
  decreasing offset moves the pattern *along* the path. One dash period is
  exactly 8 (`stroke-dasharray: 1 7`), so -8 lands the pattern back on itself
  and the loop is seamless — change the dasharray and this must change with it.
- Bidirectional pairs need nothing special: `edgesForFocus` already emits the
  outgoing edge *and* every inbound caller as separate edges, so they render
  as two opposite streams with their own arrowheads.

**Two chevrons per solid line, not one.** With one, the line stood empty for
the whole interval between it arriving and the next departing. The second is
delayed half a cycle, so it is already mid-path as the first lands.

The async **glow copy is deliberately not dashed** — a continuous soft halo
with dots streaming over it. Dashed, its static dashes sat under the moving
ones and read as two separate lines.

Cost, worst case (Kafka focused, the whole fabric lit): 15 dash-flow
animations plus 30 particle nodes, 49 running animations. `offset-distance`
resolves to a transform, but `stroke-dashoffset` is a paint-level property —
if the event fabric ever gets slow on a low-end phone, that is the thing to
cut first.

**Measured: it costs real paint but does not currently jank.** Fresh session,
390x844, 4x CPU: **293ms of paint across 306 events per 3s** (against 0ms when
idle away from Hero — so the paint is genuinely this section's), but **152
frames in 3s at an 18.0ms median with zero long tasks**. See §3B. Leave it
alone until a trace says otherwise.

### The keyframes MUST live at top level, never inside `@theme`

This was a real bug that shipped, and the symptom is deceptive: the particles
render in exactly the right places and never move.

**Tailwind v4 tree-shakes `@keyframes` declared inside `@theme`.** It emits one
only when an `--animate-*` theme variable references it, or when its name shows
up in an `animate-[...]` utility that Tailwind can see in the source. Both of
these animations are applied from an inline React `style={{ animation: ... }}`
in `ConnectionLayer.tsx`, which Tailwind never scans — so it dropped both from
the build. The elements still carried `animation: arch-travel ...` and computed
style still read `running`, but the keyframes did not exist, so nothing moved.

`@keyframes arch-travel` and `@keyframes arch-dash-flow` are therefore declared
at **top level** in `index.css`, outside `@theme`. If either ever moves back
in, it must gain an `--animate-*` variable and be applied as a utility class.

Diagnose this by grepping the built CSS, not the source:
`grep -o "@keyframes [a-z-]*" dist/assets/*.css`. Before the fix that listed
only `caret-blink` (which survives because `IntroOverlay` uses
`animate-[caret-blink_...]`, a utility) and Tailwind's own `pulse`.

`document.getAnimations()` is the runtime tell: **0** entries for a keyframe
name that is missing, 18 + 1 once it exists. Do not conclude "the harness
doesn't run CSS animations" from an empty result — this sandbox runs them fine.

Speed matters too: the dash flow shipped at 8 units per 1.1s (~7px/s), which is
technically moving and visually static. It is 0.5s now (~16px/s), the
marching-ants cadence.

**Harness note:** `getComputedStyle().transform` on an SVG child is in a
different space from SVG user units — convert through `svg.getScreenCTM()`
before comparing, or the numbers are nonsense. Verified after the fix:
`offset-distance` progressing 51.9% → 8.3% → 64.8% across samples, a chevron
travelling 71px, dash offset cycling within `0 … -8`, the two chevrons always
on opposite halves, and visible particle displacement between two consecutive
screenshots.
- Connection lines carry a **subtle glow** (a blurred wider copy beneath the
  sharp one, two strengths). Not neon.
- **Progressive disclosure**: the resting view draws 4 connections, not 40.
  Focusing a node draws only its edges. Focusing Kafka lights the whole event
  fabric. **The resting connections animate too** — see below.

### The connection layer is drawn at every size (was `hidden lg:block`)

Two separate things made the flow invisible on a phone, and neither was a
reduced-motion check, clipping, a `viewBox` problem or a second mobile
diagram:

1. **The whole layer was `display: none` below 1024px.** The container in
   `SystemMap` carried `hidden lg:block`, on the reasoning that curves between
   stacked columns would cross the content rather than explain it. It is
   drawn at every size now. The geometry needed no work at all: paths are
   built from live measured boxes (`useNodeGeometry` walks `offsetParent`), so
   a stacked layout already yields vertical runs down the spine rather than
   desktop curves — verified, the mobile SVG measures 335x1010 with paths like
   `M 168 34 C 168 52 168 40 168 58`.
2. **Particles were gated on `!dim`, and `dim` is `!focusId`.** `focusId`
   comes from *hover* on a desktop, so moving the mouse across the map kept
   something focused and the flow was always on screen — which hid the fact
   that **the resting state was static on desktop too**. A phone has no hover:
   nothing is focused until a node is tapped. The resting spine now animates
   at every size, at `opacity 0.6` and `restFactor 0.75` so it still reads as
   structure rather than competing with a focused connection.

**The layer sits behind the content, and that is what makes it acceptable on
a phone.** It is an `absolute inset-0` sibling that comes *first* in DOM, with
the nodes in `relative` flow after it, so cards paint on top. The cluster
panels are `bg-bg-subtle/50`, so a focused cross-cluster edge reads *through*
them as depth; the service nodes themselves are opaque and occlude it
completely. Verified with `elementFromPoint` over a crossing point — the
service button hit-tests on top, not the SVG. If the layer is ever moved later
in DOM or given a `z-index`, that trade collapses and the original reason for
hiding it on mobile comes back.

Verified: mobile 390 resting — 12 `arch-travel` animations, particles
advancing, no horizontal overflow; focused — 18 animations plus the dash flow;
desktop 1440 resting — 18 animations and moving, focused unchanged.

### Batch Processing
Modelled as **scheduled/background work, not a business microservice**:
"Automated jobs, synchronization workflows, and cron-based tasks that run on
a defined interval rather than on a request." Named jobs: insurance
processing, portfolio synchronization, transaction synchronization, scheduled
cron workflows. Rendered with a dashed border, borrowing the registry's
"never in the request path" cue.

### Third Party Service and vendors
The single integration boundary. Hovering it opens a light **branch tree**
(not vendor cards - those made the boundary compete with its own children),
two columns, names only, with provider notes surfacing in the detail card
below. Domains and vendors:

| Domain | Vendors |
|---|---|
| Payments | BillDesk (mutual fund transactions, mandates), Easebuzz (unlisted transactions) |
| Financial Data | MF Central, Finvu (bank/account syncing) |
| KYC | Digio (identity verification) |
| Insurance | OneAssure (health), HDFC / HFFC, Bajaj, other term insurance partners |
| Lead Management | LeadSquared |

Vendors without an unambiguous scope carry **no description**, deliberately.

**Zero layout shift on reveal**: the tree holds its space whether showing or
not and only opacity animates. An earlier height-animated version grew the
ecosystem panel by 66px on hover and shoved the page. Do not revert that.

Content is a **portfolio-friendly abstraction**, not a production topology.
Event names are generic descriptors. Keep it that way.

---

## 10. Contact - COMPLETE

**Do not re-implement. This works end to end and was verified with a real
send using Mukul's live Resend key.**

### Architecture

| File | Role |
|---|---|
| `api/_contact.ts` | All logic: validation, sanitisation, rate limit, payload build, provider call. No framework dependency. |
| `api/contact.ts` | Deployed endpoint. Web `Request`/`Response`, edge runtime. Runs on Vercel as-is. |
| `vite.config.ts` | `contactApiDevServer()` plugin mounts the **same** module at `/api/contact` in `npm run dev`. |
| `api/_contact.test.mjs` | 12 assertions against a stubbed provider. Run: `node --experimental-strip-types api/_contact.test.mjs` |
| `src/utils/contactService.ts` | Client POST. Throws on failure so the form's existing try/catch drives its error state. |

Provider is **Resend over plain `fetch`** - no SDK, so no runtime dependency
and it ports to any runtime. Moving off Vercel means writing a thin adapter
around `_contact.ts`, not a rewrite.

### The email

```
To:        CONTACT_EMAIL
From:      EMAIL_FROM  (verified sender)
Reply-To:  visitor's address
Subject:   Connecting via Portfolio from <name>
Body:      header block, then the visitor's message as the main content
```

The visitor's address **cannot** be the real `From` - sending as a domain you
do not control fails SPF/DKIM and gets rejected or spam-filed. `Reply-To` is
the correct mechanism and replying reaches them directly.

**Phone**: the form has Name/Email/Message only. The endpoint accepts a phone
and prints it *only when supplied*, so no empty row is emitted. Adding a
visible phone field would mean changing the contact section's design, which
was explicitly out of scope. Offer it; do not assume it.

### Security

Server-side re-validation (the browser check is convenience only),
control-character stripping with newlines removed from anything reaching a
header (verified `Evil\r\nBcc: victim@example.com` cannot forge a header),
length caps, a honeypot returning a normal 200 while sending nothing, and
rate limiting at 3/minute/IP.

The rate limiter is **in-memory and best-effort** - serverless runs multiple
instances, so it bounds a burst against one instance rather than guaranteeing
a global cap. Documented as such in the file. A hard cap needs Redis or
gateway limiting.

### Environment

`.env` exists locally with Mukul's real key and is **git-ignored**
(`.env`, `.env.*`, `!.env.example`). `.env.example` documents all three.

```
RESEND_API_KEY   # server-side only, never in the bundle
CONTACT_EMAIL    # mukuknegi2005@gmail.com
EMAIL_FROM       # currently Portfolio <onboarding@resend.dev>
```

**Open item:** `EMAIL_FROM` is still Resend's shared sender, which only
delivers to the account owner. Real visitors' messages will not arrive until
Mukul verifies his own domain in Resend and updates this. Flagged to him.

### UX (all verified)

Empty submit → 0 requests, 3 validation messages. Loading → "Sending…",
disabled. Triple-click → **1 request** (guarded by a ref, not the async
status). Failure → values **retained** for retry. No `alert()` anywhere.

### The letter (UI only — the endpoint above is untouched by it)

`ContactForm.tsx` renders the form as a **letter being written and posted**,
not as a panel of inputs. `Contact.tsx` no longer wraps it in a card: the
paper is its own surface.

- Fields are sentence lines on a rule — "My name is ___", "and you can reach
  me at ___", "I wanted to say ___". Each lead-in **is** the field's real
  `<label htmlFor>`, so the prose and the accessible name are the same string;
  none of it is placeholder-as-label.
- **A single-line field and the message body get different focus treatments,
  deliberately.** A one-line field lights its one rule. The body is a whole
  writing surface, so focus is a soft accent wash and a quiet border around
  the *entire* block, fading in on opacity. Giving the body both treatments
  was a real bug: it carried the ruled-paper gradient *and* the single-line
  bottom rule, so focusing a five-line area lit exactly one line — the last
  one — which also sat 5px below the final gradient rule and broke the
  spacing. The body has no bottom rule at all now (`isBody` in `WrittenLine`).
  Do not give it one back.
- Rule geometry lives in one constant, `RULE`. `RULE.line` is both the
  gradient's period and the textarea's `line-height`, which is what keeps every
  rule exactly one line apart and puts typed text *on* the rule. Measured: 5
  rules, every gap exactly 26px. `background-attachment: local` so the rules
  track the text if the body is ever scrolled.
- A corner stamp inks in as the letter is completed (0–3 valid fields, derived
  from `validateContactForm` so it can never disagree with the submit path).
  The Send button *looks* like it fills in at 3/3 but is **never disabled
  while incomplete** — a button that cannot be pressed can never produce the
  validation messages.
- Sending is one continuous sequence over **one DOM element**, driven by a
  single `runDelivery` chain with the stage lengths in `STAGE`:
  `writing → sealing → flying → delivered`. The paper's own box animates down
  to envelope proportions, a clipped triangle rotates shut as the flap, a wax
  seal springs on, then the same element arcs away and comes back as the
  confirmation. Nothing is swapped for a separate "envelope component".
- The request starts **before** the fold so the paper moves while the network
  call is in the air, but `delivered` is gated on the API actually succeeding.
  A failure unwinds the same chain: the letter opens back out at exactly its
  measured size with everything the visitor typed still in it.
- A wrapper holds the letter's measured height for the whole sequence, so the
  page below never moves. Reduced motion skips every phase and keeps the plain
  status-text flow.

- **"Write another" is the send run backwards**, not a swap back to the form:
  `unsealing` contracts the confirmation into the sealed envelope it arrived
  as, the seal lifts, the flap opens, and the paper unfolds into a blank
  letter. `Envelope` drives the same three parts through the same three
  `STAGE` lengths in the opposite order. Its opening targets are **two-value
  keyframes** (`[1, 0]`, `[0, -160]`, `[1, 0.15]`) so each part snaps to its
  sealed state on the first frame and animates out of it — entering
  `unsealing` from `delivered` finds every part already open, and animating
  "to open" from open would be a no-op. The unfold animates back to
  `height/width: "auto"` and lets Framer measure the blank letter, whose
  height is not knowable before it renders.

**One owner per property.** Springing the card's `scale` on the return while
Framer was still resolving its `width`/`height` back to `auto` made the two
fight over one matrix and the card measured **21943x12836** for a frame. The
return is now a single instant `set`, and `Delivered` owns its own emergence.
Do not reintroduce a *layout or transform* animation on the card at that
handoff. The opacity fade that is there is safe and load-bearing for a
different reason: releasing `height` to `auto` while the spent letter is still
the only mounted child resolves it to the *letter's* height for ~34ms before
`Delivered` takes over, which measured as an empty 539px card flashing.
Holding opacity at 0 across the handoff hides it; opacity takes no part in
layout projection, so it cannot bring the scale race back.

Measured through Playwright, both themes, 1440 / 390 / 360: fold interpolates
continuously (532x521 → 340x208), unfold runs 311 → 208 → 548, **zero page
drift** across the whole cycle (the wrapper holds the measured height),
`scrollWidth == clientWidth` at every sample, no size spike, 0 console errors,
form blank and interactive when the unfold lands, and the envelope width
clamps to the card's own width so it can never exceed its column.

Harness caveat: `rAF` idles at ~2fps here unless a screenshot loop pumps it,
so intermediate frames only appear when one is running. Stage *ordering* is
verified from computed transforms (the seal reads `scale(1)` on the first
frame of `unsealing`, proving the snap-to-sealed keyframe), not from frames.

---

## 11. Design and Interaction Principles

- **Do not redesign working sections.** Targeted refinements over rewrites.
- **Preserve the visual identity.** The site has a strong, deliberate
  direction. New work extends it; it does not introduce a second language.
- **Animation must feel connected.** No sequence where one element vanishes
  and another appears. Motion should read as one continuous physical event.
- **Motion needs a reason** - state change, user action, or scroll position.
  Nothing animates constantly for decoration.
- **Content lives in `src/data/`.** Never hardcode copy in JSX.
- **Never invent facts.** No fake URLs, employers, metrics or vendor
  descriptions. If a detail cannot be determined, ask.

### Performance rules (learned the hard way this session)

Prefer `transform`, `opacity`, motion values, refs, `requestAnimationFrame`.

Avoid:
- React state updates per animation frame.
- Layout reads inside movement loops. The avatar loop was calling
  `offsetHeight` **189 times across 60 frames** - a forced synchronous layout
  every frame. Now cached and re-measured on resize: **0**.
- `getBoundingClientRect()` per pointer event. The r3f scene did this on every
  `pointermove`; now cached and refreshed on a frame budget.
- Competing animation loops writing the same value.
- Full-viewport `backdrop-filter` during movement.
- Nested scaled subtrees. Seven sections each scaling their whole content,
  with `SectionBigTitle` scaling inside them, forced glyph re-rasterisation at
  a compound scale every scroll frame. Compact viewports now drop the
  section-level `scale` and keep opacity + y; the heading keeps its own scale
  and is the one element given `will-change: transform`.
- Animation loops that run off-screen. `HeroBackground` ran its full field
  (45.6 draws/frame) for the entire visit; it now pauses via
  `IntersectionObserver` and resumes on return.

**Do not blindly add `will-change`, and do not optimise working code without
measuring first.**

---

## 12. Testing Expectations

Verify in a real browser through Playwright MCP. Measure; do not assert from
reading code alone. **Performance claims go through Chrome DevTools MCP
instead - see §3A for which server answers which question.**

- **Desktop 1440**: cursor/avatar, theme toggle both directions, project
  cards, navbar drag, certificate lightbox.
- **Mobile**: small 360x740, standard 390x844, large 430x932.
- **Both themes**, every time.
- Touch paths need the `matchMedia` override from §3.

Always check: no console errors, no horizontal overflow
(`scrollWidth <= clientWidth`), no layout shift, no stale animation state
after rapid interaction, and a regression sweep of the untouched sections
(section count, nav items, skill tabs, project cards, certificate cards,
architecture nodes, contact fields).

---

## 13. Known Risks and Gotchas

1. **`pkill -f vite` does not work here.** Git Bash cannot reach Windows
   processes. Five dev servers accumulated in one session, each new one
   binding a higher port while tests hit a stale instance on 5173. Use
   PowerShell `Stop-Process`, and always confirm which port answered.
2. **Vite restarts the dev server when `.env` changes**, which re-runs the
   plugin and reloads env. Convenient, but it means "did my change take
   effect" needs checking rather than assuming.
3. **A locked file kills the dev server.** Vite watches the whole root; a PDF
   open in a viewer threw `EBUSY` and took the process down. `Certificates/`
   is now excluded via `server.watch.ignored`.
4. **HMR can serve a half-updated module** during multi-step edits, producing
   errors that vanish on a full reload. Confirm with a reload before
   diagnosing.
5. **`src/data/architecture.ts`** now only exports `principles`; the old
   `architectureNodes`/`architectureConnections` were removed with the old
   visualiser.
6. **`Certificates/` (11 MB) is not git-ignored.** Decide before the first
   commit whether the originals belong in the repo.
   `public/certificates/` (12 MB) **must** be committed - the site serves it.

---

## 14. Session Workflow

1. Read this file fully.
2. **Treat the repository as the source of truth**; this file documents
   decisions and status, not code.
3. Do not assume an old request was implemented because it was asked for.
   Check §0 and §4.
4. Before touching theme, drag, intro or scroll logic, read the actual files.
   They carry load-bearing comments explaining non-obvious races.
5. Make targeted diffs. No unrequested refactors.
6. After any change: `npx tsc -b --noEmit`, `npx oxlint`, `npm run build`,
   plus a browser regression check of adjacent interactions.
7. Report honestly. If something could not be verified in this harness, say
   so rather than implying it was seen.

---

## 15. Content Constraints

- `siteConfig.socials.linkedin` / `.github` are `undefined` **on purpose**.
  No real profile URLs have been supplied. Do not invent them.
- Real repo URLs that **do** exist: CloudEditor →
  `github.com/positron100/compile-palace` (note the repo name differs from the
  project name), CloudBook → `github.com/positron100/CloudBook`, plus the
  three DevTown project repos in `src/data/experience.ts`.
- All Fincart work content (BillDesk, Digio, OneAssure, RewardPort, AKTU
  degree, certifications) came verbatim from Mukul. Treat as ground truth;
  do not embellish with invented metrics.
- Certificate metadata in `src/data/certificates.ts` was read **off the
  documents themselves**. Do not "correct" it from memory. One known
  divergence from what Mukul originally described: the Ayurvedic dataset in
  the repo is a CSV, not the Kaggle JSON he mentioned, so the copy says "a
  public drug-prescription dataset".

---

## 16. Deployment (not yet done)

No git repository exists yet. Target is **Vercel** - a Vite SPA with an
`api/` directory deploys there with zero configuration, and the endpoint in
`api/contact.ts` is already written against that shape.

Short version:

1. Decide whether `Certificates/` goes in the repo; add to `.gitignore` if not.
2. `git init -b main`, `git add -A`, **confirm `.env` is not staged**, commit.
3. Push to a new empty GitHub repo under `positron100`.
4. Vercel → Add New → Project → import → defaults are correct (Vite,
   `npm run build`, `dist`). No `vercel.json` needed; there is no router.
5. Add `RESEND_API_KEY`, `CONTACT_EMAIL`, `EMAIL_FROM` to Production,
   Preview and Development **before** the first deploy.
6. Deploy, then verify the live contact form end to end and check the bundle
   contains no secrets.
7. Optional: custom domain, then verify it in Resend and update `EMAIL_FROM`.

Env var changes do not apply to an existing build - redeploy after editing
them.
