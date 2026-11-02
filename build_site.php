<?php

use exussum12\movies\SiteBuilder;

require 'vendor/autoload.php';

$input = $argv[1] ?? 'public/parsed.csv';
$output = $argv[2] ?? 'public/data';

$wideAreas = file(__DIR__ . '/wide_areas.txt', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
$notPlaces = file(__DIR__ . '/not_places.txt', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
$stats = (new SiteBuilder($input, $output, $wideAreas, $notPlaces))->build();

printf(
    "Built %d films, %d places and %d links into %d cells in %s\n",
    $stats['films'],
    $stats['places'],
    $stats['links'],
    $stats['cells'],
    $output
);
