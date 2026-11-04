# Movie Locations

Check out the website at https://movie.exussum.co.uk

# Data
Download the data from the following locations
[Wikipedia](https://meta.wikimedia.org/wiki/Data_dump_torrents#English_Wikipedia)  
[IMDb](https://datasets.imdbws.com/)


# Running
Install via Composer 
`composer install`

then run `php parse.php /path/to/wiki.xml /path/to/imdb.tsv`

The process should take about 600MB of RAM, it takes around
25 minutes on my machine

# Website
The website is entirely static, including search: there is no server code or
search API. Host the `public` folder. To try it without running the parser,
download the parsed.csv file (https://movie.exussum.co.uk/parsed.csv) into
`public`, then generate the site's data files:

`php build_site.php public/parsed.csv public/data`

`build.sh` runs the whole process, including compressing the files. Serve the
`.br` and `.gz` copies for `.csv`, `.tsv` and `.json` requests where you can,
because they are much smaller. `public/.htaccess` does this on Apache.

`deploy.sh` copies the built site to the live server, compressing anything that
needs it first. `./deploy.sh --dry-run` lists what would change without sending
anything.

Places in `wide_areas.txt` are treated as countries and regions. They only show
on the zoomed-out map, because their marker point isn't a meaningful spot when
zoomed in. Titles in `not_places.txt` have coordinates on Wikipedia but aren't
places, such as people and newspapers, so they are left off the map. Add to
either list and rebuild.

To test locally with php use
`cd public;
php -S localhost:8080`

Then load localhost:8080 in a browser

