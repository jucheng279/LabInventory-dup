# Icon System Reference

This document is the single authoritative reference for the icon system used across the application. It describes how icons are cataloged, fetched from Supabase storage, normalized, colored, cached, and rendered, together with the conventions that surfaces must follow when displaying icons.

---

## For AI Coding Agents - Read This First

**You must read this entire document before performing any icon-related work.** The icon pipeline has many interlocking rules; skipping this file will produce visually broken results or silent regressions.

Re-read this file whenever you are about to:

- Add, remove, rename, or re-upload any SVG in the `icons` Supabase storage bucket
- Modify `src/components/SvgIcon.tsx` or any function it contains
- Modify `src/config/iconRegistry.ts` (taxonomy, subcategory, preset, default)
- Build or modify any surface that renders an icon (cards, modals, pickers, headers, sidebars)
- Change accent color behavior or add a new accented entity
- Touch the `colorful_icons_enabled` workspace setting in any way
- Investigate an issue described as "the icon looks wrong / too thin / miscolored / wrong size"

Also consult these companion files when relevant:

- `src/components/SvgIcon.tsx` - the runtime pipeline
- `src/config/iconRegistry.ts` - the catalog
- `src/utils/preloadIcons.ts` - idle preloading
- `src/contexts/SyncContext.tsx` - the global `colorfulIconsEnabled` flag
- `src/utils/itemTypeIcons.tsx` - the separate, coexisting item-type icon system
- `src/config/locationTypes.ts` - location-context defaults
- `src/components/ColorPicker.tsx` - accent color palette and picker

**Non-negotiables:**

