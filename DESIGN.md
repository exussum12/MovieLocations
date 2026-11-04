---
name: Movie Mapper
description: A clean, category-standard map search for the films linked to any place.
colors:
  blue: "#2f6fed"
  blue-hover: "#2460d6"
  blue-text: "#1f5ad1"
  blue-tint: "#e8effd"
  blue-selection: "#cfdefc"
  surface: "#ffffff"
  ink: "#1a1f2b"
  muted: "#5b6472"
  line: "#e6e8eb"
  control-border: "#8a909a"
  field: "#f0f1f3"
  hover: "#f5f6f8"
  marker-receded: "#a6acb5"
  wide-area-fill: "rgba(255,255,255,0.35)"
  you-are-here: "#1aa260"
  map-land: "#f6f6f4"
  map-green: "#e7eee0"
  map-water: "#cfe1ee"
  map-building: "#ecece8"
  map-boundary: "#d7d7d3"
  map-label: "#6f7680"
typography:
  heading:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  wordmark:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1.4
  row-name:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.4
  subheading:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, sans-serif"
    fontSize: "14px"
    fontWeight: 700
    lineHeight: 1.4
  body:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.4
  input:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.4
  pill:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.4
  button:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.4
  meta:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.4
    fontFeature: "'tnum'"
  note:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.4
  map-label:
    fontFamily: "Noto Sans Bold"
    fontSize: "12px"
    fontWeight: 700
  map-label-film:
    fontFamily: "Noto Sans Bold"
    fontSize: "13px"
    fontWeight: 700
  map-label-selected:
    fontFamily: "Noto Sans Bold"
    fontSize: "14px"
    fontWeight: 700
rounded:
  radius: "14px"
  radius-small: "10px"
  pill: "999px"
  handle: "2px"
spacing:
  gap: "16px"
  inset: "14px"
  row-gap: "12px"
  control-gap: "10px"
  small: "8px"
  tight: "4px"
  card-width: "372px"
components:
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.radius}"
    width: "{spacing.card-width}"
  sheet-handle:
    backgroundColor: "{colors.control-border}"
    rounded: "{rounded.handle}"
    width: "40px"
    height: "4px"
  search-box:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    typography: "{typography.input}"
    rounded: "{rounded.radius-small}"
    padding: "0 14px"
    height: "46px"
  search-box-focus:
    backgroundColor: "{colors.surface}"
  pill:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.pill}"
    rounded: "{rounded.pill}"
    padding: "0 14px"
    height: "44px"
  pill-hover:
    backgroundColor: "{colors.hover}"
  action-button:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.surface}"
    typography: "{typography.button}"
    rounded: "{rounded.radius-small}"
    padding: "0 16px"
    height: "44px"
  action-button-hover:
    backgroundColor: "{colors.blue-hover}"
  text-button:
    textColor: "{colors.blue-text}"
    typography: "{typography.button}"
    height: "44px"
  filter-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.input}"
    rounded: "{rounded.radius-small}"
    padding: "0 10px"
    height: "44px"
  row:
    textColor: "{colors.ink}"
    typography: "{typography.row-name}"
    rounded: "{rounded.radius-small}"
    padding: "9px 8px"
    height: "48px"
  row-hover:
    backgroundColor: "{colors.hover}"
  row-linked:
    backgroundColor: "{colors.blue-tint}"
  toast:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    typography: "{typography.meta}"
    rounded: "{rounded.radius-small}"
    padding: "10px 14px"
  marker-film:
    backgroundColor: "{colors.blue}"
    size: "22px"
  marker-wide-area:
    backgroundColor: "{colors.wide-area-fill}"
    size: "28px"
  marker-selected:
    backgroundColor: "{colors.ink}"
    size: "26px"
  marker-you-are-here:
    backgroundColor: "{colors.you-are-here}"
    size: "14px"
---

# Design System: Movie Mapper

## Overview

**Creative North Star: "Category-standard map search"**

Movie Mapper looks like a map search on purpose. The owner chose the category standard, with Airbnb's map search as the quality bar, after trying a themed printed-map look and rejecting it as ugly. There is no theme, costume or metaphor here, and none should be added. The design should be judged on how well a familiar pattern is made: clear hierarchy, tidy spacing, and a list and map that respond to each other.

