# Panvas Frontend, UI/UX & Visual Quality Guide

> [!NOTE]
> **Historical Document**: This document reflects early planning/development phases (August-September 2026). For the canonical v0.1.0 architecture and documentation, see [README.md](../README.md) and [docs/ARCHITECTURE.md](ARCHITECTURE.md).

> **Scope & Authority**: This document is the canonical design and frontend implementation authority for the **Panvas public website, landing page, download portal, marketing surfaces, documentation site, and web product presentation**. It provides architectural principles, art-direction references, motion standards, anti-vibe-code rules, and quality checklists for future frontend tasks. It may inform application UI where appropriate, but does **not** override established Panvas desktop/workspace application UX conventions (see [`docs/03_UI_SYSTEM.md`](./03_UI_SYSTEM.md) and [`docs/codebase/14_TOOLBAR_AND_UI_SYSTEM.md`](./codebase/14_TOOLBAR_AND_UI_SYSTEM.md)).

---

## 1. Core Design Principle

**Panvas frontend work must feel intentionally designed, not AI-assembled.**

The objective is **not** to "make it look expensive" or apply trendy visual effects. The objective is:
> **Build a coherent visual system that feels like a real, professionally engineered software product with a distinct, calm, paper-and-ink Panvas identity.**

The **Panvas desktop application itself**—with its quiet charcoal and warm paper surfaces, 8px rhythm, compact typography, tactile notebook covers, and low-chrome canvas—is the primary reference for the public website's visual language.

---

## 2. Resource Authority Hierarchy

When designing and implementing frontend surfaces, resolve design decisions according to this strict five-level hierarchy:

```
Level 1: Panvas Product Identity (HIGHEST AUTHORITY)
   ├── Actual Panvas application UI & design tokens (docs/03_UI_SYSTEM.md)
   ├── Real user workflows & verified capabilities (release.md)
   └── Existing approved brand marks, typography, and paper-and-ink palette

Level 2: Art Direction & Composition Research
   ├── Seesaw (editorial layout, whitespace rhythm, typography hierarchy)
   ├── Curated professional software websites (Linear, Raycast, Obsidian, Craft, Notion)
   └── Pinterest (moodboarding, print design, texture, poster composition)

Level 3: Interaction & Motion Design
   ├── MotionSites (motion choreography, purpose-driven micro-interactions)
   ├── Framer Motion (disciplined, interruptible React motion)
   └── Motion Primitives (evaluated interaction patterns)

Level 4: Implementation Primitives & Engineering
   ├── Existing Panvas components & design system tokens
   ├── Tailwind CSS & CSS Variables
   ├── Lucide React icon set
   └── shadcn/ui (accessible unstyled headless primitives — adapted, never default)

Level 5: Generated Media & Supporting Visuals (LOWEST INFLUENCE ON ARCHITECTURE)
   └── Codex Imagine / Generative UI (supporting atmosphere, abstract graphics, social assets)
```

*Rule: Generated media and external references must serve the Panvas product story; they must never dictate the product's interface or invent non-existent features.*

---

## 3. Approved Frontend & UI/UX Resources

The following curated resources are approved for design research, interaction inspiration, and component architecture. Each serves a distinct role:

### A. Seesaw
* **Reference**: [https://www.seesaw.website/](https://www.seesaw.website/)
* **Role**: High-quality web design inspiration, editorial art direction, and typography research.
* **How to Use**:
  * Research typography pairings, editorial grids, screenshot framing, section rhythm, and asymmetric but balanced layouts.
  * Extract *principles* (e.g., "how Section A overlaps Section B to create narrative depth") from multiple sites.
  * **Rule**: **Never clone a complete website.** Synthesize design principles from 3–5 disparate references and translate them into Panvas's paper-and-ink language.

### B. MotionSites
* **Reference**: [https://motionsites.ai/](https://motionsites.ai/)
* **Role**: Motion design, choreography, and interaction inspiration.
* **How to Use**:
  * Explore entrance sequences, scroll-linked storytelling, sticky product demos, and tab switching transitions.
  * **The Motion Test**: Every substantial animation must answer: *What does this motion help the user understand?*
  * **Rule**: Eliminate decorative animation that adds latency or distraction without conveying product hierarchy or function.

### C. shadcn/ui
* **Reference**: [https://ui.shadcn.com/](https://ui.shadcn.com/)
* **Role**: Accessible, keyboard-navigable component primitives for complex interactive UI (e.g., Dialogs, Drawers, Dropdowns, Tabs, Accordions/FAQs, Tooltips, Mobile Sheets).
* **How to Use**:
  * Use as an engineering foundation for accessibility (WAI-ARIA compliance, focus traps, keyboard roving).
  * **Crucial Rule**: **Do NOT ship the default shadcn look.** Every adapted primitive must adopt Panvas typography (`Inter`/`JetBrains Mono`), Panvas border radii (`--radius-surface`), Panvas borders (`border-white/8` or `border-panvas-border-subtle`), and Panvas focus rings (`--focus-outline`).
  * Before adding a component, check whether Panvas already has an existing working primitive in `src/components/ui/`.

### D. Framer Motion
* **Role**: React-native motion engine for sophisticated layout animations, shared element transitions, and viewport-triggered reveals.
* **Repository Status**: `framer-motion` (`^12.40.0`) is **already installed** in `package.json`.
* **How to Use**:
  * Use for interactive product demos, sticky feature tab transitions, and subtle scroll progress indicators.
  * **Rule**: Use native CSS transitions (`transition-all duration-200`) for simple hover/focus states. Reserve Framer Motion for coordinate transforms, spring physics, and sequenced entrances. Always provide `prefers-reduced-motion` fallbacks.

### E. Motion Primitives
* **Role**: Reusable, modular animated UI patterns (e.g., text morphing, magnetic buttons, expandable cards).
* **How to Use**:
  * Approved for evaluation where a specific interaction pattern directly clarifies product capability.
  * **Rule**: Inspect licensing, bundle size, and dependencies before adopting. Recreate or copy small primitives directly using existing Framer Motion + Tailwind instead of adding redundant NPM dependencies.

### F. Watermelon UI
* **Role**: Potential UI component and visual inspiration library.
* **How to Use**:
  * **Rule**: Before future implementation, verify the exact repository/package intended. Do **not** install arbitrary packages based solely on the name. Evaluate accessibility, Tailwind compatibility, and bundle footprint first.

### G. Pinterest
* **Reference**: [https://www.pinterest.com/](https://www.pinterest.com/)
* **Role**: Broad visual moodboarding and graphic design research.
* **How to Use**:
  * Research print design, physical notebook bindings, architectural blueprints, technical book covers, high-contrast typography, and Swiss poster layouts.
  * **Rule**: Pinterest is an *inspiration* tool, not a UX specification. Do not copy non-functional Dribbble/Pinterest concepts that fail real-world usability or responsive constraints.

### H. Codex Imagine / Image & Video Generation
* **Role**: Generating custom atmospheric artwork, abstract background textures, release graphics, and supporting social assets.
* **How to Use**:
  * Use for background textures, hero atmospheric artwork, and conceptual diagrams.
  * **Absolute Rule**: **Real Product UI > Generated Product UI.** Never use AI image generators to create fake app screenshots or fabricated UI features. Real product captures from the Panvas codebase must always represent the product.

### I. Agent Skills & Tooling
* **Role**: Specialized execution skills available to coding agents (e.g., `senior-frontend`, `ui-design-system`, `landing-page-generator`, `accessibility`, `pw-review`).
* **Rule**: Agents must verify which skills are active in their session and read relevant `SKILL.md` instructions before generating complex frontend code.

---

## 4. Resource Status & Adoption Matrix

| Resource | Primary Role | Repository Status | Future Adoption Policy |
|---|---|---|---|
| **Seesaw** | Art Direction & Layout Research | External Reference | Mandatory research before major layout changes. |
| **MotionSites** | Motion Choreography Inspiration | External Reference | Use for interaction design; avoid empty decorative motion. |
| **Pinterest** | Graphic & Mood Inspiration | External Reference | Use for texture, typography, and poster layout exploration. |
| **Framer Motion** | React Motion System | **Installed (`^12.40.0`)** | Active in source; use for complex layout/spring animations. |
| **Tailwind CSS** | Styling & Token Pipeline | **Installed (`^3.4.17`)** | Core styling foundation; use Panvas token utilities. |
| **Lucide React** | Universal Icon Set | **Installed (`^0.469.0`)** | Sole icon library; preserve consistent 16–20px sizing. |
| **shadcn/ui** | Headless Accessible Primitives | **Not Installed / Evaluated** | Adopt individual primitives on demand; customize to Panvas tokens. |
| **Motion Primitives** | Specialized Micro-interactions | **Not Installed / Evaluated** | Adapt individual patterns using existing Framer Motion. |
| **Watermelon UI** | Component Exploration | **Requires Verification** | Verify specific source and bundle cost before use. |
| **Codex Imagine** | Atmospheric & Supporting Art | Available Tooling | Supporting graphics only; never replace real UI captures. |

---

## 5. Anti-Vibe-Code Design Rules

To ensure Panvas surfaces feel like durable, expertly engineered software, future frontend agents must **strictly avoid** these AI-generated design clichés:

1. ❌ **No Endless Bento Grids:** Do not divide every section into an arbitrary 3x3 grid of rounded cards with disconnected icons. Use asymmetric, editorial, and storytelling layouts tailored to actual feature depth.
2. ❌ **No Neon Violet/Purple Orbs:** Do not scatter generic glowing purple/cyan radial blur blobs behind every heading. Panvas uses a warm charcoal, ink, and paper palette with restrained emerald/amber/violet accents.
3. ❌ **No Overuse of Glassmorphism:** Glassmorphic backdrops (`backdrop-blur-2xl`) belong on floating chrome (topbars, command palettes, floating pen toolbars), **not** on every content card.
4. ❌ **No Universal Scroll-Fade Monotony:** Do not make every single paragraph and icon slide upward by 20px on scroll. Animate only major section anchors and interactive demonstrations.
5. ❌ **No Huge Empty Hero Sections:** Avoid 100vh hero sections containing only two lines of text and empty space. The hero must immediately present the real product UI and clear download/web CTAs.
6. ❌ **No Default shadcn/Tailwind Aesthetics:** Do not output generic unstyled shadcn zinc/slate templates. Every surface must use Panvas tokens (`#0D1117`, `#0D0D0D`, `#f7f4ec`, `#1a1815`).
7. ❌ **No Fake Marketing Artifacts:**
   * ❌ No fake customer reviews or synthetic avatars.
   * ❌ No fake metric badges (e.g. "Loved by 50,000+ engineers" or "★★★★★ 4.9 on Product Hunt").
   * ❌ No fake terminal typing animations with fictional commands.
   * ❌ No sparkles (`✨`) used as a generic icon for core features.
8. ❌ **No AI-Generated Screenshots:** Never show an AI-rendered imaginary application interface. Display only authentic captures of the real Panvas desktop and web application.

---

## 6. Dependency & Bundle Discipline

**A useful design resource does NOT automatically become a project dependency.**

Before proposing or installing any new frontend package:
1. **Check Existing Capabilities:** Does `src/components/ui/`, `framer-motion`, `lucide-react`, or standard CSS already solve this cleanly?
2. **Evaluate Bundle Weight:** Does the package introduce heavy transitive dependencies, polyfills, or large style sheets? (Keep main production bundle under reviewable gzip limits; see [`scripts/check-release.mjs`](../scripts/check-release.mjs)).
3. **Inspect Licensing & Maintenance:** Is it open-source (MIT, Apache-2.0, BSD), actively maintained, and compatible with React 18 / TypeScript 5?
4. **Favor Lightweight Adaptation:** Copying or hand-crafting a 40-line accessible hook or primitive is almost always better than adding a 50 KB NPM dependency.
5. **No Duplicate Libraries:** Never run multiple competing motion libraries, icon sets, or CSS frameworks concurrently.

---

## 7. Real Product > Decoration

**The website's strongest visual asset is Panvas itself.**

When building marketing or product showcase surfaces, prioritize genuine captures and live demonstrations of:
* **The Visual Shelf & Library:** Real notebook covers, recents, favorites, and folder hierarchy ([`LibraryWorkspace.tsx`](../src/components/library/LibraryWorkspace.tsx)).
* **Structured Notebook Writing:** Real TipTap rich text, KaTeX formulas, and Lowlight syntax-highlighted code blocks.
* **Hardware-Accelerated Vector Ink:** Pressure-sensitive pen strokes, eraser gestures, floating ruler, and universal floating pen toolbar.
* **In-Place PDF Workspace:** Real multi-page PDF thumbnail sidebar, rotation controls, vector markup, and export.
* **Infinite Canvas (Excalidraw):** Embedded Excalidraw whiteboards with custom LaTeX and Markdown floating blocks.
* **Page-Linked Voice Notes:** Real audio player components anchored to notebook sections.
* **Split View Workspace:** Independent side-by-side document comparison.
* **Curated Themes:** Clean Light, Dark Charcoal, and Warm Ink paper environments.

---

## 8. Visual Research & Implementation Workflow

When undertaking a landing-page or visual frontend task, follow this 7-stage workflow:

```
Stage 1: Understand
   └── Study the real Panvas codebase, recent release gates (release.md), and verified capabilities.

Stage 2: Reference Research
   └── Select 3–5 targeted references from Seesaw, MotionSites, Pinterest, or top-tier product sites (Linear, Raycast, Obsidian).

Stage 3: Extract Principles
   └── Document *why* each reference succeeds (e.g. "asymmetric split hero", "sticky tabbed demo with progress bars").

Stage 4: Define Panvas Direction
   └── Establish the typography hierarchy, grid, spacing, and screenshot composition before writing code.

Stage 5: Build
   └── Implement using existing Panvas React/Tailwind/Framer Motion architecture with strict token discipline.

Stage 6: Visual & Responsive QA
   └── Inspect across all 8 standard breakpoints (360px to 1440px+), verify focus states, keyboard flow, and reduced motion.

Stage 7: Motion & Detail Polish
   └── Add micro-interactions, subtle hover states, image framing rings, and texture overlays.
```

---

## 9. Professional Frontend Quality Checklist

Before submitting any frontend or visual PR, verify every item on this checklist:

### A. Art Direction & Identity
- [ ] The page has a distinct, memorable personality rooted in Panvas's paper-and-ink aesthetic.
- [ ] No generic AI-vibe clichés (no purple gradient wash, no generic bento grids, no fake stats).
- [ ] Visual hierarchy is unambiguous: Primary value proposition → Live UI showcase → Core workflows → Download/access hub.

### B. Typography & Text Rhythm
- [ ] Scaled using deliberate type tokens (`font-sans` for UI, `font-mono` for technical data, `font-sketch` only for subtle brand accents).
- [ ] Line lengths for body copy remain comfortable (45–75 characters per line, `max-w-xl` to `max-w-2xl`).
- [ ] Proper font weights (Medium `500` / Semibold `600` for titles, Regular `400` for body) with tight letter tracking on headings (`tracking-tight` / `tracking-tighter`).

### C. Components & Layout
- [ ] Radius system is uniform (Controls: `rounded-lg`, Surfaces: `rounded-xl` / `rounded-2xl`, Badges: `rounded-full`).
- [ ] 1px subtle borders (`border-white/8` or token borders) with subtle ring insets on image containers.
- [ ] Clear interactive states: default, `:hover`, `:active`, and `:focus-visible`.

### D. Motion & Interaction
- [ ] Every animation communicates state change, layout connection, or feature demonstration.
- [ ] Animations are performant (GPU-accelerated `transform` and `opacity` only).
- [ ] `prefers-reduced-motion: reduce` is respected on all marquee tickers and transforms.

### E. Product Presentation
- [ ] All screenshots represent the **current, actual Panvas UI**.
- [ ] Images are crisp, unblurred, and use modern WebP/AVIF formats with correct aspect-ratio wrappers.
- [ ] No sensitive local paths, personal email addresses, or unreleased feature mocks are exposed.

### F. Responsive Breakpoints
Must be verified across all 8 standard breakpoints:
- [ ] **1440px+ (Ultra-wide Desktop)**: Bounded container max-width (`max-w-[1400px]`), no awkward stretching.
- [ ] **1280px (Standard Desktop)**: Balanced multi-column grids and proportional typography.
- [ ] **1024px (Small Laptop / Landscape Tablet)**: Proper navigation menu reflow, no button overlapping.
- [ ] **768px (Tablet Portrait)**: Clean 2-column to 1-column transitions; text stays above images.
- [ ] **~600px (Large Phablet / Foldable)**: Seamless transition to compact toolbars and sheets.
- [ ] **430px (iPhone Pro Max / Pixel XL)**: No horizontal document overflow; touch targets ≥ 44px.
- [ ] **390px (Standard Modern Phone)**: Hero text wraps cleanly without orphan characters.
- [ ] **360px (Compact Mobile)**: Navigation bar, buttons, and badges fit within 360px viewport width.

### G. Accessibility & Web Standards
- [ ] Strict heading hierarchy (`h1` → `h2` → `h3` without skipping levels).
- [ ] Color contrast meets WCAG AA standards (≥ 4.5:1 for normal text, ≥ 3:1 for large text).
- [ ] Semantic HTML (`<main>`, `<nav>`, `<section>`, `<header>`, `<footer>`, `<button>`, `<a>`).
- [ ] All interactive buttons and links have visible focus rings (`focus-visible:ring-2`).
- [ ] Meaningful `alt` attributes on all product preview images.

### H. Performance & SEO
- [ ] Image assets compressed (total marketing page image payload < 1.5 MB).
- [ ] Lazy loading enabled for offscreen media (`loading="lazy"`).
- [ ] Accurate `<title>`, meta description, canonical link, and Open Graph tags.
- [ ] Zero unoptimized runtime bundle additions.