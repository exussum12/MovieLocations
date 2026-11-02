'use strict';

// Everything heavy happens here so the map stays smooth on phones: the search
// indexes live in this worker as flat strings and typed arrays rather than one
// object per film, and film lists are parsed here and discarded after use.

let version = '';
let shards = 256;
const dataUrl = (path) => `../data/${path}?v=${version}`;

async function fetchOk(path) {
    const response = await fetch(dataUrl(path));
    if (!response.ok) throw new Error(`${path}: ${response.status}`);
    return response;
}

const normalise = (text) => text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/_/g, ' ')
    .toLowerCase();

function lineStarts(text) {
    let count = 0;
    for (let at = text.indexOf('\n'); at !== -1; at = text.indexOf('\n', at + 1)) count++;
    const starts = new Uint32Array(count);
    let line = 0;
    let start = 0;
    for (let at = text.indexOf('\n'); at !== -1; at = text.indexOf('\n', at + 1)) {
        starts[line++] = start;
        start = at + 1;
    }
    return starts;
}

const lineAt = (index, id) => index.raw.slice(
    index.starts[id],
    id + 1 < index.starts.length ? index.starts[id + 1] - 1 : index.raw.length - 1
);

// Joined, normalised first columns with their offsets, so a search is one
// indexOf scan over a string rather than a loop over thousands of objects.
function buildNames(index) {
    const parts = new Array(index.starts.length);
    const offsets = new Uint32Array(index.starts.length);
    let length = 0;
    for (let id = 0; id < parts.length; id++) {
        const start = index.starts[id];
        const name = normalise(index.raw.slice(start, index.raw.indexOf('\t', start)));
        parts[id] = name;
        offsets[id] = length;
        length += name.length + 1;
    }
    index.names = parts.join('\n') + '\n';
    index.offsets = offsets;
}

function idAtOffset(offsets, position) {
    let low = 0;
    let high = offsets.length - 1;
    while (low < high) {
        const middle = (low + high + 1) >> 1;
        if (offsets[middle] <= position) low = middle;
        else high = middle - 1;
    }
    return low;
}

let filmsPromise = null;
let placesPromise = null;

function loadFilms() {
    filmsPromise ||= fetchOk('films.tsv').then((r) => r.text()).then((raw) => {
        const index = { raw, starts: lineStarts(raw) };
        buildNames(index);
        const total = index.starts.length;
        index.scores = new Float32Array(total);
        index.votes = new Int32Array(total);
        for (let id = 0; id < total; id++) {
            const fields = lineAt(index, id).split('\t');
            index.scores[id] = fields[1] === '' ? NaN : +fields[1];
            index.votes[id] = fields[2] === '' ? -1 : +fields[2];
        }
        return index;
    }).catch((error) => {
        filmsPromise = null;
        throw error;
    });
    return filmsPromise;
}

function loadPlaces() {
    placesPromise ||= fetchOk('places.tsv').then((r) => r.text()).then((raw) => {
        const index = { raw, starts: lineStarts(raw) };
        buildNames(index);
        return index;
    }).catch((error) => {
        placesPromise = null;
        throw error;
    });
    return placesPromise;
}

const hasFilters = (f) => !!f && (f.min != null || f.max != null || f.votes != null);

function passes(f, score, votes) {
    if (!hasFilters(f)) return true;
    if (f.min != null && !(score >= f.min)) return false;
    if (f.max != null && !(score <= f.max)) return false;
    if (f.votes != null) {
        if (votes == null || votes < 0) return false;
        if (f.mode === 'lt' ? votes >= f.votes : votes <= f.votes) return false;
    }
    return true;
}

function filmRow(index, id) {
    const [title, score, votes, imdb, places] = lineAt(index, id).split('\t');
    return {
        title,
        score: score === '' ? null : +score,
        votes: votes === '' ? null : +votes,
        imdb,
        places: +places,
    };
}

function placeRow(index, id) {
    const [name, lat, lon, count, area] = lineAt(index, id).split('\t');
    return { name, lat: +lat, lon: +lon, count: +count, area: area === '1' };
}

