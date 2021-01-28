<?php
namespace exussum12\movies;

use LogicException;
use RuntimeException;
use XMLReader;

class WikiParse
{
    private string $pathToWiki;
    private XMLReader $xml;

    public function __construct(string $pathToWiki)
    {
        $this->pathToWiki = $pathToWiki;
        if (!file_exists($pathToWiki)) {
            throw new RuntimeException("Invalid wiki file passed");
        }
        $this->reset($pathToWiki);
    }

    public function reset(): void
    {
        $this->xml = new XMLReader;
        $this->xml->open($this->pathToWiki);
    }

    public function getNextArticle(): Article
    {
        $this->moveToTag('page');
        $this->moveToTag('title');
        $title = $this->xml->readString();

        $this->moveToTag('text');
        $node = $this->xml->readString();

        if (!($title && $node)) {
            throw new LogicException("Invalid article");
        }
        $article = new Article();
        $article->title = str_replace(' ', '_', $title);
        $article->node = $node;

        return $article;
    }

    private function moveToTag(string $name): void
    {
        while (($valid = $this->xml->read()) &&
            $this->xml->localName !== $name
        ) {
            continue;
        }
        if (!$valid) {
            throw new RuntimeException("End of xml");
        }
    }
}
