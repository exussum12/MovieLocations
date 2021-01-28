<?php
namespace exussum12\movies;

class LatLong
{
    public float $lat;
    public float $long;

    public function addJudder()
    {
        $valueToAdd = 3 / 3600; // 3 seconds
        $value = random_int(-10, 10) / 10;
        return ($valueToAdd * $value);
    }
}
