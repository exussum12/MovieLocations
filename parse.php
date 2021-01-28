<?php

use exussum12\movies\Article;
use exussum12\movies\Imdb;
use exussum12\movies\Location;
use exussum12\movies\LocationFinder;
use exussum12\movies\LocationMapping;
use exussum12\movies\MovieFinder;
use exussum12\movies\WikiParse;

require 'vendor/autoload.php';

if (!file_exists($argv[1])) {
    throw new RuntimeException("Please pass the wikipedia file as arg 1");
}

if (!file_exists($argv[2])) {
    throw new RuntimeException("Please pass IMDb file as arg 2");
}
$pathToWiki = $argv[1];
$wiki = new WikiParse($pathToWiki);

/** @var Article[] $locations */
$locations = [];


$location = new LocationFinder();
$locationParser = new Location();
while (true) {
    try {
        $article = $wiki->getNextArticle();
        if ($location->isValid($article->node)) {
            $article->location = $locationParser->getParsedCoords($location->parse($article->node));
            unset($article->node);
            $locations[strtolower($article->title)] = $article;
        }
    } catch (RuntimeException $e) {
        break;
    } catch (LogicException $e) {
        continue;
    }
}
$wiki->reset();
unset($location);
//load in all IMDB
/** @var Imdb[] $imdb */
$imdb = [];

$imdbFile = fopen('/tmp/data.tsv', 'r');
fgetcsv($imdbFile, 0, "\t"); //header row
while (($row = fgetcsv($imdbFile, 0, "\t")) !== false && count($row) === 3) {
    $imdb[$row[0]] = new Imdb($row[0], $row[1], $row[2]);
}

$movie = new MovieFinder();
/** @var LocationMapping[] $output */
$output = [];
while (true) {
    try {
        $article = $wiki->getNextArticle();
        if ($movie->isValid($article->node)) {
            // Check all of the locations
            $movieLocations = $movie->getLocations($article->node);
            /** @var Article[] $movieLocations */
            $movieLocations = array_intersect_key($locations, array_flip($movieLocations));
            if (count($movieLocations) === 0) {
                continue;
            }
            //get imdb mapping
            $imdbId = $movie->getImdb($article->node);
            $imdbMatch = $imdb[$imdbId] ?? null;

            foreach ($movieLocations as $location) {
                $mapping = new LocationMapping();
                $mapping->movie = $article->title;
                $mapping->location = $location->title;
                $mapping->coords = $location->location;
                if (isset($imdbMatch)) {
                    $mapping->imdbVotes = $imdbMatch->votes;
                    $mapping->imdbScore = $imdbMatch->score;
                }
                $output[] = $mapping;
            }
        }
    } catch (RuntimeException $e) {
        break;
    } catch (LogicException $e) {
        continue;
    }
}
printf("movie\tlocation\tlat\tlon\timdb\tvotes\n");
foreach ($output as $out) {
    printf(
        "%s\t%s\t%.4f\t%.4f\t%.1f\t%d\n",
        $out->movie,
        $out->location,
        $out->coords->lat + $out->coords->addJudder(),
        $out->coords->long + $out->coords->addJudder(),
        $out->imdbScore,
        $out->imdbVotes
    );
}