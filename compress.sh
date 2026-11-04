#!/bin/bash -e
# Precompresses data files for the server to send as they are.
# Only touches files changed since they were last compressed, so reruns are quick.
# Usage: ./compress.sh path [path...]

find "$@" -type f \( -name "*.csv" -o -name "*.tsv" -o -name "*.json" \) -print0 | while IFS= read -r -d '' file; do
    if [ "$file" -nt "$file.gz" ] || [ ! -e "$file.gz" ]; then
        gzip -9 < "$file" > "$file.gz"
    fi
    if [ "$file" -nt "$file.br" ] || [ ! -e "$file.br" ]; then
        brotli < "$file" > "$file.br"
    fi
done
