<?php
namespace exussum12\movies\tests;

use exussum12\movies\Imdb;
use PHPUnit\Framework\TestCase;

class ImdbTest extends TestCase
{
    public function testSetUp()
    {
        $imdb = new Imdb('tt1234', 4.0, 12345);

        $this->assertSame('tt1234', $imdb->id);
        $this->assertSame(4.0, $imdb->score);
        $this->assertSame(12345, $imdb->votes);
    }
}
