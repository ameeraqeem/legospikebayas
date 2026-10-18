#!/bin/zsh
# Jalankan app di Mac untuk ujian (Chrome di Mac boleh terus guna Bluetooth pada localhost).
set -e
cd "$(dirname "$0")/../web"
[ -d node_modules ] || npm install
exec npm run dev
