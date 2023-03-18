<?php
namespace exussum12\movies\tests;

use exussum12\movies\MovieFinder;
use PHPUnit\Framework\TestCase;

class MovieFinderTest extends TestCase
{
    private MovieFinder $finder;

    /** @before  */
    public function arrange()
    {
        $this->finder = new MovieFinder();
    }
    public function testIsValid()
    {
        $test = "Test Movie
        [[Category: 2000 films]]
        ";

        $this->assertTrue($this->finder->isValid($test));
    }

    public function testLocationParser()
    {
        $test = "
        [[Location A]]
        [[Location B#With A hash]]
        [[Location C|Display Name]]
        ";

        $expected = [
          'location_A',
          'location_B',
          'location_C',
        ];

        $this->assertSame($expected, $this->finder->getLocations($test));
    }

    /** @dataProvider imdb */
    public function testImdbParser(string $string, string $expected)
    {
        $this->assertSame($expected, $this->finder->getImdb($string));
    }

    public function imdb() : array
    {
        return [
            'web link' => ['https://www.imdb.com/title/tt0119707', 'tt0119707'],
            'markup link' => ['{{IMDb title|119707', 'tt119707'],
            'no match' => ['Nothing to see here', ''],
        ];
    }
}
