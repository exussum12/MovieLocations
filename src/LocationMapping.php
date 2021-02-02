<?php
namespace exussum12\movies;

class LocationMapping
{
    public string $location;
    public string $movie;
    public float $imdbScore = 0;
    public int $imdbVotes = 0;
    public string $imdbId = '';
    public LatLong $coords;
}
