---
version: 1
slug: "public-index-html"
primary_target: "public/index.html"
related_targets: []
---

# Movie Mapper: map site

Scope: whole-site visual replacement of `public/index.html`. Visitor mode: Experience. Static hosting only; search and filters run in the browser from build-time files. Audience, job and proof are in PRODUCT.md.

Decisions: the user rejected the printed-map look as ugly (colour and type, side panel, symbols) and chose the category standard. Base map is OpenFreeMap vector tiles through MapLibre. Quality bar: Airbnb's map search.

## Direction contract

THESIS: A clean, friendly map search, played straight at Airbnb's level of craft, where list and map respond to each other. Refuses printed-map costume, novelty and any quirk smuggled in.

OWN-WORLD: White floating card, near-black text, muted grey secondary text, one blue for everything film. Quiet neutral map with pale water and green. System type, generous rounded corners, soft shadows, round markers sized by film count.

STORY: Search or look around a familiar place, see its films, follow a film across its places, share the link.

FIRST VIEWPORT: Map fills the screen. A floating card on the left holds name, search, pills, then the place heading and results. On phones the card becomes a bottom sheet.

FORM: Category standard (canon), chosen by the user from a re-rolled hand. seed:f00f3bf92da8fa77. Signature interaction: hovering a result highlights its marker; choosing a film isolates its places.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
