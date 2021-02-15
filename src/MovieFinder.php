<?php


namespace exussum12\movies;

class MovieFinder
{

    public function isValid($node): bool
    {
        return preg_match('/\[\[Category:.*[0-9]{4} films/i', $node);
    }

    public function getLocations($node): array
    {
        $node = strtolower($node);
        $matches = [];
        $locations = [];
        if (preg_match_all('/\[\[([^#|\]]*)/', $node, $matches) && count($matches[1]) > 0) {
            foreach ($matches[1] as $name) {
                $locations[] = str_replace(' ', '_', $name);
            }
        }

        return $locations;
    }

    public function getImdb(string $node): string
    {
        if (preg_match('#{{IMDb title\|([0-9]{4,})#', $node, $imdbMatch)) {
            return 'tt' . $imdbMatch[1];
        }

        if (preg_match('#/(tt[0-9]{4,})/?#', $node, $imdbMatch)) {
            return $imdbMatch[1];
        }

        return '';
    }
}
