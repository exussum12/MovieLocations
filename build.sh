#!/bin/bash -e
composer install
./vendor/bin/phpunit

php parse.php $1 $2 $3 > public/parsed.csv

# Replace the site's data as a whole, so no files survive from an older build
rm -rf public/data
php build_site.php public/parsed.csv public/data

./compress.sh public/data public/parsed.csv
