<?php
namespace exussum12\movies\tests;

use exussum12\movies\LatLong;
use exussum12\movies\Location;
use LogicException;
use PHPUnit\Framework\TestCase;

class LocationTest extends TestCase
{
    private Location $location;

    /** @before */
    public function setUpLocation()
    {
        $this->location = new Location();
    }

    public function testLocationParse()
    {
        $expected = new LatLong();
        $expected->lat = -59.356811;
        $expected->long = -18.019286;
        $this->assertEqualsLocation(
            $expected,
            $this->location->getParsedCoords('{{Coord|59|21|24.52|S|18|1|9.43|W|region:SE_type:landmark}}')
        );
    }

    public function testNegativeLocationParse()
    {
        $expected = new LatLong();
        $expected->lat = -15.821;
        $expected->long = -47.94;
        $this->assertEqualsLocation(
            $expected,
            $this->location->getParsedCoords('{{coord|-15.821|-47.94|type:landmark_region:BR|display=title}}')
        );
    }

    public function testDecimalDM()
    {
        $expected = new LatLong();
        $expected->lat = 49.898498;
        $expected->long = 8.675487;
        $this->assertEqualsLocation(
            $expected,
            $this->location->getParsedCoords('{{coord|49.898498 |8.675487 |display=title|format=dms}}')
        );
    }

    public function testDecimalDMWithDirection()
    {
        $expected = new LatLong();
        $expected->lat = -67.568417;
        $expected->long = -68.125796;
        $this->assertEqualsLocation(
            $expected,
            $this->location->getParsedCoords('{coord|67.568417|S|68.125796|W|format=dms|region:AQ}}')
        );
    }

    public function testHandleDM()
    {
        $expected = new LatLong();
        $expected->lat = -49.5833;
        $expected->long = -11.0166;
        $this->assertEqualsLocation(
            $expected,
            $this->location->getParsedCoords('{{coord|49|35|S|11|1|W|format=dms|display=inline,title}}')
        );
    }

    public function testHandleDMSDecimalS()
    {
        $expected = new LatLong();
        $expected->lat = 19.8873;
        $expected->long = -71.0804;
        $this->assertEqualsLocation(
            $expected,
            $this->location->getParsedCoords('{{coord|19|53|14.40|N|71|04|49.50|W|')
        );
    }
    public function testHandleDecimalWithDots()
    {
        $expected = new LatLong();
        $expected->lat = 53.3822;
        $expected->long = -4.3525;
        $this->assertEqualsLocation(
            $expected,
            $this->location->getParsedCoords('53.22.56 N, 4.21.9 W')
        );
    }
    /** @dataProvider locations */
    public function testSuccessfulParse($string, $expectedLat, $expectedLong)
    {
        $expected = new LatLong();
        $expected->lat = $expectedLat;
        $expected->long = $expectedLong;
        $this->assertEqualsLocation(
            $expected,
            $this->location->getParsedCoords($string)
        );
    }

    public function locations() : array
    {
        return [
            ['{{coord|52.204|N|0.112|E|}}', 52.204, 0.112],
            ['{{coord|57|0|N|5|41.5|W|', 57, -5.6916],
            ['61.2683|5.3250 |', 61.2683, 5.3250],
        ];
    }

    public function testInvalid()
    {
        $this->expectException(LogicException::class);
        $this->location->getParsedCoords('Nothing here');
    }

    public function testMoreInvalid()
    {

        $this->expectException(LogicException::class);
        $this->location->getParsedCoords(' missing|Georgia (U.S. state)}}');
    }


    public function assertEqualsLocation(LatLong $expected, LatLong $actual)
    {
        $this->assertEqualsWithDelta($expected->lat, $actual->lat, 0.0001);
        $this->assertEqualsWithDelta($expected->long, $actual->long, 0.0001);
    }
}
