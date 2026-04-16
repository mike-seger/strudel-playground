#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
strudels_dir="$root_dir/strudels"
index_file="$strudels_dir/index.js"
tmp_file="$(mktemp)"
trap 'rm -f "$tmp_file"' EXIT

{
  echo 'export const songs = ['
  find "$strudels_dir" -type f -name '*.js' ! -name 'index.js' -print |
    sed "s#^$strudels_dir/##" |
    sort |
    while IFS= read -r rel_path; do
      printf '  { path: "./%s" },\n' "$rel_path"
    done
  echo '];'
} > "$tmp_file"

mv "$tmp_file" "$index_file"

echo "Regenerated $index_file"
