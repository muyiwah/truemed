#!/usr/bin/env bash
# Ship the API to the VPS: rsync source, install deps on the box, restart pm2.
# Usage: infra/deploy.sh            (backend/.env.production must exist locally, or .env already on the box)
set -euo pipefail
HOST=root@75.119.132.248
DIR=/root/truemed-api
NODE_BIN=/root/.nvm/versions/node/v25.2.1/bin
cd "$(dirname "$0")/.."

rsync -az --delete \
  --exclude node_modules --exclude .env --exclude .env.production --exclude data --exclude 'spikes/*.png' --exclude 'spikes/*.jpg' --exclude eval/results.json \
  backend/ "$HOST:$DIR/"
rsync -az seed/ "$HOST:/root/seed/"
if [ -f backend/.env.production ]; then scp -q backend/.env.production "$HOST:$DIR/.env"; fi

ssh "$HOST" "export PATH=$NODE_BIN:\$PATH && cd $DIR && npm ci --omit=dev --no-audit --no-fund \
  && (pm2 describe truemed-api >/dev/null 2>&1 && pm2 restart truemed-api --update-env || pm2 start src/server.js --name truemed-api) \
  && pm2 save >/dev/null"
sleep 3
ssh "$HOST" "curl -fsS http://127.0.0.1:4080/api/health" && echo
