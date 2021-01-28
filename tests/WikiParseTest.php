<?php
namespace exussum12\movies\tests;

use Exception;
use exussum12\movies\WikiParse;
use PHPUnit\Framework\TestCase;
use RuntimeException;

class WikiParseTest extends TestCase
{
    public function testParse()
    {
        $wiki = new WikiParse(__DIR__ . '/fixtures/example.xml');
        $pageTitles = [];
        try {
            while ($article = $wiki->getNextArticle()) {
                $pageTitles[] = $article->title;
            }
        } catch (Exception $e) {
            // not needed.
        }
        $expected = [
            'Mortal_Kombat:_Annihilation',
            'Parys_Mountain',
            'Anglesey',
        ];

        $this->assertSame($expected, $pageTitles);
    }

    public function testInvalidFile()
    {
        $this->expectException(RuntimeException::class);
        new WikiParse('doesntExist');
    }
}
