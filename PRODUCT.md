# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The public: anyone curious about the film connections of a place. The founding use case is someone exploring close to home who finds interesting film links right on their doorstep. Tourist boards have also used the site, but the focus stays on people rather than organisations.

## Product Purpose

Movie Mapper shows which films have links to a place, so people can discover the film connections around them or anywhere else. It is a personal project. Success means people enjoy it and share it; there is no commercial goal.

## Positioning

The map is derived from the Wikipedia data dumps rather than a database built up by hand, which avoids the sparse coverage the creator saw on existing film location maps. Every point comes from a link between a Wikipedia film article and a Wikipedia place article.

## Operating Context

The site is live at https://movie.exussum.co.uk and the code is open source at https://github.com/exussum12/MovieLocations.

Data is rebuilt offline: `parse.php` reads a Wikipedia dump and the IMDb dataset, then `build_site.php` turns the output into the static files under `public/data`, and `build.sh` runs it all and precompresses them with gzip and brotli.

## Capabilities and Constraints

- Static hosting is a firm requirement: there is no application server or search API at runtime, and all search and filtering happens in the browser using files generated at build time.
- The base map comes from OpenFreeMap's hosted vector tiles through MapLibre, so it needs WebGL and depends on that service. All film data stays on this site's own static hosting.
- Browser speed and memory on phones are firm requirements, because of the data volume.
- Coordinates in the parsed data are deliberately staggered so markers for the same place don't sit exactly on top of each other. The variation is not real location data.
- A link means a film's article links to a place. It could be where the film was shot, where it is set, or any other connection, and the data does not record which. "Filming location" must not be claimed for an individual link.
- Each record holds film, place, latitude, longitude, IMDb score, IMDb votes and IMDb ID. IMDb fields can be missing.
- Locations can't be added directly on the site. Corrections are made by editing Wikipedia.
- Current features: browsable map, locate me, search by title, and filters for IMDb score and vote count.

## Brand Commitments

The product name is Movie Mapper. "Movie Finder" in the current heading and Open Graph title is retired.

The look is the category standard on purpose: a clean, familiar map search at the craft level of Airbnb's map search, with no novelty theme. The owner tried a themed printed-map design and rejected it as ugly.

Required attribution: Wikipedia data under CC BY-SA 3.0, OpenStreetMap contributors and OpenMapTiles for the base map, and "Information courtesy of IMDb (IMDb.com). Used with permission."

## Evidence on Hand

- `public/parsed.csv`: about 262,000 film-to-place links.
- `public/data/`: the same data as map cells, film lists and search indexes.
- The About page's account of why the project exists.

There are no user testimonials, traffic figures or named tourist board partners on hand. Do not fabricate any.

## Product Principles

- Discovery comes first: finding an unexpected link to a familiar place is the core reward.
- Be honest about what a link means, and never overstate it as a filming location.
- Make discoveries easy to share, because sharing is how the project succeeds.
- Stay simple to host and run as one person's open source project.
- Credit the sources people can follow and improve, especially Wikipedia.
