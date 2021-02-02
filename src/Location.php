<?php
namespace exussum12\movies;

use LogicException;

class Location
{
    public function getParsedCoords(string $coords): LatLong
    {
        $matches = [];

        if (strpos($coords, '|') === false) {
            $coords = str_replace('.', '|', $coords);
        }

        // Check the simple case first
        $parts = array_filter(explode("|", $coords));

        if (count($parts) === 2) {
            $parts['DegreesLat'] = trim($parts[0]);
            $parts['DegreesLong'] = trim($parts[1]);
            return $this->handleDMS($parts);
        }


        if (preg_match(
            "/
            (?P<DegreesLat>[-0-9.]{1,})
            (?:[|.](?P<MinutesLat>[0-9.]{1,}))?
            (?:[|.](?P<SecondsLat>[0-9.]{1,}))?
            [|. ]*
            (?P<NorthSouth>[NS])?
            [., |]*
            (?P<DegreesLong>[-0-9.]{1,})[|. ,]*
            (?:(?P<MinutesLong>[0-9.]{1,})[|.])?
            (?:(?P<SecondsLong>[0-9.]{1,}(?:\.[0-9]+)?)[|. ]*)?
            (?P<EastWest>[WE])?
            /xi",
            $coords,
            $matches
        )) {
            return $this->handleDMS($matches);
        }


        throw new LogicException("Invalid Coordinates");
    }

    private function handleDMS($matches): LatLong
    {
        if (!is_numeric($matches['DegreesLat']) || !is_numeric($matches['DegreesLong'])) {
            throw new LogicException("Invalid Coordinates");
        }

        $lat = $matches['DegreesLat'];
        if (!empty($matches['MinutesLat'])) {
            $lat += $matches['MinutesLat'] / 60;
        }
        if (!empty($matches['SecondsLat'])) {
            $lat += $matches['SecondsLat'] / 3600;
        }
        if (!empty($matches['NorthSouth'])) {

            if ($matches['NorthSouth'] === "S" || $matches['NorthSouth'] === "s") {
                $lat = -$lat;
            }
        }

        $long = $matches['DegreesLong'];
        if (!empty($matches['MinutesLong'])) {
            $long += $matches['MinutesLong'] / 60;
        }
        if (!empty($matches['SecondsLong'])) {
            $long += $matches['SecondsLong'] / 3600;
        }
        if (!empty($matches['EastWest'])) {

            if ($matches['EastWest'] === "W" || $matches['EastWest'] === "w") {
                $long = -$long;
            }
        }

        $return = new LatLong();
        $return->lat = (float) $lat;
        $return->long = (float) $long;

        return $return;
    }

}
