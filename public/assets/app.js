'use strict';

(function () {
    const FULL_DETAIL_ZOOM = 8; // Below this the map shows the overview, not individual places
    const PAGE_SIZE = 50;
    const LIST_ROWS = 40;
    const MAX_CELLS_KEPT = 64;
    const MAX_CONCURRENT_FETCHES = 4;
    const DEFAULT_VIEW = { lat: 51.505, lon: -0.09, zoom: 9 };

    const BLUE = '#2f6fed';
    const INK = '#1a1f2b';
    const LAND = '#f6f6f4';
    const BOLD_FONT = ['Noto Sans Bold'];
    const EMPTY = { type: 'FeatureCollection', features: [] };

    const $ = (id) => document.getElementById(id);
    const prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const isPhoneLayout = matchMedia('(max-width: 767px), (max-height: 540px) and (max-width: 960px)');
    const canHover = matchMedia('(hover: hover)').matches;

    const state = {
        manifest: null,
        cellLinks: new Map(), // "lat/lon" -> links, from the manifest
        cells: new Map(), // "lat/lon" -> { places, usedAt, countsFor }
        failedCells: new Set(),
        inFlight: new Map(),
        overview: null,
        overviewPromise: null,
        filters: { min: null, max: null, votes: null, mode: 'gt' },
        place: null,
        film: null,
        about: false,
        term: '',
        results: null,
        filterResults: false,
        searchError: false,
        pushedEntries: 0,
        mapReady: false,
    };

    // ---------------------------------------------------------------- Worker

    const worker = new Worker('assets/data-worker.js');
    const pendingCalls = new Map();
    let nextCallId = 1;
    worker.onmessage = ({ data }) => {
        const call = pendingCalls.get(data.id);
        if (!call) return;
        pendingCalls.delete(data.id);
        if (data.error) call.reject(new Error(data.error));
        else call.resolve(data.result);
    };
    const callWorker = (type, payload) => new Promise((resolve, reject) => {
        const id = nextCallId++;
        pendingCalls.set(id, { resolve, reject });
        worker.postMessage({ ...payload, id, type });
    });

    // --------------------------------------------------------------- Helpers

    function h(tag, attributes, ...children) {
        const element = document.createElement(tag);
        for (const [name, value] of Object.entries(attributes || {})) {
            if (value == null || value === false) continue;
            if (name.startsWith('on')) element.addEventListener(name.slice(2), value);
            else if (name === 'class') element.className = value;
            else element.setAttribute(name, value === true ? '' : value);
        }
        for (const child of children.flat()) {
            if (child != null && child !== false) element.append(child);
        }
        return element;
    }

    function icon(path) {
        const wrapper = document.createElement('span');
        wrapper.style.display = 'contents';
        wrapper.innerHTML = `<svg class="icon" viewBox="0 0 20 20" aria-hidden="true">${path}</svg>`;
        return wrapper;
    }
    const ICONS = {
        back: '<path d="M12 4 6 10l6 6"/>',
        share: '<path d="M10 13V3M6 6.5 10 3l4 3.5M4 11v6h12v-6"/>',
    };

    const number = new Intl.NumberFormat('en-GB');
    const formatCount = (value) => number.format(value);
    const plural = (count, word) => `${formatCount(count)} ${word}${count === 1 ? '' : 's'}`;
    const placeLabel = (name) => name.replace(/_/g, ' ');

    // "Batman_(1989_film)" reads as "Batman" with the year beside it
    function filmLabel(title) {
        const text = title.replace(/_/g, ' ');
        const match = text.match(/^(.*?)\s*\((?:(\d{4})\s+)?(?:[^()]*\s)?film\)$/);
        return match ? { name: match[1], year: match[2] || null } : { name: text, year: null };
    }
    const filmText = (title) => {
        const { name, year } = filmLabel(title);
        return year ? `${name} (${year})` : name;
    };

    const wikipediaUrl = (title) => `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`;
    const imdbUrl = (id) => `https://www.imdb.com/title/${encodeURIComponent(id)}/`;
    const cellKey = (lat, lon) => `${Math.floor(lat)}/${Math.floor(lon)}`;
    const hasFilters = () => state.filters.min != null || state.filters.max != null || state.filters.votes != null;
    const filterSignature = () => JSON.stringify(state.filters);
    const point = (lon, lat, properties) => ({ type: 'Feature', properties, geometry: { type: 'Point', coordinates: [lon, lat] } });

    function storageGet(key) {
        try { return localStorage.getItem(key); } catch (error) { return null; }
    }
    function storageSet(key, value) {
        try { localStorage.setItem(key, value); } catch (error) { /* Private windows can refuse this */ }
    }

    let toastTimer = 0;
    function toast(message) {
        const element = $('toast');
        element.textContent = message;
        element.hidden = false;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { element.hidden = true; }, 4500);
    }

    // ------------------------------------------------------------------ Map

    let map;
    try {
        map = new maplibregl.Map({
            container: 'map',
            style: 'assets/map-style.json',
            center: [DEFAULT_VIEW.lon, DEFAULT_VIEW.lat],
            zoom: DEFAULT_VIEW.zoom,
            minZoom: 0,
            maxZoom: 19,
            dragRotate: false,
            pitchWithRotate: false,
            attributionControl: false,
            fadeDuration: prefersReducedMotion.matches ? 0 : 150,
            // A cap on the sharpness of the map keeps phones with very dense screens smooth
            pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
        });
    } catch (error) {
        $('panel').replaceChildren(h('p', { style: 'margin-top:12px' }, 'This browser can’t draw the map, because WebGL is turned off or not supported. Try another browser.'));
        return;
    }
    map.touchZoomRotate.disableRotation();
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(new maplibregl.AttributionControl({
        compact: false,
        customAttribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }), 'bottom-right');

    let baseMapWarned = false;
    map.on('error', (event) => {
        const message = String(event.error && event.error.message);
        if (!baseMapWarned && /tiles\.openfreemap|map-style|Failed to fetch|AJAXError/i.test(message)) {
            baseMapWarned = true;
            toast('Some of the map background didn’t load. Film links and search still work.');
        }
    });

    function addMapLayers() {
        map.addSource('overview', { type: 'geojson', data: EMPTY });
        map.addSource('places', { type: 'geojson', data: EMPTY, buffer: 32 });
        map.addSource('film', { type: 'geojson', data: EMPTY });
        map.addSource('hover', { type: 'geojson', data: EMPTY });
        map.addSource('selected', { type: 'geojson', data: EMPTY });
        map.addSource('me', { type: 'geojson', data: EMPTY });

        const links = ['coalesce', ['get', 'links'], 0];
        map.addLayer({
            id: 'overview-dots',
            type: 'circle',
            source: 'overview',
            maxzoom: FULL_DETAIL_ZOOM,
            layout: { 'circle-sort-key': links },
            paint: {
                'circle-color': BLUE,
                'circle-opacity': 0.92,
                'circle-stroke-color': '#fff',
                'circle-stroke-width': 2,
                'circle-radius': ['interpolate', ['linear'], ['sqrt', links], 1, 11, 30, 17, 120, 28],
            },
        });
        map.addLayer({
            id: 'overview-counts',
            type: 'symbol',
            source: 'overview',
            maxzoom: FULL_DETAIL_ZOOM,
            layout: {
                'text-field': ['case',
                    ['>=', links, 10000], ['concat', ['to-string', ['round', ['/', links, 1000]]], 'k'],
                    ['>=', links, 1000], ['concat', ['to-string', ['/', ['round', ['/', links, 100]], 10]], 'k'],
                    ['to-string', links]],
                'text-font': BOLD_FONT,
                'text-size': 12,
                'text-allow-overlap': true,
                'text-ignore-placement': true,
            },
            paint: { 'text-color': '#fff' },
        });

        // Under the map's own labels, so markers never strike through a town name
        const firstLabel = map.getStyle().layers.find((layer) => layer.type === 'symbol');
        map.addLayer({
            id: 'place-dots',
            type: 'circle',
            source: 'places',
            minzoom: FULL_DETAIL_ZOOM,
            layout: { 'circle-sort-key': ['get', 'c'] },
            paint: {
                'circle-color': BLUE,
                'circle-stroke-color': '#fff',
                'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 8, 1, 12, 1.5],
                'circle-radius': ['interpolate', ['linear'], ['zoom'],
                    8, ['interpolate', ['linear'], ['sqrt', ['get', 'c']], 1, 3, 45, 15],
                    13, ['interpolate', ['linear'], ['sqrt', ['get', 'c']], 1, 9, 45, 22]],
            },
        }, firstLabel && firstLabel.id);
        map.addLayer({
            id: 'place-labels',
            type: 'symbol',
            source: 'places',
            minzoom: FULL_DETAIL_ZOOM,
            filter: ['step', ['zoom'], ['>=', ['get', 'l'], 60], 10, ['>=', ['get', 'l'], 15], 12, ['>=', ['get', 'l'], 3], 13, true],
            layout: {
                'text-field': ['get', 'n'],
                'text-font': BOLD_FONT,
                'text-size': 12,
                'text-offset': [0, 1.1],
                'text-anchor': 'top',
                'text-max-width': 9,
                'symbol-sort-key': ['-', 0, ['get', 'c']],
                'text-optional': true,
            },
            paint: { 'text-color': INK, 'text-halo-color': LAND, 'text-halo-width': 2 },
        });

        map.addLayer({
            id: 'film-dots',
            type: 'circle',
            source: 'film',
            // Exact places draw first, so a wide area's ring can't vanish beneath them
            layout: { 'circle-sort-key': ['get', 'a'] },
            paint: {
                // A wide area is a hollow ring, as it isn't an exact spot
                'circle-color': ['case', ['==', ['get', 'a'], 1], 'rgba(255,255,255,0.35)', BLUE],
                'circle-radius': ['case', ['==', ['get', 'a'], 1], 14, 11],
                'circle-stroke-color': ['case', ['==', ['get', 'a'], 1], BLUE, '#fff'],
                'circle-stroke-width': ['case', ['==', ['get', 'a'], 1], 3, 2],
            },
        });
        map.addLayer({
            id: 'film-labels',
            type: 'symbol',
            source: 'film',
            layout: {
                'text-field': ['get', 'n'],
                'text-font': BOLD_FONT,
                'text-size': 13,
                'text-radial-offset': 1,
                'text-variable-anchor': ['top', 'bottom', 'right', 'left'],
                'text-max-width': 10,
                // An exact place's name wins over a wide area's
                'symbol-sort-key': ['get', 'a'],
            },
            paint: { 'text-color': INK, 'text-halo-color': LAND, 'text-halo-width': 2 },
        });

        // A phone's world view has no room for names, and the list gives them anyway
        map.setLayerZoomRange('film-labels', isPhoneLayout.matches ? 3.5 : 0, 24);

        map.addLayer({
            id: 'hover-ring',
            type: 'circle',
            source: 'hover',
            paint: {
                'circle-color': ['case', ['==', ['get', 'a'], 1], 'rgba(255,255,255,0.35)', INK],
                'circle-radius': ['case', ['==', ['get', 'a'], 1], 16, 12],
                'circle-stroke-color': ['case', ['==', ['get', 'a'], 1], INK, '#fff'],
                'circle-stroke-width': 3,
            },
        });
        map.addLayer({
            id: 'hover-label',
            type: 'symbol',
            source: 'hover',
            layout: {
                'text-field': ['get', 'n'],
                'text-font': BOLD_FONT,
                'text-size': 13,
                'text-offset': [0, 1],
                'text-anchor': 'top',
                'text-allow-overlap': true,
                'text-ignore-placement': true,
            },
            paint: { 'text-color': INK, 'text-halo-color': '#fff', 'text-halo-width': 2.5 },
        });
        map.addLayer({
            id: 'selected-dot',
            type: 'circle',
            source: 'selected',
            paint: {
                'circle-color': ['case', ['==', ['get', 'a'], 1], 'rgba(255,255,255,0.35)', INK],
                'circle-radius': ['case', ['==', ['get', 'a'], 1], 17, 13],
                'circle-stroke-color': ['case', ['==', ['get', 'a'], 1], INK, '#fff'],
                'circle-stroke-width': 3,
            },
        });
        map.addLayer({
            id: 'selected-label',
            type: 'symbol',
            source: 'selected',
            layout: {
                'text-field': ['get', 'n'],
                'text-font': BOLD_FONT,
                'text-size': 14,
                'text-offset': [0, 1],
                'text-anchor': 'top',
                'text-allow-overlap': true,
                'text-ignore-placement': true,
            },
            paint: { 'text-color': INK, 'text-halo-color': '#fff', 'text-halo-width': 2.5 },
        });
        map.addLayer({
            id: 'me-dot',
            type: 'circle',
            source: 'me',
            paint: { 'circle-color': '#1aa260', 'circle-radius': 7, 'circle-stroke-color': '#fff', 'circle-stroke-width': 3 },
        });
    }

    function setSource(id, data) {
        if (state.mapReady) map.getSource(id).setData(data);
    }

    // Everything else recedes while a film is being followed
    function applyFilmEmphasis() {
        if (!state.mapReady) return;
        const following = !!state.film;
        map.setPaintProperty('place-dots', 'circle-color', following ? '#a6acb5' : BLUE);
        map.setPaintProperty('place-dots', 'circle-opacity', following ? 0.55 : 1);
        map.setPaintProperty('place-dots', 'circle-stroke-opacity', following ? 0 : 1);
        map.setLayoutProperty('place-labels', 'visibility', following ? 'none' : 'visible');
        for (const id of ['overview-dots', 'overview-counts']) {
            map.setLayoutProperty(id, 'visibility', following ? 'none' : 'visible');
        }
    }

    // ---------------------------------------------------------- Clear of the card

    // The part of the map not hidden behind the card or the phone's sheet
    function clearArea() {
        const canvas = map.getCanvas().getBoundingClientRect();
        const padding = map.getPadding();
        return {
            left: padding.left,
            top: padding.top,
            right: canvas.width - padding.right,
            bottom: canvas.height - padding.bottom,
        };
    }

    function clearBounds() {
        const area = clearArea();
        return new maplibregl.LngLatBounds(
            map.unproject([area.left, area.bottom]),
            map.unproject([area.right, area.top]),
        );
    }

    function targetPadding() {
        if (isPhoneLayout.matches) return { left: 0, top: 0, right: 0, bottom: sheetVisible };
        const card = $('card').getBoundingClientRect();
        return { left: card.right, top: 0, right: 0, bottom: 0 };
    }

    function moveTo(lat, lon, zoom) {
        const from = map.project([lon, lat]);
        const area = clearArea();
        const size = Math.max(area.right - area.left, area.bottom - area.top);
        const distance = Math.hypot(from.x - (area.left + area.right) / 2, from.y - (area.top + area.bottom) / 2);
        // Long animated flights fetch tiles all the way there, so far jumps cut straight in
        const far = distance > size * 1.5 || Math.abs(zoom - map.getZoom()) > 3;
        const padding = targetPadding();
        if (far || prefersReducedMotion.matches) map.jumpTo({ center: [lon, lat], zoom, padding });
        else map.easeTo({ center: [lon, lat], zoom, padding, duration: 450 });
    }

    // ---------------------------------------------------------- Loading places

    function cellsInView(padding = 0) {
        const bounds = clearBounds();
        const south = Math.floor(Math.max(bounds.getSouth() - padding, -90));
        const north = Math.floor(Math.min(bounds.getNorth() + padding, 90));
        const west = Math.floor(Math.max(bounds.getWest() - padding, -180));
        const east = Math.floor(Math.min(bounds.getEast() + padding, 180));
        const keys = [];
        for (let lat = south; lat <= north; lat++) {
            for (let lon = west; lon <= east; lon++) {
                const key = `${lat}/${lon}`;
                if (state.cellLinks.has(key)) keys.push(key);
            }
        }
        const centre = bounds.getCenter();
        const distance = (key) => {
            const [lat, lon] = key.split('/').map(Number);
            return (lat + 0.5 - centre.lat) ** 2 + (lon + 0.5 - centre.lng) ** 2;
        };
        return keys.sort((a, b) => distance(a) - distance(b));
    }

    const dataUrl = (path) => `data/${path}?v=${state.manifest.version}`;

    function loadCell(key, controller) {
        if (state.cells.has(key)) return Promise.resolve(state.cells.get(key));
        if (state.inFlight.has(key)) return state.inFlight.get(key);
        const request = fetch(dataUrl(`cells/${key}.json`), controller ? { signal: controller.signal } : undefined)
            .then((response) => {
                if (!response.ok) throw new Error(String(response.status));
                return response.json();
            })
            .then((rows) => {
                const cell = {
                    places: rows.map(([name, lat, lon, area, count, top]) => ({
                        name, lat, lon, area: area === 1, count, top, shown: hasFilters() ? 0 : count,
                    })),
                    usedAt: performance.now(),
                    countsFor: null,
                };
                state.cells.set(key, cell);
                state.failedCells.delete(key);
                return cell;
            })
            .catch((error) => {
                if (error.name !== 'AbortError') state.failedCells.add(key);
                throw error;
            })
            .finally(() => {
                if (state.inFlight.get(key) === request) state.inFlight.delete(key);
            });
        state.inFlight.set(key, request);
        return request;
    }

    // Drops the least recently seen cells so a long session stays small
    function evictCells(inView) {
        if (state.cells.size <= MAX_CELLS_KEPT) return;
        const needed = new Set(inView);
        const oldest = [...state.cells.entries()]
            .filter(([key]) => !needed.has(key))
            .sort((a, b) => a[1].usedAt - b[1].usedAt);
        for (const [key] of oldest.slice(0, state.cells.size - MAX_CELLS_KEPT)) state.cells.delete(key);
    }

    let cellController = null;
    let loadGeneration = 0;

    async function loadVisibleCells() {
        if (map.getZoom() < FULL_DETAIL_ZOOM) {
            ensureOverview();
            return;
        }
        const keys = cellsInView(0.1);
        const now = performance.now();
        for (const key of keys) {
            const cell = state.cells.get(key);
            if (cell) cell.usedAt = now;
        }
        evictCells(keys);

        // Requests for cells the visitor has already panned away from are cancelled
        if (cellController) cellController.abort();
        // A cancelled request must not be reused, or its cell would never load
        state.inFlight.clear();
        cellController = new AbortController();
        const controller = cellController;
        const generation = ++loadGeneration;
        const queue = keys.filter((key) => !state.cells.has(key));

        const run = async () => {
            while (queue.length && generation === loadGeneration) {
                const key = queue.shift();
                try {
                    await loadCell(key, controller);
                } catch (error) {
                    if (error.name === 'AbortError') continue;
                }
                schedulePlacesUpdate();
            }
        };
        schedulePlacesUpdate();
        await Promise.all(Array.from({ length: MAX_CONCURRENT_FETCHES }, run));
        if (generation === loadGeneration && hasFilters()) applyFilterCounts(keys);
    }

    // Filter counts are worked out in the worker, and only the numbers come back
    let countGeneration = 0;
    async function applyFilterCounts(keys) {
        const generation = ++countGeneration;
        const signature = filterSignature();
        const queue = keys.filter((key) => {
            const cell = state.cells.get(key);
            return cell && cell.countsFor !== signature;
        });
        const run = async () => {
            while (queue.length && generation === countGeneration) {
                const key = queue.shift();
                const cell = state.cells.get(key);
                if (!cell) continue;
                try {
                    const counts = await callWorker('cellCounts', { key, filters: state.filters });
                    if (generation !== countGeneration) return;
                    cell.countsFor = signature;
                    for (const place of cell.places) place.shown = counts[place.name] || 0;
                } catch (error) {
                    state.failedCells.add(key);
                }
                schedulePlacesUpdate();
            }
        };
        await Promise.all(Array.from({ length: 2 }, run));
    }

    function filtersPending() {
        if (!hasFilters() || map.getZoom() < FULL_DETAIL_ZOOM) return false;
        const signature = filterSignature();
        return cellsInView().some((key) => {
            const cell = state.cells.get(key);
            return cell && cell.countsFor !== signature && !state.failedCells.has(key);
        });
    }

    function resetFilterCounts() {
        for (const cell of state.cells.values()) {
            cell.countsFor = null;
            // With filters on, nothing shows until its count is known, so nothing flashes
            for (const place of cell.places) place.shown = hasFilters() ? 0 : place.count;
        }
    }

    function ensureOverview() {
        if (state.overview || state.overviewPromise) return;
        state.overviewPromise = fetch(dataUrl('overview.json'))
            .then((response) => {
                if (!response.ok) throw new Error(String(response.status));
                return response.json();
            })
            .then((data) => {
                state.overview = {
                    areas: data.areas.map(([name, lat, lon, count]) => ({ name, lat, lon, count, area: true })),
                    tops: new Map(data.tops.map(([lat, lon, name, topLat, topLon, links]) => [`${lat}/${lon}`, { name, lat: topLat, lon: topLon, links }])),
                };
                overviewGroups();
                renderPanelSoon();
            })
            .catch(() => { state.overviewPromise = null; });
    }

    // Only redone when the loaded data or filters change. Panning never rebuilds it.
    let placesQueued = false;
    function schedulePlacesUpdate() {
        renderPanelSoon();
        if (placesQueued) return;
        placesQueued = true;
        requestAnimationFrame(() => {
            placesQueued = false;
            const features = [];
            for (const cell of state.cells.values()) {
                for (const place of cell.places) {
                    if (!place.area && place.shown > 0) {
                        features.push(point(place.lon, place.lat, { k: place.name, n: placeLabel(place.name), c: place.shown, l: place.count }));
                    }
                }
            }
            setSource('places', { type: 'FeatureCollection', features });
        });
    }

    // ------------------------------------------------------ What the list shows

    function placesInView() {
        const bounds = clearBounds();
        const places = [];
        for (const key of cellsInView(0.05)) {
            const cell = state.cells.get(key);
            if (!cell) continue;
            for (const place of cell.places) {
                if (place.area || place.shown === 0) continue;
                if (bounds.contains([place.lon, place.lat])) places.push(place);
            }
        }
        return places;
    }

    function overviewSize(zoom) {
        const level = Math.floor(zoom);
        // Roughly one bubble per 60 pixels, so plenty show without piling up
        if (level < 2) return 20;
        if (level < 3) return 10;
        if (level < 4) return 5;
        if (level < 5) return 3;
        if (level < 6) return 2;
        return 1;
    }

    // The bubbles and the list share these groups, so they always agree
    let overviewCache = { key: '', groups: [] };

    function overviewGroups() {
        const size = overviewSize(map.getZoom());
        const key = `${size}/${state.overview ? 1 : 0}`;
        if (overviewCache.key === key) return overviewCache.groups;
        const groups = new Map();
        const cells = state.manifest.cells;
        for (let i = 0; i < cells.length; i += 3) {
            const links = cells[i + 2];
            if (links === 0) continue;
            const lat = cells[i];
            const lon = cells[i + 1];
            const groupKey = `${Math.floor(lat / size)}/${Math.floor(lon / size)}`;
            let group = groups.get(groupKey);
            if (!group) {
                group = { links: 0, sumLat: 0, sumLon: 0, top: null, topLinks: -1 };
                groups.set(groupKey, group);
            }
            group.links += links;
            group.sumLat += (lat + 0.5) * links;
            group.sumLon += (lon + 0.5) * links;
            const top = state.overview && state.overview.tops.get(`${lat}/${lon}`);
            if (top && top.links > group.topLinks) {
                group.top = top;
                group.topLinks = top.links;
            }
        }
        const list = [...groups.values()];
        for (const group of list) {
            // Each bubble sits on its busiest place, so it's where its name says
            group.lat = group.top ? group.top.lat : group.sumLat / group.links;
            group.lon = group.top ? group.top.lon : group.sumLon / group.links;
        }
        overviewCache = { key, groups: list };
        setSource('overview', {
            type: 'FeatureCollection',
            features: list.map((group) => point(group.lon, group.lat, { links: group.links })),
        });
        return list;
    }

    // ------------------------------------------------------------ Map input

    function featureAt(pointOnMap, layers) {
        const touch = matchMedia('(pointer: coarse)').matches ? 28 : 14;
        const box = [[pointOnMap.x - touch, pointOnMap.y - touch], [pointOnMap.x + touch, pointOnMap.y + touch]];
        const present = layers.filter((id) => map.getLayer(id));
        const features = map.queryRenderedFeatures(box, { layers: present });
        if (!features.length) return null;
        // The nearest marker wins, so crowded areas still open what you tapped
        let best = features[0];
        let bestDistance = Infinity;
        for (const feature of features) {
            const at = map.project(feature.geometry.coordinates);
            const distance = (at.x - pointOnMap.x) ** 2 + (at.y - pointOnMap.y) ** 2;
            if (distance < bestDistance) {
                best = feature;
                bestDistance = distance;
            }
        }
        return best;
    }

    function handleMapClick(event) {
        if (state.film) {
            const stop = featureAt(event.point, ['film-dots', 'film-labels']);
            if (stop) openPlace(stop.properties.k, { lat: stop.geometry.coordinates[1], lon: stop.geometry.coordinates[0], area: !!stop.properties.a });
            return;
        }
        const zoom = map.getZoom();
        if (zoom < FULL_DETAIL_ZOOM) {
            const dot = featureAt(event.point, ['overview-dots']);
            if (dot) {
                const [lon, lat] = dot.geometry.coordinates;
                map.easeTo({ center: [lon, lat], zoom: Math.min(FULL_DETAIL_ZOOM, Math.floor(zoom) + 2), duration: prefersReducedMotion.matches ? 0 : 400 });
                return;
            }
            return;
        }
        const dot = featureAt(event.point, ['place-dots', 'place-labels']);
        if (dot) openPlace(dot.properties.k, { lat: dot.geometry.coordinates[1], lon: dot.geometry.coordinates[0], area: false });
    }

    function setHovered(place) {
        setSource('hover', place
            ? { type: 'FeatureCollection', features: [point(place.lon, place.lat, { n: placeLabel(place.name), a: place.area ? 1 : 0 })] }
            : EMPTY);
    }

    // Pointing at a marker names it and picks out its row in the list
    let linkedRow = null;
    let hoveredMarker = null;
    function setMarkerHover(feature) {
        const name = feature ? feature.properties.k : null;
        if (name === hoveredMarker) return;
        hoveredMarker = name;
        if (linkedRow) linkedRow.classList.remove('is-linked');
        linkedRow = name ? panel.querySelector(`[data-place="${CSS.escape(name)}"]`) : null;
        if (linkedRow) linkedRow.classList.add('is-linked');
        setHovered(feature && name
            ? { lon: feature.geometry.coordinates[0], lat: feature.geometry.coordinates[1], name, area: !!feature.properties.a }
            : null);
    }

    function updateSelected() {
        setSource('selected', state.place && state.place.lat != null
            ? { type: 'FeatureCollection', features: [point(state.place.lon, state.place.lat, { n: placeLabel(state.place.name), a: state.place.area ? 1 : 0 })] }
            : EMPTY);
    }

    function updateFilmSource() {
        const locations = state.film && state.film.locations ? state.film.locations : [];
        setSource('film', {
            type: 'FeatureCollection',
            features: locations.map((location) => point(location.lon, location.lat, { k: location.name, n: placeLabel(location.name), a: location.area ? 1 : 0 })),
        });
        applyFilmEmphasis();
    }

    function locate() {
        if (!navigator.geolocation) {
            toast('This browser can’t share your location. Search for a place instead.');
            return;
        }
        toast('Finding your location');
        navigator.geolocation.getCurrentPosition((position) => {
            $('toast').hidden = true;
            const { latitude, longitude } = position.coords;
            setSource('me', { type: 'FeatureCollection', features: [point(longitude, latitude, {})] });
            moveTo(latitude, longitude, Math.max(map.getZoom(), 11));
        }, () => {
            toast('Couldn’t get your location. Check the browser’s permission, or search for a place instead.');
        }, { timeout: 10000, maximumAge: 60000 });
    }

    // ---------------------------------------------------------------- URLs

    let saveTimer = 0;
    function saveView() {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
            const centre = map.getCenter();
            storageSet('location', JSON.stringify({ lat: centre.lat, lon: centre.lng, zoom: map.getZoom() }));
            history.replaceState(history.state, '', buildHash());
        }, 300);
    }

    const encodeValue = (value) => encodeURIComponent(value).replace(/%2F/g, '/').replace(/%28/g, '(').replace(/%29/g, ')');

    function buildHash() {
        const centre = map.getCenter();
        const zoom = map.getZoom();
        const decimals = Math.min(5, Math.max(2, Math.ceil(zoom / 3)));
        const parts = [`map=${zoom.toFixed(2)}/${centre.lat.toFixed(decimals)}/${centre.lng.toFixed(decimals)}`];
        if (state.place) parts.push(`place=${encodeValue(state.place.name)}`);
        if (state.film) parts.push(`film=${encodeValue(state.film.title)}`);
        if (state.about) parts.push('about=1');
        const { min, max, votes, mode } = state.filters;
        if (min != null) parts.push(`min=${min}`);
        if (max != null) parts.push(`max=${max}`);
        if (votes != null) parts.push(`${mode === 'lt' ? 'votesunder' : 'votesover'}=${votes}`);
        return `#${parts.join('&')}`;
    }

    function parseHash() {
        const result = {};
        for (const part of location.hash.replace(/^#/, '').split('&')) {
            const at = part.indexOf('=');
            if (at === -1) continue;
            try {
                result[part.slice(0, at)] = decodeURIComponent(part.slice(at + 1));
            } catch (error) { /* Ignore a mangled parameter */ }
        }
        return result;
    }

    function viewFromHash(params) {
        if (!params.map) return null;
        const [zoom, lat, lon] = params.map.split('/').map(Number);
        return [zoom, lat, lon].some(Number.isNaN) ? null : { zoom, lat, lon };
    }

    function pushRoute() {
        history.pushState({ internal: true }, '', buildHash());
        state.pushedEntries++;
    }

    function goBack() {
        if (state.pushedEntries > 0) {
            state.pushedEntries--;
            history.back();
        } else {
            clearSelection();
            history.replaceState(null, '', buildHash());
            refreshAll();
            focusPanelHeading();
        }
    }

    function clearSelection() {
        state.place = null;
        state.film = null;
        state.about = false;
    }

    async function applyRoute(params) {
        clearSelection();
        state.about = params.about === '1';
        state.filters.min = params.min != null && !Number.isNaN(+params.min) ? +params.min : null;
        state.filters.max = params.max != null && !Number.isNaN(+params.max) ? +params.max : null;
        const votes = params.votesover ?? params.votesunder;
        state.filters.votes = votes != null && !Number.isNaN(+votes) ? +votes : null;
        state.filters.mode = params.votesunder != null ? 'lt' : 'gt';
        syncFilterControls();
        resetFilterCounts();

        // A shared link has to show what it points to, not just the map
        if (params.place || params.film || state.about) setSheet('half', true);
        if (params.film) await openFilm(params.film, { push: false, move: !params.map });
        if (params.place) await openPlace(params.place, null, { push: false, move: !params.map });
        if (hasFilters() && map.getZoom() >= FULL_DETAIL_ZOOM) applyFilterCounts(cellsInView(0.1));
        schedulePlacesUpdate();
        refreshAll();
    }

    window.addEventListener('popstate', () => {
        const params = parseHash();
        const view = viewFromHash(params);
        if (view) map.jumpTo({ center: [view.lon, view.lat], zoom: view.zoom });
        applyRoute(params);
    });

    function refreshAll() {
        updateSelected();
        updateFilmSource();
        renderPanel();
    }

    // ------------------------------------------------------- Opening things

    let openToken = 0;

    async function openPlace(name, known, options = {}) {
        const { push = true, move = true } = options;
        const token = ++openToken;
        let place = known ? { name, ...known } : findLoadedPlace(name);
        state.about = false;
        state.place = place ? { ...place, films: null, loading: true } : { name, loading: true, films: null };
        clearSearch();
        if (push) showResultOnMap();
        updateSelected();
        renderPanel();

        try {
            if (!place) {
                place = await callWorker('place', { name });
                if (token !== openToken) return;
                if (!place) {
                    state.place = null;
                    toast(`Couldn’t find ${placeLabel(name)}. The link may be out of date.`);
                    refreshAll();
                    return;
                }
                state.place = { ...place, films: null, loading: true };
                updateSelected();
            }
            if (push) pushRoute();
            if (move) moveTo(place.lat, place.lon, place.area ? Math.min(map.getZoom(), 6) : Math.max(map.getZoom(), 11));
            await loadPlaceFilms(0);
            if (token !== openToken) return;
        } catch (error) {
            if (token !== openToken) return;
            state.place = { ...state.place, loading: false, failed: true };
        }
        refreshAll();
        focusPanelHeading();
    }

    function findLoadedPlace(name) {
        for (const cell of state.cells.values()) {
            const found = cell.places.find((place) => place.name === name);
            if (found) return { name, lat: found.lat, lon: found.lon, area: found.area };
        }
        return null;
    }

    async function loadPlaceFilms(offset) {
        const place = state.place;
        const result = await callWorker('placeFilms', {
            key: cellKey(place.lat, place.lon),
            name: place.name,
            filters: hasFilters() ? state.filters : null,
            offset,
            limit: PAGE_SIZE,
        });
        if (state.place !== place) return;
        place.loading = false;
        place.failed = false;
        place.total = result.total;
        place.matching = result.matching;
        place.films = offset === 0 ? result.films : [...(place.films || []), ...result.films];
    }

    async function openFilm(title, options = {}) {
        const { push = true, move = true } = options;
        const token = ++openToken;
        state.about = false;
        state.place = null;
        state.film = { title, loading: true, locations: [] };
        clearSearch();
        if (push) showResultOnMap();
        refreshAll();
        try {
            const film = await callWorker('film', { title });
            if (token !== openToken) return;
            if (!film) {
                state.film = null;
                toast(`Couldn’t find ${filmText(title)}. The link may be out of date.`);
                refreshAll();
                return;
            }
            state.film = film;
            if (push) pushRoute();
            if (move) fitFilm();
        } catch (error) {
            if (token !== openToken) return;
            state.film = { title, failed: true, locations: [] };
        }
        refreshAll();
        focusPanelHeading();
    }

    function fitFilm() {
        const locations = state.film.locations;
        if (!locations.length) return;
        // Countries pull the view wide, so they only count if there's nothing more specific
        const preferred = locations.filter((location) => !location.area);
        const points = preferred.length ? preferred : locations;
        const bounds = new maplibregl.LngLatBounds();
        for (const location of points) bounds.extend([location.lon, location.lat]);
        // Space for names; the card and sheet are already allowed for by the map's padding
        map.setPadding(targetPadding());
        map.fitBounds(bounds, {
            // More at the top and right, to clear the zoom buttons
            padding: isPhoneLayout.matches
                ? { top: 40, right: 64, bottom: 30, left: 30 }
                : { top: 70, right: 80, bottom: 60, left: 60 },
            maxZoom: 11,
            duration: prefersReducedMotion.matches ? 0 : 500,
        });
    }

    async function share(title) {
        const url = location.href.split('#')[0] + buildHash();
        history.replaceState(history.state, '', buildHash());
        if (navigator.share && matchMedia('(pointer: coarse)').matches) {
            try {
                await navigator.share({ title, url });
                return;
            } catch (error) {
                if (error.name === 'AbortError') return;
            }
        }
        try {
            await navigator.clipboard.writeText(url);
            toast('Link copied');
        } catch (error) {
            toast('Couldn’t copy the link. You can copy it from the address bar.');
        }
    }

    // ---------------------------------------------------------------- Panel

    function currentView() {
        if (state.term.trim() || (state.filterResults && hasFilters())) return 'results';
        if (state.about) return 'about';
        if (state.place) return 'place';
        if (state.film) return 'film';
        return 'list';
    }

    const panel = $('panel');

    function viewKey(view) {
        if (view === 'place') return state.place ? state.place.name : '';
        if (view === 'film') return state.film ? state.film.title : '';
        return '';
    }

    function renderPanel() {
        const view = currentView();
        // Don't pull the list out from under someone using it with a keyboard
        if (view === 'list' && panel.dataset.view === view && panel.contains(document.activeElement) && document.activeElement !== panel) return;
        const scroll = panel.dataset.view === view && panel.dataset.key === viewKey(view) ? panel.scrollTop : 0;
        panel.replaceChildren(...{
            results: renderResults,
            about: renderAbout,
            place: renderPlace,
            film: renderFilm,
            list: renderList,
        }[view]());
        panel.dataset.view = view;
        panel.dataset.key = viewKey(view);
        card.classList.toggle('is-detail', view === 'place' || view === 'film' || view === 'about');
        linkedRow = null;
        hoveredMarker = null;
        panel.scrollTop = scroll;
    }

    let panelTimer = 0;
    function renderPanelSoon() {
        clearTimeout(panelTimer);
        panelTimer = setTimeout(() => {
            // Only the list follows the map. Anything else stays put while it moves.
            if (currentView() === 'list') renderPanel();
        }, 140);
    }

    function focusPanelHeading() {
        const heading = panel.querySelector('h2');
        if (heading) {
            heading.tabIndex = -1;
            heading.focus({ preventScroll: true });
        }
    }

    const backButton = () => h('button', { class: 'back', type: 'button', onclick: goBack }, icon(ICONS.back), 'Back');
    const linkNote = () => h('p', { class: 'note' }, 'A link could mean where a film was shot, where it is set, or another connection.');

    function placeRow(place) {
        const count = place.shown ?? place.count;
        let detail = place.area && place.count == null ? 'Wide area' : null;
        // Filtered counts may not include these two, so they only show unfiltered
        if (place.top && place.top.length && !hasFilters()) detail = place.top.map((title) => filmLabel(title).name).join(', ');
        return h('li', null, h('button', {
            class: 'row',
            type: 'button',
            'data-place': place.name,
            onclick: () => openPlace(place.name, { lat: place.lat, lon: place.lon, area: place.area }),
            onmouseenter: canHover ? () => setHovered(place) : null,
            onmouseleave: canHover ? () => setHovered(null) : null,
            onfocus: () => setHovered(place),
            onblur: () => setHovered(null),
        },
        h('span', { class: 'row-main' },
            h('span', { class: 'row-name' }, placeLabel(place.name)),
            detail && h('span', { class: 'row-sub' }, detail)),
        count != null && h('span', { class: 'row-count' }, plural(count, 'film'))));
    }

    function filmRow(film) {
        const { name, year } = filmLabel(film.title);
        const details = [];
        if (year) details.push(year);
        if (film.score) details.push(`IMDb ${film.score.toFixed(1)}`);
        if (film.votes) details.push(plural(film.votes, 'vote'));
        return h('li', null, h('button', { class: 'row', type: 'button', onclick: () => openFilm(film.title) },
            h('span', { class: 'row-main' },
                h('span', { class: 'row-name' }, name),
                details.length > 0 && h('span', { class: 'row-sub' }, details.join(' · '))),
            film.places != null && h('span', { class: 'row-count' }, plural(film.places, 'place'))));
    }

    function filterNote(zoom) {
        return h('p', { class: 'note status-line' },
            zoom < FULL_DETAIL_ZOOM ? 'Zoom in to see filters on the map.' : 'IMDb filters are on.',
            h('button', { class: 'text-button', type: 'button', onclick: showAllMatchingFilms }, 'See matching films'),
            h('button', { class: 'text-button', type: 'button', onclick: clearFilters }, 'Clear'));
    }

    function renderList() {
        const zoom = map.getZoom();
        const output = [];
        if (zoom < FULL_DETAIL_ZOOM) {
            const bounds = clearBounds();
            const groups = overviewGroups()
                .filter((group) => group.top && bounds.contains([group.lon, group.lat]))
                .sort((a, b) => b.links - a.links);
            const total = groups.reduce((sum, group) => sum + group.links, 0);
            const minimum = zoom < 4 ? 400 : zoom < 5 ? 150 : zoom < 6 ? 60 : zoom < 7 ? 20 : 0;
            const areas = state.overview
                ? state.overview.areas.filter((area) => area.count >= minimum && bounds.contains([area.lon, area.lat])).sort((a, b) => b.count - a.count)
                : [];
            output.push(h('h2', null, 'In this view'));
            output.push(h('p', { class: 'meta' }, total ? `${plural(total, 'film link')} in view` : ''));
            if (hasFilters()) output.push(filterNote(zoom));
            if (groups.length) {
                output.push(h('ul', { class: 'rows' }, groups.slice(0, 10).map((group) => h('li', null, h('button', {
                    class: 'row',
                    type: 'button',
                    onclick: () => map.jumpTo({ center: [group.top.lon, group.top.lat], zoom: FULL_DETAIL_ZOOM }),
                    onmouseenter: canHover ? () => setHovered({ lon: group.lon, lat: group.lat, name: group.top.name }) : null,
                    onmouseleave: canHover ? () => setHovered(null) : null,
                }, h('span', { class: 'row-main' }, h('span', { class: 'row-name' }, `Around ${placeLabel(group.top.name)}`)),
                h('span', { class: 'row-count' }, plural(group.links, 'link')))))));
            }
            if (areas.length) {
                output.push(h('h3', null, 'Countries and regions'));
                output.push(h('ul', { class: 'rows' }, areas.slice(0, 10).map(placeRow)));
            }
            if (!groups.length && !areas.length) {
                output.push(h('p', { class: 'note' }, state.overview ? 'No film links in this part of the map.' : 'Loading.'));
            }
            return output;
        }

        const places = placesInView().sort((a, b) => b.shown - a.shown);
        const keys = cellsInView();
        const loading = keys.some((key) => !state.cells.has(key) && !state.failedCells.has(key)) || filtersPending();
        const failed = keys.some((key) => state.failedCells.has(key));
        const named = places.find((place) => !place.name.includes('Festival')) || places[0];
        const links = places.reduce((sum, place) => sum + place.shown, 0);

        if (named) {
            output.push(h('h2', null, `Around ${placeLabel(named.name)}`));
            output.push(h('p', { class: 'meta' }, `${plural(links, 'film link')} across ${plural(places.length, 'place')}`));
            // On a phone this is the one line of films visible before the sheet is opened
            if (named.top && named.top.length && !hasFilters()) {
                output.push(h('p', { class: 'note peek-films' }, `Including ${named.top.map((title) => filmLabel(title).name).join(' and ')}`));
            }
        } else {
            output.push(h('h2', null, loading ? 'Looking around' : 'Nothing here yet'));
        }
        if (hasFilters()) output.push(filterNote(zoom));
        if (failed) {
            output.push(h('p', { class: 'note status-line' }, 'Part of this area didn’t load.',
                h('button', { class: 'text-button', type: 'button', onclick: retryCells }, 'Try again')));
        }
        if (places.length) {
            output.push(h('ul', { class: 'rows' }, places.slice(0, LIST_ROWS).map(placeRow)));
            if (places.length > LIST_ROWS) {
                output.push(h('p', { class: 'note more' }, `Showing the busiest ${LIST_ROWS} of ${formatCount(places.length)} places. Zoom in to see the rest.`));
            }
            output.push(linkNote());
        } else if (loading) {
            output.push(h('p', { class: 'note' }, 'Loading this area.'));
        } else if (!failed) {
            output.push(...renderEmptyView());
        }
        return output;
    }

    function renderEmptyView() {
        if (hasFilters()) return [h('p', null, 'No film links here match your filters.')];
        const nearest = nearestCell();
        return [
            h('p', null, 'Nothing here has a film link yet. Links come from Wikipedia, so this can change.'),
            nearest && h('button', {
                class: 'text-button',
                type: 'button',
                onclick: () => map.jumpTo({ center: [nearest.lon + 0.5, nearest.lat + 0.5], zoom: FULL_DETAIL_ZOOM }),
            }, 'Go to the nearest area with links'),
        ];
    }

    function nearestCell() {
        const centre = map.getCenter();
        const cells = state.manifest.cells;
        let best = null;
        let bestDistance = Infinity;
        for (let i = 0; i < cells.length; i += 3) {
            if (cells[i + 2] === 0) continue;
            const distance = (cells[i] + 0.5 - centre.lat) ** 2 + (cells[i + 1] + 0.5 - centre.lng) ** 2;
            if (distance < bestDistance) {
                bestDistance = distance;
                best = { lat: cells[i], lon: cells[i + 1] };
            }
        }
        return best;
    }

    function retryCells() {
        state.failedCells.clear();
        loadVisibleCells();
    }

    const externalLink = (href, text) => h('a', { href, target: '_blank', rel: 'noopener' }, text);

    function renderPlace() {
        const place = state.place;
        const label = placeLabel(place.name);
        const output = [backButton(), h('h2', null, label)];

        if (place.failed) {
            output.push(h('p', null, 'The film list didn’t load.'));
            output.push(h('button', {
                class: 'text-button',
                type: 'button',
                onclick: () => openPlace(place.name, { lat: place.lat, lon: place.lon, area: place.area }, { push: false, move: false }),
            }, 'Try again'));
            return output;
        }
        if (place.loading) {
            output.push(h('p', { class: 'note' }, 'Loading its films.'));
            return output;
        }

        const filtered = hasFilters() && place.matching !== place.total;
        output.push(h('p', { class: 'meta' }, filtered
            ? `${formatCount(place.matching)} of ${plural(place.total, 'film')} match your filters`
            : `${plural(place.total, 'film')} ${place.total === 1 ? 'has' : 'have'} links here`));
        if (place.area) {
            output.push(h('p', { class: 'note' }, 'A wide area, marked at the point Wikipedia gives for it, not a particular spot.'));
        }
        output.push(h('div', { class: 'actions' },
            h('button', { class: 'action-button', type: 'button', onclick: () => share(`Films linked to ${label}`) }, icon(ICONS.share), 'Share'),
            externalLink(wikipediaUrl(place.name), 'Wikipedia')));

        if (place.films && place.films.length) {
            output.push(h('ul', { class: 'rows' }, place.films.map(filmRow)));
            if (place.films.length < place.matching) {
                output.push(h('button', {
                    class: 'text-button more',
                    type: 'button',
                    onclick: async (event) => {
                        const button = event.currentTarget;
                        button.disabled = true;
                        button.textContent = 'Loading';
                        try {
                            await loadPlaceFilms(place.films.length);
                        } catch (error) {
                            toast('More films didn’t load. Try again.');
                        }
                        renderPanel();
                    },
                }, `Show more (${formatCount(place.matching - place.films.length)} left)`));
            }
        }
        output.push(linkNote());
        return output;
    }

    function renderFilm() {
        const film = state.film;
        const text = filmText(film.title);
        const output = [backButton(), h('h2', null, text)];

        if (film.failed) {
            output.push(h('p', null, 'This film’s places didn’t load.'));
            output.push(h('button', { class: 'text-button', type: 'button', onclick: () => openFilm(film.title, { push: false }) }, 'Try again'));
            return output;
        }
        if (film.loading) {
            output.push(h('p', { class: 'note' }, 'Finding its places.'));
            return output;
        }

        output.push(h('p', { class: 'meta' }, `Has links to ${plural(film.locations.length, 'place')}`));
        const links = [];
        if (film.imdb) {
            links.push(externalLink(imdbUrl(film.imdb), film.score ? `IMDb ${film.score.toFixed(1)}` : 'IMDb'));
            if (film.votes) links.push(h('span', null, plural(film.votes, 'vote')));
        }
        links.push(externalLink(wikipediaUrl(film.title), 'Wikipedia'));
        output.push(h('div', { class: 'inline-links' }, links));
        output.push(h('div', { class: 'actions' },
            h('button', { class: 'action-button', type: 'button', onclick: () => share(`${text} on Movie Mapper`) }, icon(ICONS.share), 'Share'),
            h('button', { class: 'text-button', type: 'button', onclick: fitFilm }, 'Show all on map')));

        const locations = [...film.locations].sort((a, b) => (a.area === b.area ? a.name.localeCompare(b.name) : a.area ? 1 : -1));
        output.push(h('ul', { class: 'rows' }, locations.map((location) => placeRow({ ...location, shown: null, count: null }))));
        output.push(linkNote());
        return output;
    }

    function renderAbout() {
        const wikipedia = () => externalLink('https://wikipedia.org', 'Wikipedia');
        return [backButton(), h('div', { class: 'about' },
            h('h2', null, 'About Movie Mapper'),
            h('p', null, 'Find movies with connections to nearby places.'),
            h('p', null, 'This uses data parsed from ', wikipedia(), ' to map connections between places and movies. This could be where it’s filmed, where it’s set, or any other reason why a movie would link directly to a place.'),
            h('p', null, 'This idea came about as lockdown has forced more local holidays, and while travelling even within a few kilometers it’s been amazing to find all of the interesting information right on your doorstep!'),
            h('p', null, 'The existing maps seem to have few items on them as they are building the database themselves. This map takes the Wikipedia data dumps and parses them for the links, so you can’t directly add a film or movie link to this tool. You would need to edit the information into ', wikipedia(), '!'),
            h('p', null, 'Want to help me improve this? The code is open source! Check out the code on ', externalLink('https://github.com/exussum12/MovieLocations', 'GitHub'), '.'),
            h('p', null, 'The IMDb links are also provided by the page links on ', wikipedia(), '.'),
            h('p', null, '© Wikipedia data, provided with Creative Commons Attribution-Share-Alike License 3.0.'),
            h('p', null, 'Base map © OpenStreetMap contributors, served by ', externalLink('https://openfreemap.org', 'OpenFreeMap'), ' using OpenMapTiles.'),
            h('p', null, 'Information courtesy of IMDb (', externalLink('https://www.imdb.com', 'IMDb.com'), '). Used with permission.'))];
    }

    function renderResults() {
        const term = state.term.trim();
        if (state.searchError) {
            return [h('p', { style: 'margin-top:12px' }, 'Search didn’t load.'), h('button', { class: 'text-button', type: 'button', onclick: runSearch }, 'Try again')];
        }
        if (!state.results) {
            return [h('p', { class: 'note', style: 'margin-top:12px' }, 'Getting search ready. This happens once.')];
        }
        const { films, filmTotal, places, placeTotal } = state.results;
        const output = [h('h2', { class: 'visually-hidden' }, 'Search results')];
        if (!term) {
            output.push(h('button', {
                class: 'back',
                type: 'button',
                onclick: () => {
                    clearSearch();
                    renderPanel();
                },
            }, icon(ICONS.back), 'Back to the map list'));
        }
        if (!films.length && !places.length) {
            output.push(h('p', { style: 'margin-top:12px' }, term ? `Nothing matches “${term}”.` : 'No films match these filters.'));
            if (hasFilters()) output.push(h('button', { class: 'text-button', type: 'button', onclick: clearFilters }, 'Clear filters'));
            return output;
        }
        if (places.length) {
            output.push(h('h3', null, `Places (${formatCount(placeTotal)})`));
            output.push(h('ul', { class: 'rows' }, places.map(placeRow)));
        }
        if (films.length) {
            output.push(h('h3', null, `Films (${formatCount(filmTotal)})`));
            output.push(h('ul', { class: 'rows' }, films.map(filmRow)));
            if (filmTotal > films.length) {
                output.push(h('p', { class: 'note more' }, `Showing the best ${formatCount(films.length)}. Type more to narrow it down.`));
            }
        }
        return output;
    }

    // --------------------------------------------------------------- Search

    let searchToken = 0;
    async function runSearch() {
        const token = ++searchToken;
        state.searchError = false;
        const term = state.term.trim();
        if (!term && !(state.filterResults && hasFilters())) {
            state.results = null;
            renderPanel();
            return;
        }
        try {
            const results = await callWorker('search', { term, filters: hasFilters() ? state.filters : null, limit: PAGE_SIZE });
            if (token !== searchToken) return;
            state.results = results;
        } catch (error) {
            if (token !== searchToken) return;
            state.searchError = true;
        }
        renderPanel();
    }

    function showAllMatchingFilms() {
        state.filterResults = true;
        state.results = null;
        setSheet('half');
        renderPanel();
        runSearch();
    }

    function clearSearch() {
        state.term = '';
        state.results = null;
        state.filterResults = false;
        $('term').value = '';
    }

    // At half height the results would sit under a phone's keyboard
    $('term').addEventListener('focus', () => setSheet('full'));

    let searchTimer = 0;
    $('term').addEventListener('input', (event) => {
        state.term = event.target.value;
        clearTimeout(searchTimer);
        renderPanel();
        searchTimer = setTimeout(runSearch, 120);
    });
    $('search').addEventListener('submit', (event) => {
        event.preventDefault();
        clearTimeout(searchTimer);
        runSearch();
        document.activeElement.blur();
    });
    $('term').addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && state.term) {
            clearSearch();
            renderPanel();
        }
    });

    // -------------------------------------------------------------- Filters

    function fillScoreOptions(select) {
        select.append(h('option', { value: '' }, 'Any'));
        for (let score = 1; score <= 10; score++) select.append(h('option', { value: score }, String(score)));
    }
    fillScoreOptions($('min-score'));
    fillScoreOptions($('max-score'));

    function syncFilterControls() {
        const { min, max, votes, mode } = state.filters;
        $('min-score').value = min ?? '';
        $('max-score').value = max ?? '';
        $('votes').value = votes ?? '';
        $('votes-mode').value = mode;
        const active = (min != null) + (max != null) + (votes != null);
        $('filter-count').textContent = active ? `(${active})` : '';
        $('clear-filters').hidden = !active;
    }

    function filtersChanged() {
        syncFilterControls();
        resetFilterCounts();
        history.replaceState(history.state, '', buildHash());
        if (hasFilters() && map.getZoom() >= FULL_DETAIL_ZOOM) applyFilterCounts(cellsInView(0.1));
        else countGeneration++;
        schedulePlacesUpdate();
        if (state.place && state.place.films) {
            loadPlaceFilms(0).then(renderPanel).catch(() => {});
        }
        if (state.term.trim() || state.filterResults) runSearch();
        renderPanel();
    }

    function clearFilters() {
        state.filters = { min: null, max: null, votes: null, mode: 'gt' };
        state.filterResults = false;
        state.results = null;
        filtersChanged();
    }

    let filterTimer = 0;
    function readFilters() {
        const value = (id) => ($(id).value === '' ? null : +$(id).value);
        state.filters = {
            min: value('min-score'),
            max: value('max-score'),
            votes: value('votes'),
            mode: $('votes-mode').value,
        };
        clearTimeout(filterTimer);
        filterTimer = setTimeout(filtersChanged, 200);
    }
    ['min-score', 'max-score', 'votes-mode', 'votes'].forEach((id) => {
        $(id).addEventListener('input', readFilters);
    });
    $('clear-filters').addEventListener('click', clearFilters);

    $('filters-toggle').addEventListener('click', (event) => {
        const filters = $('filters');
        filters.hidden = !filters.hidden;
        event.currentTarget.setAttribute('aria-expanded', String(!filters.hidden));
        if (!filters.hidden) setSheet('half');
    });

    // ----------------------------------------------------------- Navigation

    $('near-me').addEventListener('click', locate);
    $('about-link').addEventListener('click', () => {
        clearSearch();
        state.about = true;
        state.place = null;
        state.film = null;
        pushRoute();
        setSheet('half');
        refreshAll();
        focusPanelHeading();
    });
    $('home').addEventListener('click', (event) => {
        event.preventDefault();
        clearSearch();
        if (state.place || state.film || state.about) {
            clearSelection();
            pushRoute();
        }
        refreshAll();
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && (state.place || state.film || state.about) && event.target.id !== 'term') goBack();
    });

    // ---------------------------------------------- The phone's bottom sheet

    const card = $('card');
    const handle = $('handle');
    let sheetVisible = 0;
    let sheetState = 'peek';

    let peekHeight = 0;

    // Picking a result always leaves room to see it on the map, even from a full sheet
    function showResultOnMap() {
        if (sheetState === 'full') sheetState = 'half';
        setSheet('half', true);
    }

    function sheetHeights() {
        // Measured once, as the search controls hide while a place or film is open
        if (!peekHeight) {
            const pills = $('search').querySelector('.pills').getBoundingClientRect();
            const safeArea = parseFloat(getComputedStyle(card).paddingBottom) || 0;
            // Room for the heading and count below the controls
            peekHeight = Math.ceil(pills.bottom - card.getBoundingClientRect().top + 94 + safeArea);
        }
        return { peek: peekHeight, half: Math.round(window.innerHeight * 0.55), full: window.innerHeight - 40 };
    }

    function setSheet(next, instant = false) {
        if (!isPhoneLayout.matches) {
            document.documentElement.style.removeProperty('--visible');
            sheetVisible = 0;
            sheetState = 'peek';
            applyMapPadding(instant);
            return;
        }
        // A list already open stays as open as the visitor left it
        if (next === 'half' && sheetState === 'full') next = 'full';
        const heights = sheetHeights();
        sheetState = next;
        sheetVisible = heights[next];
        document.documentElement.style.setProperty('--visible', `${sheetVisible}px`);
        handle.setAttribute('aria-expanded', next === 'peek' ? 'false' : 'true');
        handle.setAttribute('aria-label', next === 'full' ? 'Show the map' : 'Show more of the list');
        applyMapPadding(instant);
    }

    // Keeps the map's centre in the part that can be seen
    function applyMapPadding(instant = false) {
        const padding = targetPadding();
        const current = map.getPadding();
        if (current.left === padding.left && current.bottom === padding.bottom) return;
        if (instant || prefersReducedMotion.matches || !state.mapReady) map.setPadding(padding);
        else map.easeTo({ padding, duration: 280 });
    }

    handle.addEventListener('click', () => {
        if (dragMoved) {
            dragMoved = false;
            return;
        }
        setSheet({ peek: 'half', half: 'full', full: 'peek' }[sheetState]);
    });

    let dragStart = null;
    let dragMoved = false;
    const startDrag = (element) => (event) => {
        if (!isPhoneLayout.matches || event.target.closest('a, button:not(.handle)')) return;
        dragStart = { y: event.clientY, visible: sheetVisible };
        dragMoved = false;
        element.setPointerCapture(event.pointerId);
    };
    const dragSheet = (event) => {
        if (!dragStart) return;
        const change = dragStart.y - event.clientY;
        if (Math.abs(change) > 4) dragMoved = true;
        if (!dragMoved) return;
        const heights = sheetHeights();
        const next = Math.min(heights.full, Math.max(heights.peek, dragStart.visible + change));
        card.classList.add('dragging');
        card.style.transform = `translateY(${heights.full - next}px)`;
        sheetVisible = next;
    };
    const endDrag = () => {
        if (!dragStart) return;
        dragStart = null;
        card.classList.remove('dragging');
        card.style.transform = '';
        if (!dragMoved) return;
        const heights = sheetHeights();
        const nearest = ['peek', 'half', 'full'].reduce((best, name) => (
            Math.abs(heights[name] - sheetVisible) < Math.abs(heights[best] - sheetVisible) ? name : best
        ), 'peek');
        sheetState = nearest;
        setSheet(nearest);
    };
    const cardTop = document.querySelector('.card-top');
    for (const element of [handle, cardTop]) {
        element.addEventListener('pointerdown', startDrag(element));
        element.addEventListener('pointermove', dragSheet);
        element.addEventListener('pointerup', endDrag);
        element.addEventListener('pointercancel', endDrag);
    }

    function syncLayout() {
        peekHeight = card.classList.contains('is-detail') ? peekHeight : 0;
        setSheet(isPhoneLayout.matches ? sheetState : 'peek');
        renderPanelSoon();
    }
    isPhoneLayout.addEventListener('change', syncLayout);
    let resizeTimer = 0;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(syncLayout, 150);
    });

    // --------------------------------------------------------------- Start

    function startingView(params) {
        const fromHash = viewFromHash(params);
        if (fromHash) return fromHash;
        try {
            const saved = JSON.parse(storageGet('location'));
            if (saved && Number.isFinite(saved.lat) && Number.isFinite(saved.lon) && Number.isFinite(saved.zoom)) return saved;
        } catch (error) { /* Fall through to the default */ }
        return DEFAULT_VIEW;
    }

    async function start() {
        const params = parseHash();
        syncFilterControls();
        setSheet('peek');
        const view = startingView(params);
        map.jumpTo({ center: [view.lon, view.lat], zoom: view.zoom });

        panel.replaceChildren(h('h2', null, 'Looking around'));

        const manifestLoad = fetch('data/manifest.json', { cache: 'no-cache' }).then((response) => {
            if (!response.ok) throw new Error(String(response.status));
            return response.json();
        });
        const mapLoad = new Promise((resolve) => {
            if (map.loaded()) resolve();
            else map.once('load', resolve);
        });

        try {
            // Revalidated on each visit, so a rebuild reaches returning visitors
            state.manifest = await manifestLoad;
        } catch (error) {
            panel.replaceChildren(
                h('h2', null, 'The map data didn’t load'),
                h('p', null, 'Check your connection and try again.'),
                h('button', { class: 'text-button', type: 'button', onclick: () => location.reload() }, 'Reload'),
            );
            return;
        }

        const cells = state.manifest.cells;
        for (let i = 0; i < cells.length; i += 3) {
            state.cellLinks.set(`${cells[i]}/${cells[i + 1]}`, cells[i + 2]);
        }
        worker.postMessage({ type: 'init', version: state.manifest.version, shards: state.manifest.shards });

        await mapLoad;
        addMapLayers();
        state.mapReady = true;
        overviewGroups();

        map.on('click', handleMapClick);
        if (canHover) {
            let hoverFrame = 0;
            map.on('mousemove', (event) => {
                if (hoverFrame) return;
                hoverFrame = requestAnimationFrame(() => {
                    hoverFrame = 0;
                    const layers = state.film ? ['film-dots', 'film-labels'] : map.getZoom() < FULL_DETAIL_ZOOM ? ['overview-dots'] : ['place-dots', 'place-labels'];
                    const feature = featureAt(event.point, layers);
                    map.getCanvas().style.cursor = feature ? 'pointer' : '';
                    setMarkerHover(feature);
                });
            });
        }
        map.on('moveend', () => {
            if (map.getZoom() < FULL_DETAIL_ZOOM) overviewGroups();
            loadVisibleCells();
            renderPanelSoon();
            saveView();
        });

        await applyRoute(params);
        loadVisibleCells();
    }

    start();
}());
