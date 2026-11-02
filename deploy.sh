#!/bin/bash -e
# Copies the built site to the server. Usage: ./deploy.sh [--dry-run]
#
# Only the files listed here are sent. Anything else on the server is left alone,
# and old files are only removed from inside data/ and assets/.
# parsed.csv goes too because the Readme points people to it as a download.

TARGET="cobras.hockey:docker/movies/html/"

cd "$(dirname "$0")"

if [ ! -f public/data/manifest.json ]; then
    echo "public/data is missing. Run: php build_site.php public/parsed.csv public/data" >&2
    exit 1
fi

./compress.sh public/data public/parsed.csv

options=(-rlt --chmod=Du=rwx,Dgo=rx,Fu=rw,Fgo=r --human-readable --stats)
if [ "$1" = "--dry-run" ]; then
    options+=(--dry-run --itemize-changes)
fi

# In this order, so the new page only goes live once its data is in place.
# Old data stays until the new files have arrived, for anyone loading the site meanwhile.
rsync "${options[@]}" --delete-after public/data public/assets "$TARGET"
rsync "${options[@]}" public/parsed.csv public/parsed.csv.br public/parsed.csv.gz public/.htaccess public/index.html "$TARGET"