// Best matches first: the exact title, the start of the title, the start of a
// word, then anywhere. Rows are stored most-voted first, so each tier is ranked.
function matches(index, term, limit, accept) {
    const tiers = [[], [], [], []];
    let total = 0;
    const { names, offsets } = index;
    let at = names.indexOf(term);
    while (at !== -1) {
        const id = idAtOffset(offsets, at);
        const next = id + 1 < offsets.length ? offsets[id + 1] : names.length;
        if (accept(id)) {
            total++;
            const after = names[at + term.length];
            let tier = 3;
            if (at === offsets[id]) tier = after === '\n' || names.startsWith(' (', at + term.length) ? 0 : 1;
            else if (names[at - 1] === ' ') tier = 2;
            if (tiers[tier].length < limit) tiers[tier].push(id);
        }
        at = names.indexOf(term, next);
    }
    return { ids: tiers.flat().slice(0, limit), total };
}

async function search({ term, filters, limit }) {
    const needle = normalise(term.trim());
    const filterFilm = (index) => (id) => passes(
        filters,
        index.scores[id],
        index.votes[id]
    );

    const films = await loadFilms();
    if (!needle) {
        const accept = filterFilm(films);
        const ids = [];
        let total = 0;
        for (let id = 0; id < films.starts.length; id++) {
            if (accept(id)) {
                total++;
                if (ids.length < limit) ids.push(id);
            }
        }
        return { films: ids.map((id) => filmRow(films, id)), filmTotal: total, places: [], placeTotal: 0 };
    }

    const places = await loadPlaces();
    const filmMatches = matches(films, needle, limit, filterFilm(films));
    const placeMatches = matches(places, needle, 12, () => true);
    const placeRows = placeMatches.ids.map((id) => placeRow(places, id));
    placeRows.sort((a, b) => b.count - a.count);
    return {
        films: filmMatches.ids.map((id) => filmRow(films, id)),
        filmTotal: filmMatches.total,
        places: placeRows,
        placeTotal: placeMatches.total,
    };
}

// Exact lookup without keeping a map of every title in memory
function findExact(index, name) {
    const needle = `${name}\t`;
    if (index.raw.startsWith(needle)) return 0;
    const at = index.raw.indexOf(`\n${needle}`);
    return at === -1 ? -1 : idAtOffset(index.starts, at + 1);
}

async function place({ name }) {
    const index = await loadPlaces();
    const id = findExact(index, name);
    return id === -1 ? null : placeRow(index, id);
}

async function film({ title }) {
    const index = await loadFilms();
    const id = findExact(index, title);
    if (id === -1) return null;
    const shard = await (await fetchOk(`films/${id % shards}.json`)).json();
    return {
        ...filmRow(index, id),
        locations: (shard[title] || []).map(([name, lat, lon, area]) => ({ name, lat, lon, area: !!area })),
    };
}

// One cell of film lists is kept so paging through a place doesn't parse it again
let lastDetails = { key: null, data: null };

async function details(key) {
    if (lastDetails.key !== key) {
        lastDetails = { key, data: await (await fetchOk(`details/${key}.json`)).json() };
    }
    return lastDetails.data;
}

async function placeFilms({ key, name, filters, offset, limit }) {
    const rows = (await details(key))[name] || [];
    const filtered = hasFilters(filters)
        ? rows.filter((row) => passes(filters, row[1] == null ? NaN : row[1], row[2]))
        : rows;
    return {
        total: rows.length,
        matching: filtered.length,
        films: filtered.slice(offset, offset + limit).map(([title, score, votes, imdb]) => ({ title, score, votes, imdb })),
    };
}

// Filtered counts for every place in a cell; the film lists are not kept
async function cellCounts({ key, filters }) {
    const response = await fetchOk(`details/${key}.json`);
    const data = await response.json();
    const counts = {};
    for (const name of Object.keys(data)) {
        let count = 0;
        for (const row of data[name]) {
            if (passes(filters, row[1] == null ? NaN : row[1], row[2])) count++;
        }
        counts[name] = count;
    }
    return counts;
}

const handlers = { search, place, film, placeFilms, cellCounts };

self.onmessage = async ({ data }) => {
    if (data.type === 'init') {
        version = data.version;
        shards = data.shards;
        return;
    }
    try {
        self.postMessage({ id: data.id, result: await handlers[data.type](data) });
    } catch (error) {
        self.postMessage({ id: data.id, error: String(error.message || error) });
    }
};
