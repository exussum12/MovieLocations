<?php
namespace exussum12\movies\tests;

use exussum12\movies\SiteBuilder;
use PHPUnit\Framework\TestCase;

class SiteBuilderTest extends TestCase
{
    private string $directory;

    protected function setUp(): void
    {
        $this->directory = sys_get_temp_dir() . '/site-builder-' . uniqid();
        mkdir($this->directory);
        file_put_contents($this->directory . '/input.csv', implode("\n", [
            "movie\tlocation\tlat\tlon\tscore\tvotes\timdb",
            "Obscure\tHatfield_House\t51.7610\t-0.2090\t0.0\t0\t",
            "Batman_(1989_film)\tHatfield_House\t51.7606\t-0.2086\t7.5\t383773\ttt0096895",
            "Batman_(1989_film)\tEngland\t51.5000\t-0.1000\t7.5\t383773\ttt0096895",
            "Nowhere\tNull_Island\t0.0000\t0.0000\t5.0\t10\ttt1",
            "Batman_(1989_film)\tHatfield_House\t51.7608\t-0.2088\t7.5\t383773\ttt0096895",
            "",
        ]));
    }

    protected function tearDown(): void
    {
        exec('rm -rf ' . escapeshellarg($this->directory));
    }

    private function build(): array
    {
        return (new SiteBuilder(
            $this->directory . '/input.csv',
            $this->directory . '/out',
            ['England']
        ))->build();
    }

    private function json(string $path): array
    {
        return json_decode(file_get_contents($this->directory . '/out/' . $path), true);
    }

    public function testStaggeredCoordinatesAreAveragedIntoOnePlace(): void
    {
        $this->build();

        $cell = $this->json('cells/51/-1.json');
        $place = array_values(array_filter($cell, fn ($row) => $row[0] === 'Hatfield_House'))[0];

        $this->assertSame(51.7608, $place[1]);
        $this->assertSame(-0.2088, $place[2]);
    }

    public function testRepeatedLinksCountOnce(): void
    {
        $stats = $this->build();

        $this->assertSame(3, $stats['links']);
        $this->assertSame(2, $stats['films']);
        $this->assertSame(2, $stats['places']);
    }

    public function testRowsWithoutCoordinatesAreDropped(): void
    {
        $this->build();

        $this->assertStringNotContainsString('Null_Island', file_get_contents($this->directory . '/out/places.tsv'));
        $this->assertStringNotContainsString('Nowhere', file_get_contents($this->directory . '/out/films.tsv'));
    }

    public function testTitlesThatAreNotPlacesAreLeftOut(): void
    {
        $stats = (new SiteBuilder(
            $this->directory . '/input.csv',
            $this->directory . '/out',
            [],
            ['England']
        ))->build();

        $this->assertSame(1, $stats['places']);
        $this->assertStringNotContainsString('England', file_get_contents($this->directory . '/out/places.tsv'));
    }

    public function testFilmsWithoutImdbHaveNoScore(): void
    {
        $this->build();

        $films = $this->json('details/51/-1.json')['Hatfield_House'];

        $this->assertSame(['Batman_(1989_film)', 7.5, 383773, 'tt0096895'], $films[0]);
        $this->assertSame(['Obscure', null, null, ''], $films[1]);
    }

    public function testCellSummaryCarriesCountsButNoFilmLists(): void
    {
        $this->build();

        $cell = $this->json('cells/51/-1.json');
        $place = array_values(array_filter($cell, fn ($row) => $row[0] === 'Hatfield_House'))[0];

        $this->assertSame(['Hatfield_House', 51.7608, -0.2088, 0, 2, ['Batman_(1989_film)', 'Obscure']], $place);
    }

    public function testWideAreasAreMarkedAndLeftOutOfLocalCounts(): void
    {
        $this->build();

        $this->assertSame([51, -1, 2], $this->json('manifest.json')['cells']);

        $overview = $this->json('overview.json');
        $this->assertSame([['England', 51.5, -0.1, 1]], $overview['areas']);
        $this->assertSame([[51, -1, 'Hatfield_House', 51.7608, -0.2088, 2]], $overview['tops']);
    }

    public function testFilmShardFollowsItsPositionInTheIndex(): void
    {
        $this->build();

        $titles = array_map(
            fn ($line) => explode("\t", $line)[0],
            file($this->directory . '/out/films.tsv', FILE_IGNORE_NEW_LINES)
        );
        $this->assertSame('Batman_(1989_film)', $titles[0]);

        $shard = $this->json('films/0.json');
        $this->assertCount(2, $shard['Batman_(1989_film)']);
    }
}
