<?php
namespace exussum12\movies;

use RuntimeException;

/**
 * Turns the parsed film-to-place links into the static files the website reads.
 *
 * The parser staggers each row's coordinates so markers don't stack. The site
 * draws one symbol per place, so the staggered values are averaged back into
 * one position here.
 */
class SiteBuilder
{
    public const FILM_SHARDS = 256;

    /** @var array<string, array{lat: float, lon: float, rows: int, films: array<int, true>}> */
    private array $places = [];

    /** @var array<int, array{title: string, score: ?float, votes: ?int, imdb: string, places: array<string, true>}> */
    private array $films = [];

    /** @var array<string, int> */
    private array $filmIds = [];

    private int $links = 0;

    /**
     * @param string[] $wideAreas Wikipedia titles of countries and regions
     * @param string[] $notPlaces Titles with coordinates that aren't places, such as people
     */
    public function __construct(
        private string $inputPath,
        private string $outputPath,
        private array $wideAreas = [],
        private array $notPlaces = []
    ) {
        $this->wideAreas = array_flip($wideAreas);
        $this->notPlaces = array_flip($notPlaces);
    }

    /**
     * @return array{films: int, places: int, links: int, cells: int}
     */
    public function build(): array
    {
        $this->read();
        $this->sortFilms();

        $cells = $this->groupIntoCells();
        $this->writeCells($cells);
        $this->writeFilmShards();
        $this->writeSearchIndexes();
        $this->writeManifest($cells);

        return [
            'films' => count($this->films),
            'places' => count($this->places),
            'links' => $this->links,
            'cells' => count($cells),
        ];
    }

    private function read(): void
    {
        $input = @fopen($this->inputPath, 'rb');
        if ($input === false) {
            throw new RuntimeException("Could not read {$this->inputPath}");
        }

        fgets($input); // header
        while (($line = fgets($input)) !== false) {
            $row = explode("\t", rtrim($line, "\r\n"));
            if (count($row) < 4) {
                continue;
            }
            $this->addRow($row);
        }
        fclose($input);
    }

    /**
     * @param string[] $row movie, location, lat, lon, score, votes, imdb
     */
    private function addRow(array $row): void
    {
        [$title, $place, $lat, $lon] = $row;
        if (!$this->isUsableCoordinate($lat, $lon) || isset($this->notPlaces[$place])) {
            return;
        }

        $this->places[$place] ??= ['lat' => 0.0, 'lon' => 0.0, 'rows' => 0, 'films' => []];
        $this->places[$place]['lat'] += (float) $lat;
        $this->places[$place]['lon'] += (float) $lon;
        $this->places[$place]['rows']++;

        if (!isset($this->filmIds[$title])) {
            $id = count($this->films);
            $this->filmIds[$title] = $id;
            $imdb = $row[6] ?? '';
            $this->films[$id] = [
                'title' => $title,
                // The parser prints 0.0 and 0 when a film has no IMDb match
                'score' => $imdb === '' ? null : (float) ($row[4] ?? 0),
                'votes' => $imdb === '' ? null : (int) ($row[5] ?? 0),
                'imdb' => $imdb,
                'places' => [],
            ];
        }

        $id = $this->filmIds[$title];
        if (!isset($this->films[$id]['places'][$place])) {
            $this->links++;
        }
        $this->films[$id]['places'][$place] = true;
        $this->places[$place]['films'][$id] = true;
    }

    private function isUsableCoordinate(string $lat, string $lon): bool
    {
        if (!is_numeric($lat) || !is_numeric($lon)) {
            return false;
        }
        $lat = (float) $lat;
        $lon = (float) $lon;

        return $lat != 0.0 && $lon != 0.0 && abs($lat) <= 90 && abs($lon) <= 180;
    }

    /**
     * Most-voted first, so the lists the site shows lead with films people know.
     * Ids are positions in this order, and a film's shard is derived from its id.
     */
    private function sortFilms(): void
    {
        $order = array_keys($this->films);
        usort($order, fn (int $a, int $b) =>
            ($this->films[$b]['votes'] ?? -1) <=> ($this->films[$a]['votes'] ?? -1)
            ?: strcmp($this->films[$a]['title'], $this->films[$b]['title']));

        $newIds = array_flip($order);
        $sorted = [];
        foreach ($order as $newId => $oldId) {
            $sorted[$newId] = $this->films[$oldId];
        }
        $this->films = $sorted;

        foreach ($this->places as &$place) {
            $films = [];
            foreach ($place['films'] as $oldId => $_) {
                $films[$newIds[$oldId]] = true;
            }
            ksort($films);
            $place['films'] = $films;
        }
    }

    /**
     * @return array<string, string[]> Place names keyed by "lat/lon" of the one-degree cell
     */
    private function groupIntoCells(): array
    {
        $cells = [];
        foreach ($this->places as $name => $place) {
            [$lat, $lon] = $this->position($place);
            $cells[(int) floor($lat) . '/' . (int) floor($lon)][] = $name;
        }

        return $cells;
    }

