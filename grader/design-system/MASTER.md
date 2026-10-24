# Faaxa AI Grader — Design System (Master)

**Source of truth for visual, interaction, and accessibility decisions.** Page overrides go in `design-system/pages/<page-name>.md`.

---

## Product Context

| Dimension | Value |
|---|---|
| Type | Conversion-first lead-gen tool (SaaS-adjacent) |
| Audience | Small-business contractors (40-60 yo, not tech-savvy, high-intent) |
| Stack | Next.js 16 App Router · React 19 · Tailwind v4 |
| Style | Minimalism with warm neutral surfaces + single brand-yellow accent |

---

## §1 Color Tokens

| Role | Hex | Use |
|---|---|---|
| `bg-primary` | `#FFFFFF` | Page background, cards |
| `bg-surface-soft` | `#FAFAF7` | Secondary surfaces (stats bar, location bar, embedded panels) |
| `bg-surface-muted` | `#F4F4F0` | Section separators (HowItWorks, FAQ) |
| `text-primary` | `#111827` | Headings, primary body, key facts |
| `text-secondary` | `#374151` | Form labels, secondary copy |
| `text-tertiary` | `#6B7280` | Descriptions, helper text |
| `text-quaternary` | `#9CA3AF` | Disclaimers, light captions |
| `border-default` | `#E5E7EB` (`border-gray-200`) | Card edges, dividers |
| `brand-yellow` | `#F5C518` | CTA, highlights, accent |
| `brand-yellow-dark` | `#8A6A00` | Yellow text on white (contrast safe) |
| `danger` | `#EF4444` | Errors, threat indicators |
| `success` | `#22C55E` | Confirmation states |
| `warn` | `#F59E0B` | Equal-visibility / parity state |

**Anti-pattern:** never use raw `text-white` on a white background; never use `text-white/40` (was dark-theme leftover).

**Contrast minimums:**
- Body text on white: `text-[#374151]` or darker (≥4.5:1 ✓)
- Helper text on white: `text-[#6B7280]` or darker (≥4.5:1 ✓)
- Yellow accent text on white: use `text-[#8A6A00]` not `text-[#F5C518]` (yellow itself fails contrast)

---

## §2 Typography

| Role | Class | Size · Weight · Leading |
|---|---|---|
| Hero headline | `text-4xl md:text-6xl lg:text-7xl font-black tracking-tight leading-[1.05]` | 36/60/72 · 900 · 1.05 |
| Section H2 | `text-4xl md:text-5xl font-black tracking-tight` | 36/48 · 900 |
| Card H3 | `text-lg font-bold tracking-tight` | 18 · 700 |
| Body large | `text-lg md:text-xl leading-relaxed` | 18/20 · 400 · 1.625 |
| Body | `text-sm leading-relaxed` | 14 · 400 · 1.625 |
| Caption / label | `text-xs font-bold tracking-[0.18em] uppercase` | 12 · 700 · tracked |
| Disclaimer | `text-xs` or `text-[10px]` | 12/10 · 400 |

**Font:** Inter (`font-[family-name:var(--font-inter)]`) — already global.

**Rules:**
- Body must be ≥16px on mobile (currently `text-lg`/`text-base` for body, `text-sm` only for compact UI).
- `leading-relaxed` on body, `leading-tight` on headlines.
- Tracked uppercase labels: only at `text-xs` or smaller, used for section eyebrows.

---

## §3 Spacing System (4/8px rhythm)

| Token | Value | Use |
|---|---|---|
| `gap-1.5` / `space-y-1.5` | 6px | Tight inline elements |
| `gap-2` / `space-y-2` | 8px | List items in same group |
| `gap-3` / `space-y-3` | 12px | Form fields, ranked rows |
| `gap-4` / `space-y-4` | 16px | Card section breaks |
| `gap-6` / `space-y-6` | 24px | Major content blocks |
| `py-7` / `py-8` | 28/32px | Card vertical padding |
| `py-16` / `py-20` / `py-24` | 64/80/96px | Section vertical padding |

Section horizontal padding: always `px-6 md:px-12 lg:px-20`.

---

## §4 Shape & Elevation

| Element | Radius | Shadow |
|---|---|---|
| Buttons | `rounded-lg` (8px) or `rounded-full` (pills) | `shadow-lg shadow-[#F5C518]/20` on primary CTAs |
| Inputs | `rounded-xl` (12px) | `shadow-sm` |
| Cards | `rounded-2xl` (16px) | `shadow-sm` baseline, `shadow-xl` for floating panels (dropdown) |
| Pills / badges | `rounded-full` | none |

**Single elevation scale.** Don't introduce arbitrary shadows — pick from this list.

---

## §5 Interaction States