1. Never bake `width` or `height` attributes into authored SVGs; the pipeline injects them.
2. Prefer `currentColor` on authored `fill` / `stroke` attributes when the shape should recolor.
3. All new icon metadata must go through `iconRegistry.ts`; do not hard-code icon IDs at call sites.
4. Never call `fetch` on icon URLs yourself; use `SvgIcon` (or `fetchSvg`/`preloadAllIcons`) so caching, normalization, and complexity handling apply uniformly.
5. Do not reinvent normalization, stroke scaling, or recoloring at a component level.
6. Do not confuse the SVG registry system (this document) with the lucide-based item-type icon system in `utils/itemTypeIcons.tsx`.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Icon Registry and Taxonomy](#icon-registry-and-taxonomy)
3. [The SVG Normalization Pipeline](#the-svg-normalization-pipeline)
4. [Icon Type Taxonomy](#icon-type-taxonomy)
5. [Rendering as Filled Instead of Line-Art](#rendering-as-filled-instead-of-line-art)
6. [Color System and `currentColor` Flow](#color-system-and-currentcolor-flow)
7. [The `colorfulIconsEnabled` Global Toggle](#the-colorfuliconsenabled-global-toggle)
8. [Usage Patterns by UI Surface](#usage-patterns-by-ui-surface)
9. [Accent Color System](#accent-color-system)
10. [Caching and Performance](#caching-and-performance)
11. [Adding a New Icon (Checklist)](#adding-a-new-icon-checklist)
12. [Importing Lucide Icons into the Registry](#importing-lucide-icons-into-the-registry)
13. [Adding a New Category or Subcategory](#adding-a-new-category-or-subcategory)
14. [Pitfalls and Gotchas](#pitfalls-and-gotchas)
15. [Supabase Integration Notes](#supabase-integration-notes)
16. [Historical Changes Log](#historical-changes-log)
17. [Quick Reference Appendix](#quick-reference-appendix)

---

## Architecture Overview

The icon system is intentionally split into two layers so that the catalog can evolve independently of the renderer.

- **`iconRegistry.ts` (catalog layer)** holds all metadata: icon IDs, labels, categories, subcategories, and the Supabase storage URL for each SVG. It also exposes helper functions for looking up icons, producing presets per context, and resolving defaults.
- **`SvgIcon.tsx` (runtime layer)** is the only component allowed to render a registry icon. It fetches the raw SVG (once), runs it through `normalizeSvg`, caches the processed output, and injects it via `dangerouslySetInnerHTML`.

The runtime data flow on each render is:

1. Look up the registry entry by `iconId`.
2. Fetch the raw SVG text from Supabase storage (`svgCache` deduplicates by URL).
3. Compute `effectiveColor` based on `forceColorful`, the global `colorfulIconsEnabled` flag, and the caller-supplied `color`.
4. Build a cache key `${iconId}__${size}__${effectiveColor ?? ''}` and consult `processedCache`.
5. On cache miss, call `normalizeSvg(raw, size, effectiveColor)` to classify complexity, detect line-art, detect monochrome, rewrite the `<svg>` root, optionally recolor, optionally inject/scale/boost strokes, and optionally substitute `currentColor` with the caller's color.
6. Render the resulting HTML inside an inline-flex `<span>` sized to `renderSize`.

Supabase is the source of truth for:

- The actual `.svg` files, served from the public `icons` storage bucket.
- The per-workspace `workspace_settings.colorful_icons_enabled` flag.
- Every entity's `accent_color` (on `fridge`, `sublocation`, `position`, `box`, `item`, `item_folder`).

A separate icon system - lucide icons plus a small custom set mapped from item-type strings - lives in `src/utils/itemTypeIcons.tsx`. It has its own conventions and is **not** governed by this document. Keep the two mentally separate.

Supporting files:

- `src/utils/preloadIcons.ts` - runs on app mount to warm `svgCache` in batches during idle time.
- `src/config/locationTypes.ts` - maps location types to their default registry icon IDs.
- `src/contexts/SyncContext.tsx` - exposes `colorfulIconsEnabled` via React context.
- `src/components/ColorPicker.tsx` - 12-swatch pastel palette used to pick `accent_color` values.

---

## Icon Registry and Taxonomy

### Categories and color tokens

The registry uses four top-level categories. Each category carries its own Tailwind-friendly color token used in picker UI chrome (not in the icons themselves):

| Category | Theme color |
|----------|-------------|
| Location | Blue |
| Biology  | Emerald |
| Material | Amber |
| Folder   | Slate |

### Subcategories and current icon counts

| Category | Subcategory | Storage folder | Files | Notes |
|----------|-------------|----------------|-------|-------|
| Location | Fridge      | `Fridge`       | 8 | `freezer1.svg` ... `freezer8.svg` |
| Location | Cabinet     | `cabinet`      | 5 | |
| Location | Drawer      | `drawer`       | 4 | Files are PascalCase: `Drawer1.svg` ... |
| Location | Desk        | `desk`         | 3 | |
| Location | Rack        | `Rack`         | 4 | Folder is PascalCase |
| Location | Place       | `place`        | 2 | `location1.svg`, `Room1.svg` |
| Biology  | Cell        | `cell`         | 7 | Files are PascalCase: `Cell1.svg` ... |
| Biology  | Virus       | `virus`        | 3 | |
| Biology  | Bacteria    | `bacteria`     | 3 | |
| Biology  | Antibody    | `antibody`     | 4 | |
| Biology  | Drug        | `Drug`         | 7 | Folder and files PascalCase |
| Biology  | DNA         | `DNA`          | 1 | Lucide DNA icon, line-art. Displayed as "Genetics" via `getSubcategoryLabel`. Not in item presets |
| Material | Box         | `box`          | 6 | |
| Material | Bottle      | `bottle`       | 6 | |
| Material | Tube        | `tube`         | 6 | |
| Material | Equipment   | `equipment`    | 5 | `equip1.svg` ... |
| Folder   | FolderIcon  | `other`        | 2 | Displayed as "Folder" via `getSubcategoryLabel` |
| Folder   | List        | `other`        | 3 | |
| Folder   | Document    | `other`        | 3 | Shares folder with peers |
| Folder   | Book        | `other`        | 2 | |
| Folder   | Text        | `other`        | 1 | |

### Icon ID format

The icon ID is always `${folder}/${filename}` (including the `.svg` extension). Example: `Fridge/freezer1.svg`, `Drug/Drug3.svg`, `other/folder1.svg`. **Folder and file casing are preserved verbatim from Supabase storage**; the IDs are case-sensitive. Match existing casing precisely when adding new files.

### Preset contexts

`IconPresetContext` selects which subcategories surface as quick-pick presets:

| Context    | Preset subcategories (in order) |
|------------|---------------------------------|
| `location` | Fridge, Cabinet, Drawer, Desk, Rack, Place |
| `box`      | Box (first 4 icons) |
| `item`     | Cell, Virus, Bacteria, Antibody, Drug, Bottle, Tube, Equipment |

> DNA is intentionally excluded from all preset contexts; it only appears when browsing the full hub.
| `folder`   | FolderIcon, List, Document, Book, Text |

### Helper functions (exported from `iconRegistry.ts`)

- `getAllIcons()` - full registry array.
- `getIconById(id)` - O(1) lookup via `iconByIdMap`.
- `getAllCategories()` / `getSubcategories(category)`.
- `getIconsByCategory(category)` / `getIconsBySubcategory(category, subcategory)`.
- `getPresetIcons(context)` - flat list of one icon per context subcategory.
- `getGridPresetIcons(context, maxSlots)` - preset slots for the inline hub grid.
- `getDefaultIconForContext(context)` - single default ID.
- `getDefaultHubConfig(context)` - initial `{ category, subcategory }` for `IconHubModal`.
- `getSubcategoryLabel(sub)` - remaps `FolderIcon -> "Folder"`, `DNA -> "Genetics"`; all others pass through.

### `IconEntry` shape

```ts
interface IconEntry {
  id: string;              // e.g. "Fridge/freezer1.svg"
  label: string;           // e.g. "freezer1"
  category: IconCategory;  // 'Location' | 'Biology' | 'Material' | 'Folder'
  subcategory: IconSubcategory;
  svgPath: string;         // absolute public storage URL
}
```

---

## The SVG Normalization Pipeline

`normalizeSvg(raw, size, color?)` in `SvgIcon.tsx` applies the following steps in order. Every step is driven by heuristics; avoid "fixing" one step in isolation without checking the knock-on effects on the others.

1. **Complexity classification** via `measureComplexity`, producing `'simple' | 'intermediate' | 'complex'` based on total `d=""` character count and shape tag count.
2. **Line-art detection** via `isLineArtSvg`: at least 60% of shape tags must combine an explicit non-none `stroke` with an effective `fill="none"` (including inherited from a `<g fill="none">` ancestor).
3. **Monochrome detection** via `isMonochromeSvg`: every non-`none`/non-`currentColor`/non-`transparent` fill or stroke value passes `isGrayscaleColor` (max RGB channel delta <= 20).
4. **Render-size adjustment**: complex icons scale to `size * COMPLEX_SIZE_MULTIPLIER`. Line-art icons render at exactly the requested `size` - no render-size boost is applied. Only stroke width is adjusted for line-art visibility (see step 8).
5. **ViewBox and dimension normalization**: `width` and `height` attributes are stripped and re-injected at `renderSize`; a missing `viewBox` is synthesized from `width`/`height` or falls back to `0 0 24 24`; `preserveAspectRatio="xMidYMid meet"` is added when absent.
6. **Monochrome recolor to `currentColor`**: if monochrome, every non-sentinel `fill`/`stroke` is rewritten to `currentColor`, and shapes lacking both attributes (and not under a `fill="none"` ancestor) get `fill="currentColor"` injected so they can theme correctly.
7. **Stroke injection on fill-only shapes** via `injectStrokeOnFillShapes`: shapes with no stroke attribute and no `fill="none"` receive `stroke="currentColor" stroke-width="<vbSize * FILL_ONLY_STROKE_RATIO>"` to give filled silhouettes a visible edge at small sizes.
8. **Line-art stroke scaling or boosting**: if the max existing stroke width is below `vbSize * LINE_ART_MIN_STROKE_RATIO`, all stroke widths scale up to hit that floor; otherwise, for non-simple line art, all strokes scale by `COMPLEX_STROKE_MULTIPLIER`.
9. **Light-gray line-art darkening**: for non-monochrome line art only, strokes that are roughly gray and mid-luminance become `#1f2937` so they remain readable.
10. **Fallback boost for non-line-art, non-simple SVGs**: strokes still get `COMPLEX_STROKE_MULTIPLIER` applied.
11. **Final color substitution**: if the caller supplied a color, literal `currentColor` occurrences on `fill` and `stroke` are replaced with that exact string.

### Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `COMPLEXITY_PATH_THRESHOLD` | 2000 | `d=""` chars that trigger `'complex'` |
| `COMPLEXITY_SHAPE_THRESHOLD` | 8 | shape count that triggers `'complex'` |
| `INTERMEDIATE_PATH_THRESHOLD` | 1000 | `d=""` chars that trigger `'intermediate'` |
| `INTERMEDIATE_SHAPE_THRESHOLD` | 5 | shape count that triggers `'intermediate'` |
| `COMPLEX_SIZE_MULTIPLIER` | 1.15 | render-size boost for complex icons |
| `COMPLEX_STROKE_MULTIPLIER` | 1.3 | stroke boost for complex / non-simple icons |
| `FILL_ONLY_STROKE_RATIO` | 0.012 | injected stroke width vs viewBox size |
| `LINE_ART_MIN_STROKE_RATIO` | 0.045 | minimum stroke vs viewBox size for line art |
| `LINE_ART_LIGHT_STROKE_REPLACEMENT` | `#1f2937` | darkened stroke color for gray line art |

> **Historical**: a `LINE_ART_SIZE_MULTIPLIER` of `1.15` previously boosted every line-art icon's render size by 15%. It was removed on 2026-05-06 because the blanket upscale made line-art icons appear visibly larger than filled peers in the same grid. Line-art icons now render at exactly the requested `size`; only stroke width is adjusted for visibility.

### Decision matrix

| Authored type       | Recolor to `currentColor`? | Stroke injection? | Stroke scaling / boost? | Light-gray darkening? |
|---------------------|---------------------------|-------------------|-------------------------|-----------------------|
| Line-art (stroked)  | Only if monochrome         | Skipped (has `fill="none"`) | Stroke scale-up only if too thin, else boost when non-simple (no render-size upscale) | If not monochrome |
| Simple filled       | Only if monochrome         | Yes (default edge) | No boost | No |
| Monochrome complex  | Yes                        | Yes               | Boost                   | Skipped (monochrome)  |
| Multicolor colorful | No                         | Yes on fill-only shapes | Boost when non-simple | No |

---

## Icon Type Taxonomy

Authoring guidance, grouped by how the pipeline handles each type.

- **Line-art stroked**: `fill="none"` with explicit `stroke`. Produce at any stroke width; the pipeline will scale thin strokes up to meet the min ratio. Use `currentColor` for strokes you want to theme.
- **Simple filled**: few shapes, solid fills. The pipeline will add a thin stroke edge for clarity at small sizes. Monochrome versions will recolor to `currentColor`.
- **Monochrome complex**: many shapes but all grayscale. Fully eligible for recoloring; strokes will be boosted.
- **Multicolor / colorful**: preserve-as-authored. Do not expect a `color` prop to tint them; only `effectiveColor = '#000000'` (when `colorfulIconsEnabled` is off and `forceColorful` is false) will pass through, and because their fills are literal colors (not `currentColor`), they will still render in their original palette except for `currentColor` occurrences you intentionally leave in.

---

## Rendering as Filled Instead of Line-Art

A recurring authoring mistake: an SVG intended to look like an outline icon displays as a filled silhouette - interior strokes disappear, shapes look solid, and the pipeline injects a coarse edge around everything.

### Why it happens

The pipeline has no author-provided hint for "this is line art". It runs a heuristic (`isLineArtSvg`) that classifies an icon as line art only when **at least 60% of shape tags** combine:

- an explicit non-`none` `stroke` attribute, AND
- an effective `fill="none"` (either on the shape itself or inherited from an ancestor `<g fill="none">`)

If the 60% threshold is not met, the file flows through the filled branch: `injectStrokeOnFillShapes` adds `stroke="currentColor"` to every fill-only shape at `vbSize * FILL_ONLY_STROKE_RATIO`, and no stroke scale-up / darkening is applied. Visually, this reads as a filled icon with a chunky outline instead of the clean line drawing you authored.

### Root-cause checklist

- Shapes missing `fill="none"` default to `fill="black"` per the SVG spec. The pipeline treats them as filled.
- A wrapping `<g>` without `fill="none"` does not propagate the intent. Every child shape lacking its own `fill="none"` is counted as filled by `isLineArtSvg`.
- A shape missing an explicit `stroke` attribute (even if it visually appears stroked via CSS or defaults) is not counted toward the line-art ratio.
- A single decorative filled shape in an otherwise line-art file can push the line-art ratio below 60%.

### Authoring rules to prevent this

1. On every line-art path, always set both: `fill="none"` and an explicit `stroke="currentColor"` (or the intended color).
2. Prefer wrapping the body of a line-art SVG in `<g fill="none" stroke="currentColor" stroke-width="2">` so children inherit the correct defaults, and let `hasFillNoneAncestor` pick up the inheritance.
3. If you must include a filled accent in a line-art file, make sure the ratio of stroked+fill-none shapes remains at least 60% of the total shape count.
4. Never rely on the SVG default `fill="black"` or a stylesheet to set stroke - the pipeline reads attributes, not CSS.

### Debug steps when an icon renders filled

1. Open the raw `.svg` from `src/components/icons/...`.
2. Count shape tags: `path`, `rect`, `circle`, `ellipse`, `line`, `polygon`, `polyline`.
3. For each, check: does it have a non-`none` `stroke`? Does it have `fill="none"` either directly or via an ancestor `<g>`?
4. If the count of shapes satisfying both is below 60% of the total, the pipeline classifies the file as filled. Either add `fill="none"` / `stroke=""` to more shapes, or restructure with a `<g fill="none">` wrapper.
5. Re-test after a hard-refresh to bypass `svgCache` and `processedCache`.

---

## Color System and `currentColor` Flow

The coloring model is:

1. Monochrome detection rewrites non-sentinel fills/strokes to the sentinel `currentColor`.
2. Stroke injection and darkening use `currentColor` (or the fixed `#1f2937` for light-gray line art).
3. The final pipeline step replaces `currentColor` literals with the resolved color.

The resolved color is computed in the component:

```ts
const effectiveColor = !forceColorful && !colorfulIconsEnabled ? '#000000' : color;
```

- `color` prop + monochrome authoring = full color theming.
- `color` prop + multicolor authoring = original palette preserved; only `currentColor` parts theme.
- No `color` prop and `colorfulIconsEnabled === true` = `currentColor` resolves against the ambient CSS color (rare, since `<span>` inherits parent `color`).
- `colorfulIconsEnabled === false` and `forceColorful === false` = icons render black.

`isGrayscaleColor` uses a channel-delta threshold of 20; tweaking it changes which palettes qualify as monochrome. `isLightGrayColor` additionally requires luminance between 50 and 200.

---

## The `colorfulIconsEnabled` Global Toggle

- **Source**: `SyncContext`, backed by `workspace_settings.colorful_icons_enabled` in Supabase.
- **Default**: `true`.
- **UI**: the "Colorful Icons" switch inside `WorkspaceModal`.
- **Effect**: when `false`, every `SvgIcon` with `forceColorful` unset forces `effectiveColor = '#000000'`, which then feeds step 11 of the pipeline. Multicolor SVGs with literal color fills are unaffected; monochrome SVGs render black.
- **Escape hatch**: `forceColorful` on the `SvgIcon` prop. Use it for icon pickers and previews where the user must see the authored colors regardless of workspace preference (`IconHubModal`, `IconPresetRow`).

---

## Usage Patterns by UI Surface

| Surface | Size | Color source | `forceColorful` | Notes |
|---------|------|--------------|-----------------|-------|
| `BoxCard` / `ItemCard` / `ItemFolderCard` | 28-32 | Entity `accent_color` | no | Gradient backdrop uses accent at 15% / 5% |
| Create / Edit modals (header) | 28 | Entity `accent_color` (preview) | no | Reflects live picker state |
| `IconHubModal` | 24-28 | None | yes | Always show authored palette |
| `IconPresetRow` | 20-24 | None | yes | Tiny previews; authored palette only |
| `FridgeSidebar` rows | 20 | Entity `accent_color` | no | Tinted to match row accent |
| `Workspace` breadcrumbs / headers | 20-24 | Entity `accent_color` | no | Consistent with parent card |

Minimal invocation pattern:

```tsx
<SvgIcon iconId={box.icon_id} size={28} color={box.accent_color ?? '#3b82f6'} />
```

Picker pattern:

```tsx
<SvgIcon iconId={entry.id} size={24} forceColorful />
```

Accent backdrop recipes used behind icons:

- Card gradient: `linear-gradient(135deg, ${accent}15, ${accent}05)`
- Icon well: `background: ${accent}20; border: 1px solid ${accent}40`

---

## Accent Color System

Accent colors are stored per entity so that each box, item, folder, fridge, sublocation, and position can theme its own card and icon.

- **Entities with `accent_color`**: `fridge`, `sublocation`, `position`, `box`, `item`, `item_folder`.
- **Supabase**: nullable `text` column holding a hex string.
- **Default**: `#3b82f6` (blue-500) when null.
- **Picker**: `ColorPicker` exposes 12 pastel swatches. Do not introduce purple/indigo swatches.

Recipes live alongside the consuming card component, not in a shared utility, because each card composes them slightly differently. If you add a new accented entity, follow the same nullable `text` pattern and default to `#3b82f6`.

---

## Caching and Performance

- `svgCache: Map<url, rawText>` - one entry per storage URL; deduplicates network fetches for the app lifetime.
- `processedCache: Map<key, { html, renderSize }>` where `key = iconId__size__effectiveColor`. Color is part of the key because `currentColor` is substituted during normalization; different colors produce different HTML.
- `preloadAllIcons()` in `src/utils/preloadIcons.ts` iterates the registry in batches of 20, using `requestIdleCallback` with a 2000 ms setTimeout fallback. It only warms `svgCache`; `processedCache` still fills lazily on first render of each `(iconId, size, color)` triple.

Guidance:

- Do not call `fetch()` on icon URLs from any component. Always go through `SvgIcon` (or `fetchSvg` exported from `SvgIcon.tsx`).
- Do not re-normalize SVGs outside `SvgIcon`.
- Passing rapidly-changing `color` values (e.g., during a drag) creates many `processedCache` entries. That is fine in practice but keep it in mind if profiling memory.

---

## Adding a New Icon (Checklist)

1. Author the SVG. Use `currentColor` on `fill`/`stroke` where theming is intended. Omit `width` and `height`. Include a clean `viewBox`.
2. Watch complexity. Simple icons (< `INTERMEDIATE_PATH_THRESHOLD` / <= 5 shapes) bypass stroke boosts entirely. Overly complex SVGs trigger size and stroke boosts that may not be desired.
3. For line-art icons, verify every shape explicitly declares `fill="none"` and an explicit `stroke`. Self-check: count shape tags and confirm at least 60% combine both - otherwise the pipeline classifies the file as filled and renders it with a coarse edge. See [Rendering as Filled Instead of Line-Art](#rendering-as-filled-instead-of-line-art).
4. Upload to the correct Supabase `icons` bucket subfolder. Preserve casing; the path must match the registry exactly.
5. Register the file by adding its filename to the appropriate `buildIcons(...)` call in `iconRegistry.ts` (in the same order you want it to appear).
6. Confirm the icon appears in `IconHubModal` for its subcategory and, if part of a preset, in `IconPresetRow` for the relevant context.
7. Test at 20, 28, and 32 px, with and without an accent color, against light and dark card backdrops. Line-art and filled icons authored at the same size should now visually match in the UI (the 1.15x line-art boost was removed on 2026-05-06).
8. Toggle "Colorful Icons" off in `WorkspaceModal` and verify the icon renders legibly in black.
9. **If sourcing from Lucide**, follow the full [Importing Lucide Icons into the Registry](#importing-lucide-icons-into-the-registry) guide below instead of steps 1-3. Lucide SVGs require structural transformation before they are compatible with the renderer.

---

## Importing Lucide Icons into the Registry

Lucide icons ship in a format that is **incompatible** with how `SvgIcon.tsx` processes SVGs. This section explains why and provides a reliable conversion recipe.

### Why Lucide SVGs Break

Lucide's native SVG format puts all presentation attributes on the root `<svg>` element:

```xml
<!-- RAW LUCIDE FORMAT (DO NOT USE DIRECTLY) -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
     fill="none" stroke="currentColor" stroke-width="2"
     stroke-linecap="round" stroke-linejoin="round">
  <path d="M15 2c-1.798 1.998..." />
  <path d="M9 22c1.798-1.998..." />
</svg>
```

Child `<path>` elements inherit these attributes via normal SVG cascading. **But the renderer does not understand SVG inheritance.** It inspects attributes in two places only:

1. **On each shape element itself** (`<path>`, `<rect>`, `<circle>`, etc.)
2. **On `<g>` ancestors** (via `hasFillNoneAncestor()` which walks opening `<g>` tags)

It **never** reads presentation attributes from the `<svg>` root. This causes a chain of failures:

| Renderer function | What goes wrong |
|---|---|
| `isLineArtSvg()` | Looks for `stroke="..."` on each shape's own attributes. Bare paths have none, so `hasStroke` is false. The icon is classified as **filled** instead of line-art. |
| `hasFillNoneAncestor()` | Only walks `<g>` tags. Since there's no `<g fill="none">`, it returns false. `fillNone` is false for every path. |
| `recolorMonochromeToCurrent()` | Because paths have no `fill` or `stroke` attribute, the final catch-all injects `fill="currentColor"` onto every path -- turning stroke-only line art into solid filled blobs. |
| `injectStrokeOnFillShapes()` | Because paths appear to have no stroke and no fill="none", an additional thin outline stroke is added, compounding the visual mess. |
| `getMaxStrokeWidth()` | Finds `stroke-width="2"` on the `<svg>` root tag's text, but this interacts poorly with the scaling logic since the icon already failed line-art detection. |

### Conversion Recipe

**Step 1: Get the official source**

Always copy from the canonical Lucide source to avoid spurious paths:
```
https://unpkg.com/lucide-static@latest/icons/<icon-name>.svg
```

**Step 2: Verify path data**

Compare every `<path d="...">` against the official source. Remove any paths that don't exist in the official version. Do NOT add extra paths.

**Step 3: Transform the structure**

Strip from the `<svg>` root:
- `class`, `width`, `height` attributes
- `fill`, `stroke`, `stroke-width`, `stroke-linecap`, `stroke-linejoin` attributes
- The license comment `<!-- @license ... -->`

Wrap all child elements in a `<g>` that carries the removed presentation attributes:

```xml
<!-- CORRECT REGISTRY FORMAT -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <g fill="none" stroke="currentColor" stroke-width="2"
     stroke-linecap="round" stroke-linejoin="round">
    <path d="M15 2c-1.798 1.998..." />
    <path d="M9 22c1.798-1.998..." />
  </g>
</svg>
```

**Step 4: Upload and register**

1. Upload to the correct Supabase Storage subfolder (e.g. `icons/DNA/DNA1.svg`)
2. Register in `iconRegistry.ts` via a `buildIcons(...)` call
3. If replacing an existing file, bump the version in `ICON_VERSIONS` to bust caches

**Step 5: Verify**

- Test at 20px, 28px, and 32px
- Confirm it renders as clean line art (not filled blobs)
- Test with accent color applied
- Toggle "Colorful Icons" off and confirm black rendering is legible
- Check that no extra/missing paths are visible vs. the official icon

### Before vs After: DNA Icon Example

**Before (broken -- raw Lucide format):**
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
     fill="none" stroke="currentColor" stroke-width="2"
     stroke-linecap="round" stroke-linejoin="round">
  <path d="m10 16 1.5 1.5" />
  <path d="m14 8-1.5-1.5" />
  <!-- ... more paths ... -->
</svg>
```
Result: Solid black blobs. Every path gets `fill="currentColor"` injected. Line-art detection fails.

**After (working -- registry-compatible format):**
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <g fill="none" stroke="currentColor" stroke-width="2"
     stroke-linecap="round" stroke-linejoin="round">
    <path d="m10 16 1.5 1.5" />
    <path d="m14 8-1.5-1.5" />
    <!-- ... more paths ... -->
  </g>
</svg>
```
Result: Clean stroked helix. Line-art detection succeeds. Colors apply correctly.

### Lucide Conversion Checklist (Quick Reference)

- [ ] Copied paths from the official `unpkg.com/lucide-static` source
- [ ] Verified path count and data matches the official icon exactly
- [ ] Removed `class`, `width`, `height` from `<svg>` root
- [ ] Moved `fill`, `stroke`, `stroke-width`, `stroke-linecap`, `stroke-linejoin` from `<svg>` root to a `<g>` wrapper
- [ ] Only `xmlns` and `viewBox="0 0 24 24"` remain on the `<svg>` root
- [ ] Uploaded to Supabase Storage at the correct path with correct casing
- [ ] Registered in `iconRegistry.ts`
- [ ] Bumped `ICON_VERSIONS` if replacing an existing file
- [ ] Tested at multiple sizes (20, 28, 32 px)
- [ ] Tested with colorful toggle on and off
- [ ] Visually compared to official Lucide icon at lucide.dev

### Common Lucide Conversion Failures

| Failure | Symptom | Root cause | Fix |
|---|---|---|---|
| Icon renders as solid filled blobs | Thick black shapes instead of thin strokes | Attributes left on `<svg>` root; `isLineArtSvg` returns false; `recolorMonochromeToCurrent` injects `fill="currentColor"` on all paths | Move presentation attributes to a `<g>` wrapper |
| Extra paths visible (wrong shape) | Unexpected curves/lines in the icon | Paths copied from wrong source, AI hallucination, or copy-paste error | Verify every path against the official Lucide source at unpkg |
| Icon appears correct locally but broken in the live app | Works in SVG editor but not in the rendered app | SVG uploaded correctly to local file but not to Supabase Storage | Upload via the icon upload edge function or storage API |
| Icon still broken after re-upload | Old broken version persists | Browser/CDN caching the old file | Bump `ICON_VERSIONS` entry for the icon |
| Thin hairline strokes barely visible | Strokes appear at sub-pixel widths | `stroke-width` not present on paths or `<g>`; `getMaxStrokeWidth` returns 0; no scaling applied | Ensure `stroke-width="2"` is on the `<g>` wrapper |
| Icon doesn't respond to accent color | Always renders in black/currentColor | `stroke="currentColor"` missing from the `<g>` wrapper | Add `stroke="currentColor"` to the `<g>` element |
| ViewBox clipping or misalignment | Parts of the icon are cut off | Using a tight/non-standard viewBox | Always use `viewBox="0 0 24 24"` for Lucide icons |

---

## Adding a New Category or Subcategory

1. Extend the `IconCategory` and/or `IconSubcategory` union types at the top of `iconRegistry.ts`.
2. Add the subcategory to `SUBCATEGORY_MAP` under its category.
3. If the display name differs from the identifier, add it to `SUBCATEGORY_LABELS`.
4. Add one or more `buildIcons(...)` calls to `ICON_REGISTRY`.
5. Decide whether the new subcategory participates in any `IconPresetContext`; update `CONTEXT_SUBCATEGORIES` accordingly.
6. If adding a new category, add its theme color tokens where category chrome is rendered (picker tabs, headers).
7. Update `getDefaultHubConfig` if the new category should be a default landing tab.

---

## Pitfalls and Gotchas

- **Case-sensitive IDs**. `Fridge/freezer1.svg` is not `fridge/freezer1.svg`. Supabase storage is case-sensitive; mismatches silently return 404 and `SvgIcon` renders nothing.
- **Never bake width/height**. The pipeline strips and re-injects them. Baked values can confuse `extractDimension` fallback logic when a `viewBox` is missing.
- **Tiny strokes get rescaled**. Stroke widths below `vbSize * 0.045` are scaled up; do not rely on authored stroke widths for fine visual details.
- **Complex SVGs get boosted**. If your icon crosses the intermediate/complex thresholds, expect a 1.15x render-size boost and a 1.3x stroke boost. **Line-art icons do NOT get a render-size boost** (the former `LINE_ART_SIZE_MULTIPLIER` was removed on 2026-05-06); they render at exactly the requested `size`, with only stroke width adjusted.
- **Missing `fill="none"` silently turns a line-art icon into a filled icon**. The SVG default is `fill="black"`, so any stroked path without an explicit `fill="none"` (and no `fill="none"` ancestor) counts as filled for `isLineArtSvg`. If enough shapes are miscounted, the pipeline picks the filled branch and the icon renders as a solid silhouette with a coarse injected edge.
- **Do not expand viewBoxes as a sizing workaround**. Using negative-padded viewBoxes like `-2 -2 28 28` to make an icon visually smaller is fragile - it couples the file to a specific pipeline constant. Adjust path coordinates inside `0 0 24 24` or change the `size` prop instead.
- **Light gray line-art strokes auto-darken**. In non-monochrome line-art icons, grayscale strokes with luminance 50-200 become `#1f2937`. Use explicit color intent if you need a specific gray.
- **Monochrome detection is all-or-nothing**. A single non-grayscale color value flips the icon to "colorful" and disables recoloring across the entire file.
- **`forceColorful` does not disable stroke handling**. It only bypasses the forced-black `effectiveColor`; complexity-driven size/stroke adjustments still apply.
- **`<g fill="none">` inheritance matters**. Shapes without their own `fill` attribute inherit from ancestor `<g>` elements; `hasFillNoneAncestor` respects this, so stroke injection correctly skips them.
- **Color as cache key**. Every distinct `color` string creates a new `processedCache` entry. Prefer stable accent values (do not stringify objects or include alpha variations unnecessarily).
- **Two icon systems coexist**. Do not register lucide icons in `iconRegistry.ts`, and do not render registry icons through `itemTypeIcons.tsx`.
- **Lucide-react renamed many icons in v1.x**. The most common trap: `MoreVertical` was renamed to `EllipsisVertical`, and `MoreHorizontal` to `Ellipsis`. The old names still exist as aliases but may confuse AI agents or autocomplete into importing a visually different icon with a similar name (e.g. `MoveVertical` — vertical arrows — instead of `MoreVertical` — three dots). Always use the canonical v1.x names: `EllipsisVertical` for a vertical three-dot menu, `Ellipsis` for a horizontal three-dot menu. If an icon looks wrong in the UI, check the import name character-by-character — a single-letter difference can produce a completely different icon.

---

## Supabase Integration Notes

- **Storage bucket**: `icons` (public). URL is built as `${VITE_SUPABASE_URL}/storage/v1/object/public/icons/${folder}/${file}` by `iconRegistry.ts`.
- **Workspace settings**: `workspace_settings.colorful_icons_enabled` (boolean, default `true`). Read via `SyncContext` and updated from `WorkspaceModal`.
- **Accent colors**: nullable `text` columns on `fridge`, `sublocation`, `position`, `box`, `item`, `item_folder`.
- **Realtime sync**: the workspace settings hook subscribes via Supabase Realtime; toggling the colorful flag updates every open tab.
- **Adding icons does not require a migration** - only a storage upload and a registry edit. Adding a new accented entity or a new setting does require a migration.

---

## Historical Changes Log

Keep this section append-only. Every change to the icon pipeline or to individual authored SVGs that affects rendering semantics should leave a record here so future agents understand why things look the way they do.

### 2026-05-06

- **Removed `LINE_ART_SIZE_MULTIPLIER` (was `1.15`)** from `SvgIcon.tsx`. Line-art icons no longer receive a render-size boost; they render at exactly the requested `size`. Motivation: line-art icons were consistently ~15% larger than filled peers in the same grid, breaking visual balance. Stroke-width scaling is unaffected - thin line-art strokes still scale up to `vbSize * LINE_ART_MIN_STROKE_RATIO`.
- **Reverted `src/components/icons/place/Room1.svg`** from viewBox `-2 -2 28 28` back to the default `0 0 24 24`. The negative-padded viewBox had been added earlier to visually counter the 1.15x line-art boost; with the boost removed, the padding is no longer needed and would now make the icon render too small inside its frame.
- **Reverted `src/components/icons/bottle/bottle3.svg`** from viewBox `-1.5 -1.5 27 27` back to the default `0 0 24 24` for the same reason.
- **Normalized `Fridge/freezer1.svg` and `box/box1.svg` viewBoxes** from tight lucide-authored values (`3.5 0.5 17 23` and `1.5 0.5 21 22`) to the canonical `0 0 24 24`. These two files had been imported from lucide with the tight artwork bounds preserved, which caused them to render visibly larger than peers authored at the full `0 0 24 24` box (including `place/Room1.svg` and `bottle/bottle3.svg`). With `preserveAspectRatio="xMidYMid meet"`, a tight viewBox scales the art to fill the render square, while a padded viewBox preserves lucide's native ~2 px internal margin - producing the size mismatch the user reported. Both files were re-uploaded to Supabase storage via the `reseat-freezer1-box1` edge function, and `ICON_VERSIONS` was bumped to `'2'` for both entries to bust `svgCache` and browser caches.
- **Established canonical authoring standard**: all registry SVGs should use `viewBox="0 0 24 24"` with roughly 2 px of internal margin around the artwork (lucide convention). Many catalog files still diverge from this (tight: `Fridge/freezer2`, `box/box3`, `box/box6`, `drawer/Drawer1`, `antibody/antibody4`, `Drug/Drug3`, `Drug/Drug5`, `Drug/Drug6`, `Cell/Cell2`, `Cell/Cell5`, `equipment/equip1`, `equipment/equip4`, `Rack/rack1`, `cabinet/cabinet1`, `other/folder2`; oddball: `Fridge/freezer8`, `cabinet/cabinet5`, `tube/tube3`, and others). These should be re-authored in a follow-up pass if their visual size proves disruptive. Never reintroduce `LINE_ART_SIZE_MULTIPLIER` or negative-padded viewBoxes to paper over these differences; fix the source.

### Guidance derived from this change

- **Do not re-introduce negative-padded viewBoxes as a sizing workaround.** If an icon feels too large or too small in the UI, adjust the authored path coordinates within the standard `0 0 24 24` space, or change the `size` prop at the call site. Custom viewBoxes silently drift from the rest of the icon set and create future mystery regressions.
- **When adjusting sizing constants in `SvgIcon.tsx`,** audit every authored SVG whose viewBox is not `0 0 24 24`. Those files may have been tuned to counteract the very constant you are changing.

### 2026-08-06

- **Fixed spurious extra path in `DNA/DNA1.svg`** — the SVG contained an extra `<path d="M2 9c6.667 6 13.333 0 20 6" />` that does not exist in the official Lucide DNA icon (verified against `unpkg.com/lucide-static@latest/icons/dna.svg`). This drew a second S-curve across the icon that distorted the helix shape. Root cause: the path was introduced during the original authoring process (likely a copy-paste error or generated hallucination). Fix: removed the extra path to match the 11-path official source exactly.
- **Documented Lucide import workflow** — added the "Importing Lucide Icons into the Registry" section to this document covering: why raw Lucide SVGs break the renderer, a step-by-step conversion recipe, a before/after example, a quick-reference checklist, and a table of common failure modes.

#### All DNA icon issues (consolidated reference)

The DNA icon (added 2026-08-04) required two separate fix rounds. The full chain of problems:

1. **SVG structure incompatibility (fixed 2026-08-05)** — Presentation attributes (`fill="none"`, `stroke="currentColor"`, `stroke-width="2"`, `stroke-linecap="round"`, `stroke-linejoin="round"`) were placed on the root `<svg>` tag. The `<path>` children had no attributes and relied on SVG inheritance. The renderer's `hasFillNoneAncestor()` only walks `<g>` ancestors (regex: `/<(\/?)g\b([^>]*)>/g`), so it never detected the `fill="none"` on the `<svg>` root. Cascade of failures:
   - `isLineArtSvg()` classified the icon as filled (0% of paths had `hasStroke` true)
   - `isMonochromeSvg()` found no color attributes → returned true
   - `recolorMonochromeToCurrent()` injected `fill="currentColor"` on every bare path
   - `injectStrokeOnFillShapes()` added `stroke="currentColor" stroke-width="0.29"` on top
   - Visual result: solid black blobs instead of a stroked helix

2. **Spurious extra path (fixed 2026-08-06)** — An 12th path (`M2 9c6.667 6 13.333 0 20 6`) was present that doesn't exist in the official 11-path Lucide DNA source. It drew an unwanted horizontal S-curve that distorted the visual. Likely introduced by copying from a wrong source or AI hallucination during initial SVG authoring.

3. **Storage not updated after local fix** — Correcting the local `.svg` file alone had no effect because the app fetches icons from Supabase Storage at runtime. Required a separate upload step (via edge function or storage API).

4. **Cache not busted** — After re-uploading to Storage, the browser and CDN continued serving the old file. Required bumping the entry in `ICON_VERSIONS` to append a version query parameter and force a fresh fetch.

5. **Stroke-width invisible to renderer** — With `stroke-width` only on the `<svg>` root (before fix 1), `getMaxStrokeWidth()` technically found it via regex on the raw text, but since `isLineArtSvg()` had already returned false, the stroke-scaling branch was never reached. The icon went through the filled-icon code path instead.

### 2026-08-05

- **Fixed `DNA/DNA1.svg` rendering** — the original upload placed `fill="none"` and `stroke="currentColor"` on the root `<svg>` element with bare `<path>` children that inherited these attributes. The normalization pipeline's `hasFillNoneAncestor` only inspects `<g>` ancestors, not the `<svg>` root, so it failed to recognize the paths as stroke-only line art. This caused `recolorMonochromeToCurrent` to inject `fill="currentColor"` and `injectStrokeOnFillShapes` to override the intended 2 px stroke with a 0.29 px outline — producing a broken, nearly invisible icon. Fix: restructured the SVG to wrap all paths in `<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">`, which satisfies `hasFillNoneAncestor` and prevents both incorrect injections. Re-uploaded to Supabase Storage via the `seed-dna1-icon` edge function and bumped `ICON_VERSIONS` to `'2'`.

### 2026-08-04

- **Added `DNA` subcategory under Biology** with one icon (`DNA1.svg`), sourced from the Lucide DNA icon. Display label is "Genetics" (via `SUBCATEGORY_LABELS`). Intentionally excluded from all preset contexts (`location`, `box`, `item`, `folder`) — only accessible through the full Icon Hub. SVG authored at canonical `0 0 24 24` with `currentColor` strokes, stored at `icons/DNA/DNA1.svg` in Supabase Storage.

### 2026-07-23

- **Tightened `place/Room1.svg` viewBox** from `0 0 24 24` to `1 2 22 21`. The door artwork occupies roughly the inner area with ~1-2 px of whitespace on each side in the standard canvas. The tighter viewBox crops this padding so the artwork fills more of the render square, while leaving enough breathing room (1 unit on sides, 2 at top/bottom) to avoid stroke clipping in containers with `overflow-hidden`. Uploaded to Supabase Storage via the `seed-room1-icon` edge function and `ICON_VERSIONS` bumped to `'5'`.

---

## Quick Reference Appendix

### `<SvgIcon />` props

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| `iconId` | `string \| null \| undefined` | - | Registry ID; nullish renders nothing |
| `size` | `number` | `24` | Base size before complexity / line-art boosts |
| `color` | `string` | `undefined` | Overridden to `#000000` when colorful flag is off and not forced |
| `className` | `string` | - | Applied to the wrapping `<span>` |
| `forceColorful` | `boolean` | `false` | Bypasses the global colorful toggle |

### Constant quick-reference

See the [pipeline constants table](#constants).

### File cheat sheet

| Concern | File |
|---------|------|
| Catalog, helpers, presets | `src/config/iconRegistry.ts` |
| Rendering, pipeline, caches | `src/components/SvgIcon.tsx` |
| Idle preloading | `src/utils/preloadIcons.ts` |
| Global colorful flag | `src/contexts/SyncContext.tsx` |
| Workspace toggle UI | `src/components/WorkspaceModal.tsx` |
| Accent color picker | `src/components/ColorPicker.tsx` |
| Hub / picker UI | `src/components/IconHubModal.tsx`, `src/components/IconPresetRow.tsx` |
| Location defaults | `src/config/locationTypes.ts` |
| Separate lucide-based system | `src/utils/itemTypeIcons.tsx` |
| SVG source folders | `src/components/icons/**/*.svg` |

### Glossary

- **Line art**: SVG where >=60% of shapes are `stroke`-only (`fill="none"`).
- **Monochrome**: every explicit color is grayscale (channel delta <= 20).
- **Complexity level**: classifier from `measureComplexity` driving size/stroke boosts.
- **`currentColor`**: SVG sentinel that resolves against CSS `color`; used by the pipeline as a substitution target before final coloring.
- **Accent color**: per-entity hex string stored in Supabase, passed to `SvgIcon` as `color` and to card gradients.
- **`forceColorful`**: `SvgIcon` prop that disables the global colorful-icons override for that render.
- **Effective color**: the resolved color actually written into the final SVG (`!forceColorful && !colorfulIconsEnabled ? '#000000' : color`).

### 2026-08-06 (lucide-react icon naming)

- **Fixed `MoveVertical` → `EllipsisVertical` in BoxCard, ItemCard, ItemListView.** The three-dot vertical menu button was rendering as an up/down arrow icon because `MoveVertical` (↕ arrows) was imported and aliased as `MoreVertical`. The names differ by one character and are easy to confuse. Root cause: during a lucide-react upgrade to v1.x, the old `MoreVertical` export was likely unresolved in tooling and an AI assistant or autocomplete substituted the visually-similar-in-text `MoveVertical`.
- **Key rule for future work:** In lucide-react v1.x, use the canonical names — `EllipsisVertical` for the vertical three-dot menu and `Ellipsis` for the horizontal three-dot menu. The old names (`MoreVertical`, `MoreHorizontal`) still exist as aliases but should not be used; they are easy to confuse with `MoveVertical` / `MoveHorizontal` which are completely different arrow icons.