    /**
     * @param array{lat: float, lon: float, rows: int} $place
     * @return array{float, float}
     */
    private function position(array $place): array
    {
        return [
            round($place['lat'] / $place['rows'], 4),
            round($place['lon'] / $place['rows'], 4),
        ];
    }

    private function isWideArea(string $place): bool
    {
        return isset($this->wideAreas[$place]);
    }

    /**
     * @param array<string, string[]> $cells
     */
    private function writeCells(array $cells): void
    {
        foreach ($cells as $key => $names) {
            $summary = [];
            $details = [];
            foreach ($names as $name) {
                [$lat, $lon] = $this->position($this->places[$name]);
                $films = [];
                foreach (array_keys($this->places[$name]['films']) as $id) {
                    $film = $this->films[$id];
                    $films[] = [$film['title'], $film['score'], $film['votes'], $film['imdb']];
                }
                // The two best-known titles let the list name films without loading its details
                $top = array_map(fn ($film) => $film[0], array_slice($films, 0, 2));
                $summary[] = [$name, $lat, $lon, $this->isWideArea($name) ? 1 : 0, count($films), $top];
                $details[$name] = $films;
            }
            // Panning loads only the summary. Film lists are fetched when needed,
            // because the busiest cell has around 15,000 of them.
            $this->writeJson("cells/$key.json", $summary);
            $this->writeJson("details/$key.json", $details);
        }
    }

    private function writeFilmShards(): void
    {
        $shards = [];
        foreach ($this->films as $id => $film) {
            $rows = [];
            foreach (array_keys($film['places']) as $name) {
                [$lat, $lon] = $this->position($this->places[$name]);
                $rows[] = [$name, $lat, $lon, $this->isWideArea($name) ? 1 : 0];
            }
            $shards[$id % self::FILM_SHARDS][$film['title']] = $rows;
        }

        foreach ($shards as $shard => $rows) {
            $this->writeJson("films/$shard.json", $rows);
        }
    }

    private function writeSearchIndexes(): void
    {
        $films = '';
        foreach ($this->films as $film) {
            $films .= implode("\t", [
                $film['title'],
                $film['score'] ?? '',
                $film['votes'] ?? '',
                $film['imdb'],
                count($film['places']),
            ]) . "\n";
        }
        $this->writeFile('films.tsv', $films);

        $places = '';
        foreach ($this->places as $name => $place) {
            [$lat, $lon] = $this->position($place);
            $places .= implode("\t", [
                $name,
                $lat,
                $lon,
                count($place['films']),
                $this->isWideArea($name) ? 1 : 0,
            ]) . "\n";
        }
        $this->writeFile('places.tsv', $places);
    }

    /**
     * The manifest loads on every visit, so it holds only a flat list of cells
     * (lat, lon, links). Its version changes with the data, so a rebuild can't
     * mix old and new files.
     *
     * @param array<string, string[]> $cells
     */
    private function writeManifest(array $cells): void
    {
        $flatCells = [];
        $tops = [];
        foreach ($cells as $key => $names) {
            [$cellLat, $cellLon] = array_map('intval', explode('/', $key));
            $links = 0;
            $topLinks = 0;
            $topName = null;
            foreach ($names as $name) {
                if ($this->isWideArea($name)) {
                    continue;
                }
                $count = count($this->places[$name]['films']);
                $links += $count;
                // Names the zoomed-out areas, which a festival does poorly
                if ($count > $topLinks && !str_contains($name, 'Festival')) {
                    $topLinks = $count;
                    $topName = $name;
                }
            }

            array_push($flatCells, $cellLat, $cellLon, $links);
            if ($topName !== null) {
                [$topLat, $topLon] = $this->position($this->places[$topName]);
                $tops[] = [$cellLat, $cellLon, $topName, $topLat, $topLon, $topLinks];
            }
        }

        $areas = [];
        foreach ($this->places as $name => $place) {
            if ($this->isWideArea($name)) {
                [$lat, $lon] = $this->position($place);
                $areas[] = [$name, $lat, $lon, count($place['films'])];
            }
        }

        $summary = ['films' => count($this->films), 'places' => count($this->places), 'links' => $this->links];
        $this->writeJson('manifest.json', [
            'version' => substr(md5(json_encode([$summary, $flatCells, $tops])), 0, 10),
            'shards' => self::FILM_SHARDS,
            'cells' => $flatCells,
        ] + $summary);
        // Names for the zoomed-out view, which most visits never reach
        $this->writeJson('overview.json', ['tops' => $tops, 'areas' => $areas]);
    }

    private function writeJson(string $path, array $data): void
    {
        $this->writeFile($path, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
    }

    private function writeFile(string $path, string $contents): void
    {
        $fullPath = $this->outputPath . '/' . $path;
        $directory = dirname($fullPath);
        if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
            throw new RuntimeException("Could not create $directory");
        }
        if (file_put_contents($fullPath, $contents) === false) {
            throw new RuntimeException("Could not write $fullPath");
        }
    }
}
