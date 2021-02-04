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
The website part is a static file should be able to host the
index.html, download the parsed.csv file (https://movie.exussum.co.uk/parsed.csv)
run the `split_locations.awk` file

```awk -v FS='\t' -v OFS='\t' -f split_locations.awk  public/parsed.csv```

to test locally with php use
`cd public;
php -S localhost:8080`

Then load localhost:8080 in a browser

