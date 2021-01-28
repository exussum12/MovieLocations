<?php
namespace exussum12\movies;

class Location
{
    public function getParsedCoords($coords): LatLong
    {
        $matches = [];

        if (preg_match(
            '/([0-9]{1,3})\|([0-9]{1,3})\|([0-9]{1,3}(?:\.[0-9]+)?).([N|S])' .
            '.*?([0-9]{1,3})\|([0-9]{1,3})\|([0-9]{1,3}(?:\.[0-9]+)?)\|([W|E])/i',
            $coords,
            $matches
        )) {
            return $this->handleDMS($matches);
        }

        if (preg_match(
            '/([0-9]{1,3}) *\|([0-9]{1,3}) *\| *([N|S]) *' .
            '\| *([0-9]{1,3}) *\| *([0-9]{1,3}) *\| *([W|E] *)/i',
            $coords,
            $matches
        )
        ) {
            return $this->handleDM($matches);
        }

        if (preg_match(
            '/([0-9.]+) *\|([N|S])\| *([0-9.]+) *\| *([W|E])/i',
            $coords,
            $matches
        )
        ) {
            return $this->handleDecimalDM($matches);
        }


        if (preg_match(
            '/(-?[0-9.]+) *\| *(-?[0-9.]+) */',
            $coords,
            $matches
        )
        ) {
            return $this->handleDecimal($matches);
        }

        throw new \LogicException("Invalid Coordinates");
    }



    private function handleDMS($matches): LatLong
    {
        $lat = $matches[1];
        $lat += $matches[2] / 60;
        $lat += $matches[3] / 3600;
        if ($matches[4] === "S" || $matches[4] === "s") {
            $lat = -$lat;
        }

        $long = $matches[5];
        $long += $matches[6] / 60;
        $long += $matches[7] / 3600;
        if ($matches[8] === "W" || $matches[8] === "w") {
            $long = -$long;
        }

        $return = new LatLong();
        $return->lat = (float) $lat;
        $return->long = (float) $long;

        return $return;
    }

    /**
     * @param $matches
     * @return LatLong
     */
    private function handleDM($matches): LatLong
    {
        $lat = $matches[1];
        $lat += $matches[2] / 60;
        if ($matches[3] === "S" || $matches[3] === "s") {
            $lat = -$lat;
        }

        $long = $matches[4];
        $long += $matches[5] / 60;
        if ($matches[6] === "W" || $matches[6] === "w") {
            $long = -$long;
        }

        $return = new LatLong();
        $return->lat = (float) $lat;
        $return->long = (float) $long;

        return $return;
    }

    /**
     * @param $matches
     * @return LatLong
     */
    private function handleDecimalDM($matches): LatLong
    {
        $lat = $matches[1];
        if ($matches[2] === "S" || $matches[2] === "s") {
            $lat = -$lat;
        }

        $long = $matches[3];
        if ($matches[4] === "W" || $matches[4] === "w") {
            $long = -$long;
        }

        $return = new LatLong();
        $return->lat = (float) $lat;
        $return->long = (float) $long;

        return $return;
    }

    /**
     * @param array $matches
     * @return LatLong
     */
    private function handleDecimal(array $matches): LatLong
    {
        [,$lat, $long] = $matches;

        $return = new LatLong();
        $return->lat = (float) $lat;
        $return->long = (float) $long;

        return $return;
    }
}
