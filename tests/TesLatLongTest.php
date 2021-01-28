<?php
namespace exussum12\movies\tests;

use exussum12\movies\LatLong;
use PHPUnit\Framework\TestCase;

class TesLatLongTest extends TestCase
{
    public function testAddJudder()
    {
        $coord = new LatLong();

        $threeSeconds = 3/3600;
        $this->assertLessThanOrEqual($threeSeconds, $coord->addJudder());
    }
}
