#!/bin/bash -e
composer install
./vendor/bin/phpunit

php parse.php $1 $2 > public/parsed.csv

awk -v FS='\t' -v OFS='\t' -f split_locations.awk  public/parsed.csv

find . -type f -name "*.csv" -exec sh -c "gzip -9 < {} > {}.gz" \;
find . -type f -name "*.csv" -exec sh -c "brotli -9 < {} > {}.br" \;