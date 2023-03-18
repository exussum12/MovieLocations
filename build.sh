#!/bin/bash -e
composer install
./vendor/bin/phpunit

php parse.php $1 $2 $3 > public/parsed.csv
mkdir -p -- public/out/{-90..90}
awk -v FS='\t' -v OFS='\t' -f split_locations.awk  public/parsed.csv

find . -type f -name "*.csv" -exec sh -c "gzip -9 < {} > {}.gz" \;
find . -type f -name "*.csv" -exec sh -c "brotli  < {} > {}.br" \;
