<?php
namespace exussum12\movies;

use Exception;
use LogicException;

class LocationFinder
{

    public function isValid($node): bool
    {
        return stripos($node, 'coordinates =')  !== false || stripos($node, '{{coord') !== false;
    }

    public function parse($node): string
    {

        if (preg_match('/{{coord(.*)/i', $node, $matches) && $matches[1] !== '') {
            return $matches[1];
        }

        $matches = [];
        if (preg_match('/coordinates =(.*)/i', $node, $matches) && $matches[1] !== '') {
            return $matches[1];
        }

        throw new LogicException('Possibly Invalid Wiki article');
    }
}
