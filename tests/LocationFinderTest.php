<?php
namespace exussum12\movies\tests;

use exussum12\movies\LocationFinder;
use LogicException;
use PHPUnit\Framework\TestCase;

class LocationFinderTest extends TestCase
{
    public function testIsValid()
    {
        $location = new LocationFinder();

        $this->assertTrue($location->isValid('{{coord|59|57|50|N| 10|47|05|E|'));
    }

    public function testParse()
    {
        $location = new LocationFinder();

        $this->assertSame(
            '|59|57|50|N| 10|47|05|E|',
            $location->parse('{{coord|59|57|50|N| 10|47|05|E|')
        );

        $this->assertSame(
            ' (51.993599, -0.212664)',
            $location->parse('coordinates = (51.993599, -0.212664)')
        );
    }

    public function testInvalid()
    {
        $this->expectException(LogicException::class);

        $location = new LocationFinder();
        $location->parse('something bad here');
    }
}