| Element | Resting | Hover | Focus | Disabled |
|---|---|---|---|---|
| Primary button (yellow CTA) | `bg-[#F5C518] text-black` | `hover:bg-yellow-400` | `focus:ring-2 focus:ring-[#F5C518] focus:ring-offset-2` | `disabled:opacity-50 disabled:cursor-not-allowed` |
| Secondary button | `border + text-primary` | `hover:bg-gray-50` | `focus:ring-2 focus:ring-[#F5C518]/30` | `disabled:opacity-50` |
| Input | `border-gray-300` | n/a | `focus:border-[#F5C518] focus:ring-2 focus:ring-[#F5C518]/30` | `disabled:opacity-80` |
| Input — error | `border-red-400` | n/a | `focus:border-red-500 focus:ring-red-500/30` | n/a |
| Icon-only button | `text-gray-400` | `hover:text-[#111827]` | `focus:outline-none focus:ring-2 focus:ring-[#F5C518]/40` | n/a |

**Rule:** never `focus:outline-none` without a replacement ring. Custom keyword input bug fix proved this is easy to miss.

**Timing:** all state changes `transition-all` (Tailwind default 150ms). Use `transition-colors` when only colors change.

---

## §6 Touch Targets

- All interactive elements ≥44×44px (`py-3` on inputs, `py-4` on primary CTAs, icon buttons need `p-1` minimum).
- Gap between adjacent tap targets ≥8px (use `gap-2` or higher in toolbars).

---

## §7 Form Rules (LeadForm canonical pattern)

1. Every input has a **visible `<label>`** with `htmlFor` matching `id`. Never placeholder-only.
2. Required fields show `*` with `aria-hidden="true"` plus `<span class="sr-only">(required)</span>`.
3. `autoComplete` attributes always set: `given-name`, `family-name`, `email`, `tel`.
4. Field-level errors render under the input with `role="alert"` and `id` referenced by the input's `aria-describedby`.
5. `aria-invalid` toggled on errored fields; `inputErrorClass` adds red border + red focus ring.
6. Errors include an inline warning icon (color is not the only signal).
7. Form-level errors get `role="alert"` and an inline icon.
8. Loading state on submit: spinner + disabled + `cursor-not-allowed`, button text changes to "Sending…".

---

## §8 Iconography

- **No emoji as structural icon.** Heroicons / inline SVG only.
- Standard sizes: `w-3.5 h-3.5` (inline with text), `w-4 h-4` (default), `w-5 h-5` (button), `w-8 h-8` (feature mark).
- Default stroke: `strokeWidth={2}`. Use `2.5` for emphasis (close buttons, checkmarks), `3` for solid emphasis (large checkmark, "+" button).
- All decorative icons get `aria-hidden="true"`. Icon-only interactive buttons get an `aria-label`.

---

## §9 Animation

- Spinner: `animate-spin` (Tailwind default, ~1s). Always paired with disabled state on the trigger.
- Pulse: `animate-pulse` only on the live-indicator dot in the hero badge.
- Transitions: `transition-all` (150ms) for state changes; `transition-colors` for hover-only color swaps; `duration-500` only on the threat-bar fill animation in CompetitorList.
- **Respect `prefers-reduced-motion`** for any motion added beyond these primitives.

---

## §10 Layout & Responsive

- Mobile-first. Default classes are mobile, `md:`/`lg:` for upscale.
- Section pattern: `<section class="bg-X py-Y px-6 md:px-12 lg:px-20"><div class="max-w-6xl mx-auto">…</div></section>`.
- Max content width: `max-w-6xl` (1152px) for content grids; `max-w-5xl` for hero copy; `max-w-3xl` for forms.
- Hero is centered (`items-center text-center`); search-bar wrapper resets to `text-left` so its dropdown/card render naturally.
- Breakpoints: `375 / 768 / 1024 / 1440` (Tailwind sm/md/lg/xl). No custom breakpoints.

---

## §11 Component Conventions

### Card

```
bg-white border border-gray-200 shadow-sm rounded-2xl p-6 md:p-8
```

### Yellow pill CTA button

```
bg-[#F5C518] text-black font-bold px-5 py-2.5 rounded-full text-sm hover:bg-yellow-400 transition-all
```

### Section eyebrow

```
text-[#8A6A00] text-xs font-bold tracking-[0.2em] uppercase
```

### Form input

See §5 + §7.

---

## §12 Anti-Patterns (don't ship these)

- ❌ `focus:outline-none` with no replacement focus style
- ❌ Placeholder used as the only label
- ❌ Emoji used as a structural icon (✅, 🚀, 📊…)
- ❌ Yellow `#F5C518` as TEXT on white background (1.6:1 contrast — fails AA)
- ❌ Raw `text-white` on a white background (dark-theme leftover)
- ❌ `bg-[#0A0A0A]` or any deep-black surface (the product is now light theme — use `bg-[#FAFAF7]` for soft separation)
- ❌ Generic "Something went wrong" error copy without recovery path
- ❌ Icon-only buttons without `aria-label`
- ❌ Forms without `autoComplete` attributes
- ❌ Tap targets under 44×44px (icons need padding to hit the minimum)

---

## §13 Page Overrides

When a page needs to deviate from this Master (e.g. report page uses a darker location bar for emphasis), document it under `design-system/pages/<page-name>.md` and link from the relevant section above.

Currently no overrides exist.
