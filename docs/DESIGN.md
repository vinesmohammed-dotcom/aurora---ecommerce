# DESIGN — Visual System, Tokens & UI Architecture

## 1. Design Direction & Brand Identity
This project rejects the generic, cluttered aesthetic of legacy e-commerce sites (Amazon/Flipkart) and generic tutorial templates. Instead, it adopts a **modern, minimalist, editorial aesthetic** inspired by premium direct-to-consumer design systems (such as Linear, Stripe, and Apple).

### Core Visual Principles
1. **Generous Whitespace & Rhythm**: Content breathes naturally with strict 8pt grid alignment.
2. **Tactile Elevation & Depth**: Subtle border contrasts (`border-slate-200/80`) paired with layered micro-shadows rather than heavy muddy drop shadows.
3. **Intentional Color Restraint**: Neutral dark slates dominate the canvas, reserving vibrant emerald and violet accents strictly for primary calls-to-action and critical status highlights.

---

## 2. Design Token System

### 2.1 Color Palette (Tailwind HSL Mapping)

```css
:root {
  /* Canvas & Surfaces */
  --color-bg-base: #fafafa;         /* Ultra-light slate background */
  --color-surface-card: #ffffff;    /* Pure white elevated cards */
  --color-surface-subtle: #f1f5f9;  /* Slate-100 for chips and badges */
  --color-surface-hover: #e2e8f0;   /* Slate-200 interactive hover */

  /* Text & Typography */
  --color-text-primary: #0f172a;    /* Slate-900 high contrast */
  --color-text-secondary: #475569;  /* Slate-600 readable body */
  --color-text-muted: #94a3b8;      /* Slate-400 placeholder text */

  /* Borders & Dividers */
  --color-border-subtle: #e2e8f0;   /* Slate-200 component borders */
  --color-border-focused: #0f172a;  /* Slate-900 active focus ring */

  /* Brand & Action Accents */
  --color-brand-primary: #0f172a;   /* Onyx black primary button */
  --color-brand-accent: #10b981;    /* Emerald green for success, offers, discounts */
  --color-brand-accent-hover: #059669;

  /* State & Feedback Colors */
  --color-danger: #ef4444;          /* Red-500 for errors & cancellations */
  --color-warning: #f59e0b;         /* Amber-500 for pending/processing */
  --color-info: #3b82f6;            /* Blue-500 for shipped status */
}
```

### 2.2 Typography Scale
- **Font Family**: Primary body: `Plus Jakarta Sans` or `Inter`, sans-serif. Headings & Hero: `Outfit`, sans-serif.
- **Scale**:
  - `Display / Hero`: `36px` / `44px` (font-extrabold, tracking-tight)
  - `Heading 1`: `28px` / `36px` (font-bold)
  - `Heading 2`: `22px` / `28px` (font-semibold)
  - `Heading 3`: `18px` / `24px` (font-semibold)
  - `Body / Default`: `15px` / `22px` (font-normal)
  - `Subtext / Caption`: `13px` / `18px` (font-medium, text-slate-500)
  - `Micro / Badge`: `11px` / `14px` (font-bold, tracking-wide, uppercase)

---

## 3. UI Component Design Specifications

### 3.1 Buttons (`components/ui/Button.jsx`)
- **Primary**: Solid Onyx Black (`bg-slate-900 text-white hover:bg-slate-800`), rounded-lg, 44px height (touch-accessible target), subtle active scale (`active:scale-[0.98]`).
- **Secondary / Outline**: `border border-slate-300 text-slate-700 hover:bg-slate-50`.
- **Accent / Buy Now**: `bg-emerald-600 text-white hover:bg-emerald-700`.
- **Destructive**: `bg-rose-50 text-rose-600 hover:bg-rose-100`.
- **Loading State**: Disables click, renders spinning SVG icon, preserves button dimensions.

### 3.2 Form Inputs (`components/ui/Input.jsx`)
- Border: `1px solid #cbd5e1`, transitions to `ring-2 ring-slate-900/10 border-slate-900` on focus.
- Error state: `border-rose-500 ring-rose-100`, renders subtext error with exclamation icon.

### 3.3 Product Cards (`features/catalog/ProductCard.jsx`)
- Aspect Ratio: `4:5` clean vertical framing for product imagery.
- Subtle zoom on image hover (`group-hover:scale-105 transition-transform duration-300`).
- Floating discount badge (`bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded-full text-xs`).
- Quick variant indicator pills (e.g. `S • M • L • XL`).

### 3.4 Status Badges (`components/ui/Badge.jsx`)
- `CONFIRMED`: Soft emerald pill (`bg-emerald-50 text-emerald-700 border border-emerald-200`).
- `PENDING_PAYMENT`: Soft amber pill (`bg-amber-50 text-amber-700 border border-amber-200`).
- `SHIPPED`: Soft blue pill (`bg-sky-50 text-sky-700 border border-sky-200`).
- `CANCELLED`: Soft rose pill (`bg-rose-50 text-rose-700 border border-rose-200`).

---

## 4. State Representation: Empty, Loading & Error States

| State Type | Design Implementation |
| :--- | :--- |
| **Loading State (Skeletons)** | Shimmering placeholder blocks using Tailwind's `animate-pulse` matching the exact aspect ratio and typography heights of the real card. Eliminates Layout Shift (CLS). |
| **Empty State (Zero Results)** | Clean minimalist SVG illustration with friendly headline (e.g., "Your Cart is Empty", "No products match your filter") paired with an actionable CTA button ("Explore Products"). |
| **Error State (Network Drop)** | Reusable `ErrorBanner` card featuring retry trigger (`onClick={refetch}`) and human-readable explanation. |

---

## 5. Prototyping & Figma Roadmap
1. **Figma / Stitch Design Tokens**: Establish color styles and text styles before writing React markup.
2. **Component Frame Assembly**: Validate responsive breakpoints:
   - Mobile: `< 640px` (single column product grid, bottom-sheet cart drawer).
   - Tablet: `640px - 1024px` (2-column grid, compact sidebar).
   - Desktop: `> 1024px` (3 or 4-column grid, persistent sticky filter sidebar).
3. **Design-to-Code Parity**: Every Tailwind utility class in React will strictly reference the tokens defined in this document.