The map fills the screen. A white floating card holds the name, search, filters and results, and on phones that card becomes a bottom sheet. Text is near-black with a muted grey for secondary information, and one blue carries everything to do with film. The base map stays quiet so the blue markers stand out against it.

The page is dense without feeling busy, because about 262,000 film-to-place links have to work on a phone. Several rules below are performance rules rather than visual ones. They are recorded here because they decide what a marker or a list can be.

**Key Characteristics:**
- A full-screen map with one floating card on larger screens and one bottom sheet on phones.
- White surfaces, near-black text, muted grey secondary text and one blue for film.
- A quiet neutral base map with pale water and pale green.
- System fonts, generous rounded corners and soft shadows.
- Round markers drawn as map layers, sized by film count.
- One light theme.

## Colors

A neutral interface and a neutral map, with one blue for film and almost nothing else.

### Primary
- **Blue** (#2f6fed): All film markers, overview dots, the primary Share button and the focus ring. It is also the site icon's colour.
- **Blue Hover** (#2460d6): The primary button's hover state.
- **Blue Text** (#1f5ad1): Links, text buttons and the active filter count. A darker step of the same blue, used wherever the blue is small text.
- **Blue Tint** (#e8effd): A result row whose marker is hovered on the map.
- **Blue Selection** (#cfdefc): Selected text.

### Neutral
- **Surface** (#ffffff): The card, sheet, pills, filter fields, button text and marker outlines.
- **Ink** (#1a1f2b): Main text, map labels, the toast background, and hovered or selected markers.
- **Muted** (#5b6472): Secondary text, counts, placeholders, Back and About. It stays above 5:1 on every card background.
- **Line** (#e6e8eb): Dividers between result rows.
- **Control Border** (#8a909a): Pill and filter field borders, the scrollbar and the sheet handle.
- **Field** (#f0f1f3): The search box at rest.
- **Hover** (#f5f6f8): Hovered rows and pills.
- **Marker Receded** (#a6acb5): Other places while a film is being followed, at 55% opacity with no outline.
- **Wide Area Fill** (rgba(255,255,255,0.35)): The thin white wash inside a hollow ring.
- **You Are Here** (#1aa260): The visitor's own position from Near me, and nothing else.

### Base Map
- **Land** (#f6f6f4): The map background, the page background behind it, and the halo on place labels.
- **Pale Green** (#e7eee0): Parks and woodland. The current style also applies it to residential land and ice.
- **Pale Water** (#cfe1ee): Seas, lakes and rivers.
- **Building** (#ecece8): Building footprints from zoom 12, at 70% opacity.
- **Boundary** (#d7d7d3): Country and region borders.
- **Map Label** (#6f7680): The base map's own place and road names, with a Land halo. Roads and railways are white.

These values live in three places, because map paint can't read CSS variables: `app.css` for the interface, the constants and layers in `app.js` for markers, and `map-style.json` for the base map. A colour change has to reach all that use it.

### Named Rules
**The One Blue Rule.** Film is always blue, in one hue. No other accent colour may stand for film data, and no marker may be coloured by score, year or genre. Ink marks the hovered or selected marker, grey marks receded markers, and green only marks the visitor.

**The One Light Theme Rule.** There is one light theme (`color-scheme: light`) and no dark mode, on the interface or the map.

## Typography

**Display Font:** None. Headings use the system font at a heavier weight.
**Body Font:** system-ui (with -apple-system, Segoe UI, Roboto, Noto Sans, sans-serif)
**Label/Mono Font:** Noto Sans Bold for labels drawn on the map, and no mono font.

**Character:** Plain and familiar. It should read as the visitor's own device, with hierarchy built from size and weight alone.

### Hierarchy
- **Heading** (700, 24px, 1.2, -0.01em): The place, film or area heading in the card. Long names wrap anywhere rather than overflow.
- **Wordmark** (700, 15px, 1.4): "Movie Mapper" at the top of the card. It stays smaller than the place heading.
- **Row Name** (600, 15px, 1.4): The name of a place or film in a result row.
- **Subheading** (700, 14px, 1.4): Group headings inside the panel, such as result sections.
- **Body** (400, 15px, 1.4): About text and short messages in the panel.
- **Input** (400, 16px, 1.4): The search box and filter fields. 16px stops iOS zooming the page on focus, so it must not go smaller.
- **Pill** (500, 14px, 1.4): Near me and IMDb filters.
- **Button** (600, 14px, 1.4): The primary button and text buttons.
- **Meta** (400, 14px, 1.4, tabular numbers): Counts and summary lines, such as "11,187 film links across 1,734 places".
- **Note** (400, 13px, 1.4): Row details and explanatory notes, with tabular numbers in row details.
- **Map labels** (700, 12px for place labels, 13px for a followed film and for hover, 14px for the selected place): Ink, with a 2px halo in Land, or 2.5px in white on hover and selection.

### Named Rules
**The System Fonts Rule.** The interface uses the system font stack and downloads no font, for phone speed. The one exception is outside the interface: MapLibre draws all map text from Noto Sans glyph files served with the base map tiles, as map layers can't use system fonts here. Screenshots from a Linux machine show Noto Sans in the card too, but that is only that machine's system font.

**The Link Wording Rule.** A connection is always a "link", as in "15 films have links here" and "Has links to 13 places". Never call one a "filming location", because the data doesn't record whether a film was shot there, set there or connected some other way. The About page may explain that a link could be any of these.

## Layout

The map fills the whole viewport and the page never scrolls. Everything else floats above it.

On larger screens, the card sits on the left with a 16px gap on the top, left and bottom, and is 372px wide. It holds the header, search and pills at a fixed height, and only the panel below them scrolls. The map's padding follows the card, so a place being moved to always lands in the clear area, not behind the card. Zoom controls sit top right and attribution bottom right.

The phone layout applies at up to 767px wide, and to landscape phones up to 960px wide and 540px tall. The card becomes a full-width bottom sheet with three stops: peek (the search, the pills and the top of the results), half (55% of the screen) and full (the screen height less 40px). It can be dragged by the handle or the header. When a place, film or the About page is open, the header and pills are hidden so that more rows show. The map's padding, attribution and toast all follow the sheet's visible height, and the safe area at the bottom is respected.

Spacing is a tight rhythm of 4, 8, 10, 12, 14 and 16px, with 16px as the card's inner edge and its gap from the screen. Result rows are at least 48px tall and separated by 1px lines. Hover backgrounds extend 8px past the text on each side, so that text stays aligned with the heading.

### Named Rules
**The Touch Target Rule.** Every interactive control on a phone has a target of at least 44px. A smaller visible shape needs a larger hit area.

## Elevation & Depth

There are two levels: the map, and the things floating above it. Soft, diffuse shadows separate them. Everything inside the card is flat and is separated by lines, tints and space, not by shadow.

### Shadow Vocabulary
- **Floating** (`box-shadow: 0 2px 16px rgb(20 30 50 / 0.16)`): The card, the zoom controls and the toast.
- **Sheet** (`box-shadow: 0 -2px 14px rgb(20 30 50 / 0.18)`): The phone's bottom sheet, casting upward over the map.

## Shapes

Corners are generously rounded and come in a few set sizes: 14px for the card and the top corners of the sheet, 10px for controls, rows, the toast and the zoom control group, and full pills for Near me and IMDb filters. Markers are always circles. Icons are 18px line drawings on a 20-unit grid, with a 1.8 stroke and round caps (16px in the primary button).

### Named Rules
**The Hollow Ring Rule.** A wide area, such as a country or region, is always a hollow ring and never a filled marker, because it isn't an exact spot. It is a 28px ring with a 3px blue outline when a film is followed, and a 3px ink outline when hovered (32px) or selected (34px). Wide areas stay off the browsing layer altogether. A ring draws above exact dots so it can't vanish beneath them, an exact place's label wins over a wide area's, and wide areas are listed after exact places.

## Components

Familiar controls, made carefully and left plain.

### Buttons
- **Shape:** Slightly rounded (10px) with a 44px minimum height.
- **Primary:** Blue with white text, 16px side padding and an optional 16px icon. It is used for Share, one per view.
- **Hover / Focus:** Hover moves to Blue Hover, on hover-capable devices only. Keyboard focus shows a 2px blue outline offset by 2px, as it does for every control.
- **Text button:** Blue Text with no background or padding, underlined on hover. It is used for "Show all on map" and "Clear filters".
- **Quiet button:** Muted text with no background, turning Ink on hover. It is used for About and Back.

### Chips
- **Style:** White pills with a 1px Control Border, 14px side padding, a 44px height and an 18px icon.
- **State:** Hover uses the Hover fill. An open pill has a 2px Ink border, drawn without changing its size. The active filter count is bold Blue Text inside the pill.

### Cards / Containers
- **Corner Style:** Gently rounded (14px), or top corners only on the sheet.
- **Background:** Surface.
- **Shadow Strategy:** Floating on larger screens and Sheet on phones.
- **Border:** None.
- **Internal Padding:** 16px at the sides, and the panel alone scrolls.

### Inputs / Fields
- **Search box:** A borderless 46px Field fill with a 10px radius, a Muted search icon and 14px side padding.
- **Search focus:** The fill turns white, with a 2px blue outline offset by 1px.
- **Filter fields:** White, 44px tall, with a 1px Control Border and a 10px radius. Labels sit above in Muted, in a two-column grid. Selects use a drawn chevron rather than the browser's own.

### Navigation
There is no navigation bar. The header holds the wordmark, which returns home, and About. Back appears above the heading in a detail view.

### Result Row
A full-width row with the name, a detail line and a right-aligned count. It has no border radius showing at rest, only a line above. Hover uses the Hover fill. Hovering or focusing a place row also marks that place on the map, with its name. Hovering a marker tints its row with Blue Tint, so that the list and map answer each other.

### Map Markers
Markers are map layers, never page elements.
- **Overview dots** (below zoom 8): Blue circles at 92% opacity with a 2px white outline and a bold white count, from 22px to 56px across according to links. Groups get finer as the map zooms in, from 20 degrees across at the widest to 1 degree.
- **Place dots** (zoom 8 and closer): Blue circles with a white outline, with a size set by the square root of the film count and scaled with zoom. Every place shows from zoom 8, however few films it has, and only the labels thin out.
- **Followed film:** Choosing a film isolates its places. Its exact places become 22px blue dots with a 2px white outline and named labels, while other dots recede to grey, and their labels and the overview hide.
- **Hover and selected:** An Ink dot with a 3px white outline (24px on hover, 26px when selected), with a label on a white halo.
- **You are here:** A 14px green dot with a 3px white outline.
- **Hit area:** Clicks and taps reach beyond the visible marker, by 14px with a mouse and 28px with touch, and the nearest marker wins. Map labels are clickable too.

### Toast
Short status messages in Ink with white text, 14px, 10px radius and the Floating shadow. It is centred near the bottom of the map and clears after a few seconds.

### Motion
Motion only serves the map and sheet. The sheet settles over 280ms (`cubic-bezier(0.16, 1, 0.3, 1)`), and short map moves ease over 400 to 500ms. Far jumps cut straight in, as a long flight would fetch tiles the whole way. Reduced motion removes all of it.

## Do's and Don'ts

### Do:
- **Do** treat Airbnb's map search as the quality bar, and solve problems the way a familiar map search would.
- **Do** keep markers as GPU map layers, which is what keeps panning fast on phones. To change how a marker looks, change its layer's paint.
- **Do** keep heavy data in the worker. The main thread asks it for one page of results or one film at a time, so it never holds an object for every film.
- **Do** write "link" for every connection between a film and a place.
- **Do** draw every wide area as a hollow ring.
- **Do** use the one blue for everything to do with film.
- **Do** give every phone control a target of at least 44px.
- **Do** keep input text at 16px, so iOS doesn't zoom on focus.
- **Do** keep the list and map responding to each other in both directions.

### Don't:
- **Don't** add a theme, a metaphor or printed-map styling. The owner tried a printed-map look and rejected it as ugly.
- **Don't** create a DOM element per marker, including `maplibregl.Marker`, as thousands of them would slow phones.
- **Don't** build objects across the film catalogue on the main thread.
- **Don't** download a web font for the interface.
- **Don't** call a link a "filming location".
- **Don't** draw a wide area as a filled marker.
- **Don't** add a second accent colour for film, or colour markers by data.
- **Don't** add a dark theme.
