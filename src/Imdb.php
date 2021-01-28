<?php


namespace exussum12\movies;

class Imdb
{
    public float $score;
    public int $votes;
    public string $id;
    public function __construct(string $id, float $score, int $votes)
    {
        $this->id = $id;
        $this->score = $score;
        $this->votes = $votes;
    }
}
